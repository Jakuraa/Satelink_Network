// Presentational pieces for the workflows beta. No hooks — usable from server
// and client components. Every number rendered here comes from an API response.
import { AlertTriangle, Ban, CheckCircle2, Circle, Clock, Hand, XCircle } from "lucide-react";
import { Badge, Table } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE, type GraphNode, type Run, type Scorecard } from "@/lib/workflows-shared";

export const btnPrimary =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-sl-accent px-4 text-sm font-medium text-sl-accent-ink hover:bg-sl-accent-strong disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-sl-border px-3 text-sm font-medium text-sl-text hover:border-sl-border-strong disabled:cursor-not-allowed disabled:opacity-50";
export const field =
  "w-full rounded-md border border-sl-border bg-sl-bg px-3 py-2 text-sm text-sl-text placeholder:text-sl-text-subtle focus:border-sl-accent focus:outline-none";

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] || "neutral"}>{STATUS_LABEL[status] || status}</Badge>;
}

const NODE_ICON: Record<GraphNode["status"], React.ComponentType<{ className?: string }>> = {
  done: CheckCircle2, pending: Circle, waiting: Hand, blocked: Ban, failed: XCircle, available: Clock, cancelled: Ban,
};
const NODE_COLOR: Record<GraphNode["status"], string> = {
  done: "text-sl-accent", pending: "text-sl-text-subtle", waiting: "text-sl-warn", blocked: "text-sl-text-muted", failed: "text-sl-warn", available: "text-sl-machine", cancelled: "text-sl-text-subtle",
};
const NODE_TEXT: Record<GraphNode["status"], string> = {
  done: "done", pending: "pending", waiting: "needs you", blocked: "blocked", failed: "failed", available: "available", cancelled: "cancelled",
};

