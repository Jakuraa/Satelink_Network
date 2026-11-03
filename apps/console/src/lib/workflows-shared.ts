// Types and display constants shared by server pages and client components
// (no server-only imports here — see lib/workflows.ts for the loaders).

export type NetworkStatus = { name: string; status: "live" | "evaluation" | "paused" | "not_authorized" };

export type Offer = {
  id: string;
  capability: string;
  provider: { id: string; name: string; kind: "first_party" | "external" };
  status: "live" | "preview" | "evaluation" | "paused" | "not_authorized";
  status_detail?: string;
  networks: NetworkStatus[];
  pricing: { supplier_cost_usd: string; list_price_usd: string | null; charged_usd: string; approved: boolean; basis: string | null };
  payment: { method: string; x402_version?: number; scheme?: string; facilitator?: string; pay_to?: string; assets?: string[] };
  sla: string | null;
  rate_limit: string | null;
  license: { resale: boolean; caching: boolean; evidence: string };
  last_verified: { at: string | null; result: string };
  purchasable: { ok: boolean; reason?: string; detail?: string } | null;
};

export type Capability = {
  id: string;
  name: string;
  category: string;
  summary: string;
  disclaimer: string | null;
  networks: string[];
  offer_count: number;
  executable_offer_count: number;
  availability: "available" | "evaluation" | "unavailable";
  offers: Offer[];
};

export type Quote = {
  capability: string;
  network: string;
  available: boolean;
  chosen: { offer_id: string; provider: string } | null;
  customer_charge_usd?: string;
  list_price_usd?: string | null;
  supplier_cost_usd?: string;
  pricing_approved?: boolean;
  pricing_note?: string | null;
  compared: { offer_id: string; provider: string; status: string; pricing: Offer["pricing"]; purchasable: Offer["purchasable"]; last_verified: Offer["last_verified"] }[];
};

export type StrategySpec = {
  schema: string;
  id: string;
  version: number;
  family: string;
  family_version: string;
  name: string;
  source_prompt: string;
  params: Record<string, number>;
  market: { instrument_id: string; symbol: string; venue: string; name: string };
  timeframe: string;
  direction: string;
  risk: { allocation_pct: number };
  costs: { fee_bps: number; half_spread_bps: number; slippage_bps: number };
  evaluation: { timeframe: string; train_bars: number; test_bars: number; windows: number; start: string };
  interpreter: { kind: string; version: string };
};

export type CompileResult = {
  ok: boolean;
  status: "compiled" | "needs_clarification" | "unsupported";
  spec?: StrategySpec;
  assumptions?: string[];
  questions?: { id: string; text: string; options: (string | { value: string; label: string })[] }[];
  reasons?: string[];
};

export type Scorecard = {
  label: string;
  verdict: "PASS" | "FAIL";
  verdict_reasons: string[];
  evaluation_id: string;
  result_hash: string;
  strategy: { id: string; family: string; params: Record<string, number>; market: string };
  method: { kind: string; windows: number; train_bars: number; test_bars: number; execution: string; costs_bps: { fee: number; half_spread: number; slippage: number }; baselines: string[]; pass_rule: string; leakage_check: string };
  summary: { windows_beaten: number; candidate_total_return_pct: number; best_baseline_total_return_pct: number; candidate_worst_drawdown_pct: number; buy_and_hold_worst_drawdown_pct: number };
  windows: { index: number; test_from: string; test_to: string; candidate_return_pct: number; candidate_drawdown_pct: number; trades: number; win_rate: number; sharpe: number; best_baseline: string; best_baseline_return_pct: number; beat_best_baseline: boolean }[];
  flags: string[];
  data: { provider: string; offer_id: string; source: string; from: string; to: string; bars: number; sha256: string; licence: string; commercial_licence: boolean };
  created_at: string;
};

export type GraphNode = { id: string; label: string; kind: string; status: "done" | "pending" | "waiting" | "blocked" | "failed" | "available" | "cancelled" };

export type Run = {
  id: string;
  title: string;
  template: "strategy_lab.backtest.v1" | "procurement.capability_call.v1";
  status: "running" | "awaiting_approval" | "completed" | "failed" | "blocked" | "cancelled";
  created_at: string;
  updated_at: string;
  idempotency_key: string;
  input: { spec?: StrategySpec; capability?: string; network?: string; address?: string };
  budget_usd: string | null;
  quote: Quote;
  approval: { required: boolean; reason: string | null; approved_at: string | null };
  blocked: { code: string; detail: string; offers: { offer_id: string; provider: string; reason?: string; detail?: string }[] } | null;
  budget_hold: { amount_usd: string; status: string; money_moved: boolean };
  result: null | { kind: "scorecard"; scorecard: Scorecard; served_by: string } | { kind: "capability_result"; capability: string; provider: string; served_by: string; verified: boolean; latency_ms: number | null; data: Record<string, unknown>; disclaimer: string | null };
  receipt: null | Record<string, unknown>;
  error: { code: string; detail: string } | null;
  graph: { nodes: GraphNode[]; edges: { from: string; to: string }[] };
  labels: { simulation?: string };
  trace?: { seq: number; at: string; stream: "run" | "kernel"; phase: string; hash: string }[];
};

export type RunSummary = { id: string; template: Run["template"]; status: Run["status"]; created_at: string; title: string; verdict: "PASS" | "FAIL" | null; charge_usd: string | null };

export type Template = { id: string; name: string; version: number; summary: string; approval: string; nodes: { id: string; label: string; kind: string }[]; edges: { from: string; to: string }[] };

export type SavedStrategy = { strategy_id: string; name: string; spec: StrategySpec; created_at: string };

export type McpTool = { name: string; mutating: boolean; description: string; inputSchema: { properties?: Record<string, { type?: string; description?: string }>; required?: string[] } };
export type McpManifest = { version: string; status: string; auth: string; spending: string; idempotency: string; tools: McpTool[] };

export type OpenApiDoc = {
  openapi: string;
  info: { title: string; version: string; description: string };
  paths: Record<string, Record<string, { summary: string; security?: unknown[] }>>;
};

export const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "machine" | "market" | "settle"> = {
  live: "good", preview: "machine", evaluation: "warn", paused: "neutral", not_authorized: "neutral",
  available: "good", unavailable: "neutral",
  completed: "good", running: "machine", awaiting_approval: "warn", failed: "warn", blocked: "neutral", cancelled: "neutral",
};

export const STATUS_LABEL: Record<string, string> = {
  live: "Live", preview: "Preview · not charged", evaluation: "Under evaluation", paused: "Paused", not_authorized: "Not authorized",
  available: "Available", unavailable: "Unavailable",
  completed: "Completed", running: "Running", awaiting_approval: "Awaiting your approval", failed: "Failed", blocked: "Blocked", cancelled: "Cancelled",
};
