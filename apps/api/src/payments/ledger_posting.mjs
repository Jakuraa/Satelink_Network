// Financial OS posting for provider payments — INSIDE the caller's transaction.
//
// Unlike apps/api/src/ledger/shadow_ledger_write.js (own connection, flag-gated,
// swallows errors — unchanged by this module), these functions take the
// ingest transaction's `client` and THROW on any failure, so a payment event,
// its ledger posting and its entitlement change commit or roll back together.
// The 009 deferred balance trigger checks every txn at COMMIT.
//
// Accounts (all owned by prn_platform, one per (kind, currency) — 002's unique
// key — so unlike currencies can never share an account):
//   provider clearing   kind 'clearing_<provider>'  debit-normal   money the provider/chain holds for us
//   revenue             kind 'revenue'              credit-normal  reuses acct_platform_revenue for USDT
//   customer credit     kind 'customer_credit'      credit-normal  overpayment owed back / spendable by the customer;
//                                                                  per-customer split via ref_type='customer_credit', ref_id=<customer>
// Kinds (038, founder-approved): 'payment' (one-time / credit pack), 'subscription'
// (a paid period); reversals of either post 'refund' (019 semantics: money returned
// to a customer for a recognised revenue event, incl. a lost dispute).
import { decimalsFor, PaymentError } from './contract.mjs';

export const PLATFORM_PRINCIPAL = 'prn_platform';

function accountId(kind, currency) {
  return `acct_pay_${kind}_${currency.toLowerCase()}`;
}

/** Resolve (or create) the platform account for (kind, currency). Returns its id. */
export async function ensurePlatformAccount(client, kind, currency, normality) {
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(kind)) throw new PaymentError('INVALID', `bad account kind ${kind}`);
  const decimals = decimalsFor(currency);
  const found = await client.query(
    'SELECT id, normality, decimals FROM accounts WHERE principal_id = $1 AND kind = $2 AND currency = $3',
    [PLATFORM_PRINCIPAL, kind, currency],
  );
  if (found.rows[0]) {
    const a = found.rows[0];
    if (a.normality !== normality || Number(a.decimals) !== decimals) {
      throw new PaymentError('INVALID', `account ${a.id} has normality/decimals ${a.normality}/${a.decimals}, expected ${normality}/${decimals}`);
    }
    return a.id;
  }
  const id = accountId(kind, currency);
  await client.query(
    `INSERT INTO accounts (id, principal_id, kind, normality, currency, decimals, state)
     VALUES ($1, $2, $3, $4, $5, $6, 'open')
     ON CONFLICT (principal_id, kind, currency) DO NOTHING`,
    [id, PLATFORM_PRINCIPAL, kind, normality, currency, decimals],
  );
  const again = await client.query(
    'SELECT id FROM accounts WHERE principal_id = $1 AND kind = $2 AND currency = $3',
    [PLATFORM_PRINCIPAL, kind, currency],
  );
  return again.rows[0].id;
}

