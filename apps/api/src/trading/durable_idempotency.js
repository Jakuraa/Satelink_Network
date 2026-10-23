// apps/api/src/trading/durable_idempotency.js
//
// Durable PostgreSQL Idempotency Store for Multi-Market Trading AI
//
// ARCHITECTURE & INVARIANTS:
// 1. Persists principal-scoped idempotency key, normalized request hash,
//    execution state (pending, succeeded, failed), receipt reference, response,
//    and timestamps in the `trading_idempotency` table.
// 2. Database-level concurrency safety: enforced by primary key (ON CONFLICT DO NOTHING)
//    and atomic lease acquisition.
// 3. Payload integrity: re-using a key with a different request hash is rejected
//    with IdempotencyPayloadMismatchError (HTTP 422).
// 4. In-flight protection: concurrent calls for the same key await the same execution
//    (locally) or receive IdempotencyConflictError (HTTP 409) across instances.
// 5. Crash recovery: if a process crashes mid-execution (state remains pending after
//    lease expiration), retries can safely reclaim the lease and re-run.
// 6. Failed execution recovery: if a previous attempt failed (simulation error or
//    billing refusal before charge), retries can re-execute with no duplicate charge.
// 7. Succeeded state immutability: returns cached report without re-executing or
//    re-charging, setting idempotent_replay: true.

import { ensureTradingIdempotencySchema } from './idempotency_schema.mjs';

export class IdempotencyPayloadMismatchError extends Error {
  constructor(message = 'Idempotency key was previously used with a different request payload.') {
    super(message);
    this.name = 'IdempotencyPayloadMismatchError';
    this.code = 'idempotency_payload_mismatch';
    this.http = 422;
  }
}

export class IdempotencyConflictError extends Error {
  constructor(message = 'A simulation with this idempotency key is currently in progress. Retry shortly.') {
    super(message);
    this.name = 'IdempotencyConflictError';
    this.code = 'idempotency_in_progress';
    this.http = 409;
  }
}

export class DurableIdempotencyStore {
  /**
   * @param {object} [pool] - Postgres pool/client with .query()
   * @param {object} [options]
   * @param {number} [options.defaultTimeoutMs=15000] - Lease expiration window in ms
   * @param {() => number} [options.now] - Clock function
   */
  constructor(pool = null, options = {}) {
    this.pool = pool;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;
    this.now = options.now || (() => Date.now());
    this._local = new Map(); // key -> Promise<{ value, fresh }>
    this._memoryStore = new Map(); // fallback when pool is null
    this._ensured = false;
  }

  async init() {
    if (this.pool && !this._ensured) {
      await ensureTradingIdempotencySchema(this.pool);
      this._ensured = true;
    }
  }

  async get(key, client = null) {
    if (!this.pool) {
      return this._memoryStore.get(key) || null;
    }
    await this.init();
    const db = client || this.pool;
    const res = await db.query(
      `SELECT key, principal_id, action, payload_hash, state, receipt_ref, response, error, locked_until, created_at, updated_at
       FROM trading_idempotency WHERE key = $1`,
      [key]
    );
    return res.rows[0] || null;
  }

  async has(key) {
    const row = await this.get(key);
    return Boolean(row && (row.state === 'succeeded' || row.state === 'pending'));
  }

  async recordSuccess(key, { receiptRef = null, response = null, client = null } = {}) {
    if (!this.pool) {
      const row = this._memoryStore.get(key);
      if (row) {
        row.state = 'succeeded';
        row.receipt_ref = receiptRef;
        row.response = response;
        row.updated_at = new Date(this.now());
      }
      return;
    }
    await this.init();
    const db = client || this.pool;
    await db.query(
      `UPDATE trading_idempotency
       SET state = 'succeeded', receipt_ref = $2, response = $3, updated_at = NOW()
       WHERE key = $1`,
      [key, receiptRef, typeof response === 'object' ? JSON.stringify(response) : response]
    );
  }

  async recordFailure(key, error, client = null) {
    const errorMsg = error?.message || String(error);
    if (!this.pool) {
      const row = this._memoryStore.get(key);
      if (row && row.state === 'pending') {
        row.state = 'failed';
        row.error = errorMsg;
        row.updated_at = new Date(this.now());
      }
      return;
    }
    await this.init();
    const db = client || this.pool;
    await db.query(
      `UPDATE trading_idempotency
       SET state = 'failed', error = $2, updated_at = NOW()
       WHERE key = $1 AND state = 'pending'`,
      [key, errorMsg]
    );
  }

