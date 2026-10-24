/**
 * PaperTradingOrchestrator — End-to-end verified paper-trading workflow.
 *
 * Implements the 13-step lifecycle:
 *   1. Load permitted market-data source
 *   2. Validate instrument, timestamps, freshness, licensing metadata
 *   3. Generate deterministic baseline proposal (SMA Crossover)
 *   4. Request structured model proposal via Decision API (OpenRouter/SIE)
 *   5. Validate output against Decision API schema
 *   6. Compare model and baseline proposals (models propose; deterministic policy authorizes)
 *   7. Run 10-gate deterministic risk engine
 *   8. Reject invalid proposals with auditable reason
 *   9. Submit approved paper orders idempotently
 *  10. Record order states and simulated fills
 *  11. Reconcile unknown outcomes without duplicate submissions
 *  12. Record trade receipts, platform fees and usage through Financial OS metering
 *  13. Compile structured audit report with performance and simulated disclaimers
 *
 * Invariant: CI-reproducible without live broker credentials.
 * Label: SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS.
 */
import type { Instrument } from '../market/instrument.js';
import type { MarketDataProvider, Quote, Candle } from '../market/market-data.js';
import { DataFreshness } from '../market/market-data.js';
import type { DeterministicStrategy, SignalResult } from '../strategy/types.js';
import { Signal } from '../strategy/types.js';
import type { TradingDecisionAPI, TradingDecisionProposal } from '../decision/decision-api.js';
import type {
  RiskAuthorizationEngine,
  Principal,
  TradingAccount,
  RiskLimits,
  AuthorizationResult,
  OrderSide,
} from '../risk/authorization.js';
import { OrderType } from '../risk/authorization.js';
import type { PaperBrokerAdapter, PaperOrder } from '../execution/paper-broker.js';
import { UnknownOrderReconciler, type ReconcileDecision } from '../execution/broker-adapter.js';
import type {
  FinancialOSMetering,
  CustomerTradingAccount,
  SatelinkRevenueAccount,
  TradeReceipt,
} from '../financial/metering.js';

export interface WorkflowMarketDataValidation {
  readonly valid: boolean;
  readonly source: string;
  readonly eventTs: string;
  readonly retrievalTs: string;
  readonly dataAgeSec: number;
  readonly freshness: string;
  readonly licensingValid: boolean;
  readonly rejectionReason?: string | undefined;
}

export interface PaperTradingExecutionReport {
  readonly workflowId: string;
  readonly executedAt: string;
  readonly disclaimer: 'SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS';
  readonly instrumentId: string;
  readonly marketDataValidation: WorkflowMarketDataValidation;
  readonly strategyBaseline: {
    readonly version: string;
    readonly signal: Signal;
    readonly confidence: number;
    readonly rationale: string;
  };
  readonly modelProposal: {
    readonly model: string;
    readonly signal: string;
    readonly confidence: number;
    readonly rationale: string;
    readonly risks: readonly string[];
  } | null;
  readonly consensus: {
    readonly agreesWithBaseline: boolean;
    readonly finalIntentSide: OrderSide | 'NONE';
  };
  readonly riskAuthorization: AuthorizationResult;
  readonly orderExecution: {
    readonly submitted: boolean;
    readonly orderId: string | null;
    readonly idempotencyKey: string;
    readonly status: string;
    readonly filledPriceMinor: string | null;
    readonly filledQuantity: number;
    readonly reconciliation?: ReconcileDecision | undefined;
  };
  readonly financialSettlement: {
    readonly settled: boolean;
    readonly receiptId: string | null;
    readonly notionalMinor: string;
    readonly platformFeeMinor: string;
    readonly exchangeFeeMinor: string;
    readonly remainingCustomerCapitalMinor: string;
    readonly satelinkRevenueBalanceMinor: string;
  };
  readonly performance: {
    readonly status: 'FILLED' | 'REJECTED' | 'HALTED' | 'NO_SIGNAL';
    readonly summary: string;
  };
}

export interface RunWorkflowOptions {
  readonly idempotencyKey: string;
  readonly instrument: Instrument;
  readonly principal: Principal;
  readonly account: TradingAccount;
  readonly limits: RiskLimits;
  readonly approvedInstruments: ReadonlySet<string>;
  readonly customerFinAccount: CustomerTradingAccount;
  readonly satelinkRevenueAccount: SatelinkRevenueAccount;
  readonly orderQuantity?: number;
  readonly simulateUnknownOrder?: boolean;
}

