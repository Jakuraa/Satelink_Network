// apps/api/test/trading_simulation.test.js
//
// Satelink Multi-Market Trading AI — Metered Paper-Trading Simulation Endpoint Tests
// Verifies:
//   - Discovery surface (GET /v1/trading/paper/simulate)
//   - Authentication (402 when missing, 401 when unknown, 403 when inactive)
//   - Input validation (422 for missing idempotencyKey, unsupported instruments/strategies)
//   - Financial OS credit gating (402 for insufficient credits, zero deduction)
//   - Successful metered run ($0.05 deducted, revenue logged, simulation report returned)
//   - Mandatory simulation disclaimer (SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS)
//   - Safe idempotency: replay returns identical result, ZERO double charge
//   - Failure isolation: simulation failure results in 503 and NO deduction

import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import {
  createTradingSimulationRouter,
  getSimulationPriceUsdt,
  SIMULATION_DISCLAIMER,
  ALLOWED_INSTRUMENTS,
} from '../src/routes/trading_simulation_route.js';
import { IdempotencyStore } from '../src/vnext/kernel/idempotency.js';

const TEST_API_KEY = 'sk_trading_test_key_001';

function mockPool({ account, credits = 5.0, accounts, rejectQuery } = {}) {
  const accountsMap = accounts
    ? { ...accounts }
    : account
      ? { [account.api_key || TEST_API_KEY]: { ...account, credits } }
      : {};
  const state = { credits, revenueInserts: [], usageInserts: [], chargeCount: 0 };
  const pool = {
    state,
    accountsMap,
    async query(sql, params = []) {
      if (rejectQuery) throw new Error('Postgres connection failed');
      const s = sql.replace(/\s+/g, ' ').trim();

      // Account lookup
      if (s.includes('FROM api_credits WHERE api_key')) {
        const keyParam = params[0];
        const acc = accountsMap[keyParam];
        if (acc) {
          return { rows: [{ ...acc, credits_usdt: acc.credits }] };
        }
        return { rows: [] };
      }

      // Daily limit count
      if (s.includes('FROM api_usage_daily WHERE api_key')) {
        return { rows: [{ request_count: 0 }] };
      }

      // Atomic balance deduction
      if (s.startsWith('UPDATE api_credits SET credits_usdt = credits_usdt -')) {
        const cost = Number(params[0]);
        const keyParam = params[1];
        const acc = accountsMap[keyParam];
        if (acc && acc.credits >= cost) {
          acc.credits -= cost;
          state.credits = acc.credits;
          state.chargeCount++;
          acc.chargeCount = (acc.chargeCount || 0) + 1;
          return { rowCount: 1, rows: [{ credits_usdt: acc.credits }] };
        }
        return { rowCount: 0, rows: [] };
      }

      // Usage bump
      if (s.startsWith('INSERT INTO api_usage_daily')) {
        state.usageInserts.push(params);
        return { rows: [], rowCount: 1 };
      }

      // Revenue logging
      if (s.startsWith('INSERT INTO revenue_events_v2')) {
        state.revenueInserts.push(params);
        return { rows: [], rowCount: 1 };
      }

      return { rows: [] };
    },
  };
  return pool;
}

