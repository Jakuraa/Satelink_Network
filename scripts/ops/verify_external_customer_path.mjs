// scripts/ops/verify_external_customer_path.mjs
// Repeatable Acceptance Test for Independent Non-Founder Customer Onboarding & Execution
// Satelink Multi-Market Trading AI — Paper Trading Simulation ($0.05 / call)

import { strict as assert } from 'node:assert';
import crypto from 'node:crypto';
import http from 'node:http';
import { Pool } from 'pg';

let API_BASE = process.env.API_BASE || 'https://api.satelink.network';
let server = null;
let pool = null;

const pass = process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD;
if (pass) {
  const user = process.env.POSTGRES_USER || process.env.PGUSER || 'postgres';
  const host = process.env.RAILWAY_TCP_PROXY_DOMAIN || 'roundhouse.proxy.rlwy.net';
  const port = process.env.RAILWAY_TCP_PROXY_PORT || '21238';
  const db = process.env.POSTGRES_DB || process.env.PGDATABASE || 'railway';
  const connectionString = `postgresql://${user}:${encodeURIComponent(pass)}@${host}:${port}/${db}`;
  pool = new Pool({ connectionString });

  if (process.env.START_LOCAL === '1') {
    const { createApp } = await import('../../apps/api/app_factory.mjs');
    const app = createApp(pool);
    server = http.createServer(app);
    await new Promise((r) => server.listen(4051, '127.0.0.1', r));
    API_BASE = 'http://127.0.0.1:4051';
  }
} else if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL.replace('postgres-iqew.railway.internal', 'roundhouse.proxy.rlwy.net:21238');
  pool = new Pool({ connectionString: dbUrl });

  if (process.env.START_LOCAL === '1') {
    const { createApp } = await import('../../apps/api/app_factory.mjs');
    const app = createApp(pool);
    server = http.createServer(app);
    await new Promise((r) => server.listen(4051, '127.0.0.1', r));
    API_BASE = 'http://127.0.0.1:4051';
  }
} else {
  console.log('[Notice] No database credentials provided. Running in remote-only API mode.');
}

