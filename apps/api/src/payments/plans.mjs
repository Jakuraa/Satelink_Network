// Trading AI plans, entitlements and crypto renewals (2026-10-12 directive, Wave 1.7).
//
// * Plans come from config (apps/api/config/trading_ai_plans.v1.json, status 'draft' —
//   every price/limit is FOUNDER TO CONFIRM). Nothing here or in the UI hard-codes a price.
// * Fiat recurring = Razorpay (when live). Crypto = PREPAID: each paid invoice extends the
//   entitlement by one period (payment_entitlement_grants, stacked — see ingest.mjs);
//   reminders at T-7 / T-3 / T-0; a configured grace period; NEVER an auto-charge.
// * Entitlements are enforced SERVER-SIDE by planGate(): it resolves the principal's plan
//   from active grants and checks today's usage from the EXISTING metering store (the
//   AgentAccessGuard usage rows → shadow revenue engine). No new metering pipeline.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PaymentError, decimalsFor } from './contract.mjs';

const CONFIG_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'config', 'trading_ai_plans.v1.json');
const DAY_MS = 86_400_000;
export const LIMIT_KEYS = Object.freeze(['agentRunsPerDay', 'deepReasoningPerDay', 'backtestsPerDay', 'liveStrategies', 'apiCallsPerDay']);

export function validatePlanCatalog(c) {
  const fail = (m) => { throw new PaymentError('INVALID', `plan catalog: ${m}`); };
  if (!c || typeof c.version !== 'string' || !['draft', 'published'].includes(c.status)) fail('version/status');
  if (!Number.isInteger(c.periodDays) || c.periodDays <= 0) fail('periodDays');
  if (!Number.isInteger(c.graceDays) || c.graceDays < 0) fail('graceDays');
  const ids = new Set();
  for (const p of [...(c.plans ?? []), ...(c.creditPacks ?? [])]) {
    if (!/^trading_ai_[a-z0-9_]+$/.test(p.id ?? '')) fail(`bad id ${p.id}`);
    if (ids.has(p.id)) fail(`duplicate id ${p.id}`);
    ids.add(p.id);
    for (const [cur, amt] of Object.entries(p.price ?? {})) {
      decimalsFor(cur);
      if (amt !== null && !/^\d+$/.test(String(amt))) fail(`${p.id} ${cur} price must be integer minor units`);
    }
  }
  for (const p of c.plans ?? []) {
    for (const k of LIMIT_KEYS) if (!Number.isInteger(p.limits?.[k]) || p.limits[k] < 0) fail(`${p.id} limit ${k}`);
    if (p.renewsAs && !ids.has(p.renewsAs)) fail(`${p.id} renewsAs unknown plan`);
  }
  if (!(c.plans ?? []).some((p) => p.price === null)) fail('a free plan (price null) is required');
  return c;
}

let cached = null;
export function loadPlanCatalog(path = CONFIG_PATH) {
  if (path === CONFIG_PATH && cached) return cached;
  const c = Object.freeze(validatePlanCatalog(JSON.parse(readFileSync(path, 'utf8'))));
  if (path === CONFIG_PATH) cached = c;
  return c;
}

export function planById(catalog, id) {
  return catalog.plans.find((p) => p.id === id) ?? catalog.creditPacks.find((p) => p.id === id) ?? null;
}
export function freePlan(catalog) { return catalog.plans.find((p) => p.price === null); }

/**
 * Price to charge for one purchase, in integer minor units. `firstPeriod` applies the
 * intro price (Launch: $5 first month). Refuses a currency the founder has not priced.
 */
export function quote(catalog, planId, currency, { firstPeriod = false, mode = 'test' } = {}) {
  if (mode === 'live' && catalog.status !== 'published') throw new PaymentError('DISABLED', `plan catalog ${catalog.version} is ${catalog.status}: founder must confirm prices before live checkout`);
  const p = planById(catalog, planId);
  if (!p || p.price === null) throw new PaymentError('INVALID', `${planId} is not a paid plan`);
  const table = firstPeriod && p.introPrice ? p.introPrice : p.price;
  const amt = table[currency];
  if (amt === null || amt === undefined) throw new PaymentError('UNSUPPORTED', `${planId} has no ${currency} price (founder to set)`);
  const isPack = catalog.creditPacks.some((x) => x.id === planId);
  return {
    planId, currency, amountMinor: BigInt(amt),
    intentKind: isPack ? 'credit_pack' : 'subscription_period',
    periodDays: isPack ? null : catalog.periodDays,
    // a renewal of an intro plan is billed as the plan it renews into
    renewalPlanId: isPack ? null : (p.renewsAs ?? p.id),
    catalogVersion: catalog.version,
  };
}

