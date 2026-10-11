import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

// Phase 6 item 13 — "Talk to Satelink Trading AI" console surface.
vi.mock("@/app/(console)/trading/assistant-actions", () => ({ askAssistant: async () => ({ ok: false, code: "X", message: "x" }), authorizeProposal: async () => {}, rejectProposal: async () => {} }));
import { DecisionCardView, AssistantPanel } from "@/components/trading/assistant";
import { DECISION_TEXT, PAPER_ONLY, gateText, type AssistantResult } from "@/lib/trading/assistant";

const APP = path.resolve(__dirname, "../src/app/(console)/trading");
const result = (over: Partial<AssistantResult> = {}, card: Partial<AssistantResult["card"]> = {}): AssistantResult => ({
  card: { decision: "GO", score: 88, confidence: 95, failed_gates: [], dimension_scores: {}, strategy_version: "stv_1", data_timestamp: null, expires_at: "2026-10-11T10:15:00Z", evidence_refs: ["backtest:sha256:abc"], explanation_ref: "decision:dec_1:explanation", receipt_id: "dec_1", score_meaning: "decision quality; NOT a probability of profit", ...card },
  recommendation: "GO", instrument: "BTC-USDT", traceId: "run_1", nextStep: "authorise the pending proposal (step-up) to place a PAPER order",
  notes: { market: { summary: "Ranging market." } }, proposal: { proposalId: "prp_000001", status: "pending_review" }, ...over,
});

describe("Talk to Satelink Trading AI", () => {
  it("GO card: decision, score as decision quality (not profit odds), agent notes, evidence and an authorise form with step-up", () => {
    const html = renderToStaticMarkup(<DecisionCardView result={result()} />);
    expect(html).toContain(DECISION_TEXT.GO);
    expect(html).toContain("not a probability of profit");
    expect(html).toContain("Ranging market.");
    expect(html).toContain("backtest:sha256:abc");
    expect(html).toContain('data-testid="authorize-form"');
    expect(html).toContain('name="code"');
    expect(html).toContain("prp_000001");
  });

  it("REJECT card: plain-language gate reasons and NO authorise form", () => {
    const html = renderToStaticMarkup(<DecisionCardView result={result({ recommendation: "REJECT", proposal: null, nextStep: "no action: the decision is not GO" }, { decision: "REJECT", failed_gates: ["broker_unavailable", "risk:max_order_notional"] })} />);
    expect(html).toContain(DECISION_TEXT.REJECT);
    expect(html).toContain("The broker is not reachable.");
    expect(html).toContain("A risk check refused it (max order notional).");
    expect(html).not.toContain("authorize-form");
  });

  it("the intent form asks for capital, max loss, broker and markets, and states paper-only", () => {
    const html = renderToStaticMarkup(<AssistantPanel />);
    for (const n of ["capital", "maxLoss", "broker", "markets", "mandateId", "quantity", "limitPrice"]) expect(html).toContain(`name="${n}"`);
    expect(html).toContain(PAPER_ONLY);
    expect(PAPER_ONLY).toBe("Paper trading only. Live execution is not available.");
  });

  it("gate text covers every scorecard gate", () => {
    for (const g of ["kill_switch", "stale_data", "broker_unavailable", "insufficient_liquidity", "abnormal_spread", "mandate_expired", "validation_expired", "concentration"]) expect(gateText(g)).not.toContain("_");
  });

  it("every new server action is flag-guarded; the page is behind requireAgentIa and never promises live trading", () => {
    const actions = fs.readFileSync(path.join(APP, "assistant-actions.ts"), "utf8");
    expect(actions.match(/if \(!agentIaEnabled\(\)\) redirect/g)).toHaveLength(3);
    expect(actions).toMatch(/stepUp: code/);
    const page = fs.readFileSync(path.join(APP, "agent/page.tsx"), "utf8");
    expect(page).toMatch(/requireAgentIa\(\)/);
    expect(page + fs.readFileSync(path.resolve(__dirname, "../src/components/trading/assistant.tsx"), "utf8")).not.toMatch(/live trading is available|guaranteed|profit guaranteed/i);
  });
});
