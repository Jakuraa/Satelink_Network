// Phase 6 item 13 — types and plain-language text for the "Talk to Satelink Trading AI" card.
export type DecisionCard = {
  decision: "GO" | "WAIT" | "REJECT"; score: number; confidence: number; failed_gates: string[];
  dimension_scores: Record<string, number | null>; strategy_version: string | null; data_timestamp: string | null;
  expires_at: string; evidence_refs: string[]; explanation_ref: string; receipt_id: string; score_meaning: string;
};
export type AssistantResult = {
  card: DecisionCard; recommendation: "GO" | "WAIT" | "REJECT"; instrument: string; traceId: string; nextStep: string;
  notes: Record<string, Record<string, unknown>>; proposal: { proposalId: string; status: string } | null;
};
export type Proposal = { id: string; kind: string; status: string; proposedBy: string; proposedByKind: string; payload: Record<string, unknown>; rationale: string | null; createdAt: string; expiresAt: string; expired?: boolean };

export const DECISION_TEXT: Record<DecisionCard["decision"], string> = {
  GO: "GO — the evidence and every safety gate allow this. You still decide.",
  WAIT: "WAIT — no safety gate failed, but the evidence is not strong enough yet.",
  REJECT: "REJECT — a safety gate failed. A high score can never override that.",
};

const GATE_TEXT: Record<string, string> = {
  kill_switch: "Trading is paused (kill switch).", stale_data: "Market data is stale or missing.", broker_unavailable: "The broker is not reachable.",
  insufficient_liquidity: "Not enough liquidity for this size.", abnormal_spread: "The spread is unusually wide.", mandate_expired: "Your mandate is missing, revoked or expired.",
  validation_expired: "The strategy's validation is missing or out of date.", concentration: "This would concentrate too much of your portfolio.", record_failed: "The decision could not be recorded, so it does not count.",
};
export function gateText(gate: string): string {
  if (gate.startsWith("risk:")) return `A risk check refused it (${gate.slice(5).replace(/_/g, " ")}).`;
  return GATE_TEXT[gate] ?? gate.replace(/_/g, " ");
}

export const PAPER_ONLY = "Paper trading only. Live execution is not available.";