const MOCK_EXEC_REPORT = {
  workflowId: 'WF-PAPER-1-1700000000000',
  executedAt: new Date(1700000000000).toISOString(),
  disclaimer: SIMULATION_DISCLAIMER,
  instrumentId: 'BINANCE:BTCUSDT',
  marketDataValidation: {
    valid: true,
    source: 'paper',
    eventTs: new Date(1700000000000).toISOString(),
    retrievalTs: new Date(1700000000000).toISOString(),
    dataAgeSec: 0,
    freshness: 'LIVE',
    licensingValid: true,
  },
  strategyBaseline: {
    version: '1.0.0',
    signal: 'BUY',
    confidence: 0.85,
    rationale: 'Fast SMA crossed above Slow SMA',
  },
  modelProposal: {
    model: 'satelink-sie-openrouter',
    signal: 'BUY',
    confidence: 0.88,
    rationale: 'Moving average crossover indicates positive momentum.',
    risks: ['Intraday price volatility'],
  },
  consensus: {
    agreesWithBaseline: true,
    finalIntentSide: 'BUY',
  },
  riskAuthorization: {
    authorized: true,
    policyVersion: '1.0.0',
    evaluatedAt: new Date(1700000000000).toISOString(),
    passed: [
      'G1_PRINCIPAL',
      'G2_TRADING_AUTH',
      'G3_ACCOUNT_ELIGIBLE',
      'G4_DATA_FRESH',
      'G5_INSTRUMENT_APPROVED',
      'G6_FUNDS',
      'G7_POSITION_LIMIT',
      'G8_DAILY_LOSS',
      'G9_DUPLICATE',
      'G10_KILL_SWITCH',
    ],
    failedGate: null,
    reason: null,
  },
  orderExecution: {
    submitted: true,
    orderId: 'PAPER-1-1700000000000',
    idempotencyKey: 'idem-test-1',
    status: 'FILLED',
    filledPriceMinor: '6500000',
    filledQuantity: 1,
  },
  financialSettlement: {
    settled: true,
    receiptId: 'RCPT-1-1700000000000',
    notionalMinor: '6500000',
    platformFeeMinor: '650',
    exchangeFeeMinor: '0',
    remainingCustomerCapitalMinor: '99349350',
    satelinkRevenueBalanceMinor: '650',
  },
  performance: {
    status: 'FILLED',
    summary: 'Order filled at simulated price 65000.00',
  },
};

function buildTestApp(pool, overrides = {}) {
  const app = express();
  app.use(express.json());
  const router = createTradingSimulationRouter(pool, {
    runSimulationFn: async () => MOCK_EXEC_REPORT,
    now: () => 1700000000000,
    ...overrides,
  });
  app.use('/v1/trading', router);
  return app;
}

const ACTIVE_ACCOUNT = {
  api_key: TEST_API_KEY,
  wallet_address: '0x1111111111111111111111111111111111111111',
  tier: 'basic',
  daily_limit: 10000,
  status: 'active',
  payment_hold: false,
  dodo_funded_usdt: 0,
};

