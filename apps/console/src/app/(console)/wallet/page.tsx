import type { Metadata } from "next";
import Link from "next/link";
import { Empty, ErrorNote, Kpi, PageHeader, Panel, Table } from "@/components/ui";
import { SimulationBadge } from "@/components/preview/SimulationBadge";
import { requirePreview, taskApi, usd } from "@/lib/preview";

export const metadata: Metadata = { title: "Wallet & usage · Satelink" };
export const dynamic = "force-dynamic";

type Usage = {
  simulated: true; simulation_label: string; currency: string;
  tasks: { total: number; by_state: Record<string, number> };
  simulated_spend_usd: string; satelink_fees_usd: string; simulated_spend_by_capability_usd: Record<string, string>;
  promo_credit: { granted_usd: string; available_usd: string; origin: string };
  receipts: { receipt_id: string; run_id: string; outcome: string; credits_charged_usd: string; issued_at: string }[];
  external_revenue_usd: string; external_revenue_note: string;
};

export default async function WalletPage() {
  requirePreview();
  const r = await taskApi<{ usage: Usage }>("/usage");
  if (!r.ok) return (<><PageHeader title="Wallet & usage" /><ErrorNote what="your usage" /></>);
  const u = r.data.usage;
  return (
    <>
      <PageHeader title="Wallet & usage" lede="Simulated spend, fees and receipts. Pay-per-use — no subscription." actions={<SimulationBadge />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Promotional credit available" value={<span data-testid="promo-available">{usd(u.promo_credit.available_usd)}</span>} hint={`of ${usd(u.promo_credit.granted_usd)} demo credit (simulated)`} />
        <Kpi label="Simulated spend" value={<span data-testid="sim-spend">{usd(u.simulated_spend_usd)}</span>} hint="from credits" />
        <Kpi label="Satelink fees (simulated)" value={`${usd(u.satelink_fees_usd)}`} hint="PROPOSED — NOT APPROVED" />
        <Kpi label="Tasks" value={u.tasks.total} />
      </div>
      <p className="mt-3 rounded-md border border-sl-border bg-sl-bg-raised px-3 py-2 text-[13px]" data-testid="external-revenue">External revenue: {usd(u.external_revenue_usd)} (preview). {u.external_revenue_note.replace(/^External revenue: \$[0-9.]+ \(preview\) — /, "")}</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Spend by capability (simulated)">
          {Object.keys(u.simulated_spend_by_capability_usd).length === 0 ? <Empty title="No spend yet" body="Approved tasks that complete appear here." /> : (
            <Table head={["Capability", "Credits"]} numeric={[1]} label="Spend by capability">
              {Object.entries(u.simulated_spend_by_capability_usd).map(([k, v]) => <tr key={k}><td>{k}</td><td className="text-right">{usd(v)}</td></tr>)}
            </Table>
          )}
        </Panel>
        <Panel title="Receipts">
          {u.receipts.length === 0 ? <Empty title="No receipts yet" body="Every finished task — succeeded or failed — gets an immutable receipt." /> : (
            <Table head={["Receipt", "Outcome", "Credits", "Issued"]} numeric={[2]} label="Receipts">
              {u.receipts.map((x) => (
                <tr key={x.receipt_id}><td><Link href={`/receipts/${x.receipt_id}`} className="hover:underline">{x.receipt_id.slice(0, 14)}…</Link></td><td>{x.outcome === "succeeded" ? "Succeeded" : "Failed — no charge"}</td><td className="text-right">{usd(x.credits_charged_usd)}</td><td><time dateTime={x.issued_at}>{new Date(x.issued_at).toLocaleDateString()}</time></td></tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}
