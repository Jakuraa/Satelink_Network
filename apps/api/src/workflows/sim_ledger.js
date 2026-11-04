// Simulated money on the Financial OS ledger (Release A, ADR-5).
//
// apps/api is plain Node and cannot import the TypeScript Financial OS at runtime, so this module is the
// JS writer that MIRRORS libs/financial-domain/src/coordination/reservation-postings.ts. The pure posting
// builders below are compared entry-for-entry with the TS ones by
// database/__tests__/sim_ledger_parity.integration.test.ts — any drift fails CI.
//
//   hold    Dr customer reserved            / Cr holds reserved
//   capture Dr holds reserved               / Cr revenue captured + Cr customer (reserved − captured)
//   release Dr holds reserved               / Cr customer reserved            (failure, cancel, expiry)
//
// Every transaction is tagged origin + environment (R5). Preview writes origin='simulated' (reservations)
// or 'promotional' (demo credit) with environment='preview', so `revenue_truth` can never count them.
// Amounts are BigInt minor units of USDC/6 (= micro-USD); never JS numbers (R4).

import { createHash } from 'node:crypto';
import { TaskError, ERR } from './errors.js';

export const SIM_CURRENCY = 'USDC';
export const SIM_DECIMALS = 6;
export const PREVIEW_REVENUE_ACCOUNT = 'acct_preview_sim_revenue';
export const PREVIEW_PROMO_ACCOUNT = 'acct_preview_promo';
export const PROMO_DEMO_CREDIT_MINOR = 1_000_000n; // $1.00 simulated promotional credit
const PROVENANCE = new Set(['external', 'founder', 'test', 'demo', 'simulated', 'promotional']);
const ENVIRONMENTS = new Set(['preview', 'beta', 'live']);

export const holdTxnId = (reservationId) => `rsv:${reservationId}:hold`;
export const settleTxnId = (reservationId) => `rsv:${reservationId}:settle`;

function minor(v, what) {
  if (typeof v !== 'bigint') throw new TaskError(ERR.VALIDATION, `${what} must be a BigInt minor-unit amount.`);
  if (v < 0n) throw new TaskError(ERR.VALIDATION, `${what} must not be negative.`);
  return v;
}

const entry = (account, direction, amount, refId) => ({ account, direction, amount, state: 'posted', refType: 'reservation', refId });

/** Pure: the hold transaction for a new reservation (mirrors TS holdPosting). */
export function holdPosting({ reservationId, reserved }, accounts) {
  const amount = minor(reserved, 'reserved');
  if (amount === 0n) throw new TaskError(ERR.VALIDATION, 'A reservation must hold a positive amount.');
  const refId = `${reservationId}:hold`;
  return {
    txnId: holdTxnId(reservationId), kind: 'hold', refType: 'reservation', refId, currency: SIM_CURRENCY,
    entries: [entry(accounts.customer, 'debit', amount, refId), entry(accounts.holds, 'credit', amount, refId)],
  };
}

/** Pure: the single settle transaction for a captured / released / expired reservation (mirrors TS settlePosting). */
export function settlePosting({ reservationId, state, reserved, captured = 0n }, accounts) {
  if (!['captured', 'released', 'expired'].includes(state)) throw new TaskError(ERR.VALIDATION, `reservation ${reservationId} is still held`);
  const r = minor(reserved, 'reserved');
  const c = state === 'captured' ? minor(captured, 'captured') : 0n;
  if (c > r) throw new TaskError(ERR.VALIDATION, 'captured exceeds reserved');
  const isCapture = state === 'captured';
  const refId = `${reservationId}:${isCapture ? 'capture' : 'release'}`;
  const entries = [entry(accounts.holds, 'debit', r, refId)];
  if (isCapture) entries.push(entry(accounts.revenue, 'credit', c, refId));
  const back = r - c;
  if (back > 0n) entries.push(entry(accounts.customer, 'credit', back, refId));
  return { txnId: settleTxnId(reservationId), kind: isCapture ? 'capture' : 'release', refType: 'reservation', refId, currency: SIM_CURRENCY, entries };
}

/** sha256 over the canonical entry list — receipts carry it so a receipt is bound to its ledger rows. */
export function ledgerHash(transactions) {
  const canon = transactions.map((t) => [t.txnId, t.kind, t.entries.map((e) => [e.account, e.direction, e.amount.toString(), e.state])]);
  return createHash('sha256').update(JSON.stringify(canon)).digest('hex');
}

