import type { Metadata } from "next";
import Link from "next/link";
import { Empty, ErrorNote, NeedsKey, PageHeader, Panel, Table } from "@/components/ui";
import { StatusBadge, WorkflowGraph } from "@/components/workflows/parts";
import { loadRuns, loadTemplates, workflowsBetaEnabled } from "@/lib/workflows";

export const metadata: Metadata = { title: "Workflows" };
export const dynamic = "force-dynamic";

const TEMPLATE_HREF: Record<string, string> = { "strategy_lab.backtest.v1": "/strategy-lab", "procurement.capability_call.v1": "/marketplace" };

export default async function WorkflowsPage() {
  if (!workflowsBetaEnabled()) {
    return (<><PageHeader title="Workflows" /><Empty title="Workflows are not enabled here" body="This environment does not have the workflows beta switched on." /></>);
  }
  const [runs, templates] = await Promise.all([loadRuns(), loadTemplates()]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader title="Workflows" lede="Every run — backtests and purchases — with its status, cost and a tamper-evident execution trace." />

      <Panel title="Your runs">
        {runs === null ? <NeedsKey /> : !runs.ok ? <ErrorNote what="your runs" /> : runs.data.runs.length === 0 ? (
          <Empty title="No runs yet" body="Run a backtest in Strategy Lab or buy a capability in the Marketplace — each run appears here with its full trace." cta={{ label: "Open Strategy Lab", href: "/strategy-lab" }} />
        ) : (
          <Table head={["Run", "Type", "Status", "Verdict", "Charged", "Started"]} numeric={[4]} label="Workflow runs">
            {runs.data.runs.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/workflows/${r.id}`} className="font-medium text-sl-text hover:text-sl-accent">{r.title}</Link><p className="font-mono text-[11px] text-sl-text-subtle">{r.id}</p></td>
                <td className="text-sl-text-muted">{r.template.startsWith("strategy") ? "Backtest" : "Purchase"}</td>
                <td><StatusBadge status={r.status} /></td>
                <td className="text-sl-text-muted">{r.verdict ?? ""}</td>
                <td className="text-right">{r.charge_usd != null ? `$${r.charge_usd}` : ""}</td>
                <td className="whitespace-nowrap text-sl-text-muted">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Workflow templates">
        {!templates.ok ? <ErrorNote what="workflow templates" /> : (
          <ul className="space-y-4">
            {templates.data.templates.map((t) => (
              <li key={t.id} className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-sl-text">{t.name} <span className="font-mono text-[11px] text-sl-text-subtle">{t.id}</span></p>
                  {TEMPLATE_HREF[t.id] && <Link href={TEMPLATE_HREF[t.id]} className="text-xs text-sl-accent hover:underline">Start →</Link>}
                </div>
                <p className="text-sm text-sl-text-muted">{t.summary} Approval: {t.approval === "always" ? "every purchase" : "only when the quote exceeds your budget"}.</p>
                <WorkflowGraph nodes={t.nodes} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
