import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty, ErrorNote, NeedsKey, PageHeader, Panel, Table } from "@/components/ui";
import { StatusBadge } from "@/components/workflows/parts";
import { RerunButton } from "@/components/workflows/RerunButton";
import { loadStrategy, workflowsBetaEnabled } from "@/lib/workflows";

export const metadata: Metadata = { title: "Saved strategy" };
export const dynamic = "force-dynamic";

export default async function StrategyPage({ params }: { params: Promise<{ id: string }> }) {
  if (!workflowsBetaEnabled()) notFound();
  const { id } = await params;
  if (!/^strat_[0-9a-f]{16}$/.test(id)) notFound();
  const r = await loadStrategy(id);
  if (r === null) return (<><PageHeader title="Saved strategy" /><NeedsKey /></>);
  if (!r.ok) {
    if (r.status === 404) notFound();
    return (<><PageHeader title="Saved strategy" /><ErrorNote what="this strategy" /></>);
  }
  const s = r.data.strategy;
  const spec = s.spec;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div><Link href="/strategy-lab" className="text-xs text-sl-text-muted hover:text-sl-text">← Strategy Lab</Link></div>
      <PageHeader title={s.name} lede={`${s.strategy_id} · saved ${new Date(s.created_at).toLocaleString()}`} />

      <Panel title="Strategy spec">
        <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[9rem_1fr]">
          <dt className="text-sl-text-muted">Your request</dt><dd className="text-sl-text">{spec.source_prompt || "—"}</dd>
          <dt className="text-sl-text-muted">Parameters</dt><dd className="font-mono text-sl-text">{Object.entries(spec.params).map(([k, v]) => `${k}=${v}`).join("  ")}</dd>
          <dt className="text-sl-text-muted">Market</dt><dd className="text-sl-text">{spec.market.name} · {spec.timeframe} bars · long only</dd>
          <dt className="text-sl-text-muted">Position size</dt><dd className="text-sl-text">{spec.risk.allocation_pct}% of simulated capital</dd>
          <dt className="text-sl-text-muted">Costs modelled</dt><dd className="text-sl-text">{spec.costs.fee_bps} bps fee · {spec.costs.half_spread_bps} bps half-spread · {spec.costs.slippage_bps} bps slippage</dd>
        </dl>
        <div className="mt-4"><RerunButton spec={spec} /></div>
      </Panel>

      <Panel title="Backtests of this strategy">
        {s.runs.length === 0 ? <Empty title="No backtests yet" body="Run a backtest to see how this rule did on data it never saw." /> : (
          <Table head={["Run", "Status", "Verdict", "Started"]} label="Backtests">
            {s.runs.map((run) => (
              <tr key={run.id}>
                <td><Link href={`/workflows/${run.id}`} className="font-mono text-sl-text hover:text-sl-accent">{run.id}</Link></td>
                <td><StatusBadge status={run.status} /></td>
                <td className="text-sl-text-muted">{run.verdict ?? ""}</td>
                <td className="whitespace-nowrap text-sl-text-muted">{new Date(run.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </Table>
        )}
        <p className="mt-2 text-[11px] text-sl-text-subtle">Same spec + same data gives the same result hash — re-running is reproducible, not a new chance to pass.</p>
      </Panel>
    </div>
  );
}
