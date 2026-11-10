import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Empty, PageHeader, Panel, Table } from "@/components/ui";
import { StrategyLabWorkspace } from "@/components/workflows/StrategyLabWorkspace";
import { loadStrategies, loadTemplates, workflowsBetaEnabled } from "@/lib/workflows";

export const metadata: Metadata = { title: "Strategy Lab" };
export const dynamic = "force-dynamic";

export default async function StrategyLabPage() {
  if (!workflowsBetaEnabled()) {
    return (
      <>
        <PageHeader title="Strategy Lab" />
        <Empty title="Strategy Lab is not enabled here" body="This environment does not have the workflows beta switched on." />
      </>
    );
  }
  const [t, saved] = await Promise.all([loadTemplates(), loadStrategies()]);
  const template = t.ok ? t.data.templates.find((x) => x.id === "strategy_lab.backtest.v1") || null : null;
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Strategy Lab"
        lede="Describe a trading idea in plain language. Satelink turns it into a precise rule, tests it on years of historical data it never tuned on, and tells you honestly whether it beats doing nothing."
        actions={<Badge tone="machine">Beta · simulated only</Badge>}
      />
      <StrategyLabWorkspace template={template} />
      {saved?.ok && saved.data.strategies.length > 0 && (
        <Panel title="Your saved strategies" className="mt-4">
          <Table head={["Strategy", "Parameters", "Saved"]} label="Saved strategies">
            {saved.data.strategies.map((s) => (
              <tr key={s.strategy_id}>
                <td><Link href={`/strategy-lab/strategies/${s.strategy_id}`} className="font-medium text-sl-text hover:text-sl-accent">{s.name}</Link><p className="font-mono text-[11px] text-sl-text-subtle">{s.strategy_id}</p></td>
                <td className="font-mono text-xs text-sl-text-muted">{Object.entries(s.spec.params).map(([k, v]) => `${k}=${v}`).join(" ")}</td>
                <td className="whitespace-nowrap text-sl-text-muted">{new Date(s.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </Table>
          <p className="mt-2 text-[11px] text-sl-text-subtle">Every strategy you backtest is saved automatically. Open one to revisit its backtests or run it again.</p>
        </Panel>
      )}
    </div>
  );
}
