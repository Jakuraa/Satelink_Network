import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Badge, ErrorNote, PageHeader, Panel, Table } from "@/components/ui";
import { ProcurePanel } from "@/components/workflows/ProcurePanel";
import { StatusBadge } from "@/components/workflows/parts";
import { loadCapability, workflowsBetaEnabled } from "@/lib/workflows";

export const metadata: Metadata = { title: "Capability" };
export const dynamic = "force-dynamic";

const NET_TONE = { live: "good", evaluation: "warn", paused: "neutral", not_authorized: "neutral" } as const;

export default async function CapabilityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ network?: string }> }) {
  if (!workflowsBetaEnabled()) notFound();
  const { id } = await params;
  if (!/^[a-z0-9_.-]{2,64}$/.test(id)) notFound();
  const { network = "" } = await searchParams;
  const r = await loadCapability(id, network.slice(0, 64));
  if (!r.ok) {
    if (r.status === 404) notFound();
    return (<><PageHeader title="Capability" /><ErrorNote what="this capability" /></>);
  }
  const c = r.data.capability;
  const buyable = c.id !== "market_data.candles";

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <Link href="/marketplace" className="text-xs text-sl-text-muted hover:text-sl-text">← Marketplace</Link>
      </div>
      <PageHeader title={c.name} lede={c.summary} actions={<StatusBadge status={c.availability} />} />

      {c.disclaimer && (
        <div role="note" className="flex items-start gap-2 rounded-md border border-sl-warn/50 bg-sl-bg-raised px-3 py-2 text-sm text-sl-text">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-sl-warn" /> {c.disclaimer}
        </div>
      )}

      <Panel title="Compare suppliers">
        <Table head={["Supplier", "Status", "Networks", "Supplier cost", "You pay", "Payment", "SLA", "Last verified"]} numeric={[3, 4]} label="Supplier comparison">
          {c.offers.map((o) => (
            <tr key={o.id} className="align-top">
              <td>
                <p className="font-medium text-sl-text">{o.provider.name}</p>
                <p className="font-mono text-[11px] text-sl-text-subtle">{o.id}</p>
              </td>
              <td><StatusBadge status={o.status} />{o.status_detail && <p className="mt-1 max-w-[12rem] text-[11px] text-sl-text-subtle">{o.status_detail}</p>}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {o.networks.length === 0 ? <span className="text-sl-text-subtle">none</span> : o.networks.map((n) => <Badge key={n.name} tone={NET_TONE[n.status]}>{n.name}: {n.status.replace("_", " ")}</Badge>)}
                </div>
              </td>
              <td className="text-right">${o.pricing.supplier_cost_usd}</td>
              <td className="text-right">
                ${o.pricing.charged_usd}
                {!o.pricing.approved && <p className="text-[11px] text-sl-text-subtle">{o.pricing.list_price_usd ? `list $${o.pricing.list_price_usd} · ` : ""}pricing not approved</p>}
              </td>
              <td className="text-sl-text-muted">{o.payment.method}{o.payment.x402_version ? ` v${o.payment.x402_version}` : ""}</td>
              <td className="text-sl-text-muted">{o.sla || "none"}</td>
              <td className="max-w-[16rem] text-[11px] text-sl-text-muted">{o.last_verified.at || "per run"}: {o.last_verified.result}</td>
            </tr>
          ))}
        </Table>
        <details className="mt-3 text-xs text-sl-text-muted">
          <summary className="cursor-pointer font-medium text-sl-text">Licence and usage rights</summary>
          <ul className="mt-2 space-y-1">
            {c.offers.map((o) => <li key={o.id}><span className="text-sl-text">{o.provider.name}</span>: resale {o.license.resale ? "permitted" : "not permitted"}, caching {o.license.caching ? "permitted" : "not permitted"} — {o.license.evidence}</li>)}
          </ul>
        </details>
      </Panel>

      {buyable ? (
        <Panel title="Request a quote and buy">
          <ProcurePanel capability={c.id} networks={c.networks} addressLabel={c.id.startsWith("token") ? "Token contract address" : "Wallet address"} />
        </Panel>
      ) : (
        <Panel title="Used by">
          <p className="text-sm text-sl-text-muted">Market data is selected automatically by <Link href="/strategy-lab" className="text-sl-accent hover:underline">Strategy Lab</Link> runs, after a licence check.</p>
        </Panel>
      )}
    </div>
  );
}
