import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ErrorNote, PageHeader, Panel, Table } from "@/components/ui";
import { SimulationBadge } from "@/components/preview/SimulationBadge";
import { requirePreview, taskApi, type Receipt, usd } from "@/lib/preview";

export const metadata: Metadata = { title: "Receipt · Satelink" };
export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  requirePreview();
  const { id } = await params;
  if (!/^rcpt_[0-9a-f]{8,64}$/.test(id)) notFound();
  const r = await taskApi<{ receipt: Receipt }>(`/receipts/${id}`);
  if (!r.ok && r.status === 404) notFound();
  if (!r.ok) return (<><PageHeader title="Receipt" /><ErrorNote what="this receipt" /></>);
  const rc = r.data.receipt;
  const ok = rc.outcome === "succeeded";
  const dl = "inline-flex h-9 items-center rounded-md border border-sl-border px-3 text-[13px] font-medium hover:border-sl-accent";
  return (
    <>
      <PageHeader title="Receipt" lede={rc.intent} actions={<>
        <a className={dl} href={`/api/console/tasks/receipts/${rc.receipt_id}`} download={`${rc.receipt_id}.json`}>Download JSON</a>
        <a className={dl} href={`/api/console/tasks/receipts/${rc.receipt_id}?format=csv`}>Download CSV</a>
      </>} />
      <div className="space-y-4">
        <p className="flex flex-wrap items-center gap-2 text-base font-semibold" data-testid="receipt-outcome">
          {ok ? "Completed" : "Failed — no charge"} <SimulationBadge label={rc.simulation_label} />
        </p>
        <p className="rounded-md border border-sl-warn/60 bg-sl-warn/10 px-3 py-2 text-[13px] font-semibold" data-testid="receipt-label">{rc.simulation_label}</p>
        {rc.trading_label && <p className="rounded-md border border-sl-market/60 bg-sl-market/10 px-3 py-2 text-[13px] font-semibold" data-testid="receipt-trading-label">{rc.trading_label} · {rc.notice}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Charges (simulated)">
            <dl className="tnum space-y-1 text-[13px]">
              <div className="flex justify-between"><dt>From Satelink credits</dt><dd data-testid="receipt-credits">{usd(rc.charges.credits_charged_usd)}</dd></div>
              <div className="flex justify-between"><dt>Merchant (paid by you at checkout)</dt><dd>{usd(rc.charges.merchant_paid_by_user_usd || "0.000000")}</dd></div>
              <div className="flex justify-between text-sl-text-muted"><dt>Currency</dt><dd>{rc.charges.currency}</dd></div>
            </dl>
          </Panel>
          <Panel title="Verification">
            {rc.verification ? (
              <dl className="space-y-1 text-[13px]">
                <div className="flex justify-between"><dt>Method</dt><dd>{rc.verification.method.replace(/_/g, " ")}</dd></div>
                <div className="flex justify-between"><dt>Verified</dt><dd>{rc.verification.verified ? "Yes" : "No"}</dd></div>
                {Object.entries(rc.verification.evidence).map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-sl-text-muted">{k.replace(/_/g, " ")}</dt><dd className="truncate">{String(v)}</dd></div>)}
              </dl>
            ) : <p className="text-[13px] text-sl-text-muted">Not executed{rc.error_code ? ` (${rc.error_code})` : ""} — nothing was charged.</p>}
          </Panel>
        </div>
        {rc.quote && (
          <Panel title={`Quote v${rc.quote.version} · fees ${rc.quote.fee_policy_status}`}>
            <Table head={["Item", "Supplier", "Satelink fee", "Tax"]} numeric={[1, 2, 3]} label="Receipt lines">
              {rc.quote.lines.map((l) => <tr key={l.description}><td>{l.description}</td><td className="text-right">{usd(l.supplier_cost_usd)}</td><td className="text-right">{usd(l.satelink_fee_usd)}</td><td className="text-right">{usd(l.tax_usd)}</td></tr>)}
            </Table>
          </Panel>
        )}
        <Panel title="Record">
          <dl className="space-y-1 break-all text-[12px]">
            <div><dt className="inline text-sl-text-muted">Receipt: </dt><dd className="inline">{rc.receipt_id}</dd></div>
            <div><dt className="inline text-sl-text-muted">Model: </dt><dd className="inline">{rc.served_by || "—"}</dd></div>
            <div><dt className="inline text-sl-text-muted">Ledger transactions: </dt><dd className="inline">{rc.ledger.transactions.map((t) => t.kind).join(" → ") || "none"}</dd></div>
            <div><dt className="inline text-sl-text-muted">Ledger hash: </dt><dd className="inline font-mono" data-testid="ledger-hash">{rc.ledger.ledger_hash}</dd></div>
            <div><dt className="inline text-sl-text-muted">Receipt hash: </dt><dd className="inline font-mono">{rc.receipt_sha256}</dd></div>
            <div><dt className="inline text-sl-text-muted">Issued: </dt><dd className="inline"><time dateTime={rc.issued_at}>{new Date(rc.issued_at).toLocaleString()}</time></dd></div>
          </dl>
        </Panel>
        <Link href={`/tasks/${rc.run_id}`} className="text-[13px] underline-offset-2 hover:underline">Back to the task</Link>
      </div>
    </>
  );
}
