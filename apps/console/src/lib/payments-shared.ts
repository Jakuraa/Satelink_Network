// Shapes returned by the API's /v1/payments/* (apps/api/src/payments/checkout_router.mjs).
// Client-safe: no server imports.
export type Money = { amountMinor: string; currency: string; display: string };
export type PlanPrice = Record<string, { amountMinor: string; display: string }> | null;
export type TradingAiPlan = { id: string; name: string; price: PlanPrice; introPrice: PlanPrice; renewsAs: string | null; limits: Record<string, number> };
export type PlansPayload = {
  version: string; status: "draft" | "published"; periodDays: number; graceDays: number; note: string | null;
  plans: TradingAiPlan[]; creditPacks: { id: string; name: string; price: PlanPrice }[];
  billing: { crypto: string; fiat: string };
};
export type Merchant = {
  legalName: string; cin: string; gstin: string; address: string; email: string; productDescription: string;
  links: { refundPolicy: string; terms: string; privacy: string; support: string; companyInformation: string; grievance: string };
};
export type RefundPolicy = { status: "published" | "not_published" | "unreachable"; url: string; httpStatus: number | null; completionAllowed: boolean; checkedAt: string };
export type Method = { id: "usdt_polygon" | "usdc_base" | "payram_usdt" | "transacty_upi" | "razorpay"; adapter: string; currency: string; network: string | null };
export type Quote = { planId: string; method: string; amount: Money; introApplied: boolean; periodDays: number | null; merchant: Merchant; refundPolicy: RefundPolicy; testMode: boolean };
export type Invoice = {
  rail: "erc20_transfer"; network: "polygon" | "base"; chainId: number; currency: string; token: string; decimals: number;
  payTo: string; amountMinor: string; amountDisplay: string; uri: string; confirmationsRequired: number; expiresAt: string;
};
export type Intent = { canonicalRef: string; planId: string; method: string; amount: Money; introApplied: boolean; invoice: Invoice | null; checkoutUrl: string | null; upiId?: string | null; statusUrl: string; merchant: Merchant; testMode: boolean };
export type IntentStatus = {
  canonicalRef: string; planId: string; status: string; amount: Money; network: string | null; expiresAt: string | null; updatedAt: string;
  entitlement: { planId: string; periodEnd: string | null; inGrace: boolean }; receiptReady: boolean; merchant: Merchant; refundPolicy: RefundPolicy;
};

export const METHOD_LABEL: Record<string, { title: string; detail: string }> = {
  payram_usdt: { title: "PayRam Crypto (USDT on Tron, Base, Polygon, Ethereum)", detail: "Hosted non-custodial crypto checkout with instant order link." },
  usdt_polygon: { title: "USDT on Polygon", detail: "Direct transfer from any wallet; confirmed on-chain." },
  usdc_base: { title: "USDC on Base", detail: "Direct transfer from any wallet; confirmed on-chain." },
  transacty_upi: { title: "India UPI (Transacty)", detail: "Pay INR via UPI QR/VPA; merchant settles USDT. Requires approval." },
  razorpay: { title: "Card or UPI (Razorpay)", detail: "Hosted checkout · test mode." },
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for payment / confirmations", succeeded: "Paid", overpaid: "Paid (overpayment kept as credit)",
  partially_paid: "Partly paid — send the remainder or contact support", failed: "Failed", expired: "Expired",
  refunded: "Refunded", disputed: "Disputed (lost)", dispute_open: "Dispute open", dispute_won: "Dispute won",
};