function clearingKind(provider) {
  return `clearing_${provider.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
}

async function insertTxn(client, { txnId, kind, refType, refId, currency, legs }) {
  let debit = 0n; let credit = 0n;
  for (const l of legs) {
    if (typeof l.amount !== 'bigint' || l.amount <= 0n) throw new PaymentError('INVALID', 'ledger leg amount must be a positive BigInt');
    if (l.direction === 'debit') debit += l.amount; else credit += l.amount;
  }
  if (debit !== credit) throw new PaymentError('INVALID', `unbalanced posting ${txnId}: ${debit} != ${credit}`);
  const hdr = await client.query(
    `INSERT INTO ledger_txns (txn_id, kind, ref_type, ref_id, currency, state, posted_at)
     VALUES ($1, $2, $3, $4, $5, 'posted', now())
     ON CONFLICT (txn_id) DO NOTHING RETURNING txn_id`,
    [txnId, kind, refType, refId, currency],
  );
  if (hdr.rowCount === 0) throw new PaymentError('INVALID', `ledger txn ${txnId} already exists`);
  for (const l of legs) {
    await client.query(
      `INSERT INTO ledger_entries
         (txn_id, account_id, direction, amount, currency, state, ref_type, ref_id, idem_key, posted_at, reverses_entry_id)
       VALUES ($1, $2, $3, $4, $5, 'posted', $6, $7, $8, now(), $9)`,
      [txnId, l.accountId, l.direction, l.amount.toString(), currency, l.refType ?? refType, l.refId ?? refId, `${txnId}:${l.leg}`, l.reverses ?? null],
    );
  }
  return txnId;
}

/**
 * Post a settled payment. `receivedMinor` is what arrived; `planMinor` is what
 * the intent asked for (null = no intent: the whole amount is a customer credit
 * top-up, never revenue). Overpayment remainder → customer credit.
 * Returns { txnId, revenueMinor, customerCreditMinor }.
 */
export async function postSettledPayment(client, { event, eventRowId, intent }) {
  const { currency, provider } = event;
  const received = event.amountMinor;
  if (received <= 0n) throw new PaymentError('INVALID', 'a settled payment must carry a positive amount');
  const planMinor = intent ? BigInt(intent.amount_minor) : null;
  if (intent && intent.currency !== currency) {
    throw new PaymentError('INVALID', `currency mismatch: intent ${intent.currency} vs event ${currency}`);
  }
  const revenueMinor = planMinor === null ? 0n : (received < planMinor ? received : planMinor);
  const creditMinor = received - revenueMinor;

  const clearing = await ensurePlatformAccount(client, clearingKind(provider), currency, 'debit');
  const legs = [{ leg: 'clearing', accountId: clearing, direction: 'debit', amount: received }];
  if (revenueMinor > 0n) {
    legs.push({ leg: 'revenue', accountId: await ensurePlatformAccount(client, 'revenue', currency, 'credit'), direction: 'credit', amount: revenueMinor });
  }
  if (creditMinor > 0n) {
    if (!event.customerAccountId && !intent?.customer_account_id) {
      throw new PaymentError('INVALID', 'customer credit needs a customer account');
    }
    legs.push({
      leg: 'customer_credit',
      accountId: await ensurePlatformAccount(client, 'customer_credit', currency, 'credit'),
      direction: 'credit', amount: creditMinor,
      refType: 'customer_credit', refId: intent?.customer_account_id ?? event.customerAccountId,
    });
  }
  const kind = intent?.intent_kind === 'subscription_period' ? 'subscription' : 'payment';
  const txnId = await insertTxn(client, {
    txnId: `pay:${provider}:${event.providerEventId}`,
    kind, refType: 'payment_event', refId: String(eventRowId), currency, legs,
  });
  return { txnId, revenueMinor, customerCreditMinor: creditMinor };
}

/**
 * Post the reversal of an earlier settled payment (refund / lost dispute).
 * Mirrors the original legs (debits ↔ credits) pro rata to `event.amountMinor`,
 * capped at what remains unreversed — never deletes or edits original rows.
 */
export async function postReversal(client, { event, eventRowId, originalTxnId }) {
  const orig = await client.query(
    `SELECT id, account_id, direction, amount, currency, ref_type, ref_id, idem_key
       FROM ledger_entries WHERE txn_id = $1 ORDER BY id`,
    [originalTxnId],
  );
  if (orig.rowCount === 0) throw new PaymentError('INVALID', `original ledger txn ${originalTxnId} not found`);
  const currency = orig.rows[0].currency;
  if (currency !== event.currency) throw new PaymentError('INVALID', `currency mismatch on reversal: ${currency} vs ${event.currency}`);

  const debitLegs = orig.rows.filter((r) => r.direction === 'debit');
  const total = debitLegs.reduce((s, r) => s + BigInt(r.amount), 0n);
  const already = await client.query(
    `SELECT COALESCE(SUM(le.amount), 0)::text AS amt
       FROM ledger_entries le JOIN ledger_entries o ON o.id = le.reverses_entry_id
      WHERE o.txn_id = $1 AND le.direction = 'credit'`,
    [originalTxnId],
  );
  const remaining = total - BigInt(already.rows[0].amt);
  let amount = event.amountMinor === 0n ? remaining : event.amountMinor;
  if (amount > remaining) amount = remaining;
  if (amount <= 0n) return { txnId: null, reversedMinor: 0n };

  // Scale each original leg by amount/total; push the integer remainder onto the
  // largest leg of each side so both sides still sum to `amount` exactly.
  const scaleSide = (rows) => {
    const out = rows.map((r) => ({ r, amt: (BigInt(r.amount) * amount) / total }));
    const diff = amount - out.reduce((s, x) => s + x.amt, 0n);
    out.sort((a, b) => (BigInt(b.r.amount) > BigInt(a.r.amount) ? 1 : -1))[0].amt += diff;
    return out.filter((x) => x.amt > 0n);
  };
  const legs = [
    ...scaleSide(debitLegs).map(({ r, amt }) => ({ r, amt, direction: 'credit' })),
    ...scaleSide(orig.rows.filter((r) => r.direction === 'credit')).map(({ r, amt }) => ({ r, amt, direction: 'debit' })),
  ].map(({ r, amt, direction }) => ({
    leg: `rev_${r.id}`, accountId: r.account_id, direction, amount: amt,
    refType: r.ref_type === 'customer_credit' ? 'customer_credit' : undefined,
    refId: r.ref_type === 'customer_credit' ? r.ref_id : undefined,
    reverses: r.id,
  }));
  const txnId = await insertTxn(client, {
    txnId: `pay:${event.provider}:${event.providerEventId}`,
    kind: 'refund', refType: 'payment_event', refId: String(eventRowId), currency, legs,
  });
  return { txnId, reversedMinor: amount, fullyReversed: amount === remaining };
}
