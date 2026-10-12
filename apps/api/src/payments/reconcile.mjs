// Provider ⟷ payment_events ⟷ ledger reconciliation (2026-10-12 directive, Wave 1.9).
// Runs in a WORKER (workers/payments-reconciler), never the API process. Read-only on
// money: it only writes provider_reconciliation_runs and outbox alerts; it never posts,
// edits or deletes a ledger row — a human fixes mismatches from the admin queue
// (provider_reconciliation_runs WHERE status = 'mismatch').
//
// Mismatch kinds:
//   missing_event      provider reports a payment state Satelink never ingested
//   status_mismatch    provider's latest status ≠ Satelink's latest status for that payment
//   amount_mismatch    settled amount differs (same currency) — or the currency differs
//   missing_posting    a settled/reversal event that should have a ledger txn has none
//   posting_unbalanced a ledger txn from payments whose debits ≠ credits (should be impossible)
//   orphan_event       Satelink holds a settled event the provider does not report in the window
import { SETTLED_STATUSES, REVERSAL_STATUSES } from './contract.mjs';

export async function reconcileProvider(pool, adapter, { windowStart, windowEnd, providerRecords, reconcileArgs = {}, logger = console } = {}) {
  const run = await pool.query(
    `INSERT INTO provider_reconciliation_runs (provider, window_start, window_end) VALUES ($1, $2, $3) RETURNING id`,
    [adapter.id, windowStart, windowEnd],
  );
  const runId = run.rows[0].id;
  try {
    const records = providerRecords ?? await adapter.reconcile({ windowStart, windowEnd, ...reconcileArgs });
    const ev = await pool.query(
      `SELECT DISTINCT ON (provider_payment_id) id, provider_payment_id, status, amount_minor::text, currency, ledger_txn_id
         FROM payment_events
        WHERE provider = $1 AND received_at >= $2 AND received_at < $3 AND provider_payment_id IS NOT NULL
        ORDER BY provider_payment_id, id DESC`,
      [adapter.id, windowStart, windowEnd],
    );
    const ours = new Map(ev.rows.map((r) => [r.provider_payment_id, r]));
    const mismatches = [];
    const seen = new Set();
    for (const p of records) {
      seen.add(p.providerPaymentId);
      const o = ours.get(p.providerPaymentId);
      if (!o) { if (p.status !== 'pending') mismatches.push({ kind: 'missing_event', providerPaymentId: p.providerPaymentId, providerStatus: p.status }); continue; }
      if (o.status !== p.status) mismatches.push({ kind: 'status_mismatch', providerPaymentId: p.providerPaymentId, ours: o.status, provider: p.status });
      if (SETTLED_STATUSES.includes(p.status) && SETTLED_STATUSES.includes(o.status)
          && (o.currency !== p.currency || BigInt(o.amount_minor) !== BigInt(p.amountMinor))) {
        mismatches.push({ kind: 'amount_mismatch', providerPaymentId: p.providerPaymentId, ours: `${o.amount_minor} ${o.currency}`, provider: `${p.amountMinor} ${p.currency}` });
      }
    }
    for (const o of ev.rows) {
      if (!seen.has(o.provider_payment_id) && SETTLED_STATUSES.includes(o.status)) mismatches.push({ kind: 'orphan_event', providerPaymentId: o.provider_payment_id, ours: o.status });
    }
    // every money-moving event must carry its posting, unless a later rule deliberately skipped it
    const unposted = await pool.query(
      `SELECT e.id, e.provider_payment_id, e.status FROM payment_events e
        WHERE e.provider = $1 AND e.received_at >= $2 AND e.received_at < $3
          AND e.status = ANY($4) AND e.ledger_txn_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM payment_events s WHERE s.provider = e.provider AND s.provider_payment_id = e.provider_payment_id
                           AND s.id < e.id AND s.ledger_txn_id IS NOT NULL AND s.status = ANY($5))`,
      [adapter.id, windowStart, windowEnd, [...SETTLED_STATUSES, ...REVERSAL_STATUSES], SETTLED_STATUSES],
    );
    for (const u of unposted.rows) mismatches.push({ kind: 'missing_posting', paymentEventId: String(u.id), providerPaymentId: u.provider_payment_id, status: u.status });
    const unbalanced = await pool.query(
      `SELECT le.txn_id FROM ledger_entries le JOIN payment_events e ON e.ledger_txn_id = le.txn_id
        WHERE e.provider = $1 AND e.received_at >= $2 AND e.received_at < $3
        GROUP BY le.txn_id
       HAVING SUM(le.amount) FILTER (WHERE le.direction='debit') IS DISTINCT FROM SUM(le.amount) FILTER (WHERE le.direction='credit')`,
      [adapter.id, windowStart, windowEnd],
    );
    for (const u of unbalanced.rows) mismatches.push({ kind: 'posting_unbalanced', ledgerTxnId: u.txn_id });

    const postings = await pool.query(
      `SELECT COUNT(*)::int n FROM payment_events WHERE provider = $1 AND received_at >= $2 AND received_at < $3 AND ledger_txn_id IS NOT NULL`,
      [adapter.id, windowStart, windowEnd],
    );
    const status = mismatches.length ? 'mismatch' : 'clean';
    await pool.query(
      `UPDATE provider_reconciliation_runs SET status = $1, provider_records = $2, payment_events = $3, ledger_postings = $4,
              mismatches = $5, finished_at = now() WHERE id = $6`,
      [status, records.length, ev.rowCount, postings.rows[0].n, JSON.stringify(mismatches), runId],
    );
    if (mismatches.length) {
      await pool.query(
        `INSERT INTO outbox (event_id, event_type, severity, payload) VALUES ($1, 'payments.reconciliation_mismatch', 'critical', $2)
         ON CONFLICT (event_id) DO NOTHING`,
        [`payments_recon:${runId}`, JSON.stringify({ runId: String(runId), provider: adapter.id, count: mismatches.length, kinds: [...new Set(mismatches.map((m) => m.kind))] })],
      );
    }
    return { runId: String(runId), status, mismatches };
  } catch (err) {
    // NOT_CONFIGURED / UNSUPPORTED providers record an 'error' run instead of looking clean.
    await pool.query(`UPDATE provider_reconciliation_runs SET status = 'error', error = $1, finished_at = now() WHERE id = $2`, [String(err?.message ?? err).slice(0, 500), runId]);
    logger.error?.(`[payments-recon] ${adapter.id}: ${err?.message ?? err}`);
    return { runId: String(runId), status: 'error', error: String(err?.message ?? err) };
  }
}

/** The previous UTC day — the default daily window. */
export function previousUtcDay(now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { windowStart: new Date(end.getTime() - 86_400_000), windowEnd: end };
}
