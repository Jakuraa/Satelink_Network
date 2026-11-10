import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { requirePreview } from "@/lib/preview";

export const metadata: Metadata = { title: "Agent Marketplace · Satelink" };

// Honest placeholder (P3): hiring third-party agents does not work in the preview, so nothing is listed here.
export default function AgentMarketplacePage() {
  requirePreview();
  return (
    <>
      <PageHeader title="Agent Marketplace" lede="Hire specialised AI agents for a task, with the same quote → approve → receipt flow." actions={<Badge tone="neutral">Coming soon</Badge>} />
      <Panel>
        <div className="space-y-2 text-[13px]" data-testid="coming-soon">
          <p className="font-medium text-sl-text">Not available in this preview.</p>
          <p className="text-sl-text-muted">There are no third-party agents to hire yet, so this page lists none — nothing here is invented.</p>
          <p className="text-sl-text-muted">What works today: connect <em>your own</em> agent to Satelink over MCP or A2A, and it can discover capabilities, get quotes and ask you to approve them.</p>
          <p><Link href="/developer-hub#agents" className="underline">Developer &amp; Agent Hub → Agents</Link></p>
        </div>
      </Panel>
    </>
  );
}
