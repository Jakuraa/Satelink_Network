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
};
export type Receipt = {
  receipt_id: string; run_id: string; simulated: true; simulation_label: string; outcome: "succeeded" | "failed";
  outcome_label?: string; intent: string; served_by?: string | null; model_fixture?: boolean; error_code?: string;
  plan?: { step_no: number; capability_id: string; provider: string }[];
  quote: Quote | null;
  charges: { currency: string; credits_charged_usd: string; merchant_paid_by_user_usd?: string; merchant_payment: string };
  verification?: { method: string; verified: boolean; evidence: Record<string, unknown> };
  ledger: { transactions: { txn_id: string; kind: string }[]; ledger_hash: string };
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
