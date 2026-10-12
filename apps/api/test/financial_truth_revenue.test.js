import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { createFinancialTruthRouter } from '../src/services/financial/truth.js';
import { getEarningsOverview } from '../src/dashboard_api/earnings_overview.js';

describe('Financial OS Revenue Reconciliation & Classification Guard', () => {
  const TREASURY_WALLET = '0x966e1ae22996545015b1414b35234b10719d7ad4';
  const EXTERNAL_WALLET = '0x5cbd99999999999999999999999999999999fa97';

  function createMockPool() {
    // Initialized ledger rows
    const apiCredits = [
      { api_key: 'sk_mock_treasury_1', wallet_address: TREASURY_WALLET },
      { api_key: 'sk_mock_external_1', wallet_address: EXTERNAL_WALLET },
    ];

    const revenueEvents = [
      // 1. External customer payment (genuine)
      { id: 1, client_id: 'sk_mock_external_1', amount_usdt: 0.10, status: 'success', is_test_data: false, op_type: 'rpc_query', created_at: Date.now() },
      // 2. Founder / internal treasury self-usage
      { id: 2, client_id: 'sk_mock_treasury_1', amount_usdt: 0.05, status: 'success', is_test_data: false, op_type: 'rpc_query', created_at: Date.now() },
      // 3. Mock / Test transaction
      { id: 3, client_id: 'sk_mock_qa_1', amount_usdt: 100.0, status: 'success', is_test_data: true, op_type: 'rpc_query', created_at: Date.now() },
    ];

    const creditDeposits = [
      // Founder deposit
      { id: 1, wallet_address: TREASURY_WALLET, amount_usdt: 5.0, tx_hash: '0xdda807430571c695077bd810d0127da79c956969d91cc706d312c8ba2fa14b82' },
      // External customer deposit
      { id: 2, wallet_address: EXTERNAL_WALLET, amount_usdt: 15.0, tx_hash: '0xabc123external' },
    ];

    const settlementBatches = [
      // 98 internal simulated batches summing to 14.7754 USDT
      { status: 'confirmed', count: 98, sum_usdt: 14.775408 },
      // 1 pending batch
      { status: 'pending', count: 1, sum_usdt: 0.150516 },
      // 1954 blocked unfunded batches
      { status: 'blocked_unfunded', count: 1954, sum_usdt: 294.292818 },
    ];

    const epochLedger = [
      { status: 'CLOSED', count: 217, sum: 0 },
      { status: 'OPEN', count: 1, sum: 0 },
    ];

    return {
      query: async (sql, params = []) => {
        const s = sql.replace(/\s+/g, ' ').trim();

        // 1. revenue_events_v2 with LEFT JOIN api_credits (truth.js / REVENUE_SPLIT)
        if (s.includes('FROM revenue_events_v2 e LEFT JOIN api_credits t')) {
          let total = 0;
          let ext = 0;
          let intl = 0;
          let count = 0;
          let extCount = 0;
          let intlCount = 0;

          for (const ev of revenueEvents) {
            if (ev.is_test_data) continue;
            const cred = apiCredits.find((c) => c.api_key === ev.client_id);
            const isInternal = cred && cred.wallet_address.toLowerCase() === TREASURY_WALLET.toLowerCase();
            total += ev.amount_usdt;
            count++;
            if (isInternal) {
              intl += ev.amount_usdt;
              intlCount++;
            } else {
              ext += ev.amount_usdt;
              extCount++;
            }
          }
          return {
            rows: [{
              total,
              external: ext,
              internal: intl,
              external_total: ext,
              internal_total: intl,
              count,
              external_count: extCount,
              internal_count: intlCount,
              sum: total,
              ext_sum: ext,
              int_sum: intl,
              ext_count: extCount,
              int_count: intlCount,
            }],
          };
        }

        // 2. Simple revenue_events_v2
        if (s.includes('FROM revenue_events_v2')) {
          const valid = revenueEvents.filter((e) => !e.is_test_data && e.status === 'success');
          const sum = valid.reduce((a, b) => a + b.amount_usdt, 0);
          return { rows: [{ total: sum, count: valid.length, sum }] };
        }

        // 3. credit_deposits
        if (s.includes('FROM credit_deposits')) {
          const sum = creditDeposits.reduce((a, b) => a + b.amount_usdt, 0);
          return { rows: [{ total: sum }] };
        }

        // 4. epoch_ledger
        if (s.includes('FROM epoch_ledger')) {
          if (s.includes("WHERE status = 'CLOSED'")) {
            return { rows: [{ total: 0 }] };
          }
          return { rows: epochLedger };
        }

        // 5. epoch_earnings
        if (s.includes('FROM epoch_earnings')) {
          return { rows: [] };
        }

        // 6. settlement_batches
        if (s.includes('FROM settlement_batches')) {
          return {
            rows: settlementBatches.map((b) => ({
              status: b.status,
              count: b.count,
              sum_usdt: b.sum_usdt,
            })),
          };
        }

        // 7. epochs
        if (s.includes('FROM epochs')) {
          return { rows: [] };
        }

        return { rows: [] };
      },
    };
  }

  describe('GET /api/financial/truth router', () => {
    let app;
    let pool;

    beforeEach(() => {
      pool = createMockPool();
      app = express();
      app.use('/api/financial', createFinancialTruthRouter(pool));
    });

    it('distinguishes external customer revenue ($0.10) from internal self-usage ($0.05) and test data ($100.00)', async () => {
      const res = await request(app).get('/api/financial/truth');
      expect(res.status).to.equal(200);
      expect(res.body.ok).to.be.true;

      // Real total metered = 0.10 external + 0.05 internal = 0.15 (test 100.0 is excluded)
      expect(res.body.metered_value_usdt).to.equal(0.15);
      expect(res.body.external_revenue_usdt).to.equal(0.1);
      expect(res.body.internal_revenue_usdt).to.equal(0.05);

      // Total deposited is preserved separately (5 + 15 = 20 USDT)
      expect(res.body.total_deposited_usdt).to.equal(20);
    });

    it('reports settlement batches with blocked_unfunded separated from confirmed simulated rollups', async () => {
      const res = await request(app).get('/api/financial/truth');
      expect(res.status).to.equal(200);

      expect(res.body.settlement.batches_confirmed).to.equal(98);
      expect(res.body.settlement.confirmed_batches_usdt).to.equal(14.775408);
      expect(res.body.settlement.batches_blocked_unfunded).to.equal(1954);
      expect(res.body.settlement.blocked_unfunded_usdt).to.equal(294.292818);
      expect(res.body.settlement.batches_pending).to.equal(1);
    });

    it('warns about blocked settlement batches due to unfunded signer', async () => {
      const res = await request(app).get('/api/financial/truth');
      const blockedWarning = res.body.warnings.find((w) => w.code === 'BLOCKED_SETTLEMENT_BATCHES');
      expect(blockedWarning).to.exist;
      expect(blockedWarning.message).to.include('1954 settlement batches blocked');
    });
  });

  describe('getEarningsOverview dashboard API function', () => {
    it('returns separated external and internal revenue metrics and deposits', async () => {
      const pool = createMockPool();
      const overview = await getEarningsOverview(pool);

      expect(overview.total_revenue).to.equal(0.15);
      expect(overview.external_revenue).to.equal(0.1);
      expect(overview.internal_revenue).to.equal(0.05);
      expect(overview.total_deposited).to.equal(20);
    });
  });
});
