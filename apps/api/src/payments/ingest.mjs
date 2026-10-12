// Provider-agnostic payment ingestion (2026-10-12 directive, Wave 1.2).
//
// ONE database transaction per event:
//   1. INSERT payment_events (UNIQUE provider+provider_event_id) — a duplicate is a no-op;
//   2. if newly inserted AND it moves money: post to the Financial OS ledger
//      (./ledger_posting.mjs, same client) using the 038 kinds;
//   3. grant (settled) or revoke (refund/dispute) the entitlement;
//   4. write the outbox event.
// Any failure rolls the whole thing back and THROWS, so the webhook answers 5xx
// and the provider retries — a crash mid-ingest is recovered by that retry
// (nothing partial was committed). pending / failed / expired / partially_paid
// never grant anything. A refund or dispute posts a reversal; nothing is deleted.
import { canonicalEvent, SETTLED_STATUSES, REVERSAL_STATUSES, PaymentError } from './contract.mjs';
import { postSettledPayment, postReversal } from './ledger_posting.mjs';

const DAY_MS = 86_400_000;

async function lockIntent(client, event) {
  if (event.canonicalRef) {
    const r = await client.query('SELECT * FROM payment_intents WHERE canonical_ref = $1 FOR UPDATE', [event.canonicalRef]);
    if (r.rows[0]) return r.rows[0];
  }
  if (event.providerPaymentId) {
    const r = await client.query(
      'SELECT * FROM payment_intents WHERE provider = $1 AND provider_payment_id = $2 FOR UPDATE',
      [event.provider, event.providerPaymentId],
    );
    if (r.rows[0]) return r.rows[0];
  }
  return null;
}

async function grantEntitlement(client, { eventRowId, event, intent, now }) {
  if (!intent) return null; // a bare top-up (no intent) is a customer credit, not an entitlement
  if (intent.intent_kind === 'credit_pack') {
    const r = await client.query(
      `INSERT INTO payment_entitlement_grants
         (payment_event_id, canonical_ref, customer_account_id, product_id, grant_kind, credits_minor, currency)
       VALUES ($1, $2, $3, $4, 'credits', $5, $6) RETURNING id`,
      [eventRowId, intent.canonical_ref, intent.customer_account_id, intent.product_id, intent.amount_minor, intent.currency],
    );
    return { grantId: r.rows[0].id, kind: 'credits' };
  }
  // Period grants stack: a renewal paid early extends from the current end, never overlaps.
  const days = intent.period_days ?? 30;
  const cur = await client.query(
    `SELECT MAX(period_end) AS end FROM payment_entitlement_grants
      WHERE customer_account_id = $1 AND product_id = $2 AND grant_kind = 'period' AND status = 'active'`,
    [intent.customer_account_id, intent.product_id],
  );
  const curEnd = cur.rows[0]?.end ? new Date(cur.rows[0].end) : null;
  const start = curEnd && curEnd > now ? curEnd : now;
  const end = new Date(start.getTime() + days * DAY_MS);
  const r = await client.query(
    `INSERT INTO payment_entitlement_grants
       (payment_event_id, canonical_ref, customer_account_id, product_id, grant_kind, period_start, period_end)
     VALUES ($1, $2, $3, $4, 'period', $5, $6) RETURNING id`,
    [eventRowId, intent.canonical_ref, intent.customer_account_id, intent.product_id, start, end],
  );
  return { grantId: r.rows[0].id, kind: 'period', periodStart: start, periodEnd: end };
}

async function findSettledTxn(client, event, intent) {
  const r = await client.query(
    `SELECT ledger_txn_id FROM payment_events
      WHERE provider = $1 AND status = ANY($2) AND ledger_txn_id IS NOT NULL
        AND ((canonical_ref IS NOT NULL AND canonical_ref = $3) OR (provider_payment_id IS NOT NULL AND provider_payment_id = $4))
      ORDER BY id LIMIT 1`,
    [event.provider, SETTLED_STATUSES, intent?.canonical_ref ?? event.canonicalRef, event.providerPaymentId],
  );
  return r.rows[0]?.ledger_txn_id ?? null;
}

/**
 * Ingest one canonical event (already verified + normalised by an adapter).
 * Returns { duplicate, eventId, status, ledgerTxnId, entitlement }.
 * @param {import('pg').Pool} pool
 */
