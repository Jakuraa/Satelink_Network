import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { paymentRequiredFields } from '../src/utils/payment_required.js';
import { createUpgradeContext } from '../src/middleware/upgrade_context.js';
import { createCreditsRouter } from '../src/routes/credits.js';
import { createSimpleApiKeysRouter } from '../src/billing/api_keys_route.mjs';
import { createRpcGateway } from '../src/workloads/rpc_gateway/rpc_gateway.js';

describe('Funnel and onboarding consistency (SAT-535)', function () {
  this.timeout(10000);
  let prevCanonical;

  before(() => {
    prevCanonical = process.env.CREDIT_CANONICAL;
    process.env.CREDIT_CANONICAL = 'true';
  });

  after(() => {
    if (prevCanonical !== undefined) {
      process.env.CREDIT_CANONICAL = prevCanonical;
    } else {
      delete process.env.CREDIT_CANONICAL;
    }
  });

  it('1. paymentRequiredFields contains no phantom free tier advertising', () => {
    const fields = paymentRequiredFields();
    expect(fields.deposit.free_tier_limit).to.equal(0);
    expect(fields.deposit.free_tier_resets_at).to.be.null;
    expect(fields.message).to.not.include('Free tier limit reached');
    expect(fields.message).to.include('Payment required');
  });

  it('2. upgrade_context does not advertise phantom free trial quota', () => {
    const upgradeFor = createUpgradeContext({
      pool: { query: async () => ({ rows: [] }) },
      redis: null,
      log: { warn: () => {}, error: () => {} }
    });
    const ctx = upgradeFor({ ip: '1.2.3.4', requestsToday: 10 });
    expect(ctx.free_first_step.message).to.not.include('free machine key');
    expect(ctx.free_first_step.message).to.not.include('Pay only when your workload grows');
    expect(ctx.free_first_step.wallet_option).to.not.include('calls/day free');
  });

  it('3. GET /credits/deposit/initiate and /credits/initiate instruct X-API-Key, not X-Wallet-Address alone', async () => {
    const app = express();
    app.use('/credits', createCreditsRouter({ query: async () => ({ rows: [] }) }));

    const res1 = await request(app).get('/credits/deposit/initiate?amount=1.00');
    expect(res1.status).to.equal(200);
    const step3 = res1.body.instructions.find(i => i.step === 3);
    expect(step3.description).to.include('X-API-Key');
    expect(step3.description).to.not.include('X-Wallet-Address');

    const res2 = await request(app).get('/credits/initiate?amount=10');
    expect(res2.status).to.equal(200);
    expect(res2.body.integration.header).to.equal('X-API-Key');
    expect(res2.body.integration.usage).to.include('API key');
  });

  it('4. GET /api/keys/deposit-info provides accurate RevenueVault deposit and pay-per-call instructions', async () => {
    const mockPool = {
      query: async (sql, params) => {
        if (sql.includes('SELECT tier, daily_limit, credits_usdt')) {
          return { rows: [{ tier: 'free', daily_limit: 1000, credits_usdt: '0', total_deposited: '0' }] };
        }
        return { rows: [] };
      }
    };
    const app = express();
    app.use('/api/keys', createSimpleApiKeysRouter(mockPool));

    const res = await request(app)
      .get('/api/keys/deposit-info')
      .set('X-API-Key', 'sk_free_123456789012345678901234567890123456789012345678');

    expect(res.status).to.equal(200);
    expect(res.body.instructions[0]).to.include('RevenueVault');
    expect(res.body.instructions[0].toLowerCase()).to.include('approve');
    expect(res.body.instructions[3]).to.include('$0.00003');
  });

  it('5. JSON-RPC batch requests receive protocol-compatible error response', async () => {
    const mockDb = {
      query: async () => ({ rows: [] }),
      connect: async () => ({
        query: async () => ({ rows: [] }),
        release: () => {}
      })
    };
    const app = express();
    app.use(express.json());
    app.use('/rpc', createRpcGateway(mockDb));

    const res = await request(app)
      .post('/rpc/polygon')
      .send([{ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }]);

    expect(res.status).to.equal(400);
    expect(res.body.jsonrpc).to.equal('2.0');
    expect(res.body.id).to.be.null;
    expect(res.body.error).to.deep.equal({
      code: -32600,
      message: 'Batch requests are not supported. Send individual JSON-RPC requests.'
    });
  });

  it('6. Invalid JSON-RPC requests receive protocol-compatible error fields', async () => {
    const mockDb = { query: async () => ({ rows: [] }) };
    const app = express();
    app.use(express.json());
    app.use('/rpc', createRpcGateway(mockDb));

    const res = await request(app)
      .post('/rpc/polygon')
      .send({ invalid: 'payload' });

    expect(res.status).to.equal(400);
    expect(res.body.jsonrpc).to.equal('2.0');
    expect(res.body.error).to.include('Invalid JSON-RPC 2.0 payload');
  });

  it('7. Billing denial responses preserve jsonrpc: 2.0 and id for RPC callers', async () => {
    const testKey = 'sk_basic_unfunded_000000000000000000000000000000000';
    const mockDb = {
      query: async (sql) => {
        const s = String(sql);
        if (/platform_flags/.test(s)) return { rows: [{ value: 'legacy' }] };
        if (/FROM principals/.test(s)) return { rows: [] };
        if (/FROM api_credits WHERE api_key = \$1/.test(s)) {
          return {
            rows: [{
              api_key: testKey,
              wallet_address: null,
              credits_usdt: '0',
              daily_limit: 1000,
              tier: 'basic',
              status: 'active',
              payment_hold: null
            }]
          };
        }
        if (/SELECT request_count FROM api_usage_daily/.test(s)) return { rows: [] };
        return { rows: [] };
      }
    };
    const app = express();
    app.use(express.json());
    app.use('/rpc', createRpcGateway(mockDb));

    const res = await request(app)
      .post('/rpc/polygon')
      .set('X-API-Key', testKey)
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 99 });

    expect(res.status).to.equal(402);
    expect(res.body.jsonrpc).to.equal('2.0');
    expect(res.body.id).to.equal(99);
    expect(res.body.ok).to.equal(false);
    expect(res.body.error).to.equal('insufficient_credits');
    expect(res.body.payment).to.be.an('object');
  });
});