async function main() {
  console.log('================================================================');
  console.log('  SATELINK — EXTERNAL CUSTOMER ONBOARDING & ACCEPTANCE TEST');
  console.log(`  API Base URL: ${API_BASE}`);
  console.log('  Target: Independent Non-Founder Quantitative Customer');
  console.log('================================================================\n');

  let customerKey = null;
  let keyRef = null;
  const runId = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
  const idempotencyKey1 = `cust_run_${runId}_001`;
  const idempotencyKey2 = `cust_run_${runId}_002`;

  try {
    // -------------------------------------------------------------
    // Step 1: Health & Runtime Integrity
    // -------------------------------------------------------------
    console.log('--- Step 1: Verify Health & Runtime Integrity ---');
    const healthRes = await fetch(`${API_BASE}/health`);
    assert.equal(healthRes.status, 200, 'Health endpoint must return 200');
    const health = await healthRes.json();
    console.log(`✓ Health OK: server="${health.server}", db="${health.db}", commit="${health.commit}"`);
    assert.equal(health.server, 'ok');
    assert.equal(health.db, 'ok');
    assert.ok(health.commit && health.commit !== 'unknown', 'Commit must be known');

    // -------------------------------------------------------------
    // Step 2: Service & Capability Discovery (Zero Auth)
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Public Capability Discovery (Zero Auth) ---');
    const discoRes = await fetch(`${API_BASE}/v1/trading/paper/simulate`);
    assert.equal(discoRes.status, 200, 'Discovery endpoint must be publicly accessible (200)');
    const disco = await discoRes.json();
    console.log(`✓ Service: "${disco.service}"`);
    console.log(`✓ Mode: "${disco.mode}"`);
    console.log(`✓ Canonical Price: $${disco.price_usdt} ${disco.currency}`);
    console.log(`✓ Supported Instruments: ${disco.supported_instruments?.join(', ')}`);
    console.log(`✓ Supported Strategies: ${disco.supported_strategies?.join(', ')}`);
    console.log(`✓ Disclaimer: "${disco.disclaimer}"`);

    assert.equal(disco.ok, true);
    assert.equal(disco.mode, 'SIMULATED_PAPER_EXECUTION');
    assert.equal(disco.price_usdt, 0.05);
    assert.equal(disco.currency, 'USDT');
    assert.equal(disco.disclaimer, 'SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS');
    assert.ok(disco.supported_instruments.includes('BINANCE:BTCUSDT'));
    assert.ok(disco.payment?.how_to_pay?.length > 0, 'Payment guidance must be present');

    // -------------------------------------------------------------
    // Step 3: Self-Serve Developer API Key Creation
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Self-Serve Customer API Key Creation ---');
    const keyRes = await fetch(`${API_BASE}/api/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: `external-quant-client-${runId}` }),
    });
    assert.equal(keyRes.status, 200, 'Key creation must return 200');
    const keyData = await keyRes.json();
    assert.equal(keyData.ok, true);
    customerKey = keyData.api_key;
    keyRef = 'kref_' + crypto.createHash('sha256').update(customerKey).digest('hex').slice(0, 16);
    console.log(`✓ New customer API key issued: ${customerKey.slice(0, 12)}...`);

    // Verify key status and initial balance
    const usageRes = await fetch(`${API_BASE}/api/keys/usage`, {
      headers: { 'X-API-Key': customerKey },
    });
    assert.equal(usageRes.status, 200);
    const usage = await usageRes.json();
    console.log(`✓ Initial account state: tier="${usage.tier}", credits_remaining=$${usage.credits_remaining}`);
    assert.equal(usage.credits_remaining, 0, 'New account must start with 0 credits');

    // -------------------------------------------------------------
    // Step 4: Unfunded Execution Attempt (402 Payment Required)
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Unfunded Execution Attempt (402 Denied) ---');
    const unfundedRes = await fetch(`${API_BASE}/v1/trading/paper/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': customerKey,
      },
      body: JSON.stringify({
        idempotencyKey: idempotencyKey1,
        instrumentId: 'BINANCE:BTCUSDT',
        strategy: 'sma-crossover',
      }),
    });
    assert.equal(unfundedRes.status, 402, 'Unfunded request must return HTTP 402');
    const unfundedBody = await unfundedRes.json();
    console.log(`✓ 402 Denied as expected: error="${unfundedBody.error}", price_usdt=$${unfundedBody.price_usdt}`);
    console.log(`✓ Payment rails returned: ${unfundedBody.how_to_pay?.map(r => r.rail).join(', ')}`);
    assert.equal(unfundedBody.ok, false);
    assert.ok(unfundedBody.error === 'insufficient_credits' || unfundedBody.error === 'payment_required');
    assert.equal(unfundedBody.price_usdt, 0.05);
    assert.equal(unfundedBody.disclaimer, 'SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS');

    // -------------------------------------------------------------
    // Step 5: Deposit & Calldata Verification
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Funding Guidance & Calldata Verification ---');
    const initRes = await fetch(`${API_BASE}/credits/initiate?amount=10`);
    assert.equal(initRes.status, 200);
    const initData = await initRes.json();
    console.log(`✓ RevenueVault address: ${initData.revenueVaultAddress}`);
    console.log(`✓ USDT contract address: ${initData.usdtAddress}`);
    console.log(`✓ Chain ID: ${initData.chainId} (Polygon PoS)`);
    assert.equal(initData.revenueVaultAddress, '0x577D3716d6Ad5b676d230f5409deF9838FABaCEF');
    assert.equal(initData.usdtAddress, '0xc2132D05D31c914a87C6611C10748AEb04B58e8F');
    assert.equal(initData.chainId, 137);

    // If pool is available, fund the customer account for testing execution
    if (pool) {
      console.log('\n--- Step 6: Controlled Account Funding ($0.10 USDT) ---');
      await pool.query(
        `UPDATE api_credits
         SET credits_usdt = 0.10, total_deposited = 0.10, demand_source = 'test_external_acceptance'
         WHERE api_key = $1`,
        [customerKey]
      );
      console.log('✓ Account funded with $0.10 USDT credits');

      // -------------------------------------------------------------
      // Step 7: First Metered Simulation Run ($0.05)
      // -------------------------------------------------------------
      console.log('\n--- Step 7: Execute Metered Simulation ($0.05 Charge) ---');
      const sim1Res = await fetch(`${API_BASE}/v1/trading/paper/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': customerKey,
        },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey1,
          instrumentId: 'BINANCE:BTCUSDT',
          strategy: 'sma-crossover',
          strategyParams: { fastPeriod: 10, slowPeriod: 30 },
          orderQuantity: 1,
        }),
      });
      assert.equal(sim1Res.status, 200, 'First simulation must succeed (200)');
      const sim1Body = await sim1Res.json();
      console.log(`✓ Simulation completed: billed_usdt=$${sim1Body.billed_usdt}`);
      console.log(`✓ Revenue Receipt: req_id="${sim1Body.revenue_receipt?.revenue_request_id}", amount=$${sim1Body.revenue_receipt?.amount_usdt}, recorded=${sim1Body.revenue_receipt?.recorded}`);
      console.log(`✓ Mandatory Disclaimer: "${sim1Body.disclaimer}"`);

      assert.equal(sim1Body.ok, true);
      assert.equal(sim1Body.billed_usdt, 0.05);
      assert.equal(sim1Body.disclaimer, 'SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS');
      assert.ok(sim1Body.revenue_receipt?.recorded, 'Revenue receipt must be recorded');
      assert.equal(sim1Body.revenue_receipt?.amount_usdt, 0.05);
      const receipt1 = sim1Body.revenue_receipt?.revenue_request_id;
      assert.ok(receipt1 && receipt1.startsWith('sim:'));

      // Check balance: should now be 0.05
      const bal1 = await pool.query('SELECT credits_usdt, total_spent FROM api_credits WHERE api_key = $1', [customerKey]);
      console.log(`✓ Balance after 1st run: $${bal1.rows[0].credits_usdt} remaining, $${bal1.rows[0].total_spent} spent`);
      assert.equal(Number(bal1.rows[0].credits_usdt), 0.05);
      assert.equal(Number(bal1.rows[0].total_spent), 0.05);

      // -------------------------------------------------------------
      // Step 8: Idempotent Replay Verification ($0.00 Extra Charge)
      // -------------------------------------------------------------
      console.log('\n--- Step 8: Idempotent Replay (Zero Double-Charge) ---');
      const replayRes = await fetch(`${API_BASE}/v1/trading/paper/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': customerKey,
        },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey1,
          instrumentId: 'BINANCE:BTCUSDT',
          strategy: 'sma-crossover',
          strategyParams: { fastPeriod: 10, slowPeriod: 30 },
          orderQuantity: 1,
        }),
      });
      assert.equal(replayRes.status, 200, 'Idempotent replay must return 200');
      const replayBody = await replayRes.json();
      console.log(`✓ Replay response: idempotent_replay=${replayBody.idempotent_replay}`);
      assert.equal(replayBody.idempotent_replay, true, 'Must be flagged as idempotent replay');
      assert.equal(replayBody.revenue_receipt?.revenue_request_id, receipt1);

      // Check balance: must remain exactly 0.05 (no extra charge)
      const balReplay = await pool.query('SELECT credits_usdt, total_spent FROM api_credits WHERE api_key = $1', [customerKey]);
      console.log(`✓ Balance after replay: $${balReplay.rows[0].credits_usdt} remaining, $${balReplay.rows[0].total_spent} spent`);
      assert.equal(Number(balReplay.rows[0].credits_usdt), 0.05, 'Replay must NOT deduct credits');
      assert.equal(Number(balReplay.rows[0].total_spent), 0.05, 'Total spent must not increase');

      // -------------------------------------------------------------
      // Step 9: Idempotency Payload Conflict Rejection (422)
      // -------------------------------------------------------------
      console.log('\n--- Step 9: Payload Conflict Rejection (422) ---');
      const conflictRes = await fetch(`${API_BASE}/v1/trading/paper/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': customerKey,
        },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey1, // Reusing key with different instrument!
          instrumentId: 'NSE:NIFTY50',
          strategy: 'sma-crossover',
        }),
      });
      assert.equal(conflictRes.status, 422, 'Conflicting payload must return HTTP 422');
      const conflictBody = await conflictRes.json();
      console.log(`✓ 422 Rejected: error="${conflictBody.error}"`);
      assert.equal(conflictBody.error, 'idempotency_payload_mismatch');

      // -------------------------------------------------------------
      // Step 10: Second Simulation & Balance Exhaustion ($0.05)
      // -------------------------------------------------------------
      console.log('\n--- Step 10: Second Simulation & Account Exhaustion ---');
      const sim2Res = await fetch(`${API_BASE}/v1/trading/paper/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': customerKey,
        },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey2,
          instrumentId: 'PAPER:BTCUSDT',
          strategy: 'sma-crossover',
        }),
      });
      assert.equal(sim2Res.status, 200);
      const sim2Body = await sim2Res.json();
      console.log(`✓ Second simulation completed: billed_usdt=$${sim2Body.billed_usdt}`);
      assert.equal(sim2Body.billed_usdt, 0.05);
      const receipt2 = sim2Body.revenue_receipt?.revenue_request_id;
      assert.ok(receipt2 && receipt2.startsWith('sim:'));

      const bal2 = await pool.query('SELECT credits_usdt, total_spent FROM api_credits WHERE api_key = $1', [customerKey]);
      console.log(`✓ Balance after 2nd run: $${bal2.rows[0].credits_usdt} remaining, $${bal2.rows[0].total_spent} spent`);
      assert.equal(Number(bal2.rows[0].credits_usdt), 0.00);
      assert.equal(Number(bal2.rows[0].total_spent), 0.10);

      // -------------------------------------------------------------
      // Step 11: Exhausted Balance Rejection (402)
      // -------------------------------------------------------------
      console.log('\n--- Step 11: Exhausted Balance Rejection (402) ---');
      const sim3Res = await fetch(`${API_BASE}/v1/trading/paper/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': customerKey,
        },
        body: JSON.stringify({
          idempotencyKey: `cust_run_${runId}_003`,
          instrumentId: 'BINANCE:BTCUSDT',
          strategy: 'sma-crossover',
        }),
      });
      assert.equal(sim3Res.status, 402, 'Exhausted account must return 402');
      console.log('✓ Third simulation correctly denied with 402 (insufficient credits)');

      // -------------------------------------------------------------
      // Step 12: Ledger Reconciliation & Revenue Isolation
      // -------------------------------------------------------------
      console.log('\n--- Step 12: Ledger Reconciliation & Financial Truth ---');
      const ledgerEvents = await pool.query(
        `SELECT id, op_type, amount_usdt, request_id, is_test_data
         FROM revenue_events_v2
         WHERE client_id = $1
         ORDER BY id ASC`,
        [customerKey]
      );
      console.log(`✓ Ledger events found: ${ledgerEvents.rows.length}`);
      assert.equal(ledgerEvents.rows.length, 2, 'Exactly 2 revenue events should exist');

      for (const evt of ledgerEvents.rows) {
        assert.equal(evt.op_type, 'paper_simulation');
        assert.equal(Number(evt.amount_usdt), 0.05);
      }
      assert.equal(ledgerEvents.rows[0].request_id, receipt1);
      assert.equal(ledgerEvents.rows[1].request_id, receipt2);
      console.log('✓ Receipts reconcile 1:1 with revenue_events_v2 records');

      // Verify idempotency store
      const idemRows = await pool.query(
        `SELECT key, state, receipt_ref FROM trading_idempotency WHERE principal_id = $1`,
        [keyRef]
      );
      assert.equal(idemRows.rows.length, 2);
      console.log('✓ Durable PostgreSQL trading_idempotency persisted both states cleanly');
    }

    console.log('\n================================================================');
    console.log('  EXTERNAL CUSTOMER ACCEPTANCE TEST COMPLETED SUCCESSFULLY');
    console.log('================================================================\n');
  } finally {
    if (pool && customerKey) {
      console.log('[Cleanup] Safely removing test artifacts...');
      await pool.query('DELETE FROM api_credits WHERE api_key = $1', [customerKey]);
      if (keyRef) {
        await pool.query('DELETE FROM trading_idempotency WHERE principal_id = $1', [keyRef]);
      }
      await pool.query('DELETE FROM revenue_events_v2 WHERE client_id = $1', [customerKey]);
      console.log('[Cleanup] Teardown complete. External revenue remains strictly $0.00.');
    }
    if (server) server.close();
    if (pool) await pool.end();
  }
}

main().catch((err) => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
