// Wave 1.8 checkout screens: merchant of record + refund-policy gate rendering.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MerchantBlock, RefundPolicyNotice } from "../src/components/payments/MerchantBlock";
import type { Merchant, RefundPolicy } from "../src/lib/payments-shared";

const merchant: Merchant = {
  legalName: "Jakuraa Commercial Private Limited", cin: "U52190TZ2019PTC033093", gstin: "33AADCF9341B1Z1",
  address: "38, 39, First Floor, Malaviya Street, Ramnagar, Coimbatore, Tamil Nadu 641009, India", email: "hello@jakuraa.com",
  productDescription: "Non-custodial AI trading software subscription; Satelink never holds customer funds or executes on its own account.",
  links: { refundPolicy: "https://jakuraa.com/legal/refunds", terms: "https://jakuraa.com/legal/terms", privacy: "https://jakuraa.com/legal/privacy", support: "https://jakuraa.com/contact", companyInformation: "https://jakuraa.com/legal/company-information", grievance: "https://jakuraa.com/legal/grievance" },
};
const notPublished: RefundPolicy = { status: "not_published", url: "https://jakuraa.com/legal/refunds", httpStatus: 404, completionAllowed: false, checkedAt: "2026-10-12T00:00:00Z" };
const published: RefundPolicy = { ...notPublished, status: "published", httpStatus: 200, completionAllowed: true };

describe("checkout merchant block", () => {
  it("shows Jakuraa's CIN and GSTIN on every invoice/receipt", () => {
    const html = renderToStaticMarkup(<MerchantBlock merchant={merchant} policy={published} />);
    expect(html).toContain("Jakuraa Commercial Private Limited");
    expect(html).toContain("U52190TZ2019PTC033093");
    expect(html).toContain("33AADCF9341B1Z1");
  });

  it("refund page 404 → 'not yet published' state, NO link to the missing page, blocking copy when completing", () => {
    const html = renderToStaticMarkup(<RefundPolicyNotice policy={notPublished} blocking />);
    expect(html).toContain("Refund policy not yet published");
    expect(html).toContain("returns 404");
    expect(html).toContain("can&#x27;t be completed");
    expect(html).not.toContain('href="https://jakuraa.com/legal/refunds"');
  });

  it("unreachable probe fails closed the same way", () => {
    const html = renderToStaticMarkup(<RefundPolicyNotice policy={{ ...notPublished, status: "unreachable", httpStatus: null }} blocking={false} />);
    expect(html).toContain("could not be reached");
    expect(html).not.toContain("href=");
  });

  it("published → links the real refund-policy page", () => {
    const html = renderToStaticMarkup(<RefundPolicyNotice policy={published} blocking={false} />);
    expect(html).toContain('href="https://jakuraa.com/legal/refunds"');
    expect(html).not.toContain("not yet published");
  });
});
