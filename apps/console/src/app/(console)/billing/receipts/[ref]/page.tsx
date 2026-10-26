import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { MerchantBlock } from "@/components/payments/MerchantBlock";
import { loadIntent } from "@/lib/payments";
import { STATUS_LABEL } from "@/lib/payments-shared";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Receipt — Satelink AI Assistance" };
export const dynamic = "force-dynamic";

interface ReceiptPageProps {
  params: Promise<{ ref: string }>;
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { ref } = await params;
  if (!/^inv_[A-Za-z0-9-]{8,64}$/.test(ref)) notFound();

  const session = await getSession();
  if (!session) redirect(`/sign-in?next=/billing/receipts/${ref}`);

  const r = await loadIntent(ref);
  if (!r.ok) {
    if (r.status === 404) notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader title="Receipt" />
        <div className="mt-4 text-sm text-sl-text-muted">Unable to load receipt details.</div>
      </div>
    );
  }

  const i = r.data;
  const isReceipt = i.receiptReady;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title={isReceipt ? "Official Receipt" : "Invoice"}
          lede={`Reference ${i.canonicalRef}`}
        />
        <Link
          href="/billing/checkout"
          className="text-xs text-sl-accent hover:underline"
        >
          Return to Checkout
        </Link>
      </div>

      <Panel>
        <div className="space-y-6 p-6">
          <div className="flex items-center justify-between border-b border-sl-border pb-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-sl-text-muted">Status</span>
              <p className="text-base font-semibold text-sl-text">{STATUS_LABEL[i.status] ?? i.status}</p>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase tracking-wider text-sl-text-muted">Issued Date</span>
              <p className="text-sm font-mono text-sl-text">{new Date(i.updatedAt).toLocaleString()}</p>
            </div>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-sl-text-muted">Product</dt>
            <dd className="font-medium text-sl-text">Satelink AI Assistance — {i.planId}</dd>

            <dt className="text-sl-text-muted">Settled Amount</dt>
            <dd className="font-mono font-bold text-sl-text">
              {i.amount.display} {i.amount.currency}
            </dd>

            {i.network && (
              <>
                <dt className="text-sl-text-muted">Settlement Rail</dt>
                <dd className="font-medium text-sl-text capitalize">{i.network}</dd>
              </>
            )}

            {isReceipt && (
              <>
                <dt className="text-sl-text-muted">Entitlement Period End</dt>
                <dd className="font-medium text-sl-text">
                  {i.entitlement.periodEnd
                    ? new Date(i.entitlement.periodEnd).toLocaleDateString()
                    : "—"}
                </dd>
              </>
            )}
          </dl>

          <MerchantBlock merchant={i.merchant} policy={i.refundPolicy} />
        </div>
      </Panel>
    </div>
  );
}
