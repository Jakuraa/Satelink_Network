/**
 * @satelink/trading — End-to-End Paper Trading Orchestrator Test Suite
 *
 * Verifies the full 13-step lifecycle:
 *   1. Permitted market data
 *   2. Validation of instrument, timestamps, freshness, licensing
 *   3. Deterministic baseline proposal
 *   4. OpenRouter/Decision API structured proposal
 *   5. Schema validation
 *   6. Consensus & policy priority (models propose; policy authorizes)
 *   7. 10-gate deterministic risk checks
 *   8. Auditable rejection of invalid proposals
 *   9. Idempotent paper order submission
 *  10. Simulated fills
 *  11. Unknown outcome reconciliation without duplicate submission
 *  12. Financial OS metering, fees, capital separation, trade receipts
 *  13. Complete report with performance & simulation banner
 */
import { describe, it, expect } from 'vitest';
import { PaperTradingOrchestrator } from '../workflow/paper-trading-orchestrator.js';
import { PaperDataProvider } from '../market/paper-data-provider.js';
import { PAPER_INSTRUMENTS } from '../market/instrument.js';
import { SMAcrossoverStrategy } from '../strategy/sma-crossover.js';
import { TradingDecisionAPI, type AIProvider } from '../decision/decision-api.js';
import { RiskAuthorizationEngine } from '../risk/authorization.js';
import { PaperBrokerAdapter } from '../execution/paper-broker.js';
import { FinancialOSMetering } from '../financial/metering.js';
import { DataFreshness, type Candle } from '../market/market-data.js';

function makeCandle(closeMinor: bigint): Candle {
  const now = new Date().toISOString();
  return {
    kind: 'CANDLE',
    instrument: PAPER_INSTRUMENTS.BTC_USDT,
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
      licenseEvidence: null,
    },
    openMinor: closeMinor,
    highMinor: closeMinor,
    lowMinor: closeMinor,
    closeMinor,
    volume: '1',
    isClosed: true,
  };
}

class MockAIProvider implements AIProvider {
  readonly id = 'mock-openrouter';
  constructor(
    public reply: { signal: string; confidence: number; rationale: string; risks: string[] } = {
      signal: 'BUY',
      confidence: 0.88,
      rationale: 'Strong momentum and trend confirmation',
      risks: ['Short term volatility'],
    },
    public shouldThrow = false,
  ) {}

  async structuredOutput<T = unknown>(): Promise<T> {
    if (this.shouldThrow) {
      throw new Error('OpenRouter API rate limit / timeout');
    }
    return this.reply as unknown as T;
  }
}

