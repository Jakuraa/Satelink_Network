import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { createFinancialTruthRouter, CONSUMED_USAGE_PREDICATE } from '../src/services/financial/truth.js';

// S6 (mandate W1, 2026-10-20): /api/financial/truth summed every revenue_events_v2 row as
// "metered value" — deposits (subscription_payment, pack_purchase), refund reversals and
// never-charged phantom rows included. Every query that sums revenue_events_v2.amount_usdt
// must apply the consumed-usage predicate.

function capturePool() {
  const sql = [];
  return {
    sql,
    async query(q) {
      sql.push(String(q));
      return { rows: [{}], rowCount: 0 };
    },
  };
}

describe('S6 — financial truth counts consumed usage only', () => {
  it('the predicate excludes deposits, refund reversals and non-billable rows', () => {
    for (const t of ["'subscription_payment'", "'pack_purchase'", "'refund_reversal'"]) expect(CONSUMED_USAGE_PREDICATE).to.include(t);
    expect(CONSUMED_USAGE_PREDICATE).to.match(/NOT IN/);
    expect(CONSUMED_USAGE_PREDICATE).to.match(/COALESCE\(e\.is_billable, true\)/);
  });

  it('every revenue_events_v2 sum in /truth applies the predicate', async () => {
    const pool = capturePool();
    const app = express();
    app.use('/api/financial', createFinancialTruthRouter(pool));
    await request(app).get('/api/financial/truth');
    const sums = pool.sql.filter((q) => /FROM revenue_events_v2/.test(q) && /SUM\(e?\.?amount_usdt\)/i.test(q));
    expect(sums.length, 'revenue_events_v2 sums seen').to.be.at.least(2);
    for (const q of sums) expect(q).to.include(CONSUMED_USAGE_PREDICATE);
  });
});
