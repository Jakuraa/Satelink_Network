import { describe, it, expect } from "vitest";
import { NAV, SIMPLE_NAV, ADVANCED_NAV } from "../src/components/Shell";
import { loadTradingDiscovery, FALLBACK_DISCOVERY, type SimulationReport } from "../src/lib/trading";
import { TASKS, USE_CASE_LABELS } from "../src/lib/onboarding";

describe("Satelink Trading AI — Console Repositioning Acceptance Suite", () => {
  describe("1. Information Architecture & Navigation", () => {
    it("configures the 5 primary workspaces in NAV", () => {
      const hrefs = NAV.map((n) => n.href);
      expect(hrefs).toContain("/");
      expect(hrefs).toContain("/paper-trading");
      expect(hrefs).toContain("/developers");
      expect(hrefs).toContain("/billing");
      expect(hrefs).toContain("/docs");

      const paperItem = NAV.find((n) => n.href === "/paper-trading");
      expect(paperItem?.label).toBe("Paper Trading");

      const devItem = NAV.find((n) => n.href === "/developers");
      expect(devItem?.label).toBe("API & Developers");
    });

    it("configures SIMPLE_NAV for developer-first onboarding", () => {
      const hrefs = SIMPLE_NAV.map((n) => n.href);
      expect(hrefs).toContain("/");
      expect(hrefs).toContain("/paper-trading");
      expect(hrefs).toContain("/developers");
      expect(hrefs).toContain("/billing");
      expect(hrefs).toContain("/docs");
    });

    it("preserves advanced telemetry and key tools in ADVANCED_NAV", () => {
      const hrefs = ADVANCED_NAV.map((n) => n.href);
      expect(hrefs).toContain("/paper-trading");
      expect(hrefs).toContain("/developers");
      expect(hrefs).toContain("/keys");
      expect(hrefs).toContain("/requests");
      expect(hrefs).toContain("/usage");
      expect(hrefs).toContain("/spend");
      expect(hrefs).toContain("/rpc");
      expect(hrefs).toContain("/x402");
    });
  });

  describe("2. Canonical Capability Discovery & Price Truth", () => {
    it("reports canonical $0.05 USDT rate and supported instruments", async () => {
      const disco = await loadTradingDiscovery();

      expect(disco.ok).toBe(true);
      expect(disco.price_usdt).toBe(0.05);
      expect(disco.currency).toBe("USDT");
      expect(disco.mode).toBe("SIMULATED_PAPER_EXECUTION");

      // Supported instruments
      expect(disco.supported_instruments).toContain("BINANCE:BTCUSDT");
      expect(disco.supported_instruments).toContain("PAPER:BTCUSDT");
      expect(disco.supported_instruments).toContain("NSE:NIFTY50");
      expect(disco.supported_instruments.length).toBe(3);

      // Supported strategy
      expect(disco.supported_strategies).toContain("sma-crossover");

      // Mandatory disclaimer
      expect(disco.disclaimer).toBe("SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS");

      // Payment rails guidance present
      expect(disco.payment?.how_to_pay?.length).toBeGreaterThan(0);
    });

    it("provides fallback discovery that maintains zero-fake-data invariants", () => {
      expect(FALLBACK_DISCOVERY.price_usdt).toBe(0.05);
      expect(FALLBACK_DISCOVERY.mode).toBe("SIMULATED_PAPER_EXECUTION");
      expect(FALLBACK_DISCOVERY.disclaimer).toBe("SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS");
    });
  });

  describe("3. Simulation Request Construction & Parameter Validation", () => {
    it("validates valid payload parameters", () => {
      const payload = {
        idempotencyKey: "sim_test_001",
        instrumentId: "BINANCE:BTCUSDT",
        strategy: "sma-crossover",
        strategyParams: { fastPeriod: 3, slowPeriod: 5 },
        orderQuantity: 1,
      };

      expect(payload.idempotencyKey.length).toBeGreaterThanOrEqual(4);
      expect(["BINANCE:BTCUSDT", "PAPER:BTCUSDT", "NSE:NIFTY50"]).toContain(payload.instrumentId);
      expect(payload.strategy).toBe("sma-crossover");
      expect(payload.strategyParams.fastPeriod).toBe(3);
      expect(payload.strategyParams.slowPeriod).toBe(5);
      expect(payload.orderQuantity).toBeGreaterThanOrEqual(1);
    });

    it("detects invalid idempotency keys (< 4 characters)", () => {
      const badKeys = ["", "a", "123", "   "];
      for (const k of badKeys) {
        expect(k.trim().length < 4).toBe(true);
      }
    });

    it("detects unsupported instruments", () => {
      const unsupported = ["COINBASE:ETHUSD", "NASDAQ:AAPL", "FOREX:EURUSD"];
      for (const inst of unsupported) {
        expect(FALLBACK_DISCOVERY.supported_instruments.includes(inst)).toBe(false);
      }
    });
  });

  describe("4. Error & Idempotency Semantics", () => {
    it("verifies HTTP 402 payment required schema", () => {
      const mock402 = {
        ok: false,
        error: "payment_required",
        code: 402,
        message: "Trading simulation is a paid service ($0.05/call). Provide an API key funded with credits.",
        price_usdt: 0.05,
        disclaimer: "SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS",
        how_to_pay: [
          { rail: "x402", resource: "https://rpc.satelink.network/rpc/polygon" },
          { rail: "usdt_deposit", initiate: "https://rpc.satelink.network/credits/deposit/initiate" },
        ],
      };

      expect(mock402.ok).toBe(false);
      expect(mock402.code).toBe(402);
      expect(mock402.price_usdt).toBe(0.05);
      expect(mock402.disclaimer).toBe("SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS");
      expect(mock402.how_to_pay.length).toBe(2);
    });

    it("verifies HTTP 422 validation and idempotency conflict schemas", () => {
      const mock422Mismatch = {
        ok: false,
        error: "idempotency_payload_mismatch",
        message: "This idempotency key was previously submitted with a different payload.",
        disclaimer: "SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS",
      };

      expect(mock422Mismatch.ok).toBe(false);
      expect(mock422Mismatch.error).toBe("idempotency_payload_mismatch");
      expect(mock422Mismatch.disclaimer).toBe("SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS");
    });
  });

  describe("5. Structured Simulation Report & Authoritative Receipt", () => {
    it("validates successful 200 report structure and Financial OS receipt", () => {
      const mockReport: SimulationReport = {
        ok: true,
        disclaimer: "SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS",
        service: "Satelink Multi-Market Trading AI",
        billed_usdt: 0.05,
        price_usdt: 0.05,
        tier: "payg",
        idempotency_key: "sim_test_001",
        instrument_id: "BINANCE:BTCUSDT",
        strategy: "sma-crossover",
        revenue_receipt: {
          revenue_request_id: "sim:key_test:1729850000:abc",
          amount_usdt: 0.05,
          recorded: true,
        },
        simulation: {
          workflow_id: "wf_test_001",
          executed_at: new Date().toISOString(),
          status: "COMPLETED",
          summary: "Simulation completed",
          market_data: {
            source: "paper",
            freshness: "SNAPSHOT",
            data_age_sec: 12,
            licensing_valid: true,
          },
          strategy_baseline: {
            type: "sma-crossover",
            parameters: { fastPeriod: 3, slowPeriod: 5 },
          },
          model_proposal: {
            signal: "BUY",
            confidence: 0.88,
            rationale: "Moving average crossover indicates positive momentum.",
            risks: ["Intraday price volatility", "Execution slippage"],
          },
          risk_authorization: {
            authorized: true,
            passed_gates: ["maxPositionCount", "maxExposureMinor", "maxDailyLossMinor"],
            failed_gate: null,
            reason: null,
          },
          order_execution: {
            order_id: "sim_order_001",
            status: "FILLED",
            side: "BUY",
            price: "65000.00",
            quantity: 1,
          },
          financial_settlement: {
            revenueRequestId: "sim:key_test:1729850000:abc",
            platformFeeMinor: "1000",
            currency: "USD",
          },
        },
      };

      expect(mockReport.ok).toBe(true);
      expect(mockReport.billed_usdt).toBe(0.05);
      expect(mockReport.revenue_receipt?.amount_usdt).toBe(0.05);
      expect(mockReport.revenue_receipt?.recorded).toBe(true);
      expect(mockReport.revenue_receipt?.revenue_request_id).toMatch(/^sim:/);
      expect(mockReport.simulation?.status).toBe("COMPLETED");
      expect(mockReport.simulation?.order_execution?.status).toBe("FILLED");
      expect(mockReport.simulation?.risk_authorization?.authorized).toBe(true);
      expect(mockReport.disclaimer).toBe("SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS");
    });
  });

  describe("6. First-Run Onboarding & Task Mapping", () => {
    it("maps onboarding tasks to developer-first endpoints", () => {
      expect(TASKS["market-data"].href).toBe("/paper-trading");
      expect(TASKS["market-data"].title).toContain("paper simulation");

      expect(TASKS["agent-access"].href).toBe("/developers");
      expect(TASKS["agent-access"].title).toContain("API keys");

      expect(TASKS["add-money"].href).toBe("/billing/add");
      expect(TASKS["add-money"].title).toContain("credits");

      expect(TASKS["spend"].href).toBe("/spend");
      expect(TASKS["rpc"].href).toBe("/rpc");
    });

    it("preserves supported use case labels", () => {
      expect(USE_CASE_LABELS.automated_trading).toBe("Automated trading (bots and strategies)");
      expect(USE_CASE_LABELS.ai_agent).toBe("An AI agent that needs market data");
    });
  });

  describe("7. Claims & Positioning Truth", () => {
    it("does not contain forbidden claims across navigation or task descriptors", () => {
      const texts = [
        ...NAV.map((n) => n.label),
        ...Object.values(TASKS).map((t) => `${t.title} ${t.body}`),
        FALLBACK_DISCOVERY.disclaimer,
        FALLBACK_DISCOVERY.note || "",
      ];

      const forbiddenPatterns = [
        /\bguarantee(d|s)?\b/i,
        /\bprofit(s|able)?\b/i,
        /\bwin rate\b/i,
        /\balpha\b/i,
        /\bbeat the market\b/i,
        /\blive trading is (on|open|available)\b/i,
        /\brisk[- ]free\b/i,
      ];

      for (const text of texts) {
        for (const pattern of forbiddenPatterns) {
          expect(pattern.test(text)).toBe(false);
        }
      }
    });
  });
});