describe('Trading Simulation API — POST /v1/trading/paper/simulate', () => {
  it('GET /v1/trading/paper/simulate provides free discovery with price and disclaimer', async () => {
    const pool = mockPool();
    const app = buildTestApp(pool);
    const res = await request(app).get('/v1/trading/paper/simulate');

    expect(res.status).to.equal(200);
    expect(res.body.ok).to.equal(true);
    expect(res.body.price_usdt).to.equal(0.05);
    expect(res.body.currency).to.equal('USDT');
    expect(res.body.disclaimer).to.equal(SIMULATION_DISCLAIMER);
    expect(res.body.supported_instruments).to.deep.equal(ALLOWED_INSTRUMENTS);
    expect(res.body.payment).to.have.property('how_to_pay');
  });

  it('catalog price is loaded dynamically as $0.05', () => {
    const price = getSimulationPriceUsdt();
    expect(price).to.equal(0.05);
  });

  it('rejects unauthenticated request with 402 and payment guidance', async () => {
    const pool = mockPool();
    const app = buildTestApp(pool);
    const res = await request(app)
      .post('/v1/trading/paper/simulate')
      .send({ idempotencyKey: 'idem-1234', instrumentId: 'BINANCE:BTCUSDT' });

    expect(res.status).to.equal(402);
    expect(res.body.ok).to.equal(false);
    expect(res.body.error).to.equal('payment_required');
    expect(res.body.disclaimer).to.equal(SIMULATION_DISCLAIMER);
    expect(res.body.how_to_pay).to.be.an('array');
    expect(pool.state.chargeCount).to.equal(0);
  });

  it('rejects request with missing or short idempotencyKey with 422', async () => {
    const pool = mockPool({ account: ACTIVE_ACCOUNT, credits: 5.0 });
    const app = buildTestApp(pool);
    const res = await request(app)
      .post('/v1/trading/paper/simulate')
      .set('x-api-key', TEST_API_KEY)
      .send({ idempotencyKey: 'ab', instrumentId: 'BINANCE:BTCUSDT' });

    expect(res.status).to.equal(422);
    expect(res.body.error).to.equal('missing_idempotency_key');
    expect(pool.state.chargeCount).to.equal(0);
  });

  it('rejects request with unsupported instrument with 422', async () => {
    const pool = mockPool({ account: ACTIVE_ACCOUNT, credits: 5.0 });
    const app = buildTestApp(pool);
    const res = await request(app)
      .post('/v1/trading/paper/simulate')
      .set('x-api-key', TEST_API_KEY)
      .send({ idempotencyKey: 'idem-1234', instrumentId: 'UNKNOWN:XYZ' });

    expect(res.status).to.equal(422);
    expect(res.body.error).to.equal('unsupported_instrument');
    expect(res.body.supported_instruments).to.deep.equal(ALLOWED_INSTRUMENTS);
    expect(pool.state.chargeCount).to.equal(0);
  });

  it('rejects request with unsupported strategy with 422', async () => {
    const pool = mockPool({ account: ACTIVE_ACCOUNT, credits: 5.0 });
    const app = buildTestApp(pool);
    const res = await request(app)
      .post('/v1/trading/paper/simulate')
      .set('x-api-key', TEST_API_KEY)
      .send({
        idempotencyKey: 'idem-1234',
        instrumentId: 'BINANCE:BTCUSDT',
        strategy: 'unsupported-ml-strategy',
      });

    expect(res.status).to.equal(422);
    expect(res.body.error).to.equal('unsupported_strategy');
    expect(pool.state.chargeCount).to.equal(0);
  });

  it('rejects unknown API key with 401', async () => {
    const pool = mockPool({ account: null });
    const app = buildTestApp(pool);
    const res = await request(app)
      .post('/v1/trading/paper/simulate')
      .set('x-api-key', 'sk_nonexistent_key')
      .send({ idempotencyKey: 'idem-1234', instrumentId: 'BINANCE:BTCUSDT' });

    expect(res.status).to.equal(401);
    expect(res.body.error).to.equal('account_not_found');
    expect(pool.state.chargeCount).to.equal(0);
  });

  it('rejects inactive account with 403', async () => {
    const pool = mockPool({ account: { ...ACTIVE_ACCOUNT, status: 'suspended' }, credits: 5.0 });
    const app = buildTestApp(pool);
    const res = await request(app)
      .post('/v1/trading/paper/simulate')
      .set('x-api-key', TEST_API_KEY)
      .send({ idempotencyKey: 'idem-1234', instrumentId: 'BINANCE:BTCUSDT' });

    expect(res.status).to.equal(403);
    expect(res.body.error).to.equal('account_inactive');
    expect(pool.state.chargeCount).to.equal(0);
  });

  it('rejects insufficient balance with 402 and zero deduction', async () => {
    const pool = mockPool({ account: ACTIVE_ACCOUNT, credits: 0.01 }); // less than $0.05
    const app = buildTestApp(pool);
    const res = await request(app)
      .post('/v1/trading/paper/simulate')
      .set('x-api-key', TEST_API_KEY)
      .send({ idempotencyKey: 'idem-1234', instrumentId: 'BINANCE:BTCUSDT' });

    expect(res.status).to.equal(402);
    expect(res.body.error).to.equal('insufficient_credits');
    expect(res.body.how_to_pay).to.be.an('array');
    expect(pool.state.chargeCount).to.equal(0);
    expect(pool.state.credits).to.equal(0.01);
  });

  it('successful simulation deducts $0.05, logs revenue, and returns report with disclaimer', async () => {
    const pool = mockPool({ account: ACTIVE_ACCOUNT, credits: 2.0 });
    const app = buildTestApp(pool);
    const res = await request(app)
      .post('/v1/trading/paper/simulate')
      .set('x-api-key', TEST_API_KEY)
      .send({
        idempotencyKey: 'idem-run-success-001',
        instrumentId: 'BINANCE:BTCUSDT',
        strategy: 'sma-crossover',
      });

    expect(res.status).to.equal(200);
    expect(res.body.ok).to.equal(true);
    expect(res.body.disclaimer).to.equal(SIMULATION_DISCLAIMER);
    expect(res.body.billed_usdt).to.equal(0.05);
    expect(res.body.instrument_id).to.equal('BINANCE:BTCUSDT');
    expect(res.body.simulation.status).to.equal('FILLED');
    expect(res.body.simulation.order_execution.status).to.equal('FILLED');
    expect(res.body.simulation.financial_settlement.settled).to.equal(true);
    expect(res.body.simulation.financial_settlement.receiptId).to.equal('RCPT-1-1700000000000');

    // Balance deducted by exactly 0.05
    expect(pool.state.chargeCount).to.equal(1);
    expect(pool.state.credits).to.be.closeTo(1.95, 0.0001);

    // Revenue event logged with opType paper_simulation
    expect(pool.state.revenueInserts.length).to.be.at.least(1);
  });

  it('idempotent replay returns cached result with idempotent_replay: true and ZERO extra charge', async () => {
    const pool = mockPool({ account: ACTIVE_ACCOUNT, credits: 5.0 });
    const store = new IdempotencyStore();
    const app = buildTestApp(pool, { idempotencyStore: store });

    const payload = {
      idempotencyKey: 'idem-replay-001',
      instrumentId: 'BINANCE:BTCUSDT',
    };

    // First request
    const r1 = await request(app)
      .post('/v1/trading/paper/simulate')
      .set('x-api-key', TEST_API_KEY)
      .send(payload);

    expect(r1.status).to.equal(200);
    expect(r1.body.idempotent_replay).to.be.undefined;
    expect(pool.state.chargeCount).to.equal(1);
    expect(pool.state.credits).to.be.closeTo(4.95, 0.0001);

    // Second request with EXACT same idempotencyKey
    const r2 = await request(app)
      .post('/v1/trading/paper/simulate')
      .set('x-api-key', TEST_API_KEY)
      .send(payload);

    expect(r2.status).to.equal(200);
    expect(r2.body.ok).to.equal(true);
    expect(r2.body.idempotent_replay).to.equal(true);
    expect(r2.body.simulation.workflow_id).to.equal(r1.body.simulation.workflow_id);

    // CRITICAL: chargeCount is still strictly 1! Balance is still 4.95!
    expect(pool.state.chargeCount).to.equal(1);
    expect(pool.state.credits).to.be.closeTo(4.95, 0.0001);
  });

  it('simulation failure results in 503 and NO credit deduction', async () => {
    const pool = mockPool({ account: ACTIVE_ACCOUNT, credits: 5.0 });
    const app = buildTestApp(pool, {
      runSimulationFn: async () => {
        throw new Error('Simulation engine internal error');
      },
    });

    const res = await request(app)
      .post('/v1/trading/paper/simulate')
      .set('x-api-key', TEST_API_KEY)
      .send({
        idempotencyKey: 'idem-sim-fail-001',
        instrumentId: 'BINANCE:BTCUSDT',
      });

    expect(res.status).to.equal(503);
    expect(res.body.error).to.equal('simulation_failed');
    expect(res.body.charged).to.equal(false);
    expect(res.body.disclaimer).to.equal(SIMULATION_DISCLAIMER);

    // Customer was not charged
    expect(pool.state.chargeCount).to.equal(0);
    expect(pool.state.credits).to.equal(5.0);
  });

  it('simulation timeout results in 503 and NO credit deduction', async () => {
    const pool = mockPool({ account: ACTIVE_ACCOUNT, credits: 5.0 });
    const app = buildTestApp(pool, {
      simulationTimeoutMs: 50,
      runSimulationFn: () => new Promise((resolve) => setTimeout(resolve, 200)),
    });

    const res = await request(app)
      .post('/v1/trading/paper/simulate')
      .set('x-api-key', TEST_API_KEY)
      .send({
        idempotencyKey: 'idem-timeout-001',
        instrumentId: 'BINANCE:BTCUSDT',
      });

    expect(res.status).to.equal(503);
    expect(res.body.error).to.equal('simulation_timeout');
    expect(res.body.charged).to.equal(false);
    expect(pool.state.chargeCount).to.equal(0);
    expect(pool.state.credits).to.equal(5.0);
  });

  it('end-to-end integration: executes real PaperTradingOrchestrator without mocks', async () => {
    const pool = mockPool({ account: ACTIVE_ACCOUNT, credits: 10.0 });
    // Use default runSimulationFn (which invokes real @satelink/trading PaperTradingOrchestrator)
    const app = express();
    app.use(express.json());
    app.use('/v1/trading', createTradingSimulationRouter(pool));

    const res = await request(app)
      .post('/v1/trading/paper/simulate')
      .set('x-api-key', TEST_API_KEY)
      .send({
        idempotencyKey: 'idem-real-e2e-001',
        instrumentId: 'BINANCE:BTCUSDT',
        strategy: 'sma-crossover',
      });

    expect(res.status).to.equal(200);
    expect(res.body.ok).to.equal(true);
    expect(res.body.disclaimer).to.equal(SIMULATION_DISCLAIMER);
    expect(res.body.billed_usdt).to.equal(0.05);
    expect(res.body.simulation.status).to.equal('FILLED');
    expect(res.body.simulation.order_execution.status).to.equal('FILLED');
    expect(res.body.simulation.financial_settlement.settled).to.equal(true);
    expect(res.body.simulation.risk_authorization.authorized).to.equal(true);
    expect(pool.state.chargeCount).to.equal(1);
  });

  describe('Financial OS Concurrency, Idempotency & Correctness Audit (Phase 2)', () => {
    it('prevents balance overspend under concurrent requests when balance covers only one request', async () => {
      // Account has EXACTLY 0.05 credits (enough for only 1 simulation call)
      const pool = mockPool({ account: ACTIVE_ACCOUNT, credits: 0.05 });
      let simExecutions = 0;
      const app = buildTestApp(pool, {
        runSimulationFn: async () => {
          simExecutions++;
          // Artificial 20ms delay to ensure both concurrent requests run in-flight simultaneously
          await new Promise((r) => setTimeout(r, 20));
          return MOCK_EXEC_REPORT;
        },
      });

      // Two concurrent requests with DIFFERENT idempotency keys
      const [r1, r2] = await Promise.all([
        request(app)
          .post('/v1/trading/paper/simulate')
          .set('x-api-key', TEST_API_KEY)
          .send({ idempotencyKey: 'concurrent-overspend-1', instrumentId: 'BINANCE:BTCUSDT' }),
        request(app)
          .post('/v1/trading/paper/simulate')
          .set('x-api-key', TEST_API_KEY)
          .send({ idempotencyKey: 'concurrent-overspend-2', instrumentId: 'BINANCE:BTCUSDT' }),
      ]);

      const statuses = [r1.status, r2.status].sort();
      // Exactly one succeeds with 200, the other is rejected with 402 insufficient_credits
      expect(statuses).to.deep.equal([200, 402]);

      const successRes = r1.status === 200 ? r1 : r2;
      const deniedRes = r1.status === 402 ? r1 : r2;

      expect(successRes.body.ok).to.equal(true);
      expect(successRes.body.billed_usdt).to.equal(0.05);

      expect(deniedRes.body.ok).to.equal(false);
      expect(deniedRes.body.error).to.equal('insufficient_credits');

      // CRITICAL: Account balance never went negative, strictly 0.00
      expect(pool.state.credits).to.be.closeTo(0.0, 0.0001);
      expect(pool.state.chargeCount).to.equal(1);
    });

    it('concurrent requests reusing the same idempotency key coalesce into a single execution and charge', async () => {
      const pool = mockPool({ account: ACTIVE_ACCOUNT, credits: 5.0 });
      let simExecutions = 0;
      const store = new IdempotencyStore();
      const app = buildTestApp(pool, {
        idempotencyStore: store,
        runSimulationFn: async () => {
          simExecutions++;
          await new Promise((r) => setTimeout(r, 25));
          return MOCK_EXEC_REPORT;
        },
      });

      const sharedPayload = {
        idempotencyKey: 'concurrent-idem-coalesce-001',
        instrumentId: 'BINANCE:BTCUSDT',
      };

      // Two concurrent requests with the EXACT SAME idempotency key
      const [r1, r2] = await Promise.all([
        request(app)
          .post('/v1/trading/paper/simulate')
          .set('x-api-key', TEST_API_KEY)
          .send(sharedPayload),
        request(app)
          .post('/v1/trading/paper/simulate')
          .set('x-api-key', TEST_API_KEY)
          .send(sharedPayload),
      ]);

      expect(r1.status).to.equal(200);
      expect(r2.status).to.equal(200);

      // Exactly one was fresh, the other was an idempotent replay
      const replays = [r1.body.idempotent_replay, r2.body.idempotent_replay];
      expect(replays).to.include(true);
      expect(replays).to.include(undefined);

      // Crucial: Simulation executed strictly once, charged strictly once
      expect(simExecutions).to.equal(1);
      expect(pool.state.chargeCount).to.equal(1);
      expect(pool.state.credits).to.be.closeTo(4.95, 0.0001);
    });

    it('rejects idempotency key reuse with a different request payload with 422 and zero deduction', async () => {
      const pool = mockPool({ account: ACTIVE_ACCOUNT, credits: 5.0 });
      const store = new IdempotencyStore();
      const app = buildTestApp(pool, { idempotencyStore: store });

      // First call with BTCUSDT
      const r1 = await request(app)
        .post('/v1/trading/paper/simulate')
        .set('x-api-key', TEST_API_KEY)
        .send({
          idempotencyKey: 'idem-mismatch-test-01',
          instrumentId: 'BINANCE:BTCUSDT',
        });

      expect(r1.status).to.equal(200);
      expect(pool.state.chargeCount).to.equal(1);
      expect(pool.state.credits).to.be.closeTo(4.95, 0.0001);

      // Second call reusing the same idempotency key with a DIFFERENT payload (NSE:NIFTY50)
      const r2 = await request(app)
        .post('/v1/trading/paper/simulate')
        .set('x-api-key', TEST_API_KEY)
        .send({
          idempotencyKey: 'idem-mismatch-test-01',
          instrumentId: 'NSE:NIFTY50',
        });

      expect(r2.status).to.equal(422);
      expect(r2.body.ok).to.equal(false);
      expect(r2.body.error).to.equal('idempotency_payload_mismatch');
      expect(r2.body.message).to.match(/different request payload/i);

      // Zero additional credit deduction
      expect(pool.state.chargeCount).to.equal(1);
      expect(pool.state.credits).to.be.closeTo(4.95, 0.0001);
    });

    it('isolates idempotency keys across different principals (no cross-principal cache hit or leak)', async () => {
      const ALICE_KEY = 'sk_alice_trading_001';
      const BOB_KEY = 'sk_bob_trading_002';

      const pool = mockPool({
        accounts: {
          [ALICE_KEY]: { ...ACTIVE_ACCOUNT, api_key: ALICE_KEY, credits: 5.0 },
          [BOB_KEY]: { ...ACTIVE_ACCOUNT, api_key: BOB_KEY, credits: 5.0 },
        },
      });

      const store = new IdempotencyStore();
      const app = buildTestApp(pool, { idempotencyStore: store });

      const sharedKey = 'client-common-key-999';

      // Alice executes with sharedKey for BTCUSDT
      const rAlice = await request(app)
        .post('/v1/trading/paper/simulate')
        .set('x-api-key', ALICE_KEY)
        .send({
          idempotencyKey: sharedKey,
          instrumentId: 'BINANCE:BTCUSDT',
        });

      expect(rAlice.status).to.equal(200);
      expect(rAlice.body.instrument_id).to.equal('BINANCE:BTCUSDT');
      expect(pool.accountsMap[ALICE_KEY].credits).to.be.closeTo(4.95, 0.0001);

      // Bob executes with the EXACT SAME key for NIFTY50
      const rBob = await request(app)
        .post('/v1/trading/paper/simulate')
        .set('x-api-key', BOB_KEY)
        .send({
          idempotencyKey: sharedKey,
          instrumentId: 'NSE:NIFTY50',
        });

      expect(rBob.status).to.equal(200);
      // Bob executes in Bob's own namespace, receiving Bob's requested instrument
      expect(rBob.body.instrument_id).to.equal('NSE:NIFTY50');
      expect(rBob.body.idempotent_replay).to.be.undefined;

      // Bob is charged from Bob's own balance
      expect(pool.accountsMap[BOB_KEY].credits).to.be.closeTo(4.95, 0.0001);
    });

    it('reconciles revenue_events_v2 and receipts 1:1 with credit deductions', async () => {
      const pool = mockPool({ account: ACTIVE_ACCOUNT, credits: 5.0 });
      const app = buildTestApp(pool);

      const res = await request(app)
        .post('/v1/trading/paper/simulate')
        .set('x-api-key', TEST_API_KEY)
        .send({
          idempotencyKey: 'reconciliation-test-001',
          instrumentId: 'BINANCE:BTCUSDT',
        });

      expect(res.status).to.equal(200);
      expect(res.body.revenue_receipt).to.be.an('object');
      expect(res.body.revenue_receipt.recorded).to.equal(true);
      expect(res.body.revenue_receipt.amount_usdt).to.equal(0.05);

      const revReqId = res.body.revenue_receipt.revenue_request_id;
      expect(revReqId).to.be.a('string');
      expect(revReqId).to.match(/^sim:kref_[0-9a-f]+:\d+:[0-9a-f]+$/);

      // Reconcile with pool revenue insert
      expect(pool.state.revenueInserts.length).to.equal(1);
      const insertParams = pool.state.revenueInserts[0];
      // [opType, client_id, amount_usdt, status, request_id, created_at, chain, method, source, isTestData]
      expect(insertParams[0]).to.equal('paper_simulation');
      expect(insertParams[2]).to.equal(0.05);
      expect(insertParams[3]).to.equal('completed');
      expect(insertParams[4]).to.equal(revReqId);
    });

    it('retrying after a simulation failure safely allows re-execution with no duplicate charge', async () => {
      const pool = mockPool({ account: ACTIVE_ACCOUNT, credits: 5.0 });
      let failCount = 1;
      const app = buildTestApp(pool, {
        runSimulationFn: async () => {
          if (failCount > 0) {
            failCount--;
            throw new Error('transient broker engine outage');
          }
          return MOCK_EXEC_REPORT;
        },
      });

      const key = 'idem-retry-after-fail-001';

      // First attempt: simulation fails -> 503
      const r1 = await request(app)
        .post('/v1/trading/paper/simulate')
        .set('x-api-key', TEST_API_KEY)
        .send({ idempotencyKey: key, instrumentId: 'BINANCE:BTCUSDT' });

      expect(r1.status).to.equal(503);
      expect(r1.body.charged).to.equal(false);
      expect(pool.state.chargeCount).to.equal(0);
      expect(pool.state.credits).to.equal(5.0);

      // Second attempt with the SAME key: simulation succeeds -> 200, charged once
      const r2 = await request(app)
        .post('/v1/trading/paper/simulate')
        .set('x-api-key', TEST_API_KEY)
        .send({ idempotencyKey: key, instrumentId: 'BINANCE:BTCUSDT' });

      expect(r2.status).to.equal(200);
      expect(r2.body.ok).to.equal(true);
      expect(r2.body.billed_usdt).to.equal(0.05);
      expect(pool.state.chargeCount).to.equal(1);
      expect(pool.state.credits).to.be.closeTo(4.95, 0.0001);
    });
  });

  describe('Phase 4 — Repeatable Customer Acceptance Proof', () => {
    const EXTERNAL_CUSTOMER_KEY = 'sk_external_customer_verified_999';
    const EXTERNAL_ACCOUNT = Object.freeze({
      api_key: EXTERNAL_CUSTOMER_KEY,
      tier: 'pro',
      status: 'active',
      daily_limit: 10000,
      payment_hold: false,
    });

    it('demonstrates the full 9-step external customer transaction lifecycle', async () => {
      const INITIAL_CREDITS = 1.00;
      const pool = mockPool({ account: EXTERNAL_ACCOUNT, credits: INITIAL_CREDITS });
      const store = new IdempotencyStore();
      const app = buildTestApp(pool, { idempotencyStore: store });

      // Step 1 & 2: Principal authenticates and discovers capability and catalog price
      const discoveryRes = await request(app).get('/v1/trading/paper/simulate');
      expect(discoveryRes.status).to.equal(200);
      expect(discoveryRes.body.ok).to.equal(true);
      expect(discoveryRes.body.mode).to.equal('SIMULATED_PAPER_EXECUTION');
      expect(discoveryRes.body.price_usdt).to.equal(0.05);
      expect(discoveryRes.body.disclaimer).to.equal(SIMULATION_DISCLAIMER);
      expect(discoveryRes.body.supported_instruments).to.include('BINANCE:BTCUSDT');

      // Step 3: Account has sufficient canonical credits ($1.00 >= $0.05)
      expect(pool.state.credits).to.equal(INITIAL_CREDITS);

      // Step 4 & 5: Valid simulation runs, returns disclaimer, and exactly one $0.05 charge is recorded
      const customerKey = 'cust-tx-proof-001';
      const simRes = await request(app)
        .post('/v1/trading/paper/simulate')
        .set('x-api-key', EXTERNAL_CUSTOMER_KEY)
        .send({
          idempotencyKey: customerKey,
          instrumentId: 'BINANCE:BTCUSDT',
          strategy: 'sma-crossover',
        });

      expect(simRes.status).to.equal(200);
      expect(simRes.body.ok).to.equal(true);
      expect(simRes.body.disclaimer).to.equal(SIMULATION_DISCLAIMER);
      expect(simRes.body.billed_usdt).to.equal(0.05);
      expect(simRes.body.simulation.status).to.equal('FILLED');

      // Step 6: Corresponding revenue event and receipt reconcile with credit deduction
      expect(pool.state.chargeCount).to.equal(1);
      expect(pool.state.credits).to.be.closeTo(0.95, 0.0001);
      expect(simRes.body.revenue_receipt).to.be.an('object');
      const receiptId = simRes.body.revenue_receipt.revenue_request_id;
      expect(pool.state.revenueInserts.length).to.equal(1);
      expect(pool.state.revenueInserts[0][4]).to.equal(receiptId);
      expect(pool.state.revenueInserts[0][2]).to.equal(0.05);

      // Step 7: Repeating the same idempotent request produces NO duplicate charge
      const replayRes = await request(app)
        .post('/v1/trading/paper/simulate')
        .set('x-api-key', EXTERNAL_CUSTOMER_KEY)
        .send({
          idempotencyKey: customerKey,
          instrumentId: 'BINANCE:BTCUSDT',
          strategy: 'sma-crossover',
        });

      expect(replayRes.status).to.equal(200);
      expect(replayRes.body.idempotent_replay).to.equal(true);
      expect(replayRes.body.simulation.workflow_id).to.equal(simRes.body.simulation.workflow_id);
      expect(pool.state.chargeCount).to.equal(1);
      expect(pool.state.credits).to.be.closeTo(0.95, 0.0001);

      // Step 8: Failure cases do not cause unintended deductions
      const failRes = await request(app)
        .post('/v1/trading/paper/simulate')
        .set('x-api-key', EXTERNAL_CUSTOMER_KEY)
        .send({
          idempotencyKey: 'cust-tx-invalid-instrument',
          instrumentId: 'UNKNOWN:XYZ',
        });
      expect(failRes.status).to.equal(422);
      expect(pool.state.chargeCount).to.equal(1);
      expect(pool.state.credits).to.be.closeTo(0.95, 0.0001);

      // Step 9: The result is retrievable by the authorized principal, cross-principal is blocked
      const intruderKey = 'sk_intruder_random_attacker';
      const intruderPool = mockPool({
        account: { ...EXTERNAL_ACCOUNT, api_key: intruderKey },
        credits: 10.0,
      });
      const intruderApp = buildTestApp(intruderPool, { idempotencyStore: store });

      const intruderRes = await request(intruderApp)
        .post('/v1/trading/paper/simulate')
        .set('x-api-key', intruderKey)
        .send({
          idempotencyKey: customerKey, // attempting to replay/read customer's key
          instrumentId: 'NSE:NIFTY50',
        });

      // Intruder does NOT receive external customer's cached result
      expect(intruderRes.status).to.equal(200);
      expect(intruderRes.body.instrument_id).to.equal('NSE:NIFTY50');
      expect(intruderRes.body.idempotent_replay).to.be.undefined;
      expect(intruderPool.accountsMap[intruderKey].credits).to.be.closeTo(9.95, 0.0001);
    });
  });
});
