// Client-safe Release A preview types and labels (no server imports — see preview.ts for the server side).
export const SIMULATION_LABEL = "SIMULATED — NO MONEY MOVED";

export type QuoteLine = {
  capability_id: string; description: string; fee_policy_id: string; fee_policy_status: string;
  supplier_cost_paid_from: "satelink_credits" | "merchant_checkout";
  supplier_cost_usd: string; satelink_fee_usd: string; tax_usd: string;
};
export type Quote = {
  quote_id: string; version: number; currency: string; simulated: true; simulation_label: string;
  lines: QuoteLine[]; total_usd: string; credit_charge_usd: string; merchant_paid_by_user_usd: string;
  fee_policy_status: string; disclosure: string; expires_at: string;
};
export type PlanStep = {
  step_no: number; capability_id: string; capability_name?: string; provider_name?: string; release_status?: string;
  permission?: string; success_condition?: string; inputs: Record<string, unknown>;
  offer: { title: string; sku: string; price_usd: string } | null;
};
export type Task = {
  id: string; state: string; version: number; intent: string; simulated: true; simulation_label: string;
  created_at: string; updated_at: string;
  question: { text: string; field: string; connector_id?: string | null } | null;
  plan: { steps: PlanStep[]; model: { served_by: string; cost_minor?: string; fixture?: boolean } | null } | null;
  model_badge: string | null;
  quote: Quote | null;
  reservation: { reservation_id: string; state: string; amount_usd: string; captured_usd: string | null; simulated: true; simulation_label: string } | null;
  receipt_id: string | null;
  error: { code: string; message: string; retryable: boolean } | null;
  trading: TradingResult | null;
  /** Owner-only step output from a supplier (schema-checked by its connector, untrusted — rendered as text only). */
  output?: Record<string, unknown> | null;
  /** Set when an agent (MCP/A2A) asked the owner to approve the current quote. */
  approval_request?: { channel: string; at: string } | null;
  actor_type?: string;
};
export type TradingResult = {
  kind: "evaluation" | "paper_order"; label: string; notice: string;
  evaluation_id?: string; dataset_label?: string;
  scorecard?: { verdict: string; strategy: { family: string; market: string; params: Record<string, unknown> };
    method: { windows: number; train_bars: number; test_bars: number; execution: string; costs_bps: { fee: number; half_spread: number; slippage: number }; leakage_check: string };
    summary: { windows_beaten: number; candidate_total_return_pct: number; best_baseline_total_return_pct: number; candidate_worst_drawdown_pct: number; buy_and_hold_worst_drawdown_pct: number };
    windows: { index: number; test_from: string; test_to: string; candidate_return_pct: number; candidate_drawdown_pct: number; trades: number; best_baseline: string; best_baseline_return_pct: number; beat_best_baseline: boolean }[] };
  risk?: { decision: "GO" | "WAIT" | "REJECT"; trace: { rule: string; passed: boolean; blocking: boolean; detail: string }[]; policy_version: string };
  fill?: { order_id: string; status: string; instrument_id: string; side: string; quantity: string; fill_price_minor: string; fill_at: string; venue: string };
};
export const TRADING_LABEL = "SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS";
export type Receipt = {
  receipt_id: string; run_id: string; simulated: true; simulation_label: string; outcome: "succeeded" | "failed";
  outcome_label?: string; intent: string; trading_label?: string; notice?: string; served_by?: string | null; model_fixture?: boolean; error_code?: string;
  plan?: { step_no: number; capability_id: string; provider: string }[];
  quote: Quote | null;
  charges: { currency: string; credits_charged_usd: string; merchant_paid_by_user_usd?: string; merchant_payment: string };
  verification?: { method: string; verified: boolean; evidence: Record<string, unknown> };
  ledger: { transactions: { txn_id: string; kind: string }[]; ledger_hash: string };
  /** S6: the x402 preview payment that approved the task (mock facilitator; never settled). */
  payment?: { rail: string; network: string; payer: string; amount_minor: string; verified_by: string; settlement: string };
  issued_at: string; receipt_sha256: string;
};
export type Capability = {
  id: string; name: string; description: string; category: string; release_status: "LIVE" | "PREVIEW" | "SIMULATED" | "COMING_SOON";
  providers: { id: string; name: string; kind: string; offer_status?: string }[];
  permission_scope: string; fee_policy_id: string; markets: string[]; price_model: { kind: string };
  credential_requirements: string[]; disclaimer?: string | null;
};

export const TERMINAL = ["SUCCEEDED", "PARTIALLY_SUCCEEDED", "FAILED", "REJECTED", "CANCELLED", "EXPIRED", "REQUIRES_RECONCILIATION"];

export function stateTone(s: string): "good" | "warn" | "neutral" | "settle" | "machine" {
  if (s === "SUCCEEDED") return "good";
  if (["FAILED", "REJECTED", "EXPIRED", "CANCELLED", "REQUIRES_RECONCILIATION", "UNKNOWN_EXECUTION_OUTCOME"].includes(s)) return "warn";
  if (["AWAITING_APPROVAL", "AWAITING_INPUT", "QUOTED"].includes(s)) return "machine";
  if (["RESERVED", "EXECUTING", "VERIFYING", "AUTHORIZED"].includes(s)) return "settle";
  return "neutral";
}

export const STATE_LABEL: Record<string, string> = {
  CREATED: "Created", UNDERSTANDING: "Understanding", PLANNING: "Planning", AWAITING_INPUT: "Needs your input", QUOTED: "Quoted",
  AWAITING_APPROVAL: "Awaiting your approval", AUTHORIZED: "Approved", RESERVED: "Credit reserved (simulated)", EXECUTING: "Executing",
  VERIFYING: "Verifying", SUCCEEDED: "Succeeded", REJECTED: "Not possible", FAILED: "Failed — no charge", CANCELLED: "Cancelled",
  EXPIRED: "Expired", PARTIALLY_SUCCEEDED: "Partly succeeded", REQUIRES_RECONCILIATION: "Under review", UNKNOWN_EXECUTION_OUTCOME: "Checking with supplier",
};

/** Display a USD decimal string exactly (string math — never a float): at least 2 decimals, sub-cent kept.
 *  "1.000000" → "$1.00", "0.999000" → "$0.999", "0.000123" → "$0.000123". */
export function usd(v: string | null | undefined): string {
  if (v == null || !/^-?\d+(\.\d+)?$/.test(String(v))) return "$—";
  const [w, f = ""] = String(v).split(".");
  const frac = f.replace(/0+$/, "").padEnd(2, "0");
  return `$${w}.${frac}`;
}