  /**
   * Run fn exactly once per idempotency key with full restart recovery,
   * cross-instance mutual exclusion, and payload hash verification.
   *
   * @param {string} key - Principal-scoped idempotency key
   * @param {object|Function} optionsOrFn - Execution options or callback
   * @param {Function} [maybeFn] - Callback if options were provided
   */
  async run(key, optionsOrFn, maybeFn) {
    const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn;
    const options = typeof optionsOrFn === 'object' ? optionsOrFn : {};
    const {
      payloadHash = null,
      principalId = 'unknown',
      action = 'paper_simulation',
      timeoutMs = this.defaultTimeoutMs,
      client = null,
    } = options;

    if (!key || typeof key !== 'string') {
      throw new Error('DurableIdempotencyStore: a valid key is required');
    }
    if (typeof fn !== 'function') {
      throw new Error('DurableIdempotencyStore: a function to execute is required');
    }

    // 1. In-process promise cache (synchronously registered before any await)
    if (this._local.has(key)) {
      const localResult = await this._local.get(key);
      return { value: localResult.value, fresh: false };
    }

    const execution = (async () => {
      await this.init();

      // 2. Inspect database state
      const existing = await this.get(key, client);

      if (existing) {
        // (a) Payload conflict check: same key with different body is rejected
        if (payloadHash && existing.payload_hash && existing.payload_hash !== payloadHash) {
          throw new IdempotencyPayloadMismatchError();
        }

        // (b) Succeeded: replay cached response
        if (existing.state === 'succeeded') {
          const resp = typeof existing.response === 'string'
            ? JSON.parse(existing.response)
            : existing.response;
          return {
            value: {
              payloadHash: existing.payload_hash,
              response: resp,
              receiptRef: existing.receipt_ref,
            },
            fresh: false,
          };
        }

        // (c) Pending: check if lease is active or expired
        if (existing.state === 'pending') {
          const lockUntil = new Date(existing.locked_until).getTime();
          const currentTime = this.now();

          if (lockUntil > currentTime) {
            // Active in-flight execution on another instance/process
            throw new IdempotencyConflictError();
          }

          // Lease expired: process crash recovery! Reclaim lease
          const newLockUntil = new Date(currentTime + timeoutMs);
          if (this.pool) {
            const db = client || this.pool;
            const claim = await db.query(
              `UPDATE trading_idempotency
               SET state = 'pending', locked_until = $2, updated_at = NOW()
               WHERE key = $1 AND state = 'pending' AND locked_until = $3
               RETURNING key`,
              [key, newLockUntil, existing.locked_until]
            );
            if (claim.rowCount === 0) {
              throw new IdempotencyConflictError();
            }
          } else {
            existing.locked_until = newLockUntil;
            existing.updated_at = new Date(currentTime);
          }
        } else if (existing.state === 'failed') {
          // (d) Failed: retry after prior failure is permitted (not charged previously)
          const currentTime = this.now();
          const newLockUntil = new Date(currentTime + timeoutMs);
          if (this.pool) {
            const db = client || this.pool;
            const claim = await db.query(
              `UPDATE trading_idempotency
               SET state = 'pending', error = NULL, locked_until = $2, updated_at = NOW()
               WHERE key = $1 AND state = 'failed'
               RETURNING key`,
              [key, newLockUntil]
            );
            if (claim.rowCount === 0) {
              throw new IdempotencyConflictError();
            }
          } else {
            existing.state = 'pending';
            existing.error = null;
            existing.locked_until = newLockUntil;
            existing.updated_at = new Date(currentTime);
          }
        }
      } else {
        // 3. Insert fresh pending row
        const currentTime = this.now();
        const newLockUntil = new Date(currentTime + timeoutMs);

        if (this.pool) {
          const db = client || this.pool;
          const insertRes = await db.query(
            `INSERT INTO trading_idempotency (
               key, principal_id, action, payload_hash, state, locked_until, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, 'pending', $5, NOW(), NOW())
             ON CONFLICT (key) DO NOTHING RETURNING key`,
            [key, principalId, action, payloadHash || '', newLockUntil]
          );

          if (insertRes.rowCount === 0) {
            // Concurrent insert won the race; re-fetch and process
            return this.run(key, options, fn);
          }
        } else {
          this._memoryStore.set(key, {
            key,
            principal_id: principalId,
            action,
            payload_hash: payloadHash || '',
            state: 'pending',
            receipt_ref: null,
            response: null,
            error: null,
            locked_until: newLockUntil,
            created_at: new Date(currentTime),
            updated_at: new Date(currentTime),
          });
        }
      }

      // 4. Execute callback
      try {
        const result = await fn();
        // Record success if state is still pending (unless route already committed it)
        const rowNow = await this.get(key, client);
        if (!rowNow || rowNow.state !== 'succeeded') {
          await this.recordSuccess(key, {
            receiptRef: result?.receiptRef || result?.response?.revenue_receipt?.revenue_request_id || null,
            response: result?.response || result,
            client,
          });
        }
        return { value: result, fresh: true };
      } catch (err) {
        await this.recordFailure(key, err, client);
        throw err;
      }
    })();

    // Cache synchronously in local map
    const cachedPromise = execution
      .then((res) => res)
      .catch((err) => {
        this._local.delete(key);
        throw err;
      });
    cachedPromise.catch(() => {});
    this._local.set(key, cachedPromise);

    try {
      const res = await cachedPromise;
      return res;
    } finally {
      this._local.delete(key);
    }
  }

  // Back-compat shim for kernel / IdempotencyStore interface
  async once(key, fn) {
    const res = await this.run(key, fn);
    return res.value;
  }
}
