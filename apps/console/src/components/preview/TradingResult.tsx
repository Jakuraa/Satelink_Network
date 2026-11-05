"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TRADING_LABEL, type TradingResult as TR } from "@/lib/preview-shared";
import { Badge } from "@/components/ui";
import { newKey, post } from "./taskClient";

const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;

export function TradingLabel() {
  return (
    <p data-testid="trading-label" className="rounded-md border border-sl-market/60 bg-sl-market/10 px-3 py-2 text-[12px] font-semibold tracking-wide text-sl-text">
      {TRADING_LABEL} · Education and simulation only — not investment advice.
    </p>
  );
}

export function TradingResult({ t }: { t: TR }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (t.kind === "paper_order" && t.fill) {
    return (
      <section aria-label="Paper fill" className="space-y-2 rounded-md border border-sl-border bg-sl-surface p-3" data-testid="paper-fill">
        <TradingLabel />
        <dl className="grid grid-cols-1 gap-1 text-[13px] sm:grid-cols-2">
          <div><dt className="inline text-sl-text-muted">Order: </dt><dd className="inline">{t.fill.order_id}</dd></div>
          <div><dt className="inline text-sl-text-muted">Status: </dt><dd className="inline">{t.fill.status} (paper)</dd></div>
          <div><dt className="inline text-sl-text-muted">Market: </dt><dd className="inline">{t.fill.instrument_id} · {t.fill.side} {t.fill.quantity}</dd></div>
          <div><dt className="inline text-sl-text-muted">Venue: </dt><dd className="inline">{t.fill.venue}</dd></div>
        </dl>
      </section>
    );
  }
  const sc = t.scorecard; const risk = t.risk;
  if (!sc || !risk) return null;
  const tone = risk.decision === "GO" ? "good" : risk.decision === "WAIT" ? "warn" : "warn";
  return (
    <section aria-label="Strategy evaluation" className="space-y-3 rounded-md border border-sl-border bg-sl-surface p-3" data-testid="trading-result">
      <TradingLabel />
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Risk decision</h2>
        <Badge tone={tone}><span data-testid="risk-decision">{risk.decision}</span></Badge>
        <span className="text-[12px] text-sl-text-muted">policy {risk.policy_version} · deterministic — the model explains, never decides</span>
      </div>
      <ul className="space-y-1 text-[13px]" data-testid="risk-trace">
        {risk.trace.map((r) => (
          <li key={r.rule} className="flex flex-wrap gap-2"><span aria-hidden>{r.passed ? "✓" : "✗"}</span><span className={r.passed ? "text-sl-text" : "font-medium text-sl-text"}>{r.rule}</span><span className="text-sl-text-muted">{r.detail}</span></li>
        ))}
      </ul>
      <p className="text-[12px] text-sl-text-muted">{sc.strategy.family} on {sc.strategy.market} · walk-forward, {sc.method.windows} out-of-sample windows ({sc.method.train_bars} train / {sc.method.test_bars} test bars) · fees {sc.method.costs_bps.fee} bps, spread {sc.method.costs_bps.half_spread} bps, slippage {sc.method.costs_bps.slippage} bps · look-ahead check {sc.method.leakage_check}</p>
      <p className="text-[12px] text-sl-text-muted" data-testid="dataset-label">{t.dataset_label}</p>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Out-of-sample windows">
        <table className="tnum w-full text-left text-[12px]">
          <thead className="text-[11px] uppercase tracking-wider text-sl-text-subtle"><tr><th scope="col" className="py-1 pr-2">Window</th><th scope="col" className="py-1 pr-2 text-right">Return</th><th scope="col" className="py-1 pr-2 text-right">Drawdown</th><th scope="col" className="py-1 pr-2 text-right">Trades</th><th scope="col" className="py-1 text-right">Best baseline</th></tr></thead>
          <tbody>
            {sc.windows.map((w) => (
              <tr key={w.index} className="border-t border-sl-border/60">
                <td className="py-1 pr-2">{w.index + 1}: {w.test_from.slice(0, 10)} → {w.test_to.slice(0, 10)}</td>
                <td className="py-1 pr-2 text-right">{pct(w.candidate_return_pct)}</td>
                <td className="py-1 pr-2 text-right">{pct(-Math.abs(w.candidate_drawdown_pct))}</td>
                <td className="py-1 pr-2 text-right">{w.trades}</td>
                <td className="py-1 text-right">{w.best_baseline} {pct(w.best_baseline_return_pct)} {w.beat_best_baseline ? "· beaten" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {risk.decision === "GO" && t.evaluation_id && (
        <div className="space-y-1">
          <button type="button" disabled={busy} data-testid="paper-trade" onClick={async () => {
            setBusy(true); setErr(null);
            const r = await post<{ task: { id: string } }>("tasks", { text: `Paper trade ${t.evaluation_id} buy`, idempotency_key: newKey("paper") });
            setBusy(false);
            if (r.ok) router.push(`/tasks/${r.data.task.id}`); else setErr(r.error.message);
          }} className="inline-flex h-9 items-center rounded-md bg-sl-accent px-3 text-[13px] font-medium text-sl-accent-ink hover:bg-sl-accent-strong disabled:opacity-60">
            Paper trade (simulated)
          </button>
          {err && <p role="alert" className="text-[12px]">{err}</p>}
        </div>
      )}
    </section>
  );
}
