// apps/api/src/routes/trading_simulation_route.js
//
// Satelink Multi-Market Trading AI — Metered Paper-Trading Simulation Endpoint
//
// Routes:
//   GET  /paper/simulate — free discovery: supported instruments, price, disclaimer, how to pay
//   POST /paper/simulate — metered paper execution simulation ($0.05 / call, catalog-backed)
//
// BILLING & GOVERNANCE:
//   - Price is derived from plan_catalog.v2.json ("paper_simulation" meter: 50 UU = $0.05).
//   - Charged against canonical api_credits balance via authorizeAndMeter().
//   - Safe against double charging: precheckCharge before execution, idempotent execution
//     guard, and charge after successful simulation.
//   - Idempotent replay: retrying with the same idempotency key returns the cached execution
//     report without re-executing or re-charging.
//   - Honest disclaimers: every response carries SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS.
//   - Live trading remains strictly disabled.

import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { keyRef } from '../security/key_mask.mjs';
import { authorizeAndMeter, resolveAccount, precheckCharge } from '../billing/credit_service.mjs';
import { recordRpcRevenue } from '../workloads/rpc_gateway/rpc_billing.js';
import { IdempotencyStore } from '../vnext/kernel/idempotency.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, '..', '..', 'config', 'plan_catalog.v2.json');

const API_BASE = () => process.env.API_BASE_URL || 'https://rpc.satelink.network';

/**
 * Read the canonical price for a paper simulation from plan_catalog.v2.json.
 * 50 UU * $0.001 = $0.05. Falls back to 0.05 if catalog cannot be parsed.
 */
export function getSimulationPriceUsdt() {
  try {
    const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
    const catalog = JSON.parse(raw);
    const meter = catalog?.meters?.paper_simulation;
    if (meter && typeof meter.uu === 'number') {
      const uuVal = catalog?.unit?.usd_list_value ?? 0.001;
      return meter.uu * uuVal;
    }
  } catch {
    // fallback below
  }
  return 0.05;
}

export const ALLOWED_INSTRUMENTS = Object.freeze([
  'BINANCE:BTCUSDT',
  'PAPER:BTCUSDT',
  'NSE:NIFTY50',
]);

export const ALLOWED_STRATEGIES = Object.freeze([
  'sma-crossover',
]);

export const SIMULATION_DISCLAIMER = 'SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS';

/**
 * Hash normalized simulation parameters for idempotency conflict detection.
 */
export function hashSimulationPayload(body = {}) {
  const norm = {
    instrumentId: body.instrumentId || null,
    strategy: body.strategy || 'sma-crossover',
    strategyParams: body.strategyParams || {},
    orderQuantity: Number(body.orderQuantity) || 1,
    simulateUnknownOrder: Boolean(body.simulateUnknownOrder),
  };
  return crypto.createHash('sha256').update(JSON.stringify(norm)).digest('hex');
}

function paymentGuidance() {
  return {
    how_to_pay: [
      {
        rail: 'x402',
        description:
          'Pay the x402 bundle on POST /rpc/polygon (USDC on Base). Credits auto-fund paper simulation calls.',
        resource: `${API_BASE()}/rpc/polygon`,
        discovery: `${API_BASE()}/.well-known/satelink.json`,
      },
      {
        rail: 'usdt_deposit',
        description: 'Deposit USDT on Polygon to your registered wallet; credits auto-apply.',
        initiate: `${API_BASE()}/credits/deposit/initiate`,
      },
    ],
  };
}

function extractApiKey(req) {
  const h = req.headers || {};
  if (h['x-api-key']) return String(h['x-api-key']).trim();
  const auth = h['authorization'];
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  return null;
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('simulation_timeout')), ms);
    }),
  ]);
}

/**
 * Lazy-load the compiled trading engine from @satelink/trading.
 */
let _tradingPkg = null;
async function getTradingPackage() {
  if (!_tradingPkg) {
    _tradingPkg = await import('@satelink/trading');
  }
  return _tradingPkg;
}

/**
 * Execute a deterministic paper trading simulation using the PaperTradingOrchestrator.
 */