/** Workflow nodes and edges as an ordered step graph (wraps on narrow screens). */
export function WorkflowGraph({ nodes }: { nodes: (Pick<GraphNode, "id" | "label" | "kind"> & { status?: GraphNode["status"] })[] }) {
  return (
    <ol aria-label="Workflow steps" className="flex flex-wrap items-stretch gap-x-1 gap-y-2">
      {nodes.map((n, i) => {
        const status = n.status || "pending";
        const Icon = NODE_ICON[status];
        return (
          <li key={n.id} className="flex items-center gap-1">
            <div className="flex min-w-[8.5rem] items-start gap-2 rounded-md border border-sl-border bg-sl-bg-raised px-2.5 py-2">
              <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${NODE_COLOR[status]}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium leading-tight text-sl-text">{n.label}</p>
                <p className="text-[11px] text-sl-text-subtle">{n.kind} · {NODE_TEXT[status]}</p>
              </div>
            </div>
            {i < nodes.length - 1 && <span aria-hidden className="text-sl-text-subtle">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

export function ScorecardView({ sc }: { sc: Scorecard }) {
  return (
    <div className="space-y-4">
      <div role="note" className="flex items-start gap-2 rounded-md border border-sl-warn/50 bg-sl-bg-raised px-3 py-2 text-xs text-sl-text">
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-sl-warn" />
        <p><span className="font-semibold">{sc.label}.</span> Past simulated performance on historical data. It is not a forecast, a recommendation, or investment advice.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-md px-3 py-1 text-sm font-semibold ${sc.verdict === "PASS" ? "bg-sl-accent/15 text-sl-accent" : "bg-sl-warn/15 text-sl-text"}`}>
          Verdict: {sc.verdict}
        </span>
        <ul className="text-xs text-sl-text-muted">
          {sc.verdict_reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Windows beaten", `${sc.summary.windows_beaten} / ${sc.method.windows}`],
          ["Strategy return (OOS)", pct(sc.summary.candidate_total_return_pct)],
          ["Best baseline (OOS)", pct(sc.summary.best_baseline_total_return_pct)],
          ["Worst drawdown", `${sc.summary.candidate_worst_drawdown_pct.toFixed(2)}% vs B&H ${sc.summary.buy_and_hold_worst_drawdown_pct.toFixed(2)}%`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-sl-border bg-sl-surface px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wider text-sl-text-subtle">{k}</dt>
            <dd className="tnum mt-0.5 text-sm font-semibold text-sl-text">{v}</dd>
          </div>
        ))}
      </dl>

      <Table head={["OOS window", "Strategy", "Drawdown", "Trades", "Win rate", "Best baseline", "Baseline", "Beat?"]} numeric={[1, 2, 3, 4, 6]} label="Out-of-sample windows">
        {sc.windows.map((w) => (
          <tr key={w.index}>
            <td className="whitespace-nowrap text-sl-text-muted">{w.test_from.slice(0, 10)} → {w.test_to.slice(0, 10)}</td>
            <td className="text-right">{pct(w.candidate_return_pct)}</td>
            <td className="text-right">{w.candidate_drawdown_pct.toFixed(2)}%</td>
            <td className="text-right">{w.trades}</td>
            <td className="text-right">{(w.win_rate * 100).toFixed(0)}%</td>
            <td className="text-sl-text-muted">{w.best_baseline}</td>
            <td className="text-right">{pct(w.best_baseline_return_pct)}</td>
            <td>{w.beat_best_baseline ? <Badge tone="good">yes</Badge> : <Badge>no</Badge>}</td>
          </tr>
        ))}
      </Table>

      <details className="rounded-md border border-sl-border px-3 py-2 text-xs text-sl-text-muted">
        <summary className="cursor-pointer font-medium text-sl-text">Method, costs and data provenance</summary>
        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr]">
          <dt>Method</dt><dd>{sc.method.kind}: {sc.method.windows} windows, {sc.method.train_bars}-bar train / {sc.method.test_bars}-bar test</dd>
          <dt>Execution</dt><dd>{sc.method.execution}</dd>
          <dt>Costs</dt><dd>fee {sc.method.costs_bps.fee} bps · half-spread {sc.method.costs_bps.half_spread} bps · slippage {sc.method.costs_bps.slippage} bps (+ seeded jitter)</dd>
          <dt>Baselines</dt><dd>{sc.method.baselines.join(", ")}</dd>
          <dt>Pass rule</dt><dd>{sc.method.pass_rule}</dd>
          <dt>Look-ahead check</dt><dd>{sc.method.leakage_check}</dd>
          <dt>Data</dt><dd>{sc.data.provider} · {sc.data.bars} bars · {sc.data.from.slice(0, 10)} → {sc.data.to.slice(0, 10)}</dd>
          <dt>Dataset SHA-256</dt><dd className="break-all font-mono">{sc.data.sha256}</dd>
          <dt>Licence</dt><dd>{sc.data.licence}{sc.data.commercial_licence ? "" : " — non-commercial evaluation only"}</dd>
          <dt>Evaluation</dt><dd className="break-all font-mono">{sc.evaluation_id} · result {sc.result_hash.slice(0, 16)}…</dd>
          <dt>Flags</dt><dd>{sc.flags.length ? sc.flags.join(", ") : "none"}</dd>
        </dl>
      </details>
    </div>
  );
}

export function RunResult({ run }: { run: Run }) {
  if (run.status === "blocked" && run.blocked) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-sl-text">{run.blocked.detail}</p>
        <ul className="space-y-1 text-xs text-sl-text-muted">
          {run.blocked.offers.map((o) => <li key={o.offer_id}><span className="text-sl-text">{o.provider}</span> — {o.detail}</li>)}
        </ul>
        <p className="text-xs text-sl-text-subtle">Nothing was executed and nothing was charged.</p>
      </div>
    );
  }
  if (run.status === "failed" && run.error) {
    return (
      <div className="space-y-1 text-sm">
        <p className="font-medium text-sl-text">Failed: {run.error.code.replace(/_/g, " ")}</p>
        <p className="text-sl-text-muted">{run.error.detail}</p>
        <p className="text-xs text-sl-text-subtle">Failed calls are never charged. The budget hold was released.</p>
      </div>
    );
  }
  if (!run.result) return <p className="text-sm text-sl-text-muted">No result yet.</p>;
  if (run.result.kind === "scorecard") return <ScorecardView sc={run.result.scorecard} />;
  const r = run.result;
  return (
    <div className="space-y-2 text-sm">
      <p className="flex items-center gap-2 text-sl-text"><CheckCircle2 aria-hidden className="size-4 text-sl-accent" /> Verified result from {r.provider}{r.latency_ms != null ? ` in ${r.latency_ms} ms` : ""}</p>
      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[10rem_1fr]">
        {Object.entries(r.data).map(([k, v]) => (
          <div key={k} className="contents"><dt className="text-sl-text-muted">{k.replace(/_/g, " ")}</dt><dd className="break-all font-mono text-sl-text">{String(v)}</dd></div>
        ))}
      </dl>
      {r.disclaimer && <p className="text-xs text-sl-text-subtle">{r.disclaimer}</p>}
    </div>
  );
}

export function ReceiptView({ receipt }: { receipt: Record<string, unknown> }) {
  const rows = Object.entries(receipt).filter(([, v]) => v !== null && typeof v !== "object");
  const settlement = receipt.settlement as Record<string, unknown> | undefined;
  const revenue = receipt.revenue as { counted: boolean; reason: string } | undefined;
  return (
    <div className="space-y-2 text-xs">
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[11rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents"><dt className="text-sl-text-muted">{k.replace(/_/g, " ")}</dt><dd className="break-all font-mono text-sl-text">{String(v)}</dd></div>
        ))}
        {settlement && (<><dt className="text-sl-text-muted">settlement</dt><dd className="font-mono text-sl-text">{String(settlement.status)} · money moved: {String(settlement.money_moved)}</dd></>)}
        {revenue && (<><dt className="text-sl-text-muted">counted as revenue</dt><dd className="font-mono text-sl-text">{revenue.counted ? "yes" : `no (${revenue.reason.replace(/_/g, " ")})`}</dd></>)}
      </dl>
    </div>
  );
}
