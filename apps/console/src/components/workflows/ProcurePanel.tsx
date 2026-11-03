"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2, Receipt, Search, X } from "lucide-react";
import type { Quote, Run } from "@/lib/workflows-shared";
import { ReceiptView, RunResult, StatusBadge, btnPrimary, btnSecondary, field } from "./parts";

function idemKey() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return "buy_" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function post<T>(path: string, body: unknown = {}): Promise<{ status: number; data: T }> {
  const res = await fetch(`/api/console/workflows/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, data: (await res.json().catch(() => ({ ok: false, error: "bad_response" }))) as T };
}

type RunResp = { ok: boolean; run?: Run; error?: string; message?: string };

export function ProcurePanel({ capability, networks, addressLabel }: { capability: string; networks: string[]; addressLabel: string }) {
  const [network, setNetwork] = useState(networks[0] || "");
  const [address, setAddress] = useState("");
  const [budget, setBudget] = useState("0.01");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const validAddress = /^0x[0-9a-fA-F]{40}$/.test(address);

  async function getQuote() {
    setBusy("quote"); setErr(null); setRun(null);
    const { data } = await post<{ ok: boolean; quote?: Quote; error?: string }>("marketplace/quote", { capability, network });
    setBusy(null);
    if (!data.ok || !data.quote) { setErr(data.error || "Quote unavailable."); return; }
    setQuote(data.quote);
  }

  async function create() {
    setBusy("create"); setErr(null);
    const { status, data } = await post<RunResp>("workflows/runs", { template: "procurement.capability_call.v1", input: { capability, network, address }, budget_usd: budget, idempotency_key: idemKey() });
    setBusy(null);
    if (status === 401) { setErr("Connect or create an API key to make purchases — runs are recorded against your account."); return; }
    if (!data.ok || !data.run) { setErr(data.message || data.error || "Could not create the purchase."); return; }
    setRun(data.run);
  }

  async function act(action: "approve" | "cancel") {
    if (!run) return;
    setBusy(action); setErr(null);
    const { data } = await post<RunResp>(`workflows/runs/${run.id}/${action}`);
    setBusy(null);
    if (!data.ok || !data.run) { setErr(data.message || data.error || `Could not ${action}.`); return; }
    setRun(data.run);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); void getQuote(); }} className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_8rem]">
        <label className="space-y-1 text-xs text-sl-text-muted">
          <span>Network</span>
          <select value={network} onChange={(e) => { setNetwork(e.target.value); setQuote(null); setRun(null); }} className={field}>
            {networks.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-sl-text-muted">
          <span>{addressLabel}</span>
          <input value={address} onChange={(e) => setAddress(e.target.value.trim())} placeholder="0x…" spellCheck={false} autoComplete="off" className={`${field} font-mono`} aria-invalid={address !== "" && !validAddress} />
        </label>
        <label className="space-y-1 text-xs text-sl-text-muted">
          <span>Budget cap (USD)</span>
          <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" className={`${field} tnum`} />
        </label>
        <div className="sm:col-span-3">
          <button type="submit" className={btnSecondary} disabled={!network || busy !== null}>
            {busy === "quote" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Search aria-hidden className="size-4" />} Compare suppliers & quote
          </button>
        </div>
      </form>

      {quote && (
        <div className="rounded-md border border-sl-border bg-sl-bg-raised p-3 text-sm">
          {quote.available ? (
            <>
              <p className="text-sl-text">Best available: <span className="font-medium">{quote.chosen?.provider}</span></p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div><dt className="text-sl-text-muted">You pay</dt><dd className="tnum font-semibold text-sl-text">${quote.customer_charge_usd}</dd></div>
                <div><dt className="text-sl-text-muted">List price</dt><dd className="tnum text-sl-text">{quote.list_price_usd ? `$${quote.list_price_usd}` : "not set"}</dd></div>
                <div><dt className="text-sl-text-muted">Supplier cost</dt><dd className="tnum text-sl-text">${quote.supplier_cost_usd}</dd></div>
                <div><dt className="text-sl-text-muted">Budget cap</dt><dd className="tnum text-sl-text">${budget || "none"}</dd></div>
              </dl>
              {quote.pricing_note && <p className="mt-2 text-xs text-sl-text-muted">{quote.pricing_note}</p>}
              {!run && (
                <button type="button" onClick={create} className={`${btnPrimary} mt-3`} disabled={!validAddress || busy !== null}>
                  {busy === "create" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Receipt aria-hidden className="size-4" />} Create capped purchase
                </button>
              )}
              {!validAddress && !run && <p className="mt-1 text-xs text-sl-text-subtle">Enter a public 0x address (40 hex characters) to continue.</p>}
            </>
          ) : (
            <>
              <p className="font-medium text-sl-text">No supplier can run this on {quote.network} right now.</p>
              <ul className="mt-1 space-y-0.5 text-xs text-sl-text-muted">
                {quote.compared.map((c) => <li key={c.offer_id}><span className="text-sl-text">{c.provider}</span> — {c.purchasable?.detail || c.status}</li>)}
              </ul>
              <p className="mt-2 text-xs text-sl-text-subtle">Nothing will be executed or charged.</p>
            </>
          )}
        </div>
      )}

      {err && <div role="alert" className="rounded-md border border-sl-warn/50 bg-sl-bg-raised px-3 py-2 text-sm text-sl-text">{err}</div>}

      {run && (
        <div className="space-y-3 rounded-md border border-sl-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><StatusBadge status={run.status} /><span className="font-mono text-[11px] text-sl-text-subtle">{run.id}</span></div>
            <Link href={`/workflows/${run.id}`} className="text-xs text-sl-accent hover:underline">Run details & trace</Link>
          </div>
          {run.status === "awaiting_approval" && (
            <div className="space-y-2">
              <p className="text-sm text-sl-text">
                Approve one call to <span className="font-medium">{run.quote.chosen?.provider}</span> for <span className="tnum font-semibold">${run.quote.customer_charge_usd}</span>
                {run.budget_usd ? <> (cap ${run.budget_usd})</> : null}. If the call fails or the result can&apos;t be verified, you are not charged.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => act("approve")} className={btnPrimary} disabled={busy !== null}>
                  {busy === "approve" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />} Approve & run
                </button>
                <button type="button" onClick={() => act("cancel")} className={btnSecondary} disabled={busy !== null}><X aria-hidden className="size-4" /> Cancel</button>
              </div>
            </div>
          )}
          {["completed", "failed", "blocked", "cancelled"].includes(run.status) && <RunResult run={run} />}
          {run.receipt && run.status === "completed" && (
            <details open className="rounded-md border border-sl-border px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-sl-text">Receipt</summary>
              <div className="mt-2"><ReceiptView receipt={run.receipt} /></div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
