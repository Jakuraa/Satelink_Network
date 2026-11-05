// Customer workflows beta (Strategy Lab, Marketplace, Workflow runs).
// Server-side loaders for /v1/{strategy-lab,marketplace,workflows}/* on the API.
// Every value shown comes from these calls; a failed call is an error state,
// a 404 means the beta is not enabled on that API (WORKFLOWS_BETA_ENABLED).
import { apiFetch, type ApiResult } from "./api";
import { accountsEnabled } from "./account";
import { authCookieHeader } from "./session";
import { getActiveKey } from "./keys";

export function workflowsBetaEnabled() {
  return process.env.WORKFLOWS_BETA_ENABLED === "true";
}

export * from "./workflows-shared";
import type { Capability, McpManifest, OpenApiDoc, Run, RunSummary, SavedStrategy, Template } from "./workflows-shared";

/** Identity headers for run endpoints: console session (accounts V1) or the connected key. */
export async function workflowIdentity(): Promise<Record<string, string> | null> {
  if (accountsEnabled()) {
    const cookie = await authCookieHeader();
    return cookie ? { Cookie: cookie, "X-Satelink-Console": "1" } : null;
  }
  const active = await getActiveKey();
  return active ? { "X-API-Key": active.k } : null;
}

export function loadCapabilities(q = "", network = ""): Promise<ApiResult<{ ok: true; capabilities: Capability[]; statuses: Record<string, string>; not_listed: { provider: string; reason: string }[] }>> {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (network) qs.set("network", network);
  return apiFetch(`/v1/marketplace/capabilities${qs.size ? `?${qs}` : ""}`);
}

export function loadCapability(id: string, network = ""): Promise<ApiResult<{ ok: true; capability: Capability }>> {
  return apiFetch(`/v1/marketplace/capabilities/${encodeURIComponent(id)}${network ? `?network=${encodeURIComponent(network)}` : ""}`);
}

export function loadTemplates(): Promise<ApiResult<{ ok: true; templates: Template[] }>> {
  return apiFetch("/v1/workflows/templates");
}

export async function loadRuns(): Promise<ApiResult<{ ok: true; runs: RunSummary[] }> | null> {
  const headers = await workflowIdentity();
  if (!headers) return null;
  return apiFetch("/v1/workflows/runs", { headers });
}

export async function loadRun(id: string): Promise<ApiResult<{ ok: true; run: Run }> | null> {
  const headers = await workflowIdentity();
  if (!headers) return null;
  return apiFetch(`/v1/workflows/runs/${encodeURIComponent(id)}`, { headers });
}

export async function loadStrategies(): Promise<ApiResult<{ ok: true; strategies: SavedStrategy[] }> | null> {
  const headers = await workflowIdentity();
  if (!headers) return null;
  return apiFetch("/v1/strategy-lab/strategies", { headers });
}

export async function loadStrategy(id: string): Promise<ApiResult<{ ok: true; strategy: SavedStrategy & { runs: RunSummary[] } }> | null> {
  const headers = await workflowIdentity();
  if (!headers) return null;
  return apiFetch(`/v1/strategy-lab/strategies/${encodeURIComponent(id)}`, { headers });
}

export function loadMcpTools(): Promise<ApiResult<{ ok: true; manifest: McpManifest }>> {
  return apiFetch("/v1/workflows/mcp-tools");
}

export function loadOpenApi(): Promise<ApiResult<OpenApiDoc>> {
  return apiFetch("/v1/workflows/openapi.json");
}

export type RpcPricing = { ok: true; price_per_call_usdt: number; settlement_chain?: { name: string; chain_id: number }; tiers?: { tier: string; daily_limit: number }[] };
export function loadRpcPricing(): Promise<ApiResult<RpcPricing>> {
  return apiFetch("/v1/pricing", { revalidate: 300 });
}
