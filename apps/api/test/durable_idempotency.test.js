// apps/api/test/durable_idempotency.test.js
//
// Test Suite for Durable Idempotency (Section D requirements):
// 1. Persist principal-scoped key, normalized request hash, execution state, result/receipt, timestamps
// 2. Concurrency safety & simultaneous requests mutual exclusion
// 3. Process restart recovery
// 4. Multiple instances sharing the database
// 5. Payload mismatch rejection (422)
// 6. Failed charging recovery & safe retry
// 7. Mid-flight crash recovery (expired lease takeover)

import { expect } from 'chai';
import pg from 'pg';
import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';
import {
  DurableIdempotencyStore,
  IdempotencyPayloadMismatchError,
  IdempotencyConflictError,
} from '../src/trading/durable_idempotency.js';
import { ensureTradingIdempotencySchema } from '../src/trading/idempotency_schema.mjs';
import { createTradingSimulationRouter } from '../src/routes/trading_simulation_route.js';

const TEST_DSN = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql:///satelink_test?host=/tmp';

async function tryConnect() {
  try {
    const pool = new pg.Pool({ connectionString: TEST_DSN, max: 5 });
    await pool.query('SELECT 1');
    return pool;
  } catch {
    return null;
  }
}

describe('Durable Idempotency Engine (PostgreSQL & Multi-Instance)', function () {
  this.timeout(10000);

  let pool;
  let hasRealPg = false;

  before(async () => {
    pool = await tryConnect();
    if (pool) {
      hasRealPg = true;
      await ensureTradingIdempotencySchema(pool);
    }
  });

  after(async () => {
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(async () => {
    if (hasRealPg && pool) {
      await pool.query('DELETE FROM trading_idempotency');
    }
  });

  describe('1. Simultaneous Requests & Mutual Exclusion', () => {
    it('concurrent callers for the same key coalesce into a single execution', async () => {
      const store = new DurableIdempotencyStore(pool);
      let execCount = 0;
      const key = `simul-test-${Date.now()}`;
      const payloadHash = 'hash-alpha-1';

      // Launch 5 simultaneous requests
      const promises = Array.from({ length: 5 }, () =>
        store.run(key, { payloadHash, principalId: 'kref_test_001', timeoutMs: 5000 }, async () => {
          execCount++;
          await new Promise((r) => setTimeout(r, 50));
          return { response: { status: 'COMPLETED', tradeId: 101 }, receiptRef: 'rec_101' };
        })
      );

      const results = await Promise.all(promises);

      // Exactly one execution executed fresh
      expect(execCount).to.equal(1);
      const freshResults = results.filter((r) => r.fresh);
      const replayResults = results.filter((r) => !r.fresh);

      expect(freshResults.length).to.equal(1);
      expect(replayResults.length).to.equal(4);

      // All returned the identical response and receipt
      for (const res of results) {
        expect(res.value.response.status).to.equal('COMPLETED');
        expect(res.value.response.tradeId).to.equal(101);
      }
    });
  });

  describe('2. Process-Restart Recovery', () => {
    it('restores persisted state across simulated process restarts without re-executing', async () => {
      const key = `restart-test-${Date.now()}`;
      const payloadHash = 'hash-restart-100';

      // Process 1: run and persist
      const sharedMem = !pool ? new Map() : undefined;
      let proc1Execs = 0;
      const store1 = new DurableIdempotencyStore(pool, { memoryStore: sharedMem });
      const res1 = await store1.run(
        key,
        { payloadHash, principalId: 'kref_proc_1', timeoutMs: 5000 },
        async () => {
          proc1Execs++;
          return { response: { status: 'PERSISTED_OK', balance: 500 }, receiptRef: 'rec_restart_1' };
        }
      );

      expect(proc1Execs).to.equal(1);
      expect(res1.fresh).to.equal(true);

      // "Restart": completely drop store1 and instantiate store2 from the same database
      const store2 = new DurableIdempotencyStore(pool, { memoryStore: sharedMem });
      let proc2Execs = 0;

      const res2 = await store2.run(
        key,
        { payloadHash, principalId: 'kref_proc_1', timeoutMs: 5000 },
        async () => {
          proc2Execs++;
          return { response: { status: 'SHOULD_NOT_RUN' }, receiptRef: 'rec_bad' };
        }
      );

      // Zero execution in process 2
      expect(proc2Execs).to.equal(0);
      expect(res2.fresh).to.equal(false);
      expect(res2.value.response.status).to.equal('PERSISTED_OK');
      expect(res2.value.response.balance).to.equal(500);
      expect(res2.value.receiptRef).to.equal('rec_restart_1');
    });
  });

  describe('3. Multiple Instances Sharing Database', () => {
    it('instance B recognizes completed state executed by instance A', async () => {
      const sharedMem = !pool ? new Map() : undefined;
      const storeA = new DurableIdempotencyStore(pool, { memoryStore: sharedMem });
      const storeB = new DurableIdempotencyStore(pool, { memoryStore: sharedMem });

      const key = `multi-instance-${Date.now()}`;
      const payloadHash = 'hash-multi-inst';

      let execA = 0;
      let execB = 0;

      // Instance A executes
      const resA = await storeA.run(
        key,
        { payloadHash, principalId: 'kref_user_a', timeoutMs: 5000 },
        async () => {
          execA++;
          return { response: { node: 'node-A-completed' }, receiptRef: 'rec_node_A' };
        }
      );

      expect(execA).to.equal(1);
      expect(resA.fresh).to.equal(true);

      // Instance B receives retry request with the same key
      const resB = await storeB.run(
        key,
        { payloadHash, principalId: 'kref_user_a', timeoutMs: 5000 },
        async () => {
          execB++;
          return { response: { node: 'node-B' } };
        }
      );

      expect(execB).to.equal(0);
      expect(resB.fresh).to.equal(false);
      expect(resB.value.response.node).to.equal('node-A-completed');
      expect(resB.value.receiptRef).to.equal('rec_node_A');
    });
  });

  describe('4. Payload Mismatch Rejection', () => {
    it('rejects reusing an idempotency key with a different payload hash (HTTP 422)', async () => {
      const store = new DurableIdempotencyStore(pool);
      const key = `payload-mismatch-${Date.now()}`;

      // First run with payload A
      await store.run(
        key,
        { payloadHash: 'hash-version-A', principalId: 'kref_mismatch' },
        async () => ({ response: { ok: true } })
      );

      // Second run with payload B
      let caught = null;
      try {
        await store.run(
          key,
          { payloadHash: 'hash-version-B-DIFFERENT', principalId: 'kref_mismatch' },
          async () => ({ response: { ok: true } })
        );
      } catch (err) {
        caught = err;
      }

      expect(caught).to.be.an.instanceOf(IdempotencyPayloadMismatchError);
      expect(caught.code).to.equal('idempotency_payload_mismatch');
      expect(caught.http).to.equal(422);
    });
  });

  describe('5. Failed Charging & Error Recovery', () => {
    it('transitions to failed on error and allows safe retry without burning key or duplicate charge', async () => {
      const store = new DurableIdempotencyStore(pool);
      const key = `fail-recover-${Date.now()}`;
      const payloadHash = 'hash-fail-rec';

      let attempt = 0;

      // Attempt 1 fails (e.g., billing insufficient credits)
      try {
        await store.run(
          key,
          { payloadHash, principalId: 'kref_retry' },
          async () => {
            attempt++;
            const err = new Error('insufficient_credits');
            err.code = 'insufficient_credits';
            throw err;
          }
        );
      } catch (e) {
        expect(e.message).to.equal('insufficient_credits');
      }

      expect(attempt).to.equal(1);

      // Verify DB record is marked failed
      const recordAfterFail = await store.get(key);
      expect(recordAfterFail.state).to.equal('failed');
      expect(recordAfterFail.error).to.include('insufficient_credits');

      // Attempt 2 with same key succeeds after user funds credits
      const res2 = await store.run(
        key,
        { payloadHash, principalId: 'kref_retry' },
        async () => {
          attempt++;
          return { response: { funded: true, billed: 0.05 }, receiptRef: 'rec_funded_1' };
        }
      );

      expect(attempt).to.equal(2);
      expect(res2.fresh).to.equal(true);
      expect(res2.value.response.funded).to.equal(true);

      // Verify DB record is now marked succeeded
      const recordAfterSuccess = await store.get(key);
      expect(recordAfterSuccess.state).to.equal('succeeded');
      expect(recordAfterSuccess.receipt_ref).to.equal('rec_funded_1');
    });
  });

  describe('6. Recovery After Mid-Flight Crash (Expired Lease Takeover)', () => {
    it('blocks callers while lease is active, then safely takes over when lease expires', async () => {
      let virtualTime = 1_000_000;
      const clock = () => virtualTime;

      const store1 = new DurableIdempotencyStore(pool, { now: clock });
      const store2 = new DurableIdempotencyStore(pool, { now: clock });

      const key = `crash-recover-${Date.now()}`;
      const payloadHash = 'hash-crash-rec';

      // Store 1 inserts a pending record with 2000ms lease
      const lockedUntil = new Date(virtualTime + 2000);
      if (pool) {
        await pool.query(
          `INSERT INTO trading_idempotency (key, principal_id, action, payload_hash, state, locked_until, created_at, updated_at)
           VALUES ($1, 'kref_crashed', 'paper_simulation', $2, 'pending', $3, NOW(), NOW())`,
          [key, payloadHash, lockedUntil]
        );
      } else {
        store2._memoryStore.set(key, {
          key,
          principal_id: 'kref_crashed',
          action: 'paper_simulation',
          payload_hash: payloadHash,
          state: 'pending',
          locked_until: lockedUntil,
          created_at: new Date(virtualTime),
          updated_at: new Date(virtualTime),
        });
      }

      // Case A: Call while lease is still active -> 409 Conflict
      virtualTime += 500; // time = 1_000_500 < 1_002_000
      let activeConflict = null;
      try {
        await store2.run(
          key,
          { payloadHash, principalId: 'kref_crashed', timeoutMs: 2000 },
          async () => ({ response: { ok: true } })
        );
      } catch (err) {
        activeConflict = err;
      }

      expect(activeConflict).to.be.an.instanceOf(IdempotencyConflictError);
      expect(activeConflict.code).to.equal('idempotency_in_progress');
      expect(activeConflict.http).to.equal(409);

      // Case B: Time advances past lease expiration (process is presumed crashed)
      virtualTime += 2500; // time = 1_003_000 > 1_002_000 (lease expired)

      let recoveryExecRan = false;
      const recoveryResult = await store2.run(
        key,
        { payloadHash, principalId: 'kref_crashed', timeoutMs: 5000 },
        async () => {
          recoveryExecRan = true;
          return { response: { status: 'CRASH_RECOVERED' }, receiptRef: 'rec_recovered_1' };
        }
      );

      expect(recoveryExecRan).to.equal(true);
      expect(recoveryResult.fresh).to.equal(true);
      expect(recoveryResult.value.response.status).to.equal('CRASH_RECOVERED');

      // State is now succeeded in DB
      const finalRow = await store2.get(key);
      expect(finalRow.state).to.equal('succeeded');
      expect(finalRow.receipt_ref).to.equal('rec_recovered_1');
    });
  });

  describe('7. End-to-End Express API with Durable Idempotency', () => {
    it('POST /v1/trading/paper/simulate handles idempotency conflicts and replays seamlessly', async () => {
      // Mock pool with billing capabilities
      const activeAccount = {
        api_key: 'sk_pro_durable_test_key_001',
        tier: 'pro',
        status: 'active',
        daily_limit: 10000,
        credits: 10.0,
      };

      const mockDb = {
        accounts: { [activeAccount.api_key]: activeAccount },
        async query(sql, params = []) {
          const s = sql.replace(/\s+/g, ' ').trim();
          if (s.includes('FROM api_credits WHERE api_key')) {
            const acc = this.accounts[params[0]];
            return { rows: acc ? [{ ...acc, credits_usdt: acc.credits }] : [] };
          }
          if (s.includes('FROM api_usage_daily')) {
            return { rows: [{ request_count: 0 }] };
          }
          if (s.startsWith('UPDATE api_credits SET credits_usdt = credits_usdt -')) {
            const cost = Number(params[0]);
            const acc = this.accounts[params[1]];
            if (acc && acc.credits >= cost) {
              acc.credits -= cost;
              return { rowCount: 1, rows: [{ credits_usdt: acc.credits }] };
            }
            return { rowCount: 0, rows: [] };
          }
          if (s.startsWith('INSERT INTO api_usage_daily') || s.startsWith('INSERT INTO revenue_events_v2')) {
            return { rows: [], rowCount: 1 };
          }
          if (pool) {
            return pool.query(sql, params);
          }
          return { rows: [] };
        },
      };

      const durableStore = new DurableIdempotencyStore(pool);
      const app = express();
      app.use(express.json());
      app.use(
        '/v1/trading',
        createTradingSimulationRouter(mockDb, {
          idempotencyStore: durableStore,
          runSimulationFn: async () => ({
            workflowId: 'WF-E2E-DURABLE',
            executedAt: new Date().toISOString(),
            performance: { status: 'COMPLETED', summary: 'E2E durable test' },
          }),
        })
      );

      const idemKey = `e2e-api-key-${Date.now()}`;

      // 1. Initial Request -> 200, Billed $0.05
      const res1 = await request(app)
        .post('/v1/trading/paper/simulate')
        .set('x-api-key', activeAccount.api_key)
        .send({ idempotencyKey: idemKey, instrumentId: 'BINANCE:BTCUSDT' });

      expect(res1.status).to.equal(200);
      expect(res1.body.billed_usdt).to.equal(0.05);
      expect(res1.body.idempotent_replay).to.be.undefined;
      expect(mockDb.accounts[activeAccount.api_key].credits).to.be.closeTo(9.95, 0.0001);

      // 2. Replay with identical payload -> 200, idempotent_replay: true, zero additional deduction
      const res2 = await request(app)
        .post('/v1/trading/paper/simulate')
        .set('x-api-key', activeAccount.api_key)
        .send({ idempotencyKey: idemKey, instrumentId: 'BINANCE:BTCUSDT' });

      expect(res2.status).to.equal(200);
      expect(res2.body.idempotent_replay).to.equal(true);
      expect(mockDb.accounts[activeAccount.api_key].credits).to.be.closeTo(9.95, 0.0001);

      // 3. Replay with different instrumentId (payload mismatch) -> 422 idempotency_payload_mismatch
      const res3 = await request(app)
        .post('/v1/trading/paper/simulate')
        .set('x-api-key', activeAccount.api_key)
        .send({ idempotencyKey: idemKey, instrumentId: 'NSE:NIFTY50' });

      expect(res3.status).to.equal(422);
      expect(res3.body.error).to.equal('idempotency_payload_mismatch');
      expect(mockDb.accounts[activeAccount.api_key].credits).to.be.closeTo(9.95, 0.0001);
    });
  });
});