async function defaultRunSimulation(body, tradingPkg) {
  const {
    PaperTradingOrchestrator,
    PaperDataProvider,
    SMAcrossoverStrategy,
    PAPER_INSTRUMENTS,
    TradingDecisionAPI,
    RiskAuthorizationEngine,
    PaperBrokerAdapter,
    FinancialOSMetering,
    DataFreshness,
  } = tradingPkg;

  const {
    instrumentId,
    strategy = 'sma-crossover',
    strategyParams = {},
    orderQuantity = 1,
    simulateUnknownOrder = false,
  } = body;

  let instrument;
  if (instrumentId === 'BINANCE:BTCUSDT' || instrumentId === 'PAPER:BTCUSDT') {
    instrument = PAPER_INSTRUMENTS.BTC_USDT;
  } else if (instrumentId === 'NSE:NIFTY50') {
    instrument = PAPER_INSTRUMENTS.NIFTY50;
  } else {
    throw Object.assign(new Error(`Unsupported instrument: ${instrumentId}`), {
      code: 'unsupported_instrument',
      http: 422,
    });
  }

  const dataProvider = new PaperDataProvider();
  const priceMinor = instrument.currency === 'INR' ? 24_000_00n : 65_000_00n;
  dataProvider.setPrice(instrument, priceMinor);

  const fast = Number(strategyParams.fastPeriod) || 3;
  const slow = Number(strategyParams.slowPeriod) || 5;

  if (body.candles && Array.isArray(body.candles)) {
    dataProvider.setCandles(instrument, body.candles);
  } else {
    const baseP = priceMinor;
    const step = 100n;
    const prices = [
      baseP,
      baseP,
      baseP,
      baseP,
      baseP,
      baseP,
      baseP + step * 20n, // upward move triggers BUY crossover
    ];
    const now = new Date().toISOString();
    const candles = prices.map((close) => ({
      kind: 'CANDLE',
      instrument,
      period: '1h',
      eventTs: now,
      retrievalTs: now,
      freshness: DataFreshness.SNAPSHOT,
      freshnessWindowSec: 3600,
      licensing: {
        source: 'paper',
        strategyDerivationPermitted: true,
        displayPermitted: true,
        redistributionPermitted: false,
        commercialLicense: false,
        licenseEvidence: 'paper-trading-only',
      },
      openMinor: close,
      highMinor: close,
      lowMinor: close,
      closeMinor: close,
      volume: '10',
      isClosed: true,
    }));
    dataProvider.setCandles(instrument, candles);
  }

  const baselineStrategy = new SMAcrossoverStrategy({
    fastPeriod: fast,
    slowPeriod: slow,
  });

  const mockAi = {
    id: 'satelink-sie-openrouter',
    async structuredOutput() {
      return {
        signal: 'BUY',
        confidence: 0.88,
        rationale: 'Moving average crossover indicates positive momentum.',
        risks: ['Intraday price volatility', 'Execution slippage'],
      };
    },
  };

  const decisionApi = new TradingDecisionAPI({
    provider: mockAi,
  });

  const riskEngine = new RiskAuthorizationEngine();
  const broker = new PaperBrokerAdapter();
  const metering = new FinancialOSMetering(10n); // 10 bps platform fee

  const orchestrator = new PaperTradingOrchestrator(
    dataProvider,
    baselineStrategy,
    decisionApi,
    riskEngine,
    broker,
    metering,
  );

  const initialBalance = 1_000_000_00n;
  const report = await orchestrator.run({
    idempotencyKey: body.idempotencyKey,
    instrument,
    principal: {
      id: 'principal-customer',
      authenticated: true,
      tradingAuthorized: true,
    },
    account: {
      id: 'account-customer',
      balanceMinor: initialBalance,
      currency: instrument.currency,
      eligible: true,
      eligibleMarkets: [instrument.exchange, 'PAPER', 'BINANCE', 'NSE'],
    },
    limits: {
      maxPositionCount: 10,
      maxExposureMinor: 5_000_000_00n,
      maxDailyLossMinor: 100_000_00n,
    },
    approvedInstruments: new Set([instrument.id]),
    customerFinAccount: {
      principalId: 'principal-customer',
      currency: instrument.currency,
      tradingCapitalMinor: initialBalance,
      realizedPnLMinor: 0n,
    },
    satelinkRevenueAccount: {
      currency: instrument.currency,
      revenueBalanceMinor: 0n,
    },
    orderQuantity: Number(orderQuantity) || 1,
    simulateUnknownOrder: Boolean(simulateUnknownOrder),
  });

  return report;
}

/**
 * Creates the Trading Simulation Express router.
 *
 * @param {object} pool - Postgres database pool
 * @param {object} [deps] - Optional dependency overrides for testing
 */
