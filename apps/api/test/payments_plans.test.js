// Trading AI plans (Wave 1.7) — pure config/quote tests. DB-backed entitlement
// resolution is covered in database/__tests__/payments_ingest.integration.test.ts.
import { expect } from 'chai';
import { loadPlanCatalog, validatePlanCatalog, quote, planById, freePlan, planGate } from '../src/payments/plans.mjs';

describe('Trading AI plan catalog (founder to confirm)', () => {
  const c = loadPlanCatalog();

  it('loads, validates, and is still a DRAFT (no live checkout until the founder publishes)', () => {
    expect(c.status).to.equal('draft');
    expect(freePlan(c).id).to.equal('trading_ai_free');
    expect(c.plans.map((p) => p.id)).to.include.members(['trading_ai_free', 'trading_ai_launch', 'trading_ai_pro', 'trading_ai_max']);
    expect(() => quote(c, 'trading_ai_pro', 'USDT', { mode: 'live' })).to.throw(/founder must confirm/);
  });

  it('quotes integer minor units per currency; Launch intro is $5, renews as Pro', () => {
    expect(quote(c, 'trading_ai_pro', 'USDT')).to.include({ amountMinor: 19_000_000n, intentKind: 'subscription_period', periodDays: 30 });
    expect(quote(c, 'trading_ai_launch', 'USD', { firstPeriod: true }).amountMinor).to.equal(500n);
    expect(quote(c, 'trading_ai_launch', 'USD').renewalPlanId).to.equal('trading_ai_pro');
    expect(quote(c, 'trading_ai_credits_10', 'USDC')).to.include({ intentKind: 'credit_pack', periodDays: null });
  });

  it('refuses unpriced currencies and the free plan instead of guessing', () => {
    expect(() => quote(c, 'trading_ai_pro', 'INR')).to.throw(/founder to set/);
    expect(() => quote(c, 'trading_ai_free', 'USD')).to.throw(/not a paid plan/);
    expect(() => quote(c, 'trading_ai_nope', 'USD')).to.throw(/not a paid plan/);
  });

  it('validation rejects float prices, missing limits and a catalog without a free plan', () => {
    const base = JSON.parse(JSON.stringify(c));
    const bad1 = JSON.parse(JSON.stringify(base)); bad1.plans[2].price.USD = 19.99;
    expect(() => validatePlanCatalog(bad1)).to.throw(/integer minor units/);
    const bad2 = JSON.parse(JSON.stringify(base)); delete bad2.plans[2].limits.backtestsPerDay;
    expect(() => validatePlanCatalog(bad2)).to.throw(/limit backtestsPerDay/);
    const bad3 = JSON.parse(JSON.stringify(base)); bad3.plans = bad3.plans.filter((p) => p.price !== null);
    expect(() => validatePlanCatalog(bad3)).to.throw(/free plan/);
  });

  it('planGate enforces the free plan when no grant exists (server-side, reads existing metering)', async () => {
    const db = { query: async () => ({ rows: [] }) };
    const usage = { countToday: async () => 5 };
    const r = await planGate(db, { customerAccountId: 'c', feature: 'agentRuns', usage, catalog: c });
    expect(r).to.include({ allowed: false, plan: 'trading_ai_free', limit: 5, used: 5 });
    expect((await planGate(db, { customerAccountId: 'c', feature: 'liveStrategies', current: 0, usage, catalog: c })).allowed).to.equal(false);
    expect(planById(c, 'trading_ai_max').limits.liveStrategies).to.equal(5);
  });
});
