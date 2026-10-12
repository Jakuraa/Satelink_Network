"use server";
// Phase 6 item 13 — "Talk to Satelink Trading AI" server actions. Console server only: the user's
// session cookie is forwarded by tradingPost; nothing secret reaches the browser. The assistant never
// places an order — authorising a proposal (with a 6-digit step-up code) does, in PAPER mode only.
import { redirect } from "next/navigation";
import { agentIaEnabled } from "@/lib/trading/flags";
import { tradingPost } from "@/lib/trading/client";
import type { AssistantResult } from "@/lib/trading/assistant";

const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;
const PRP_RE = /^prp_[A-Za-z0-9_-]{3,64}$/;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function askAssistant(f: FormData): Promise<{ ok: true; data: AssistantResult } | { ok: false; code: string; message: string }> {
  if (!agentIaEnabled()) redirect("/");
  const key = str(f, "idempotencyKey");
  if (!KEY_RE.test(key)) return { ok: false, code: "BAD_FORM", message: "Please reload the page and try again." };
  const markets = str(f, "markets").split(/[\s,]+/).filter(Boolean).map((m) => m.toUpperCase()).slice(0, 5);
  const body: Record<string, unknown> = { intent: { capital: str(f, "capital"), maxLoss: str(f, "maxLoss"), broker: str(f, "broker"), markets } };
  if (str(f, "quantity")) body.order = { mandateId: str(f, "mandateId"), side: str(f, "side") || "buy", quantity: str(f, "quantity"), ...(str(f, "limitPrice") ? { limitPrice: str(f, "limitPrice") } : {}) };
  const r = await tradingPost<AssistantResult>("/assistant/evaluate", body, { idempotencyKey: key });
  if (!r.ok) return { ok: false, code: r.code ?? String(r.status), message: (r.message ?? "The assistant is not available right now.").slice(0, 300) };
  return { ok: true, data: r.data };
}

export async function authorizeProposal(f: FormData) {
  if (!agentIaEnabled()) redirect("/");
  const id = str(f, "proposalId");
  const code = str(f, "code");
  const key = str(f, "idempotencyKey");
  if (!PRP_RE.test(id) || !KEY_RE.test(key)) redirect("/trading/agent?error=BAD_FORM");
  if (!/^\d{6}$/.test(code)) redirect("/trading/agent?error=STEP_UP_REQUIRED");
  const r = await tradingPost<{ orderId?: string; strategyVersionId?: string }>(`/proposals/${encodeURIComponent(id)}/approve`, {}, { idempotencyKey: key, stepUp: code });
  if (!r.ok) redirect(`/trading/agent?${new URLSearchParams({ error: r.code ?? String(r.status), message: (r.message ?? "").slice(0, 200) })}`);
  const out = (r as { data: { orderId?: string } }).data;
  if (out.orderId) redirect(`/trading/orders/${encodeURIComponent(out.orderId)}?placed=1`);
  redirect("/trading/agent?done=approved");
}

export async function rejectProposal(f: FormData) {
  if (!agentIaEnabled()) redirect("/");
  const id = str(f, "proposalId");
  const key = str(f, "idempotencyKey");
  if (!PRP_RE.test(id) || !KEY_RE.test(key)) redirect("/trading/agent?error=BAD_FORM");
  const r = await tradingPost(`/proposals/${encodeURIComponent(id)}/reject`, { reason: str(f, "reason") || "Declined in the console" }, { idempotencyKey: key });
  redirect(r.ok ? "/trading/agent?done=rejected" : `/trading/agent?error=${encodeURIComponent(r.code ?? String(r.status))}`);
}