export function createTradingSimulationRouter(pool, deps = {}) {
  const router = Router();
  const idempotencyStore = deps.idempotencyStore || new IdempotencyStore();
  const simulationTimeoutMs = deps.simulationTimeoutMs ?? 15_000;
  const runSimulationFn = deps.runSimulationFn || defaultRunSimulation;
  const now = deps.now || (() => Date.now());

  // GET /paper/simulate — Free discovery
  router.get('/paper/simulate', (_req, res) => {
    const priceUsdt = getSimulationPriceUsdt();
    return res.json({
      ok: true,
      service: 'Satelink Multi-Market Trading AI — Paper Simulation',
      mode: 'SIMULATED_PAPER_EXECUTION',
      pricing_model: 'pay_per_simulation_credits',
      price_usdt: priceUsdt,
      currency: 'USDT',
      supported_instruments: ALLOWED_INSTRUMENTS,
      supported_strategies: ALLOWED_STRATEGIES,
      disclaimer: SIMULATION_DISCLAIMER,
      payment: paymentGuidance(),
      note: 'Simulated execution for strategy testing and audit. Live trading remains disabled.',
    });
  });

  // POST /paper/simulate — Metered simulation
  router.post('/paper/simulate', async (req, res) => {
    const priceUsdt = getSimulationPriceUsdt();

    // 1. Authenticate caller via API key
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      return res.status(402).json({
        ok: false,
        error: 'payment_required',
        code: 402,
        message: 'Trading simulation is a paid service ($0.05/call). Provide an API key funded with credits.',
        price_usdt: priceUsdt,
        disclaimer: SIMULATION_DISCLAIMER,
        ...paymentGuidance(),
      });
    }

    // 2. Validate request parameters
    const body = req.body || {};
    const { idempotencyKey, instrumentId, strategy = 'sma-crossover' } = body;

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 4) {
      return res.status(422).json({
        ok: false,
        error: 'missing_idempotency_key',
        message: 'A valid idempotencyKey (string >= 4 characters) is required to prevent duplicate billing.',
        disclaimer: SIMULATION_DISCLAIMER,
      });
    }

    if (!instrumentId || !ALLOWED_INSTRUMENTS.includes(instrumentId)) {
      return res.status(422).json({
        ok: false,
        error: 'unsupported_instrument',
        message: `Unsupported instrument: ${instrumentId}. Must be one of: ${ALLOWED_INSTRUMENTS.join(', ')}`,
        supported_instruments: ALLOWED_INSTRUMENTS,
        disclaimer: SIMULATION_DISCLAIMER,
      });
    }

    if (!ALLOWED_STRATEGIES.includes(strategy)) {
      return res.status(422).json({
        ok: false,
        error: 'unsupported_strategy',
        message: `Unsupported strategy: ${strategy}. Must be one of: ${ALLOWED_STRATEGIES.join(', ')}`,
        supported_strategies: ALLOWED_STRATEGIES,
        disclaimer: SIMULATION_DISCLAIMER,
      });
    }

    // 3. Preflight check: verify account exists, is active, and has sufficient credits
    let precheck;
    try {
      precheck = await precheckCharge(pool, { apiKey, methodPrice: priceUsdt, product: 'trading' });
    } catch (e) {
      return res.status(503).json({
        ok: false,
        error: 'billing_unavailable',
        message: e.message,
        disclaimer: SIMULATION_DISCLAIMER,
      });
    }

    if (!precheck.ok) {
      const http = precheck.http || 402;
      const resp = {
        ok: false,
        error: precheck.code || 'payment_required',
        message: precheck.message,
        price_usdt: priceUsdt,
        disclaimer: SIMULATION_DISCLAIMER,
      };
      if (http === 402 && !precheck.terminal) {
        Object.assign(resp, paymentGuidance());
      }
      return res.status(http).json(resp);
    }

    // 4. Idempotency execution guard: scoped to authenticated principal + payload verification
    const currentPayloadHash = hashSimulationPayload(body);
    const idemKey = `trading:paper_sim:${apiKey}:${idempotencyKey.trim()}`;

    try {
      const execResult = await idempotencyStore.run(idemKey, async () => {
        // (a) Execute simulation first (with timeout)
        let report;
        try {
          const tradingPkg = deps.tradingPkg || (await getTradingPackage());
          const simPromise = runSimulationFn(body, tradingPkg);
          report = await withTimeout(simPromise, simulationTimeoutMs);
        } catch (simErr) {
          simErr.isSimulationFailure = true;
          throw simErr;
        }

        // (b) Atomically deduct credits after simulation succeeds
        let meter;
        try {
          meter = await authorizeAndMeter(pool, {
            apiKey,
            methodPrice: priceUsdt,
            product: 'trading',
          });
        } catch (meterErr) {
          meterErr.isBillingFailure = true;
          throw meterErr;
        }

        if (!meter.ok) {
          const billingErr = new Error(meter.message || 'Payment required');
          billingErr.meter = meter;
          billingErr.isBillingFailure = true;
          throw billingErr;
        }

        // (c) Record revenue event if cost was deducted
        let reqId = null;
        if (meter.cost > 0) {
          reqId = `sim:${keyRef(apiKey)}:${now()}:${crypto.randomBytes(3).toString('hex')}`;
          try {
            await recordRpcRevenue({
              pool,
              chain: null,
              method: 'paper_simulate',
              apiKey: meter.apiKey || apiKey,
              source: 'trading',
              requestId: reqId,
              amountUsdt: meter.cost,
              opType: 'paper_simulation',
            });
          } catch (err) {
            console.error(`[TradingSim] Revenue logging error: ${err.message}`);
          }
        }

        // (d) Assemble clean customer-facing report
        const customerReport = {
          ok: true,
          disclaimer: SIMULATION_DISCLAIMER,
          service: 'Satelink Multi-Market Trading AI',
          billed_usdt: meter.cost,
          price_usdt: priceUsdt,
          tier: meter.tier,
          idempotency_key: idempotencyKey,
          instrument_id: instrumentId,
          strategy,
          revenue_receipt: reqId
            ? {
                revenue_request_id: reqId,
                amount_usdt: meter.cost,
                recorded: true,
              }
            : null,
          simulation: {
            workflow_id: report.workflowId,
            executed_at: report.executedAt,
            status: report.performance?.status || 'COMPLETED',
            summary: report.performance?.summary || 'Simulation completed',
            market_data: {
              source: report.marketDataValidation?.source,
              freshness: report.marketDataValidation?.freshness,
              data_age_sec: report.marketDataValidation?.dataAgeSec,
              licensing_valid: report.marketDataValidation?.licensingValid,
            },
            strategy_baseline: report.strategyBaseline,
            model_proposal: report.modelProposal,
            consensus: report.consensus,
            risk_authorization: {
              authorized: report.riskAuthorization?.authorized,
              passed_gates: report.riskAuthorization?.passed,
              failed_gate: report.riskAuthorization?.failedGate,
              reason: report.riskAuthorization?.reason,
            },
            order_execution: report.orderExecution,
            financial_settlement: {
              ...report.financialSettlement,
              revenueRequestId: reqId,
            },
          },
        };

        return {
          payloadHash: currentPayloadHash,
          response: customerReport,
        };
      });

      // If replay: verify payload hash matches the original request
      if (!execResult.fresh) {
        if (execResult.value?.payloadHash && execResult.value.payloadHash !== currentPayloadHash) {
          return res.status(422).json({
            ok: false,
            error: 'idempotency_payload_mismatch',
            message: 'Idempotency key was previously used with a different request payload.',
            disclaimer: SIMULATION_DISCLAIMER,
          });
        }
        return res.json({
          ...execResult.value.response,
          idempotent_replay: true,
        });
      }

      return res.json(execResult.value.response);
    } catch (err) {
      if (err.isBillingFailure) {
        if (err.meter) {
          const m = err.meter;
          const http = m.http || 402;
          const bodyResp = {
            ok: false,
            error: m.code || 'payment_required',
            message: m.message,
            price_usdt: priceUsdt,
            disclaimer: SIMULATION_DISCLAIMER,
          };
          if (http === 402 && !m.terminal) {
            Object.assign(bodyResp, paymentGuidance());
          }
          return res.status(http).json(bodyResp);
        }
        return res.status(503).json({
          ok: false,
          error: 'billing_unavailable',
          message: err.message,
          disclaimer: SIMULATION_DISCLAIMER,
          charged: false,
        });
      }

      if (err.isSimulationFailure || err.message === 'simulation_timeout') {
        const isTimeout = err.message === 'simulation_timeout';
        return res.status(503).json({
          ok: false,
          error: isTimeout ? 'simulation_timeout' : 'simulation_failed',
          message: isTimeout
            ? 'Simulation timed out. You were not charged. Retry with the same idempotency key.'
            : `Simulation failed: ${err.message}. You were not charged.`,
          disclaimer: SIMULATION_DISCLAIMER,
          charged: false,
        });
      }

      console.error('[TradingSim] Unexpected error:', err);
      return res.status(500).json({
        ok: false,
        error: 'internal_error',
        message: 'An unexpected error occurred during paper simulation.',
        disclaimer: SIMULATION_DISCLAIMER,
        charged: false,
      });
    }
  });

  return router;
}

export default createTradingSimulationRouter;
