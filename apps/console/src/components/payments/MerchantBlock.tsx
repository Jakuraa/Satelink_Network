// Merchant of record + refund policy, shown on every invoice and receipt.
// The refund-policy link renders ONLY when the API reports the page published (HTTP 200);
// otherwise a clear "not yet published" state — never a link to a page that 404s.
import type { Merchant, RefundPolicy } from "@/lib/payments-shared";

export function RefundPolicyNotice({ policy, blocking }: { policy: RefundPolicy | null; blocking: boolean }) {
  if (policy?.status === "published") {
    return (
      <p className="text-[13px] text-sl-text-muted">
        Refund policy: <a className="text-sl-accent underline" href={policy.url} target="_blank" rel="noreferrer">{policy.url.replace("https://", "")}</a>
      </p>
    );
  }
  return (
    <div role="status" className="rounded-[var(--sl-radius)] border border-sl-warn/40 bg-sl-warn/10 p-3 text-[13px] text-sl-text">
      <p className="font-medium">Refund policy not yet published</p>
      <p className="mt-1 text-sl-text-muted">
        Jakuraa Commercial Private Limited has not yet published its refund policy (jakuraa.com/legal/refunds
        {policy?.httpStatus ? ` returns ${policy.httpStatus}` : " could not be reached"}).
        {blocking ? " Checkout can't be completed until it is published — you won't be asked to pay." : ""}
      </p>
    </div>
  );
}

export function MerchantBlock({ merchant, policy, blocking = false }: { merchant: Merchant; policy: RefundPolicy | null; blocking?: boolean }) {
  return (
    <section aria-label="Merchant of record" className="space-y-3 border-t border-sl-border pt-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
        <dt className="text-sl-text-muted">Merchant</dt><dd className="text-sl-text">{merchant.legalName}</dd>
        <dt className="text-sl-text-muted">CIN</dt><dd className="font-mono text-sl-text">{merchant.cin}</dd>
        <dt className="text-sl-text-muted">GSTIN</dt><dd className="font-mono text-sl-text">{merchant.gstin}</dd>
        <dt className="text-sl-text-muted">Address</dt><dd className="text-sl-text">{merchant.address}</dd>
        <dt className="text-sl-text-muted">Product</dt><dd className="text-sl-text">{merchant.productDescription}</dd>
      </dl>
      <RefundPolicyNotice policy={policy} blocking={blocking} />
      <p className="text-[12px] text-sl-text-subtle">
        <a className="underline" href={merchant.links.terms}>Terms</a> · <a className="underline" href={merchant.links.privacy}>Privacy</a> ·{" "}
        <a className="underline" href={merchant.links.companyInformation}>Company information</a> · <a className="underline" href={merchant.links.grievance}>Grievance</a> ·{" "}
        <a className="underline" href={merchant.links.support}>Support</a>
      </p>
    </section>
  );
}
