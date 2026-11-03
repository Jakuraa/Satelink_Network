import type { Metadata } from "next";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { StrategyLabWorkspace } from "@/components/workflows/StrategyLabWorkspace";
import { loadTemplates, workflowsBetaEnabled } from "@/lib/workflows";

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
  const t = await loadTemplates();
  const template = t.ok ? t.data.templates.find((x) => x.id === "strategy_lab.backtest.v1") || null : null;
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Strategy Lab"
        lede="Describe a trading idea in plain language. Satelink turns it into a precise rule, tests it on years of historical data it never tuned on, and tells you honestly whether it beats doing nothing."
        actions={<Badge tone="machine">Beta · simulated only</Badge>}
      />
      <StrategyLabWorkspace template={template} />
    </div>
  );
}
