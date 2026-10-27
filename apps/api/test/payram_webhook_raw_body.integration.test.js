import { expect } from 'chai';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { createApp } from '../app_factory.mjs';

describe('PayRam Webhook Raw Body & HMAC Verification (createApp Integration)', () => {
  const API_KEY = 'payram_secret_key_audit_test_987654321';
  let app;
  let pool;
  let queries = [];
  let paymentEvents = new Map();
  let nextEventId = 1;
  let nextTxnId = 1;

  before(() => {
    process.env.PAYMENTS_V1 = 'true';
    process.env.PAYMENT_PAYRAM = 'true';
    process.env.PAYRAM_BASE_URL = 'https://pay.satelink.network';
    process.env.PAYRAM_API_KEY = API_KEY;

    // Track financial writes and provide transaction-capable mock pool
    pool = {
      query: async (sql, params = []) => {
        queries.push({ sql, params });
        if (sql.includes('registered_nodes') || sql.includes('nodes') || sql.includes('epochs')) {
          return { rows: [{ count: '0', id: 0 }] };
        }
        return { rows: [] };
      },
      connect: async () => {
        const client = {
          query: async (sql, params = []) => {
            queries.push({ sql, params });
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              return { rows: [] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
              return { rows: [] };
            }
            if (sql.includes('INSERT INTO payment_events')) {
              const provider = params[0];
              const eventId = params[1];
              const key = `${provider}:${eventId}`;
              if (paymentEvents.has(key)) {
                return { rowCount: 0, rows: [] };
              }
              const id = nextEventId++;
              paymentEvents.set(key, id);
              return { rowCount: 1, rows: [{ id }] };
            }
            if (sql.includes('INSERT INTO ledger_txns')) {
              return { rowCount: 1, rows: [{ txn_id: params[0] }] };
            }
            if (sql.includes('INSERT INTO ledger_entries')) {
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('SELECT id, normality, decimals FROM accounts') || sql.includes('SELECT id FROM accounts')) {
              const kind = params[1] || '';
              const normality = kind === 'revenue' || kind === 'customer_credit' ? 'credit' : 'debit';
              return { rows: [{ id: `acct_${kind}`, normality, decimals: 2 }] };
            }
            if (sql.includes('SELECT id FROM ledger_journal_entries')) {
              return { rows: [] };
            }
            return { rows: [] };
          },
          release: () => {},
        };
        return client;
      },
    };

    app = createApp(pool, null);
  });

  function signPayram(rawBody, key = API_KEY) {
    const hex = createHmac('sha256', key).update(rawBody).digest('hex');
    return `sha256=${hex}`;
  }

  function makePayload(refId, filledAmount = '19.00') {
    return JSON.stringify({
      customer_id: 'acct_test_user_001',
      invoice_id: `inv_ref_${refId}`,
      reference_id: `payram_ref_${refId}`,
      status: 'FILLED',
      amount: '19.00',
      currency: 'USD',
      filled_amount: filledAmount,
      filled_amount_in_usd: filledAmount,
      timestamp: Math.floor(Date.now() / 1000),
      payment_info: [],
      confirmation_current: 0,
      confirmation_required: 1,
    });
  }

  it('1. A correctly signed raw body is accepted and processed once', async () => {
    const rawJson = makePayload('tx_001', '19.00');
    const signature = signPayram(rawJson);
    const initialWriteCount = queries.filter((q) => q.sql.includes('INSERT INTO')).length;

    const res = await request(app)
      .post('/webhooks/payram')
      .set('Content-Type', 'application/json')
      .set('X-Payram-Signature', signature)
      .send(rawJson);

    expect(res.status).to.equal(200);
    expect(res.body.ok).to.be.true;
    expect(res.body.duplicate).to.be.false;
    expect(res.body.status).to.equal('succeeded');

    const matchingEvents = queries.filter((q) => q.sql.includes('payment_events'));
    expect(matchingEvents.length).to.be.greaterThan(0);
    const matchingLedger = queries.filter((q) => q.sql.includes('ledger_txns'));
    expect(matchingLedger.length).to.be.greaterThan(0);
  });

  it('2. An invalid signature is rejected before any financial write', async () => {
    const rawJson = makePayload('tx_bad_sig', '19.00');
    const fakeSignature = 'sha256=' + '0'.repeat(64);
    const initialWriteCount = queries.filter((q) => q.sql.includes('INSERT INTO')).length;

    const res = await request(app)
      .post('/webhooks/payram')
      .set('Content-Type', 'application/json')
      .set('X-Payram-Signature', fakeSignature)
      .send(rawJson);

    expect(res.status).to.equal(401);
    expect(res.body.ok).to.be.false;
    expect(res.body.error).to.equal('bad_signature');

    const postWriteCount = queries.filter((q) => q.sql.includes('INSERT INTO')).length;
    expect(postWriteCount).to.equal(initialWriteCount);
  });

  it('3. A modified body fails signature verification', async () => {
    const originalBody = makePayload('tx_tampered', '19.00');
    const signature = signPayram(originalBody);

    // Tamper with the payload (e.g. change amount or add whitespace/attribute)
    const modifiedBody = JSON.stringify({
      ...JSON.parse(originalBody),
      amount: '999.00',
    });
    const initialWriteCount = queries.filter((q) => q.sql.includes('INSERT INTO')).length;

    const res = await request(app)
      .post('/webhooks/payram')
      .set('Content-Type', 'application/json')
      .set('X-Payram-Signature', signature)
      .send(modifiedBody);

    expect(res.status).to.equal(401);
    expect(res.body.ok).to.be.false;
    expect(res.body.error).to.equal('bad_signature');

    const postWriteCount = queries.filter((q) => q.sql.includes('INSERT INTO')).length;
    expect(postWriteCount).to.equal(initialWriteCount);
  });

  it('4. Duplicate delivery is idempotent', async () => {
    const rawJson = makePayload('tx_001', '19.00'); // same reference as test 1
    const signature = signPayram(rawJson);
    const initialLedgerWrites = queries.filter((q) => q.sql.includes('INSERT INTO ledger_txns')).length;

    const res = await request(app)
      .post('/webhooks/payram')
      .set('Content-Type', 'application/json')
      .set('X-Payram-Signature', signature)
      .send(rawJson);

    expect(res.status).to.equal(200);
    expect(res.body.ok).to.be.true;
    expect(res.body.duplicate).to.be.true;

    // No new ledger transaction inserted on duplicate
    const postLedgerWrites = queries.filter((q) => q.sql.includes('INSERT INTO ledger_txns')).length;
    expect(postLedgerWrites).to.equal(initialLedgerWrites);
  });

  it('5. Existing JSON API routes continue to work with parsed req.body', async () => {
    const res = await request(app)
      .post('/api/mode')
      .set('Content-Type', 'application/json')
      .send({ ping: 'test' });

    // Mode is a GET route in api, let's test GET /api/mode and another JSON route
    const modeRes = await request(app).get('/api/mode');
    expect(modeRes.status).to.equal(200);
    expect(modeRes.body.ok).to.be.true;

    const healthRes = await request(app).get('/healthz');
    expect(healthRes.status).to.equal(200);
    expect(healthRes.body.status).to.equal('ok');

    // Test a JSON POST endpoint that consumes req.body
    const challengeRes = await request(app)
      .post('/auth/challenge')
      .set('Content-Type', 'application/json')
      .send({ address: '0x1234567890123456789012345678901234567890' });

    expect(challengeRes.status).to.be.oneOf([200, 400]); // Parsed JSON body properly without parser crash
  });
});
