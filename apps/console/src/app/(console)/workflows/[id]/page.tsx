import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ErrorNote, NeedsKey, PageHeader, Panel, Table } from "@/components/ui";
import { ReceiptView, RunResult, StatusBadge, WorkflowGraph } from "@/components/workflows/parts";
import { RunActions } from "@/components/workflows/RunActions";
import { loadRun, workflowsBetaEnabled } from "@/lib/workflows";

export const metadata: Metadata = { title: "Workflow run" };
export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  if (!workflowsBetaEnabled()) notFound();
  const { id } = await params;
  if (!/^run_[0-9a-f]{8,64}$/.test(id)) notFound();
  const r = await loadRun(id);
  if (r === null) return (<><PageHeader title="Workflow run" /><NeedsKey /></>);
  if (!r.ok) {
    if (r.status === 404) notFound();
    return (<><PageHeader title="Workflow run" /><ErrorNote what="this run" /></>);
  }
  const run = r.data.run;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div><Link href="/workflows" className="text-xs text-sl-text-muted hover:text-sl-text">← Workflows</Link></div>
      <PageHeader title={run.title} lede={`${run.id} · started ${new Date(run.created_at).toLocaleString()}`} actions={<StatusBadge status={run.status} />} />

      <Panel title="Workflow"><WorkflowGraph nodes={run.graph.nodes} /></Panel>

      {run.status === "awaiting_approval" && run.quote.chosen && (
        <Panel title="Your approval"><RunActions runId={run.id} amountUsd={run.quote.customer_charge_usd || "0"} provider={run.quote.chosen.provider} /></Panel>
      )}

      <Panel title={run.template === "strategy_lab.backtest.v1" ? "Scorecard" : "Result"}><RunResult run={run} /></Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Cost">
          <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
            <dt className="text-sl-text-muted">Supplier</dt><dd className="text-sl-text">{run.quote.chosen?.provider || "none available"}</dd>
            <dt className="text-sl-text-muted">Charged</dt><dd className="tnum text-sl-text">${run.quote.customer_charge_usd ?? "0"}{run.quote.pricing_note ? <span className="ml-2 text-xs text-sl-text-muted">{run.quote.pricing_note}</span> : null}</dd>
            <dt className="text-sl-text-muted">Budget cap</dt><dd className="tnum text-sl-text">{run.budget_usd ? `$${run.budget_usd}` : "none"}</dd>
            <dt className="text-sl-text-muted">Budget hold</dt><dd className="text-sl-text">${run.budget_hold.amount_usd} · {run.budget_hold.status} · no funds moved</dd>
            <dt className="text-sl-text-muted">Idempotency key</dt><dd className="break-all font-mono text-xs text-sl-text">{run.idempotency_key}</dd>
          </dl>
        </Panel>
        <Panel title="Receipt">{run.receipt ? <ReceiptView receipt={run.receipt} /> : <p className="text-sm text-sl-text-muted">Issued when the run finishes.</p>}</Panel>
      </div>

      {run.trace && (
        <Panel title="Execution trace (hash-chained journal)">
          <Table head={["#", "Time", "Source", "Phase", "Hash"]} numeric={[0]} label="Execution trace">
            {run.trace.map((e) => (
              <tr key={e.seq}>
                <td className="text-right">{e.seq}</td>
                <td className="whitespace-nowrap text-sl-text-muted">{e.at.replace("T", " ").slice(0, 19)}</td>
                <td className="text-sl-text-muted">{e.stream}</td>
                <td className="font-mono text-sl-text">{e.phase}</td>
                <td className="font-mono text-[11px] text-sl-text-subtle">{e.hash.slice(0, 16)}…</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
    </div>
  );
}
