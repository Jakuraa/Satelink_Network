// Preview fee math (Release A, P2.5). BigInt micro-USD only (R4). The configuration in
// config/pricing.preview.json is PROPOSED — NOT APPROVED; this module refuses any other status so an
// unreviewed file can never be presented as approved pricing.
//
// Quote lines say who pays the supplier amount:
//   satelink_credits  — Satelink's own service (inference, strategy evaluation, paper simulation): the
//                       supplier cost + fee + tax are paid from (simulated) Satelink credits.
//   merchant_checkout — procured goods/services: the user pays the merchant directly at the merchant's
//                       checkout; Satelink credits pay ONLY Satelink's fee (+ tax on it). Satelink never
//                       holds customer money to pay third parties.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TaskError, ERR } from './errors.js';

export const FEE_STATUS = 'PROPOSED — NOT APPROVED';
const DEFAULT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'config', 'pricing.preview.json');

const big = (v, what) => {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isSafeInteger(v)) return BigInt(v);
  if (typeof v === 'string' && /^\d+$/.test(v)) return BigInt(v);
  throw new TaskError(ERR.VALIDATION, `${what} must be an integer number of micro-USD.`);
};

/** ceil(a * b / d) for non-negative BigInts. */
export function ceilMulDiv(a, b, d) {
  if (a < 0n || b < 0n || d <= 0n) throw new TaskError(ERR.VALIDATION, 'ceilMulDiv expects non-negative operands');
  const n = a * b;
  return n === 0n ? 0n : (n + d - 1n) / d;
}

export function loadPricing(file = DEFAULT_FILE) {
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  validatePricing(cfg);
  return cfg;
}

export function validatePricing(cfg) {
  const bad = (m) => { throw new TaskError(ERR.VALIDATION, `pricing config: ${m}`); };
  if (cfg.status !== FEE_STATUS) bad(`status must be "${FEE_STATUS}"`);
  if (cfg.currency !== 'USD' || cfg.minor_decimals !== 6) bad('currency must be USD with 6 minor decimals');
  if (cfg.rounding !== 'ceil_to_minor_unit') bad('rounding must be ceil_to_minor_unit');
  for (const [id, p] of Object.entries(cfg.policies || {})) {
    if (p.status !== FEE_STATUS) bad(`policy ${id} must be "${FEE_STATUS}"`);
    if (!['satelink_credits', 'merchant_checkout'].includes(p.supplier_cost_paid_from)) bad(`policy ${id}: supplier_cost_paid_from`);
    if (p.kind === 'percent_of_supplier_cost') {
      if (!Number.isSafeInteger(p.bps) || p.bps < 0 || p.bps > 10_000) bad(`policy ${id}: bps`);
      if (!Number.isSafeInteger(p.min_minor) || p.min_minor < 0) bad(`policy ${id}: min_minor`);
    } else if (p.kind === 'flat') {
      if (!Number.isSafeInteger(p.flat_minor) || p.flat_minor < 0) bad(`policy ${id}: flat_minor`);
    } else bad(`policy ${id}: unknown kind ${p.kind}`);
  }
  if (cfg.tax?.rate_bps !== 0) bad('preview tax rate must be 0 (not computed in preview)');
  return true;
}

/** The Satelink fee for one line, in micro-USD. */
export function feeFor(cfg, policyId, supplierCostMinor) {
  const p = cfg.policies[policyId];
  if (!p) throw new TaskError(ERR.VALIDATION, `unknown fee policy ${policyId}`);
  const cost = big(supplierCostMinor, 'supplier cost');
  if (p.kind === 'flat') return BigInt(p.flat_minor);
  const pct = ceilMulDiv(cost, BigInt(p.bps), 10_000n);
  const min = BigInt(p.min_minor);
  return pct > min ? pct : min;
}

/**
 * Price quote lines. Input lines: { capability_id, description, fee_policy_id, supplier_cost_minor }.
 * Returns lines with fee/tax/paid_from plus totals; every amount is a BigInt.
 */
export function priceLines(cfg, lines) {
  if (!Array.isArray(lines) || lines.length === 0) throw new TaskError(ERR.VALIDATION, 'a quote needs at least one line');
  const out = []; let supplier = 0n; let fee = 0n; let tax = 0n; let credit = 0n;
  for (const l of lines) {
    const policy = cfg.policies[l.fee_policy_id];
    if (!policy) throw new TaskError(ERR.VALIDATION, `unknown fee policy ${l.fee_policy_id}`);
    const cost = big(l.supplier_cost_minor, 'supplier cost');
    const f = feeFor(cfg, l.fee_policy_id, cost);
    const t = ceilMulDiv(f, BigInt(cfg.tax.rate_bps), 10_000n); // tax on Satelink's fee only (0 in preview)
    const paidFrom = policy.supplier_cost_paid_from;
    const creditPart = (paidFrom === 'satelink_credits' ? cost : 0n) + f + t;
    out.push({
      capability_id: l.capability_id, description: l.description, fee_policy_id: l.fee_policy_id, fee_policy_status: FEE_STATUS,
      supplier_cost_minor: cost, satelink_fee_minor: f, tax_minor: t, line_total_minor: cost + f + t,
      supplier_cost_paid_from: paidFrom, credit_charge_minor: creditPart,
    });
    supplier += cost; fee += f; tax += t; credit += creditPart;
  }
  return { lines: out, supplier_cost_minor: supplier, satelink_fee_minor: fee, tax_minor: tax, total_minor: supplier + fee + tax, credit_charge_minor: credit };
}

/** micro-USD BigInt → "1.234567" (exact; no floats). */
export function formatUsd(minor) {
  const m = big(minor, 'amount');
  const whole = m / 1_000_000n; const frac = (m % 1_000_000n).toString().padStart(6, '0');
  return `${whole}.${frac}`;
}
