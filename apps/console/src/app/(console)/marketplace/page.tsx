import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge, Empty, ErrorNote, PageHeader, Panel } from "@/components/ui";
import { StatusBadge, btnSecondary, field } from "@/components/workflows/parts";
import { loadCapabilities, workflowsBetaEnabled } from "@/lib/workflows";

export const metadata: Metadata = { title: "Agent Marketplace" };
export const dynamic = "force-dynamic";

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ q?: string; network?: string }> }) {
  if (!workflowsBetaEnabled()) {
    return (<><PageHeader title="Agent Marketplace" /><Empty title="The marketplace is not enabled here" body="This environment does not have the workflows beta switched on." /></>);
  }
  const { q = "", network = "" } = await searchParams;
  const r = await loadCapabilities(q.slice(0, 120), network.slice(0, 64));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Agent Marketplace"
        lede="Capabilities your agents and workflows can buy, with every supplier's real status, networks, price and the evidence behind it. Only verified, authorized suppliers can be purchased."
        actions={<Badge tone="machine">Beta · no charges</Badge>}
      />

      <form method="get" className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,28rem)_10rem_auto] sm:justify-start" role="search">
        <label htmlFor="mq" className="sr-only">Search capabilities</label>
        <input id="mq" name="q" defaultValue={q} placeholder="Search: balance, token risk, market data…" className={field} />
        <label htmlFor="mn" className="sr-only">Network</label>
        <select id="mn" name="network" defaultValue={network} className={field}>
          <option value="">Any network</option>
          <option value="polygon">polygon</option>
          <option value="base">base</option>
          <option value="ethereum">ethereum</option>
        </select>
        <button type="submit" className={btnSecondary}><Search aria-hidden className="size-4" /> Search</button>
      </form>

      {!r.ok ? (
        r.status === 404 ? <Empty title="The marketplace API is not enabled" body="The connected API does not serve the workflows beta (WORKFLOWS_BETA_ENABLED is off)." /> : <ErrorNote what="the capability catalog" />
      ) : r.data.capabilities.length === 0 ? (
        <Empty title="No capabilities match" body="Try a broader search or clear the network filter." cta={{ label: "Clear search", href: "/marketplace" }} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {r.data.capabilities.map((c) => (
            <li key={c.id}>
              <Link href={`/marketplace/${encodeURIComponent(c.id)}${network ? `?network=${encodeURIComponent(network)}` : ""}`}
                className="block h-full rounded-md border border-sl-border bg-sl-surface p-3 hover:border-sl-border-strong focus-visible:border-sl-accent">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-sl-text-subtle">{c.category}</p>
                    <h2 className="font-medium text-sl-text">{c.name}</h2>
                  </div>
                  <StatusBadge status={c.availability} />
                </div>
                <p className="mt-1 text-sm text-sl-text-muted">{c.summary}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-sl-text-muted">
                  <span>{c.offer_count} supplier offer{c.offer_count === 1 ? "" : "s"} · {c.executable_offer_count} purchasable</span>
                  <span aria-hidden>·</span>
                  {c.networks.slice(0, 4).map((n) => <span key={n} className="rounded border border-sl-border px-1.5 py-px font-mono">{n}</span>)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {r.ok && r.data.not_listed.length > 0 && (
        <Panel title="Suppliers under review (not listed)" className="mt-6">
          <ul className="space-y-1.5 text-sm">
            {r.data.not_listed.map((n) => <li key={n.provider}><span className="font-medium text-sl-text">{n.provider}</span> <span className="text-sl-text-muted">— {n.reason}</span></li>)}
          </ul>
        </Panel>
      )}
    </div>
  );
}