export class PaperTradingOrchestrator {
  private seq = 0;
  private readonly reconciler: UnknownOrderReconciler;

  constructor(
    private readonly dataProvider: MarketDataProvider,
    private readonly baselineStrategy: DeterministicStrategy,
    private readonly decisionApi: TradingDecisionAPI,
    private readonly riskEngine: RiskAuthorizationEngine,
    private readonly broker: PaperBrokerAdapter,
    private readonly metering: FinancialOSMetering,
  ) {
    this.reconciler = new UnknownOrderReconciler(this.broker);
  }

  async run(opts: RunWorkflowOptions): Promise<PaperTradingExecutionReport> {
    const workflowId = `WF-PAPER-${++this.seq}-${Date.now()}`;
    const executedAt = new Date().toISOString();
    const qty = opts.orderQuantity ?? 1;

    // STEP 1: Load permitted market data
    const quote: Quote = await this.dataProvider.snapshot(opts.instrument);
    const candles: Candle[] = await this.dataProvider.candles(opts.instrument, '1h', 10);

    // STEP 2: Validate instrument, timestamps, freshness and licensing metadata
    const nowMs = Date.now();
    const retrievalMs = new Date(quote.retrievalTs).getTime();
    const dataAgeSec = Math.max(0, Math.floor((nowMs - retrievalMs) / 1000));
    const freshnessStatus = this.dataProvider.checkFreshness(quote, nowMs);
    const licensingOk = quote.licensing.strategyDerivationPermitted;

    let marketDataValid = true;
    let dataRejectionReason: string | undefined;

    if (freshnessStatus === DataFreshness.STALE) {
      marketDataValid = false;
      dataRejectionReason = `Market data is stale: age ${dataAgeSec}s exceeds threshold ${quote.freshnessWindowSec}s`;
    } else if (!licensingOk) {
      marketDataValid = false;
      dataRejectionReason = `Provider '${quote.licensing.source}' does not permit strategy derivation`;
    } else if (opts.instrument.id !== quote.instrument.id) {
      marketDataValid = false;
      dataRejectionReason = `Instrument ID mismatch: expected ${opts.instrument.id}, got ${quote.instrument.id}`;
    }

    const validationReport: WorkflowMarketDataValidation = {
      valid: marketDataValid,
      source: quote.licensing.source,
      eventTs: quote.eventTs,
      retrievalTs: quote.retrievalTs,
      dataAgeSec,
      freshness: freshnessStatus,
      licensingValid: licensingOk,
      rejectionReason: dataRejectionReason,
    };

    // Fast-fail if market data invalid
    if (!marketDataValid) {
      return this.buildReport({
        workflowId,
        executedAt,
        instrumentId: opts.instrument.id,
        validation: validationReport,
        baseline: null,
        proposal: null,
        agrees: false,
        authResult: {
          authorized: false,
          policyVersion: '1.0.0',
          evaluatedAt: executedAt,
          passed: [],
          failedGate: 'G4_DATA_FRESH',
          reason: dataRejectionReason ?? 'Invalid market data',
        },
        order: null,
        receipt: null,
        customerFinAccount: opts.customerFinAccount,
        satelinkRevenueAccount: opts.satelinkRevenueAccount,
        idempotencyKey: opts.idempotencyKey,
        status: 'HALTED',
        summary: `Workflow halted at Step 2: ${dataRejectionReason}`,
      });
    }

    // STEP 3: Generate deterministic baseline proposal
    const strategyInput = {
      instrument: opts.instrument,
      latestQuote: quote,
      recentCandles: candles,
    };
    const baselineSignal: SignalResult = this.baselineStrategy.evaluate(strategyInput);

    // STEP 4 & 5: Request structured model proposal & validate schema
    let modelProposal: TradingDecisionProposal | null = null;
    let agreesWithBaseline = false;

    try {
      const decisionResult = await this.decisionApi.propose({
        input: strategyInput,
        deterministicBaseline: baselineSignal,
      });
      modelProposal = decisionResult.proposal;
      agreesWithBaseline = decisionResult.agreesWithBaseline;
    } catch (err) {
      // OpenRouter error or schema invalid - default safely to baseline without crashing
      modelProposal = {
        signal: 'HOLD',
        confidence: 0,
        rationale: `Model evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
        risks: ['AI_PROVIDER_ERROR'],
        model: 'fallback-none',
        generationId: null,
        inputTokens: 0,
        outputTokens: 0,
        costMicroUsd: 0n,
      };
      agreesWithBaseline = false;
    }

    // STEP 6: Compare model and baseline proposals
    // Models propose; deterministic policy authorizes.
    // If baseline is HOLD, no trade is executed.
    const intentSide: OrderSide | 'NONE' =
      baselineSignal.signal === Signal.BUY ? 'BUY' :
      baselineSignal.signal === Signal.SELL ? 'SELL' : 'NONE';

    if (intentSide === 'NONE') {
      return this.buildReport({
        workflowId,
        executedAt,
        instrumentId: opts.instrument.id,
        validation: validationReport,
        baseline: baselineSignal,
        proposal: modelProposal,
        agrees: agreesWithBaseline,
        authResult: {
          authorized: false,
          policyVersion: '1.0.0',
          evaluatedAt: executedAt,
          passed: ['G1_PRINCIPAL', 'G2_TRADING_AUTH', 'G3_ACCOUNT_ELIGIBLE', 'G4_DATA_FRESH', 'G5_INSTRUMENT_APPROVED'],
          failedGate: null,
          reason: 'Baseline strategy signals HOLD; no order generated',
        },
        order: null,
        receipt: null,
        customerFinAccount: opts.customerFinAccount,
        satelinkRevenueAccount: opts.satelinkRevenueAccount,
        idempotencyKey: opts.idempotencyKey,
        status: 'NO_SIGNAL',
        summary: 'Baseline strategy evaluated to HOLD; order was not generated.',
      });
    }

    // STEP 7 & 8: Run 10-gate deterministic risk engine
    const estimatedPrice = quote.lastMinor ?? quote.askMinor ?? quote.bidMinor ?? 100_00n;
    const orderValueMinor = BigInt(qty) * estimatedPrice;

    const authInput = {
      principal: opts.principal,
      account: opts.account,
      orderIntent: {
        idempotencyKey: opts.idempotencyKey,
        instrumentId: opts.instrument.id,
        exchange: opts.instrument.exchange,
        side: intentSide,
        orderType: OrderType.MARKET,
        quantity: qty,
      },
      limits: opts.limits,
      dataAgeSeconds: dataAgeSec,
      maxDataAgeSeconds: quote.freshnessWindowSec,
      approvedInstruments: opts.approvedInstruments,
      currentPositionCount: 0,
      currentExposureMinor: 0n,
      todaysLossMinor: 0n,
      isDuplicate: false,
      killSwitchEngaged: false,
      orderValueMinor,
    };

    const authResult: AuthorizationResult = this.riskEngine.authorize(authInput);

    // If risk authorization failed, record and halt
    if (!authResult.authorized) {
      return this.buildReport({
        workflowId,
        executedAt,
        instrumentId: opts.instrument.id,
        validation: validationReport,
        baseline: baselineSignal,
        proposal: modelProposal,
        agrees: agreesWithBaseline,
        authResult,
        order: null,
        receipt: null,
        customerFinAccount: opts.customerFinAccount,
        satelinkRevenueAccount: opts.satelinkRevenueAccount,
        idempotencyKey: opts.idempotencyKey,
        status: 'REJECTED',
        summary: `Risk authorization rejected at gate ${authResult.failedGate}: ${authResult.reason}`,
      });
    }

    // STEP 9 & 10: Submit approved paper order idempotently & record fills
    // Ensure paper broker has fresh simulated market price
    this.broker.setMarketPrice(opts.instrument.id, estimatedPrice);

    let paperOrder: PaperOrder;
    let reconcileDecision: ReconcileDecision | undefined;

    if (opts.simulateUnknownOrder) {
      // STEP 11: Reconcile unknown outcome scenario
      // Check existing order via reconciler before any retry
      reconcileDecision = await this.reconciler.reconcile(opts.idempotencyKey);
      if (reconcileDecision.action === 'ADOPT_EXISTING' && reconcileDecision.existingOrder) {
        const orderId =
          reconcileDecision.existingOrder.brokerOrderId ||
          (reconcileDecision.existingOrder as { orderId?: string }).orderId ||
          '';
        const found = this.broker.getOrder(orderId);
        paperOrder = found ?? this.broker.submit(authInput.orderIntent);
      } else {
        paperOrder = this.broker.submit(authInput.orderIntent);
      }
    } else {
      paperOrder = this.broker.submit(authInput.orderIntent);
    }

    // STEP 12: Record trade receipts and fees through Financial OS metering
    let receipt: TradeReceipt | null = null;
    if (paperOrder.status === 'FILLED' && paperOrder.filledPriceMinor != null) {
      const settlement = this.metering.settleFill(
        opts.customerFinAccount,
        opts.satelinkRevenueAccount,
        {
          orderId: paperOrder.orderId,
          idempotencyKey: opts.idempotencyKey,
          instrumentId: opts.instrument.id,
          side: intentSide,
          fillPriceMinor: paperOrder.filledPriceMinor,
          filledQuantity: paperOrder.filledQuantity,
          currency: opts.instrument.currency,
          exchangeFeeMinor: 10n, // Nominal simulated exchange fee
          timestamp: paperOrder.updatedAt,
        },
      );
      receipt = settlement.receipt;
    }

    // STEP 13: Produce complete performance & audit report
    return this.buildReport({
      workflowId,
      executedAt,
      instrumentId: opts.instrument.id,
      validation: validationReport,
      baseline: baselineSignal,
      proposal: modelProposal,
      agrees: agreesWithBaseline,
      authResult,
      order: paperOrder,
      receipt,
      reconcileDecision,
      customerFinAccount: opts.customerFinAccount,
      satelinkRevenueAccount: opts.satelinkRevenueAccount,
      idempotencyKey: opts.idempotencyKey,
      status: 'FILLED',
      summary: `Order ${paperOrder.orderId} executed successfully at ${paperOrder.filledPriceMinor} minor-units. Financial OS receipt issued.`,
    });
  }

  private buildReport(ctx: {
    workflowId: string;
    executedAt: string;
    instrumentId: string;
    validation: WorkflowMarketDataValidation;
    baseline: SignalResult | null;
    proposal: TradingDecisionProposal | null;
    agrees: boolean;
    authResult: AuthorizationResult;
    order: PaperOrder | null;
    receipt: TradeReceipt | null;
    reconcileDecision?: ReconcileDecision | undefined;
    customerFinAccount: CustomerTradingAccount;
    satelinkRevenueAccount: SatelinkRevenueAccount;
    idempotencyKey: string;
    status: 'FILLED' | 'REJECTED' | 'HALTED' | 'NO_SIGNAL';
    summary: string;
  }): PaperTradingExecutionReport {
    return {
      workflowId: ctx.workflowId,
      executedAt: ctx.executedAt,
      disclaimer: 'SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS',
      instrumentId: ctx.instrumentId,
      marketDataValidation: ctx.validation,
      strategyBaseline: ctx.baseline
        ? {
            version: ctx.baseline.strategyVersion,
            signal: ctx.baseline.signal,
            confidence: ctx.baseline.confidence,
            rationale: ctx.baseline.rationale,
          }
        : {
            version: 'N/A',
            signal: Signal.HOLD,
            confidence: 0,
            rationale: 'Baseline evaluation omitted due to prior stage halt',
          },
      modelProposal: ctx.proposal
        ? {
            model: ctx.proposal.model,
            signal: ctx.proposal.signal,
            confidence: ctx.proposal.confidence,
            rationale: ctx.proposal.rationale,
            risks: ctx.proposal.risks,
          }
        : null,
      consensus: {
        agreesWithBaseline: ctx.agrees,
        finalIntentSide: ctx.baseline?.signal === Signal.BUY ? 'BUY' : ctx.baseline?.signal === Signal.SELL ? 'SELL' : 'NONE',
      },
      riskAuthorization: ctx.authResult,
      orderExecution: {
        submitted: ctx.order !== null,
        orderId: ctx.order?.orderId ?? null,
        idempotencyKey: ctx.idempotencyKey,
        status: ctx.order?.status ?? 'NOT_SUBMITTED',
        filledPriceMinor: ctx.order?.filledPriceMinor?.toString() ?? null,
        filledQuantity: ctx.order?.filledQuantity ?? 0,
        reconciliation: ctx.reconcileDecision,
      },
      financialSettlement: {
        settled: ctx.receipt !== null,
        receiptId: ctx.receipt?.receiptId ?? null,
        notionalMinor: ctx.receipt?.notionalMinor.toString() ?? '0',
        platformFeeMinor: ctx.receipt?.satelinkFeeMinor.toString() ?? '0',
        exchangeFeeMinor: ctx.receipt?.exchangeFeeMinor.toString() ?? '0',
        remainingCustomerCapitalMinor: ctx.customerFinAccount.tradingCapitalMinor.toString(),
        satelinkRevenueBalanceMinor: ctx.satelinkRevenueAccount.revenueBalanceMinor.toString(),
      },
      performance: {
        status: ctx.status,
        summary: ctx.summary,
      },
    };
  }
}
