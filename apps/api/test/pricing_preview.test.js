// apps/api/test/pricing_preview.test.js — Release A P2.6 fee math: unit + seeded property tests (BigInt only).
import { expect } from 'chai';
import { loadPricing, validatePricing, feeFor, priceLines, ceilMulDiv, formatUsd, FEE_STATUS } from '../src/workflows/pricing.js';

// Deterministic PRNG (mulberry32) so property failures are reproducible.
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const randMinor = (r, max = 10_000_000_000) => BigInt(Math.floor(r() * max));

describe('preview pricing (P2.5/P2.6)', () => {
  const cfg = loadPricing();

  it('the shipped config is labelled PROPOSED — NOT APPROVED everywhere', () => {
    expect(cfg.status).to.equal(FEE_STATUS);
    for (const p of Object.values(cfg.policies)) expect(p.status).to.equal(FEE_STATUS);
  });

  it('refuses a config that claims approval or uses non-integer amounts', () => {
    expect(() => validatePricing({ ...cfg, status: 'APPROVED' })).to.throw(/PROPOSED/);
    const p = structuredClone(cfg); p.policies.procurement_10pct_min_2000.status = 'APPROVED';
    expect(() => validatePricing(p)).to.throw(/procurement_10pct_min_2000/);
    const q = structuredClone(cfg); q.policies.strategy_eval_flat_100000.flat_minor = 0.1;
    expect(() => validatePricing(q)).to.throw(/flat_minor/);
  });

  it('default fees: inference +20%, procurement 10% min $0.002, strategy eval $0.10, paper $0.05', () => {
    expect(feeFor(cfg, 'inference_markup_20pct', 1_000_000n)).to.equal(200_000n);
    expect(feeFor(cfg, 'procurement_10pct_min_2000', 5_000_000n)).to.equal(500_000n);
    expect(feeFor(cfg, 'procurement_10pct_min_2000', 1_000n)).to.equal(2_000n); // minimum
    expect(feeFor(cfg, 'strategy_eval_flat_100000', 0n)).to.equal(100_000n);
    expect(feeFor(cfg, 'paper_sim_flat_50000', 123n)).to.equal(50_000n);
  });

  it('rounds up to the micro-unit, never down', () => {
    expect(feeFor(cfg, 'inference_markup_20pct', 1n)).to.equal(1n); // 0.2 µ → 1 µ
    expect(feeFor(cfg, 'inference_markup_20pct', 7n)).to.equal(2n); // 1.4 µ → 2 µ
    expect(ceilMulDiv(0n, 2000n, 10000n)).to.equal(0n);
  });

  it('rejects floats and negatives as money (R4)', () => {
    expect(() => feeFor(cfg, 'inference_markup_20pct', 1.5)).to.throw(/integer/);
    expect(() => feeFor(cfg, 'inference_markup_20pct', -5)).to.throw();
    expect(() => priceLines(cfg, [{ capability_id: 'x.y', fee_policy_id: 'inference_markup_20pct', supplier_cost_minor: '1.2' }])).to.throw(/integer/);
  });

  it('property: percentage fee = exact ceiling, ≥ minimum, monotonic in cost (5,000 seeded cases)', () => {
    const r = rng(20261104);
    for (let i = 0; i < 5000; i++) {
      const id = r() < 0.5 ? 'inference_markup_20pct' : 'procurement_10pct_min_2000';
      const p = cfg.policies[id];
      const a = randMinor(r); const b = a + randMinor(r, 1_000_000);
      const fa = feeFor(cfg, id, a); const fb = feeFor(cfg, id, b);
      const exact = a * BigInt(p.bps);
      expect(fa >= BigInt(p.min_minor)).to.equal(true);
      if (fa > BigInt(p.min_minor)) { expect(fa * 10_000n >= exact).to.equal(true); expect((fa - 1n) * 10_000n < exact).to.equal(true); }
      expect(fb >= fa, `monotonic ${a} ${b}`).to.equal(true);
    }
  });

  it('property: totals add up, credits never pay a merchant, credit charge ≤ total (2,000 seeded quotes)', () => {
    const r = rng(42); const ids = Object.keys(cfg.policies);
    for (let i = 0; i < 2000; i++) {
      const lines = Array.from({ length: 1 + Math.floor(r() * 4) }, (_, k) => ({ capability_id: `cap.l${k}`, description: 'x', fee_policy_id: ids[Math.floor(r() * ids.length)], supplier_cost_minor: randMinor(r) }));
      const q = priceLines(cfg, lines);
      expect(q.total_minor).to.equal(q.supplier_cost_minor + q.satelink_fee_minor + q.tax_minor);
      expect(q.lines.reduce((s, l) => s + l.line_total_minor, 0n)).to.equal(q.total_minor);
      expect(q.credit_charge_minor <= q.total_minor).to.equal(true);
      for (const l of q.lines) {
        expect(typeof l.supplier_cost_minor).to.equal('bigint');
        if (l.supplier_cost_paid_from === 'merchant_checkout') expect(l.credit_charge_minor).to.equal(l.satelink_fee_minor + l.tax_minor);
        else expect(l.credit_charge_minor).to.equal(l.line_total_minor);
        expect(l.fee_policy_status).to.equal(FEE_STATUS);
      }
    }
  });

  it('formats micro-USD exactly', () => {
    expect(formatUsd(0n)).to.equal('0.000000');
    expect(formatUsd(1_234_567n)).to.equal('1.234567');
    expect(formatUsd(9_007_199_254_740_993n)).to.equal('9007199254.740993'); // beyond 2^53: no float loss
  });
});
