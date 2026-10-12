// Merchant of record shown on every checkout, invoice and receipt (Part A: Jakuraa
// Commercial Private Limited, verified CIN/GSTIN). Mirrors apps/corporate/content/company.ts —
// a test asserts the two never drift. Refund/support policy links point at jakuraa.com legal pages.
export const MERCHANT = Object.freeze({
  legalName: 'Jakuraa Commercial Private Limited',
  cin: 'U52190TZ2019PTC033093',
  gstin: '33AADCF9341B1Z1',
  address: '38, 39, First Floor, Malaviya Street, Ramnagar, Coimbatore, Tamil Nadu 641009, India',
  email: 'hello@jakuraa.com',
  productDescription: 'Non-custodial AI trading software subscription; Satelink never holds customer funds or executes on its own account.',
  links: Object.freeze({
    // FOUNDER ACTION: jakuraa.com has no refund-policy page yet (2026-10-12). Checkout refuses
    // LIVE mode while this is null; it is never linked to a page that does not exist.
    refundPolicy: null,
    grievance: 'https://jakuraa.com/legal/grievance',
    terms: 'https://jakuraa.com/legal/terms',
    privacy: 'https://jakuraa.com/legal/privacy',
    support: 'https://jakuraa.com/contact',
    companyInformation: 'https://jakuraa.com/legal/company-information',
  }),
});