async function postTxn(client, txn, { origin, environment }) {
  if (!PROVENANCE.has(origin) || !ENVIRONMENTS.has(environment)) throw new TaskError(ERR.VALIDATION, 'origin/environment required (R5).');
  // Balanced by construction; asserted here too (the DB trigger checks it again at COMMIT).
  let dr = 0n; let cr = 0n;
  for (const e of txn.entries) if (e.direction === 'debit') dr += e.amount; else cr += e.amount;
  if (dr !== cr) throw new TaskError(ERR.VALIDATION, `unbalanced ${txn.txnId}`);
  const ins = await client.query(
    `INSERT INTO ledger_txns (txn_id, kind, ref_type, ref_id, currency, state, posted_at, origin, environment)
     VALUES ($1,$2,$3,$4,$5,'posted',now(),$6,$7) ON CONFLICT (txn_id) DO NOTHING`,
    [txn.txnId, txn.kind, txn.refType, txn.refId, txn.currency, origin, environment],
  );
  if (ins.rowCount === 0) return false; // replay: already posted, write nothing
  for (let i = 0; i < txn.entries.length; i++) {
    const e = txn.entries[i];
    await client.query(
      `INSERT INTO ledger_entries (txn_id, account_id, direction, amount, currency, state, ref_type, ref_id, reverses_entry_id, idem_key, posted_at)
       VALUES ($1,$2,$3,$4,$5,'posted',$6,$7,NULL,$8,now()) ON CONFLICT (idem_key, account_id, direction) DO NOTHING`,
      [txn.txnId, e.account, e.direction, e.amount.toString(), txn.currency, e.refType, e.refId, `${txn.txnId}#${i}`],
    );
  }
  return true;
}

async function tx(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* surface the original error */ }
    throw e;
  } finally { client.release(); }
}

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 24);
const PRINCIPAL_KIND = { human: 'human', developer: 'human', agent: 'agent', machine: 'machine' };

export class SimLedger {
  constructor(pool) { this.pool = pool; }

  /** Platform preview accounts (idempotent). prn_platform is seeded by migration 005. */
  async ensurePlatformAccounts() {
    await this.pool.query(
      `INSERT INTO accounts (id, principal_id, kind, normality, currency, decimals, state) VALUES
         ($1, 'prn_platform', 'revenue', 'credit', $3, $4, 'open'),
         ($2, 'prn_platform', 'promotional', 'debit', $3, $4, 'open')
       ON CONFLICT (id) DO NOTHING`,
      [PREVIEW_REVENUE_ACCOUNT, PREVIEW_PROMO_ACCOUNT, SIM_CURRENCY, SIM_DECIMALS],
    );
  }

  /** Customer principal + credit and holds accounts for a workflow principal (idempotent, deterministic ids). */
  async ensureCustomer(principalRef, actorType = 'human') {
    const h = hash(principalRef);
    const prn = `prn_${h}`;
    await this.pool.query(
      `INSERT INTO principals (id, kind, display_name, external_ref, state) VALUES ($1,$2,'Preview customer',$3,'active') ON CONFLICT (id) DO NOTHING`,
      [prn, PRINCIPAL_KIND[actorType] || 'human', principalRef],
    );
    const customer = `acct_${h}_credit`; const holds = `acct_${h}_holds`;
    await this.pool.query(
      `INSERT INTO accounts (id, principal_id, kind, normality, currency, decimals, balance_invariant, state) VALUES
         ($1,$3,'customer_credit','credit',$4,$5,'non_negative','open'),
         ($2,$3,'customer_holds','credit',$4,$5,'non_negative','open')
       ON CONFLICT (id) DO NOTHING`,
      [customer, holds, prn, SIM_CURRENCY, SIM_DECIMALS],
    );
    return { principalId: prn, customer, holds, revenue: PREVIEW_REVENUE_ACCOUNT };
  }

  /** $1 simulated promotional credit, once per customer (origin='promotional' — never revenue). */
  async grantDemoCredit(accounts) {
    const txnId = `promo:${accounts.customer}:demo-v1`;
    const refId = `${accounts.customer}:demo-v1`;
    return tx(this.pool, (c) => postTxn(c, {
      txnId, kind: 'deposit', refType: 'promotion', refId, currency: SIM_CURRENCY,
      entries: [
        { account: PREVIEW_PROMO_ACCOUNT, direction: 'debit', amount: PROMO_DEMO_CREDIT_MINOR, state: 'posted', refType: 'promotion', refId },
        { account: accounts.customer, direction: 'credit', amount: PROMO_DEMO_CREDIT_MINOR, state: 'posted', refType: 'promotion', refId },
      ],
    }, { origin: 'promotional', environment: 'preview' }));
  }