export async function ingestCanonicalEvent(pool, rawEvent, { now = new Date(), hooks = {} } = {}) {
  const event = canonicalEvent(rawEvent);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO payment_events
         (provider, provider_event_id, provider_payment_id, canonical_ref, customer_account_id, product_id,
          amount_minor, currency, network, status, occurred_at, raw_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (provider, provider_event_id) DO NOTHING
       RETURNING id`,
      [event.provider, event.providerEventId, event.providerPaymentId, event.canonicalRef, event.customerAccountId,
        event.productId, event.amountMinor.toString(), event.currency, event.network, event.status, event.occurredAt, event.raw_hash],
    );
    if (ins.rowCount === 0) {
      await client.query('COMMIT');
      return { duplicate: true, status: event.status, ledgerTxnId: null, entitlement: null };
    }
    const eventRowId = ins.rows[0].id;
    await hooks.afterEventInsert?.(client, eventRowId); // test seam: crash-mid-ingest

    const intent = await lockIntent(client, event);
    if (intent && intent.customer_account_id && event.customerAccountId && intent.customer_account_id !== event.customerAccountId) {
      throw new PaymentError('INVALID', `customer mismatch for ${intent.canonical_ref}`);
    }

    let ledgerTxnId = null;
    let entitlement = null;
    if (SETTLED_STATUSES.includes(event.status)) {
      if (await findSettledTxn(client, event, intent)) {
        // A second "settled" event for the same payment (e.g. FILLED then OVER_FILLED):
        // recorded, but never posted or granted twice. Support reconciles the delta.
        entitlement = { skipped: 'already_settled' };
      } else {
        const posted = await postSettledPayment(client, { event, eventRowId, intent });
        ledgerTxnId = posted.txnId;
        entitlement = await grantEntitlement(client, { eventRowId, event, intent, now });
      }
    } else if (REVERSAL_STATUSES.includes(event.status)) {
      const originalTxnId = await findSettledTxn(client, event, intent);
      if (originalTxnId) {
        const rev = await postReversal(client, { event, eventRowId, originalTxnId });
        ledgerTxnId = rev.txnId;
        if (rev.fullyReversed && intent) {
          const r = await client.query(
            `UPDATE payment_entitlement_grants SET status = 'revoked', revoked_by_event_id = $1
              WHERE canonical_ref = $2 AND status = 'active' RETURNING id`,
            [eventRowId, intent.canonical_ref],
          );
          entitlement = { revoked: r.rows.map((x) => x.id) };
        }
      } else {
        entitlement = { skipped: 'nothing_settled_to_reverse' };
      }
    }

    if (ledgerTxnId) await client.query('UPDATE payment_events SET ledger_txn_id = $1 WHERE id = $2', [ledgerTxnId, eventRowId]);
    if (intent) {
      await client.query('UPDATE payment_intents SET status = $1, provider_payment_id = COALESCE(provider_payment_id, $2), updated_at = now() WHERE canonical_ref = $3',
        [event.status, event.providerPaymentId, intent.canonical_ref]);
    }
    await client.query(
      `INSERT INTO outbox (event_id, event_type, severity, payload) VALUES ($1, $2, $3, $4)`,
      [`payment_event:${eventRowId}`, `payment.${event.status}`, event.status === 'disputed' ? 'warning' : 'info',
        JSON.stringify({ paymentEventId: String(eventRowId), provider: event.provider, canonicalRef: intent?.canonical_ref ?? event.canonicalRef,
          customerAccountId: intent?.customer_account_id ?? event.customerAccountId, status: event.status,
          amountMinor: event.amountMinor.toString(), currency: event.currency, ledgerTxnId })],
    );
    await client.query('COMMIT');
    return { duplicate: false, eventId: String(eventRowId), status: event.status, ledgerTxnId, entitlement };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Verify → normalise → ingest. Throws PaymentError('BAD_SIGNATURE') before touching the DB. */
export async function ingestWebhook(pool, adapter, rawBody, headers, opts = {}) {
  if (!(await adapter.verifyWebhook(rawBody, headers))) throw new PaymentError('BAD_SIGNATURE', `${adapter.id}: webhook signature rejected`);
  const event = await adapter.normalizeEvent(rawBody, headers);
  if (!event) return { ignored: true };
  return ingestCanonicalEvent(pool, event, opts);
}

/** Record a checkout/invoice intent (called by the checkout API when a customer picks a plan). */
export async function recordIntent(db, i) {
  await db.query(
    `INSERT INTO payment_intents
       (canonical_ref, provider, provider_payment_id, customer_account_id, product_id, intent_kind,
        amount_minor, currency, network, period_days, expires_at, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [i.canonicalRef, i.provider, i.providerPaymentId ?? null, i.customerAccountId, i.productId, i.intentKind,
      BigInt(i.amountMinor).toString(), i.currency, i.network ?? null, i.periodDays ?? null, i.expiresAt ?? null, JSON.stringify(i.metadata ?? {})],
  );
}
