// Server-side reads of the API's /v1/payments/* as the signed-in user. A failed call
// returns { ok: false } and the page renders a designed error state — nothing is defaulted.
import { apiFetch, type ApiResult } from "./api";
import { authCookieHeader } from "./session";
import type { IntentStatus, Merchant, Method, PlansPayload, RefundPolicy } from "./payments-shared";

type Envelope<T> = { ok: true; data: T };
async function get<T>(path: string, auth = false): Promise<ApiResult<T>> {
  const r = await apiFetch<Envelope<T>>(`/v1/payments${path}`, auth ? { cookie: await authCookieHeader() } : {});
  return r.ok ? { ok: true, data: r.data.data } : r;
}

export const loadTradingAiPlans = () => get<PlansPayload>("/plans/trading-ai");
export const loadMerchant = () => get<{ merchant: Merchant; refundPolicy: RefundPolicy }>("/merchant");
export const loadMethods = () => get<{ testMode: boolean; methods: Method[] }>("/checkout/methods");
export const loadIntent = (ref: string) => get<IntentStatus>(`/checkout/intents/${encodeURIComponent(ref)}`, true);

/** Mutation as the signed-in user (adds the API's CSRF header). Returns status + body as-is. */
export async function paymentsPost(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const { API_BASE } = await import("./api");
  try {
    const r = await fetch(`${API_BASE}/v1/payments${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-Satelink-Console": "1", Cookie: await authCookieHeader() },
      body: JSON.stringify(body ?? {}), cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    return { status: r.status, body: await r.json().catch(() => ({ ok: false, error: "non_json_response" })) };
  } catch (e) {
    return { status: 502, body: { ok: false, error: e instanceof Error ? e.name : "fetch_failed" } };
  }
}