describe('PaperTradingOrchestrator — End-to-End Lifecycle', () => {
  const BTC = PAPER_INSTRUMENTS.BTC_USDT;

  function createHarness(opts: {
    aiProvider?: AIProvider;
    staleData?: boolean;
    unpermittedLicensing?: boolean;
  } = {}) {
    const dataProvider = new PaperDataProvider();
    dataProvider.setPrice(BTC, 60_000_00n); // $60,000
    // default buy crossover candles: [100, 100, 100, 100, 100, 100, 200]
    const buyPrices = [100n, 100n, 100n, 100n, 100n, 100n, 200n];
    dataProvider.setCandles(BTC, buyPrices.map(makeCandle));

    const baselineStrategy = new SMAcrossoverStrategy({ fastPeriod: 3, slowPeriod: 5 });
    const decisionApi = new TradingDecisionAPI({
      provider: opts.aiProvider ?? new MockAIProvider(),
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

    return { dataProvider, orchestrator, broker, metering };
  }

  function createBaseWorkflowOptions(overrides: Record<string, unknown> = {}) {
    return {
      idempotencyKey: `test-idem-${Date.now()}-${Math.random()}`,
      instrument: BTC,
      principal: { id: 'p-trader-1', authenticated: true, tradingAuthorized: true },
      account: {
        id: 'acc-trader-1',
        balanceMinor: 500_000_00n, // $500,000 balance
        currency: 'USDT',
        eligible: true,
        eligibleMarkets: ['BINANCE', 'PAPER'],
      },
      limits: {
        maxPositionCount: 5,
        maxExposureMinor: 1_000_000_00n, // $1,000,000 max exposure
        maxDailyLossMinor: 50_000_00n,
      },
      approvedInstruments: new Set([BTC.id]),
      customerFinAccount: {
        principalId: 'p-trader-1',
        currency: 'USDT',
        tradingCapitalMinor: 500_000_00n,
        realizedPnLMinor: 0n,
      },
      satelinkRevenueAccount: {
        currency: 'USDT',
        revenueBalanceMinor: 10_000_00n, // $10,000 Satelink treasury balance
      },
      orderQuantity: 1,
      ...overrides,
    };
  }

  it('completes the entire 13-step paper trading workflow end-to-end on a BUY signal', async () => {
    const { dataProvider, orchestrator } = createHarness();

    // Prepare candles that trigger a BUY crossover
    // fast(3)=133, slow(5)=120 -> crossover above
    const prices = [100n, 100n, 100n, 100n, 100n, 100n, 200n];
    let i = 0;
    for (const p of prices) {
      dataProvider.setPrice(BTC, p * 100_00n);
      i++;
    }

    const opts = createBaseWorkflowOptions();
    const report = await orchestrator.run(opts);

    // Step 2 validation
    expect(report.marketDataValidation.valid).toBe(true);
    expect(report.marketDataValidation.freshness).toBe(DataFreshness.SNAPSHOT);
    expect(report.disclaimer).toBe('SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS');

    // Step 3 & 4: Baseline & AI proposal
    expect(report.strategyBaseline.signal).toBe('BUY');
    expect(report.modelProposal?.signal).toBe('BUY');
    expect(report.consensus.agreesWithBaseline).toBe(true);

    // Step 7: Risk authorization
    expect(report.riskAuthorization.authorized).toBe(true);
    expect(report.riskAuthorization.passed.length).toBe(10);
    expect(report.riskAuthorization.failedGate).toBeNull();

    // Step 9 & 10: Order execution
    expect(report.orderExecution.submitted).toBe(true);
    expect(report.orderExecution.status).toBe('FILLED');
    expect(report.orderExecution.filledQuantity).toBe(1);
    expect(report.orderExecution.orderId).toContain('PAPER-');

    // Step 12: Financial OS settlement
    expect(report.financialSettlement.settled).toBe(true);
    expect(report.financialSettlement.receiptId).toContain('RCPT-');
    expect(BigInt(report.financialSettlement.notionalMinor)).toBeGreaterThan(0n);
    expect(BigInt(report.financialSettlement.platformFeeMinor)).toBeGreaterThan(0n);

    // Capital separation check: Satelink revenue received platform fee
    expect(BigInt(report.financialSettlement.satelinkRevenueBalanceMinor)).toBeGreaterThan(10_000_00n);
    // Customer capital reduced by notional + fees
    expect(BigInt(report.financialSettlement.remainingCustomerCapitalMinor)).toBeLessThan(500_000_00n);

    // Step 13: Performance summary
    expect(report.performance.status).toBe('FILLED');
    expect(report.performance.summary).toContain('executed successfully');
  });

  it('rejects execution when market data is stale (G4 gate fail)', async () => {
    const { dataProvider, orchestrator } = createHarness();

    // Mock snapshot returning stale timestamp (older than freshnessWindowSec)
    dataProvider.snapshot = async (inst) => ({
      kind: 'QUOTE',
      instrument: inst,
      eventTs: '2026-10-20T00:00:00.000Z',
      retrievalTs: '2026-10-20T00:00:00.000Z', // Days old
      freshness: DataFreshness.STALE,
      freshnessWindowSec: 10,
      licensing: {
        source: 'paper',
        strategyDerivationPermitted: true,
        displayPermitted: true,
        redistributionPermitted: false,
        commercialLicense: false,
        licenseEvidence: null,
      },
      bidMinor: 59_999_00n,
      askMinor: 60_001_00n,
      lastMinor: 60_000_00n,
      volume: '1',
      openInterest: null,
    });

    const opts = createBaseWorkflowOptions();
    const report = await orchestrator.run(opts);

    expect(report.marketDataValidation.valid).toBe(false);
    expect(report.marketDataValidation.rejectionReason).toContain('Market data is stale');
    expect(report.riskAuthorization.authorized).toBe(false);
    expect(report.riskAuthorization.failedGate).toBe('G4_DATA_FRESH');
    expect(report.orderExecution.submitted).toBe(false);
    expect(report.financialSettlement.settled).toBe(false);
    expect(report.performance.status).toBe('HALTED');
  });

  it('rejects execution when licensing does not permit strategy derivation', async () => {
    const { dataProvider, orchestrator } = createHarness();

    dataProvider.snapshot = async (inst) => ({
      kind: 'QUOTE',
      instrument: inst,
      eventTs: new Date().toISOString(),
      retrievalTs: new Date().toISOString(),
      freshness: DataFreshness.SNAPSHOT,
      freshnessWindowSec: 60,
      licensing: {
        source: 'restricted_feed',
        strategyDerivationPermitted: false, // Disallowed
        displayPermitted: true,
        redistributionPermitted: false,
        commercialLicense: false,
        licenseEvidence: null,
      },
      bidMinor: 59_999_00n,
      askMinor: 60_001_00n,
      lastMinor: 60_000_00n,
      volume: '1',
      openInterest: null,
    });

    const opts = createBaseWorkflowOptions();
    const report = await orchestrator.run(opts);

    expect(report.marketDataValidation.valid).toBe(false);
    expect(report.marketDataValidation.licensingValid).toBe(false);
    expect(report.marketDataValidation.rejectionReason).toContain('does not permit strategy derivation');
    expect(report.orderExecution.submitted).toBe(false);
  });

  it('gracefully handles OpenRouter provider failure by falling back to safe policy without crashing', async () => {
    const failingAI = new MockAIProvider(undefined, true);
    const { orchestrator } = createHarness({ aiProvider: failingAI });

    const opts = createBaseWorkflowOptions();
    const report = await orchestrator.run(opts);

    expect(report.modelProposal?.rationale).toContain('Model evaluation failed');
    expect(report.modelProposal?.risks).toContain('AI_PROVIDER_ERROR');
    // Does not crash; consensus records divergence
    expect(report.consensus.agreesWithBaseline).toBe(false);
  });

  it('rejects execution when customer funds are insufficient (G6 gate fail)', async () => {
    const { orchestrator } = createHarness();

    const opts = createBaseWorkflowOptions({
      account: {
        id: 'acc-poor',
        balanceMinor: 10_00n, // Only $10
        currency: 'USDT',
        eligible: true,
        eligibleMarkets: ['BINANCE', 'PAPER'],
      },
      orderQuantity: 10, // 10 * $60,000 = $600,000 order
    });

    const report = await orchestrator.run(opts);

    expect(report.riskAuthorization.authorized).toBe(false);
    expect(report.riskAuthorization.failedGate).toBe('G6_FUNDS');
    expect(report.riskAuthorization.reason).toContain('Insufficient funds');
    expect(report.orderExecution.submitted).toBe(false);
    expect(report.performance.status).toBe('REJECTED');
  });

  it('reconciles unknown order submissions without duplicating orders', async () => {
    const { orchestrator, broker } = createHarness();

    const idempotencyKey = 'idem-reconcile-test-999';

    // Submit an initial order with this idempotency key
    const initialOrder = broker.submit({
      idempotencyKey,
      instrumentId: BTC.id,
      exchange: BTC.exchange,
      side: 'BUY',
      orderType: 'MARKET',
      quantity: 1,
    });

    expect(initialOrder.status).toBe('FILLED');

    // Run workflow with simulateUnknownOrder: true and same idempotency key
    const opts = createBaseWorkflowOptions({
      idempotencyKey,
      simulateUnknownOrder: true,
    });

    const report = await orchestrator.run(opts);

    // Verify reconciliation occurred
    expect(report.orderExecution.reconciliation).toBeDefined();
    expect(report.orderExecution.reconciliation?.action).toBe('ADOPT_EXISTING');
    expect(report.orderExecution.orderId).toBe(initialOrder.orderId);

    // Ensure no duplicate order was created in broker
    const allOrders = broker.getAllOrders();
    const matching = allOrders.filter((o) => o.idempotencyKey === idempotencyKey);
    expect(matching.length).toBe(1);
  });
});
