"use client";
// Phase 6 item 13 — "Talk to Satelink Trading AI": intent → the one core (orchestrator → engines →
// scorecard) → a GO / WAIT / REJECT card with evidence → authorise a PAPER order with step-up.
import { useState, useTransition } from "react";
import { askAssistant, authorizeProposal } from "@/app/(console)/trading/assistant-actions";
import { DECISION_TEXT, PAPER_ONLY, gateText, type AssistantResult } from "@/lib/trading/assistant";

const newKey = () => crypto.randomUUID();

export function DecisionCardView({ result }: { result: AssistantResult }) {
  const c = result.card;
  return (
    <div className="mt-4 rounded border border-sl-border p-4" data-testid="decision-card">
      <p className="text-lg font-semibold" data-decision={c.decision}>{DECISION_TEXT[c.decision]}</p>
      <p className="mt-1 text-sl-text-muted">
        Score {c.score}/100 · confidence {c.confidence}/100 for {result.instrument}. The score measures decision quality, not a probability of profit.
      </p>
      {c.failed_gates.length > 0 && (
        <ul className="mt-2 list-disc pl-5">{c.failed_gates.map((g) => <li key={g}>{gateText(g)}</li>)}</ul>
      )}
      {Object.entries(result.notes).map(([agent, note]) => (
        <p key={agent} className="mt-2 text-sm"><span className="font-medium">{agent.replace(/_/g, " ")}:</span> {String(note.summary ?? note.interpretation ?? note.explanation ?? note.note ?? "")}</p>
      ))}
      <details className="mt-2 text-sm"><summary>Evidence ({c.evidence_refs.length})</summary><ul className="list-disc pl-5">{c.evidence_refs.map((e) => <li key={e}><code>{e}</code></li>)}</ul></details>
      <p className="mt-2 text-sm text-sl-text-muted">Valid until {new Date(c.expires_at).toLocaleString()} · receipt <code>{c.receipt_id}</code></p>
      <p className="mt-2 text-sm">{result.nextStep}</p>
      {result.proposal && (
        <form action={authorizeProposal} className="mt-3 flex flex-wrap items-end gap-2" data-testid="authorize-form">
          <input type="hidden" name="proposalId" value={result.proposal.proposalId} />
          <input type="hidden" name="idempotencyKey" value={newKey()} />
          <label className="flex flex-col text-sm">Authenticator code<input name="code" inputMode="numeric" pattern="\d{6}" required className="rounded border border-sl-border px-2 py-1" /></label>
          <button type="submit" className="rounded bg-sl-accent px-3 py-1 text-sl-accent-ink">Authorise paper order</button>
        </form>
      )}
    </div>
  );
}

export function AssistantPanel() {
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [key, setKey] = useState(newKey);
  return (
    <div>
      <p className="text-sm text-sl-text-muted">{PAPER_ONLY} The AI proposes; deterministic risk checks and your signed mandate decide. Nothing is placed until you authorise it.</p>
      <form
        className="mt-3 grid gap-2 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const r = await askAssistant(fd);
            setKey(newKey());
            if (r.ok) { setResult(r.data); setError(null); } else { setResult(null); setError(r.message); }
          });
        }}
      >
        <input type="hidden" name="idempotencyKey" value={key} />
        <label className="flex flex-col text-sm">Capital (USDT)<input name="capital" required inputMode="decimal" className="rounded border border-sl-border px-2 py-1" /></label>
        <label className="flex flex-col text-sm">Maximum loss you accept (USDT)<input name="maxLoss" required inputMode="decimal" className="rounded border border-sl-border px-2 py-1" /></label>
        <label className="flex flex-col text-sm">Broker<select name="broker" className="rounded border border-sl-border px-2 py-1"><option value="binance">Binance</option><option value="alpaca">Alpaca</option><option value="upstox">Upstox</option></select></label>
        <label className="flex flex-col text-sm">Markets<input name="markets" required placeholder="BTC-USDT" className="rounded border border-sl-border px-2 py-1" /></label>
        <fieldset className="sm:col-span-2 rounded border border-sl-border p-2">
          <legend className="text-sm">Optional: an order to evaluate (paper)</legend>
          <div className="grid gap-2 sm:grid-cols-4">
            <label className="flex flex-col text-sm">Mandate<input name="mandateId" placeholder="mdt_…" className="rounded border border-sl-border px-2 py-1" /></label>
            <label className="flex flex-col text-sm">Side<select name="side" className="rounded border border-sl-border px-2 py-1"><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
            <label className="flex flex-col text-sm">Quantity<input name="quantity" inputMode="decimal" className="rounded border border-sl-border px-2 py-1" /></label>
            <label className="flex flex-col text-sm">Limit price<input name="limitPrice" inputMode="decimal" className="rounded border border-sl-border px-2 py-1" /></label>
          </div>
        </fieldset>
        <button type="submit" disabled={pending} className="sm:col-span-2 rounded bg-sl-accent px-3 py-2 text-sl-accent-ink">{pending ? "Evaluating…" : "Ask Satelink Trading AI"}</button>
      </form>
      {error && <p role="alert" className="mt-3 text-sl-down">{error}</p>}
      {result && <DecisionCardView result={result} />}
    </div>
  );
}
