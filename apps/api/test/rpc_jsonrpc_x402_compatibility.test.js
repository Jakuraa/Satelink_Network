// apps/api/test/rpc_jsonrpc_x402_compatibility.test.js
// Regression test suite for Step D: JSON-RPC 2.0 / x402 compatibility.
// Validates all 12 Phase 3 requirements.

import 'dotenv/config';
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { x402Client } from '@x402/core/client';
import { ExactEvmScheme } from '@x402/evm/exact/client';

describe('JSON-RPC 2.0 / x402 compatibility suite (Step D)', function () {
  this.timeout(30000);

  let app;
  let createFreeTierGate;
  let createX402Middleware;
  let createRpcGateway;
  let attachBaseMiddleware;
  let gate;
  let x402;
  const silent = { info() {}, warn() {}, error() {} };

  const PAYER_ADDRESS = '0x1111111111111111111111111111111111111111';
  const VALID_API_KEY = 'mock_funded_api_key_123';

  const SAMPLE_PAYMENT_REQUIRED = {
    x402Version: 2,
    error: 'Payment required',
    resource: {
      url: 'https://rpc.satelink.network/rpc/polygon',
      description: 'Satelink — Polygon PoS (chain 137) JSON-RPC',
      mimeType: 'application/json',
    },
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '100000',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        payTo: '0x966E1Ae22996545015b1414B35234b10719d7Ad4',
        maxTimeoutSeconds: 60,
        extra: { name: 'USD Coin', version: '2' },
      },
    ],
    extensions: { bazaar: { info: { input: { type: 'http', method: 'POST' } } } },
  };

  function fakeServer(tx = '0xsettle_tx_1') {
    return {
      initialize: async () => {},
      processHTTPRequest: async ({ paymentHeader }) => {
        if (!paymentHeader) {
          return {
            type: 'payment-error',
            response: {
              status: 402,
              headers: {
                'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(SAMPLE_PAYMENT_REQUIRED)).toString('base64'),
              },
              body: SAMPLE_PAYMENT_REQUIRED,
            },
          };
        }
        return {
          type: 'payment-verified',
          paymentPayload: { tx },
          paymentRequirements: {},
          declaredExtensions: {},
        };
      },
      processSettlement: async () => ({
        success: true,
        transaction: tx,
        payer: PAYER_ADDRESS,
        network: 'eip155:8453',
        headers: {},
      }),
    };
  }

  function fakePool() {
    const credits = new Map();
    const deposits = new Set();
    const sessionKeys = new Map();

    const client = {
      async query(sql, params = []) {
        const text = String(sql);
        if (/BEGIN|COMMIT|ROLLBACK/i.test(text)) {
          return { rowCount: 0, rows: [] };
        }
        if (/CREATE\s+TABLE/i.test(text)) {
          return { rowCount: 0, rows: [] };
        }
        if (/UPDATE\s+credit_balances/i.test(text)) {
          return { rowCount: 1, rows: [{ balance_usdt: '10.00' }] };
        }
        if (/FROM\s+credit_balances/i.test(text)) {
          return { rows: [{ balance_usdt: '10.00' }] };
        }
        if (/FROM\s+payment_sources\s+WHERE\s+tx_hash\s*=\s*\$1/i.test(text)) {
          const exists = deposits.has(params[0]);
          return { rows: exists ? [{ tx_hash: params[0] }] : [] };
        }
        if (/INSERT\s+INTO\s+payment_sources/i.test(text)) {
          const txHash = params[2] || params[0];
          if (deposits.has(txHash)) {
            const err = new Error('duplicate key value violates unique constraint');
            err.code = '23505';
            throw err;
          }
          deposits.add(txHash);
          return { rowCount: 1, rows: [] };
        }
        if (/INSERT\s+INTO\s+api_deposits/i.test(text)) {
          const txHash = params[1];
          if (deposits.has(txHash)) {
            const err = new Error('duplicate key value violates unique constraint');
            err.code = '23505';
            throw err;
          }
          return { rowCount: 1, rows: [] };
        }
        if (/SELECT\s+api_key\s+FROM\s+api_credits\s+WHERE\s+lower\(wallet_address\)/i.test(text)) {
          return { rows: [{ api_key: `x402_${PAYER_ADDRESS.toLowerCase()}` }] };
        }
        if (/UPDATE\s+api_credits/i.test(text)) {
          return { rowCount: 1, rows: [{ credits_usdt: '0.10' }] };
        }
        if (/SELECT.*FROM\s+api_credits\s+WHERE\s+api_key\s*=\s*\$1/i.test(text)) {
          if (params[0] && params[0].includes('unknown')) {
            return { rows: [] };
          }
          if (params[0] && params[0].includes('unfunded')) {
            return {
              rows: [
                {
                  api_key: params[0],
                  wallet_address: PAYER_ADDRESS,
                  tier: 'free',
                  balance_usdt: '0.00',
                  credits_usdt: '0.00',
                  credits_remaining: 0,
                  daily_used: 0,
                  daily_limit: 1000,
                },
              ],
            };
          }
          return {
            rows: [
              {
                api_key: params[0],
                wallet_address: PAYER_ADDRESS,
                balance_usdt: '10.00',
                credits_usdt: '10.00',
                credits_remaining: 1000,
                daily_used: 0,
                daily_limit: 100000,
              },
            ],
          };
        }
        if (/INSERT\s+INTO\s+x402_api_keys/i.test(text)) {
          sessionKeys.set(params[0], params[1]);
          return { rowCount: 1, rows: [] };
        }
        if (/INSERT\s+INTO\s+revenue_events_v2/i.test(text)) {
          return { rowCount: 1, rows: [] };
        }
        if (/FROM\s+x402_funnel/i.test(text)) {
          return { rowCount: 1, rows: [] };
        }
        return { rows: [], rowCount: 0 };
      },
      release() {},
    };

    return {
      credits,
      deposits,
      sessionKeys,
      query: client.query,
      connect: async () => client,
    };
  }

  before(async () => {
    process.env.X402_ENABLED = 'true';
    process.env.FREE_TIER_DAILY_LIMIT = '0'; // Immediately trigger 402 for anonymous callers
    process.env.FREE_TIER_ANON_CALLS = '0';
    process.env.ANON_FREE_TIER_ENABLED = 'false';

    ({ createFreeTierGate } = await import('../src/middleware/free_tier_gate.js'));
    ({ createX402Middleware } = await import('../src/payments/x402/middleware.js'));
    ({ createRpcGateway } = await import('../src/workloads/rpc_gateway/rpc_gateway.js'));
    ({ attachBaseMiddleware } = await import('../src/security/middleware.js'));

    const pool = fakePool();
    gate = createFreeTierGate(silent, null);
    x402 = createX402Middleware(pool, silent, { httpServer: fakeServer() });

    app = express();
    attachBaseMiddleware(app);
    app.use('/rpc', x402, (req, res, next) => (req.x402?.settled ? next() : gate(req, res, next)), express.json({ limit: '1mb' }), createRpcGateway(pool));

    // Global error handler matching app_factory.mjs
    app.use((err, req, res, next) => {
      if (res.headersSent) return next(err);
      const isRpc = req.originalUrl?.startsWith('/rpc') || req.path?.startsWith('/rpc');
      if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        if (isRpc) {
          return res.status(400).json({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error',
            },
          });
        }
        return res.status(400).json({ ok: false, error: 'Invalid JSON payload' });
      }
      if (isRpc) {
        return res.status(500).json({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: 'Internal error',
          },
        });
      }
      return res.status(err.status || 500).json({ ok: false, error: 'Internal server error' });
    });
  });

  // 1. Valid JSON-RPC request without payment returns a 402 challenge that remains usable by x402 clients.
  it('1. valid JSON-RPC request without payment returns a 402 challenge usable by x402 clients', async () => {
    const res = await request(app)
      .post('/rpc/polygon')
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 101 });

    expect(res.status).to.equal(402);
    expect(res.body.x402Version).to.equal(2);
    expect(res.body.accepts).to.be.an('array').with.length.greaterThan(0);

    const client = new x402Client();
    client.register('eip155:8453', new ExactEvmScheme());
    const req = client.selectPaymentRequirements(res.body.x402Version, res.body.accepts);
    expect(req).to.be.an('object');
    expect(req.scheme).to.equal('exact');
    expect(req.network).to.equal('eip155:8453');
    expect(req.amount).to.equal('100000');
  });

  // 2. JSON-RPC error fields follow the expected specification (object, code, message, NOT string).
  it('2. JSON-RPC error fields follow the expected specification (error object, not string)', async () => {
    const res = await request(app)
      .post('/rpc/polygon')
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 102 });

    expect(res.status).to.equal(402);
    expect(res.body.jsonrpc).to.equal('2.0');
    expect(res.body.error).to.be.an('object');
    expect(typeof res.body.error).to.not.equal('string');
    expect(res.body.error.code).to.equal(-32005);
    expect(res.body.error.message).to.be.a('string');
    expect(res.body.error.data).to.be.an('object');
    expect(res.body.error.data.error_code).to.be.a('string');
  });

  // 3. The response ID matches the request ID (numbers and strings).
  it('3. the response ID matches the request ID', async () => {
    const resNum = await request(app)
      .post('/rpc/polygon')
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 777 });
    expect(resNum.body.id).to.equal(777);

    const resStr = await request(app)
      .post('/rpc/polygon')
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 'client-req-99' });
    expect(resStr.body.id).to.equal('client-req-99');
  });

  // 4. Missing or invalid request IDs are handled correctly.
  it('4. missing or invalid request IDs return id: null', async () => {
    const resMissing = await request(app)
      .post('/rpc/polygon')
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [] });
    expect(resMissing.status).to.equal(402);
    expect(resMissing.body.id).to.equal(null);

    const resNull = await request(app)
      .post('/rpc/polygon')
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: null });
    expect(resNull.status).to.equal(402);
    expect(resNull.body.id).to.equal(null);
  });

  // 5. Malformed JSON and unsupported methods produce appropriate errors without stack traces.
  it('5. malformed JSON returns -32700 Parse error with id null and no stack trace', async () => {
    const res = await request(app)
      .post('/rpc/polygon')
      .set('Content-Type', 'application/json')
      .send('{"jsonrpc": "2.0", "method": bad_json_payload');

    expect(res.status).to.equal(400);
    expect(res.body.jsonrpc).to.equal('2.0');
    expect(res.body.id).to.equal(null);
    expect(res.body.error).to.be.an('object');
    expect(res.body.error.code).to.equal(-32700);
    expect(res.body.error.message).to.equal('Parse error');
    expect(res.text).to.not.include('SyntaxError');
    expect(res.text).to.not.include('node_modules');
  });

  it('5b. unsupported chain returns 400', async () => {
    const res = await request(app)
      .post('/rpc/nonexistent_chain_999')
      .set('X-API-Key', VALID_API_KEY)
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 501 });

    expect(res.status).to.equal(400);
    expect(res.body.error).to.include('Unsupported chain');
  });

  it('5c. missing or invalid method returns -32600 Invalid Request', async () => {
    const res = await request(app)
      .post('/rpc/polygon')
      .set('X-API-Key', VALID_API_KEY)
      .send({ jsonrpc: '2.0', method: '', params: [], id: 502 });

    expect(res.status).to.equal(400);
    expect(res.body.jsonrpc).to.equal('2.0');
    const errCode = res.body.error?.code ?? res.body.rpc_error?.code;
    expect(errCode).to.equal(-32600);
  });

  // 6. Existing x402 headers and payment requirements remain present.
  it('6. existing x402 headers and payment requirements remain present', async () => {
    const res = await request(app)
      .post('/rpc/polygon')
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 601 });

    expect(res.status).to.equal(402);
    const header = res.headers['payment-required'];
    expect(header).to.be.a('string');

    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    expect(decoded.x402Version).to.equal(2);
    expect(decoded.accepts).to.be.an('array').with.length.greaterThan(0);

    // Alternative payment (USDT on Polygon) preserved
    expect(res.body.alternativePayment).to.be.an('object');
    expect(res.body.alternativePayment.deposit.vault_address).to.match(/^0x[0-9a-fA-F]{40}$/);
    expect(res.body.alternativePayment.deposit.chain_id).to.equal(137);
  });

  // 7. The challenge contains no secret values.
  it('7. the challenge contains no secret values', async () => {
    const res = await request(app)
      .post('/rpc/polygon')
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 701 });

    const bodyStr = JSON.stringify(res.body);
    const headersStr = JSON.stringify(res.headers);

    expect(bodyStr).to.not.include(process.env.ADMIN_API_KEY || 'superadmin');
    expect(bodyStr).to.not.include(process.env.JWT_SECRET || 'jwtsecret');
    expect(bodyStr).to.not.match(/postgres:\/\//i);
    expect(bodyStr).to.not.match(/password/i);
    expect(headersStr).to.not.match(/postgres:\/\//i);
  });

  // 8. A correctly paid request reaches verification and settlement path.
  it('8. a correctly paid request reaches verification and settlement path', async () => {
    const paymentHeader = Buffer.from(JSON.stringify({ x402Version: 2, scheme: 'exact' })).toString('base64');
    const res = await request(app)
      .post('/rpc/polygon')
      .set('X-Payment', paymentHeader)
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 801 });

    // The payment settles, sets session keys, and proceeds past the payment gate
    expect(res.headers['x-satelink-api-key']).to.be.a('string');
    expect(res.headers['x-api-key']).to.be.a('string');
  });

  // 9. A failed or invalid payment does not grant access.
  it('9. a malformed payment header does not grant access', async () => {
    const res = await request(app)
      .post('/rpc/polygon')
      .set('X-Payment', 'not-valid-base64-json!')
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 901 });

    expect(res.status).to.equal(400);
    expect(res.body.error).to.equal('x402_payment_malformed');
  });

  // 10. Repeated requests cannot bypass payment or double-credit the caller.
  it('10. duplicate settlement tx_hash is rejected with 409 conflict', async () => {
    const pool = fakePool();
    const dupeServer = fakeServer('0xduplicate_tx_hash_1');
    const customX402 = createX402Middleware(pool, silent, { httpServer: dupeServer });
    const customApp = express();
    attachBaseMiddleware(customApp);
    customApp.use('/rpc', customX402, (req, res, next) => (req.x402?.settled ? next() : gate(req, res, next)), express.json(), createRpcGateway(pool));

    const paymentHeader = Buffer.from(JSON.stringify({ x402Version: 2 })).toString('base64');

    // First attempt: settles
    const res1 = await request(customApp)
      .post('/rpc/polygon')
      .set('X-Payment', paymentHeader)
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1001 });
    expect(res1.status).to.not.equal(409);

    // Second attempt with same tx: 409 Conflict
    const res2 = await request(customApp)
      .post('/rpc/polygon')
      .set('X-Payment', paymentHeader)
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1002 });
    expect(res2.status).to.equal(409);
    expect(res2.body.error).to.equal('duplicate_settlement');
  });

  // 11. Batch behavior is consistent with documented support.
  it('11. batch JSON-RPC requests return -32600 Batch requests are not supported', async () => {
    const res = await request(app)
      .post('/rpc/polygon')
      .set('X-API-Key', VALID_API_KEY)
      .send([
        { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },
        { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 }
      ]);

    expect(res.status).to.equal(400);
    expect(res.body.jsonrpc).to.equal('2.0');
    expect(res.body.id).to.equal(null);
    expect(res.body.error).to.be.an('object');
    expect(res.body.error.code).to.equal(-32600);
    expect(res.body.error.message).to.include('Batch requests are not supported');
  });

  // 12. Standard JSON-RPC client (ethers.js v6 error handling pattern) consumes 402 cleanly.
  it('12. ethers.js style JSON-RPC response parser cleanly processes the 402 error', async () => {
    const res = await request(app)
      .post('/rpc/polygon')
      .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1201 });

    expect(res.status).to.equal(402);

    // Simulate how ethers.js v6 / web3.js inspects JSON-RPC responses:
    const payload = res.body;
    expect(payload.jsonrpc).to.equal('2.0');
    expect(payload.id).to.equal(1201);
    expect(payload.error).to.be.an('object');

    // Ethers checks: error.code (number), error.message (string)
    const errorCode = payload.error.code;
    const errorMessage = payload.error.message;
    expect(typeof errorCode).to.equal('number');
    expect(typeof errorMessage).to.equal('string');
    expect(errorCode).to.equal(-32005);
    expect(errorMessage.length).to.be.greaterThan(0);
  });

  // 13. Keyed caller with unfunded key receives compliant JSON-RPC 2.0 error object.
  it('13. keyed caller with unfunded key receives compliant JSON-RPC 2.0 error object', async () => {
    const prev = process.env.CREDIT_CANONICAL;
    process.env.CREDIT_CANONICAL = 'true';
    try {
      const res = await request(app)
        .post('/rpc/polygon')
        .set('X-API-Key', 'mock_unfunded_key_999')
        .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1301 });

      expect(res.status).to.equal(402);
      expect(res.body.jsonrpc).to.equal('2.0');
      expect(res.body.id).to.equal(1301);
      expect(res.body.error).to.be.an('object');
      expect(typeof res.body.error).to.not.equal('string');
      expect(res.body.error.code).to.equal(-32005);
      expect(res.body.error.message).to.be.a('string');
      expect(res.body.error.data).to.be.an('object');
      expect(res.body.deposit || res.body.payment).to.be.an('object');
    } finally {
      process.env.CREDIT_CANONICAL = prev;
    }
  });

  // 14. Keyed caller with unknown key receives compliant JSON-RPC 2.0 error object with matching id.
  it('14. keyed caller with unknown key receives compliant JSON-RPC 2.0 error object with matching id', async () => {
    const prev = process.env.CREDIT_CANONICAL;
    process.env.CREDIT_CANONICAL = 'true';
    try {
      const res = await request(app)
        .post('/rpc/polygon')
        .set('X-API-Key', 'sk_unknown_key_0000000000000000')
        .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 'client-key-test' });

      expect(res.status).to.be.oneOf([401, 402]);
      expect(res.body.jsonrpc).to.equal('2.0');
      expect(res.body.id).to.equal('client-key-test');
      expect(res.body.error).to.be.an('object');
      expect(typeof res.body.error).to.not.equal('string');
      expect(res.body.error.code).to.equal(-32005);
      expect(res.body.error.message).to.be.a('string');
      expect(res.body.error.data.error_code).to.be.a('string');
    } finally {
      process.env.CREDIT_CANONICAL = prev;
    }
  });

  // 15. Keyed caller with daily limit exceeded receives compliant JSON-RPC 2.0 error object
  it('15. keyed caller with daily limit exceeded receives compliant JSON-RPC 2.0 error object with code -32005', async () => {
    const prev = process.env.CREDIT_CANONICAL;
    const prevPath = process.env.CAPACITY_ENFORCEMENT_PATH;
    process.env.CREDIT_CANONICAL = 'true';
    process.env.CAPACITY_ENFORCEMENT_PATH = 'legacy';
    try {
      const pool = fakePool();
      // Mock pool returning an account that exceeded daily limit
      const origQuery = pool.query;
      const customQuery = async (sql, params = []) => {
        const text = String(sql);
        if (/FROM\s+api_usage_daily/i.test(text)) {
          return { rows: [{ request_count: 1000 }] };
        }
        if (/SELECT.*FROM\s+api_credits\s+WHERE\s+api_key\s*=\s*\$1/i.test(text)) {
          return {
            rows: [
              {
                api_key: params[0],
                wallet_address: PAYER_ADDRESS,
                tier: 'free',
                balance_usdt: '10.00',
                credits_usdt: '10.00',
                credits_remaining: 1000,
                daily_used: 1000,
                daily_limit: 1000,
              },
            ],
          };
        }
        return origQuery(sql, params);
      };
      pool.query = customQuery;
      pool.connect = async () => ({ query: customQuery, release() {} });

      const customGate = createFreeTierGate(silent, null);
      const customX402 = createX402Middleware(pool, silent, { httpServer: fakeServer() });
      const customApp = express();
      attachBaseMiddleware(customApp);
      customApp.use('/rpc', customX402, (req, res, next) => (req.x402?.settled ? next() : customGate(req, res, next)), express.json(), createRpcGateway(pool));

      const res = await request(customApp)
        .post('/rpc/polygon')
        .set('X-API-Key', 'sk_mock_daily_limit_key')
        .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1501 });

      expect(res.status).to.equal(429);
      expect(res.body.jsonrpc).to.equal('2.0');
      expect(res.body.id).to.equal(1501);
      expect(res.body.error).to.be.an('object');
      expect(res.body.error.code).to.equal(-32005);
      expect(res.body.error.data.error_code).to.equal('daily_limit_exceeded');
      expect(res.body.payment).to.be.an('object');
    } finally {
      process.env.CREDIT_CANONICAL = prev;
      process.env.CAPACITY_ENFORCEMENT_PATH = prevPath;
    }
  });

  // 16. Standard Web3 client parser compatibility (ethers/viem/web3.py) handles error objects safely
  it('16. standard Web3 client parser safely reads error object on all billing denial conditions', async () => {
    const denials = [
      { name: 'unfunded', key: 'mock_unfunded_key_999' },
      { name: 'unknown', key: 'sk_unknown_key_0000000000000000' }
    ];

    const prev = process.env.CREDIT_CANONICAL;
    process.env.CREDIT_CANONICAL = 'true';
    try {
      for (const d of denials) {
        const res = await request(app)
          .post('/rpc/polygon')
          .set('X-API-Key', d.key)
          .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: `test-${d.name}` });

        const parsed = res.body;
        expect(parsed.error).to.be.an('object');
        expect(typeof parsed.error.code).to.equal('number');
        expect(typeof parsed.error.message).to.equal('string');
        expect(parsed.error.code).to.equal(-32005);
      }
    } finally {
      process.env.CREDIT_CANONICAL = prev;
    }
  });
});