  async available(accountId, client = this.pool) {
    const { rows } = await client.query('SELECT available_balance::text AS a FROM account_balances WHERE account_id = $1', [accountId]);
    return rows.length ? BigInt(rows[0].a) : 0n;
  }

  /**
   * Reserve `amount` for a run. Atomic: locks the customer account, checks available capacity, posts the
   * hold and records the reservation in ONE transaction. Idempotent on `idempotencyKey` (a replay returns
   * the original reservation and writes nothing). Insufficient capacity = clean reject (no partial hold).
   */
  async reserve({ reservationId, runId, quoteId, accounts, amount, idempotencyKey, origin = 'simulated', environment = 'preview' }) {
    minor(amount, 'amount');
    return tx(this.pool, async (c) => {
      // Lock first, then look for a prior reservation: a concurrent duplicate waits on the lock and then
      // sees the committed original (replay) instead of racing it.
      await c.query('SELECT id FROM accounts WHERE id = $1 FOR UPDATE', [accounts.customer]);
      const prior = await c.query('SELECT * FROM workflow_reservations WHERE idempotency_key = $1 OR run_id = $2', [idempotencyKey, runId]);
      if (prior.rows.length) return { reservation: prior.rows[0], replayed: true };
      const avail = await this.available(accounts.customer, c);
      if (avail < amount) {
        throw new TaskError(ERR.INSUFFICIENT_CREDIT, 'Not enough simulated credit for this task.', { status: 402, extra: { available_minor: avail.toString(), required_minor: amount.toString() } });
      }
      const txn = holdPosting({ reservationId, reserved: amount }, accounts);
      await postTxn(c, txn, { origin, environment });
      const { rows } = await c.query(
        `INSERT INTO workflow_reservations (reservation_id, run_id, quote_id, customer_account, holds_account, revenue_account,
            currency, amount_minor, state, idempotency_key, hold_txn_id, origin, environment)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'held',$9,$10,$11,$12) RETURNING *`,
        [reservationId, runId, quoteId, accounts.customer, accounts.holds, accounts.revenue, SIM_CURRENCY, amount.toString(), idempotencyKey, txn.txnId, origin, environment],
      );
      return { reservation: rows[0], replayed: false };
    });
  }

  /** Capture (after verified success) or release/expire. Exactly one settle per reservation; replay-safe. */
  async settle(reservationId, outcome, capturedMinor = 0n) {
    if (!['captured', 'released', 'expired'].includes(outcome)) throw new TaskError(ERR.VALIDATION, 'bad settle outcome');
    return tx(this.pool, async (c) => {
      const { rows } = await c.query('SELECT * FROM workflow_reservations WHERE reservation_id = $1 FOR UPDATE', [reservationId]);
      if (!rows.length) throw new TaskError(ERR.NOT_FOUND, 'reservation not found', { status: 404 });
      const r = rows[0];
      if (r.state !== 'held') {
        if (r.state !== outcome) throw new TaskError(ERR.ILLEGAL_TRANSITION, `reservation already ${r.state}`, { status: 409 });
        return { reservation: r, replayed: true };
      }
      const accounts = { customer: r.customer_account, holds: r.holds_account, revenue: r.revenue_account };
      const txn = settlePosting({ reservationId, state: outcome, reserved: BigInt(r.amount_minor), captured: capturedMinor }, accounts);
      await postTxn(c, txn, { origin: r.origin, environment: r.environment });
      const upd = await c.query(
        `UPDATE workflow_reservations SET state = $2, captured_minor = $3, settle_txn_id = $4, settled_at = now()
          WHERE reservation_id = $1 AND state = 'held' RETURNING *`,
        [reservationId, outcome, outcome === 'captured' ? capturedMinor.toString() : null, txn.txnId],
      );
      return { reservation: upd.rows[0], replayed: false };
    });
  }

  /** Ledger transactions of a reservation in posting order (for receipts and reconciliation). */
  async transactionsFor(reservationId) {
    const { rows } = await this.pool.query(
      `SELECT t.txn_id, t.kind, e.account_id, e.direction, e.amount::text AS amount, e.state
         FROM ledger_txns t JOIN ledger_entries e ON e.txn_id = t.txn_id
        WHERE t.txn_id IN ($1, $2) ORDER BY t.created_at, e.id`,
      [holdTxnId(reservationId), settleTxnId(reservationId)],
    );
    const by = new Map();
    for (const r of rows) {
      if (!by.has(r.txn_id)) by.set(r.txn_id, { txnId: r.txn_id, kind: r.kind, entries: [] });
      by.get(r.txn_id).entries.push({ account: r.account_id, direction: r.direction, amount: BigInt(r.amount), state: r.state });
    }
    return [...by.values()];
  }
}
