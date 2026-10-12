import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ErrorNote, PageHeader, Panel } from "@/components/ui";
import { MerchantBlock } from "@/components/payments/MerchantBlock";
import { loadIntent } from "@/lib/payments";
import { STATUS_LABEL } from "@/lib/payments-shared";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Receipt" };
export const dynamic = "force-dynamic";

// Invoice / receipt for one checkout (owner-only: the API answers 404 for anyone else).
// Shows the merchant of record (CIN, GSTIN, address) and the refund policy — linked only
// when the page is published, otherwise a clear "not yet published" state.
export default async function ReceiptPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  if (!/^inv_[A-Za-z0-9-]{8,64}$/.test(ref)) notFound();
  if (!(await getSession())) redirect(`/sign-in?next=/billing/receipts/${ref}`);
  const r = await loadIntent(ref);
  if (!r.ok) {
    if (r.status === 404) notFound();
    return (<><PageHeader title="Receipt" /><ErrorNote what="this receipt" /></>);
  }
  const i = r.data;
  const isReceipt = i.receiptReady;
  return (
    <>
      <PageHeader title={isReceipt ? "Receipt" : "Invoice"} lede={`Reference ${i.canonicalRef}`} />
      <Panel>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
          <dt className="text-sl-text-muted">Status</dt><dd className="text-sl-text">{STATUS_LABEL[i.status] ?? i.status}</dd>
          <dt className="text-sl-text-muted">Plan</dt><dd className="text-sl-text">{i.planId}</dd>
          <dt className="text-sl-text-muted">Amount</dt><dd className="font-mono text-sl-text">{i.amount.display} {i.amount.currency}</dd>
          {i.network && (<><dt className="text-sl-text-muted">Network</dt><dd className="text-sl-text">{i.network}</dd></>)}
          <dt className="text-sl-text-muted">Issued</dt><dd className="text-sl-text">{new Date(i.updatedAt).toLocaleString()}</dd>
          {isReceipt && (<><dt className="text-sl-text-muted">Active until</dt><dd className="text-sl-text">{i.entitlement.periodEnd ? new Date(i.entitlement.periodEnd).toLocaleDateString() : "—"}</dd></>)}
        </dl>
        <div className="mt-5"><MerchantBlock merchant={i.merchant} policy={i.refundPolicy} /></div>
      </Panel>
    </>
  );
}