/**
 * The principal's effective plan right now: the highest-priced active period grant that
 * covers `now` (or is inside the grace window), else Free. Read-only.
 */
export async function effectivePlan(db, customerAccountId, { catalog = loadPlanCatalog(), now = new Date() } = {}) {
  const graceMs = catalog.graceDays * DAY_MS;
  const r = await db.query(
    `SELECT product_id, period_start, period_end FROM payment_entitlement_grants
      WHERE customer_account_id = $1 AND grant_kind = 'period' AND status = 'active'
        AND period_start <= $2::timestamptz AND period_end + make_interval(secs => $3::double precision / 1000) > $2::timestamptz`,
    [customerAccountId, now, graceMs],
  );
  let best = null;
  for (const row of r.rows) {
    const p = planById(catalog, row.product_id);
    if (!p || p.price === null) continue;
    const rank = BigInt(p.price.USD ?? 0);
    if (!best || rank > best.rank) best = { plan: p, rank, periodEnd: new Date(row.period_end), inGrace: new Date(row.period_end) <= now };
  }
  if (!best) return { plan: freePlan(catalog), periodEnd: null, inGrace: false };
  return { plan: best.plan, periodEnd: best.periodEnd, inGrace: best.inGrace };
}

/**
 * Server-side gate for one Trading AI action. `usage.countToday(principalId, feature, now)`
 * reads the EXISTING metering store; this function never writes usage itself.
 * feature ∈ agentRuns | deepReasoning | backtests | apiCalls ; liveStrategies is a level, passed as `current`.
 * Returns { allowed, plan, limit, used } — callers turn !allowed into 402 PLAN_LIMIT.
 */
export async function planGate(db, { customerAccountId, feature, usage, current, catalog = loadPlanCatalog(), now = new Date() }) {
  const key = feature === 'liveStrategies' ? 'liveStrategies' : `${feature}PerDay`;
  if (!LIMIT_KEYS.includes(key)) throw new PaymentError('INVALID', `unknown gated feature ${feature}`);
  const { plan, inGrace } = await effectivePlan(db, customerAccountId, { catalog, now });
  const limit = plan.limits[key];
  const used = feature === 'liveStrategies' ? Number(current ?? 0) : Number(await usage.countToday(customerAccountId, feature, now));
  return { allowed: used < limit, plan: plan.id, limit, used, inGrace };
}

/**
 * Renewal reminders for prepaid (crypto) periods: one outbox row per (grant, T-day),
 * idempotent by event_id, for grants ending within the reminder windows. No charge is
 * ever attempted — the reminder links to a fresh renewal invoice.
 */
export async function queueRenewalReminders(db, { catalog = loadPlanCatalog(), now = new Date() } = {}) {
  const r = await db.query(
    `SELECT g.id, g.customer_account_id, g.product_id, g.period_end
       FROM payment_entitlement_grants g
      WHERE g.grant_kind = 'period' AND g.status = 'active'
        AND g.period_end > $1::timestamptz - interval '1 day' AND g.period_end <= $1::timestamptz + make_interval(days => $2::int)
        AND NOT EXISTS (SELECT 1 FROM payment_entitlement_grants n
                         WHERE n.customer_account_id = g.customer_account_id AND n.product_id = g.product_id
                           AND n.status = 'active' AND n.grant_kind = 'period' AND n.period_start >= g.period_end)`,
    [now, Math.max(...catalog.renewalReminderDays)],
  );
  let queued = 0;
  for (const g of r.rows) {
    const daysLeft = Math.max(0, Math.ceil((new Date(g.period_end).getTime() - now.getTime()) / DAY_MS));
    const due = catalog.renewalReminderDays.filter((d) => daysLeft <= d).sort((a, b) => a - b)[0];
    if (due === undefined) continue;
    const ins = await db.query(
      `INSERT INTO outbox (event_id, event_type, severity, payload) VALUES ($1, 'subscription.renewal_due', 'info', $2)
       ON CONFLICT (event_id) DO NOTHING`,
      [`renewal:${g.id}:T-${due}`, JSON.stringify({ grantId: String(g.id), customerAccountId: g.customer_account_id, planId: g.product_id, periodEnd: new Date(g.period_end).toISOString(), reminder: `T-${due}` })],
    );
    queued += ins.rowCount;
  }
  return { queued };
}
