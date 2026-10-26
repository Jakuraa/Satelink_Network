import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OnePageCheckout } from "../src/components/payments/OnePageCheckout";
import type { PlansPayload, Method, Merchant, RefundPolicy } from "../src/lib/payments-shared";

const mockPlans: PlansPayload = {
  version: "trading-ai-2026-10-v1-draft",
  status: "published",
  periodDays: 30,
  graceDays: 3,
  note: null,
  plans: [
    {
      id: "trading_ai_free",
      name: "Free",
      price: null,
      introPrice: null,
      renewsAs: null,
      limits: { agentRunsPerDay: 5, deepReasoningPerDay: 0, backtestsPerDay: 2, liveStrategies: 0, apiCallsPerDay: 100 },
    },
    {
      id: "trading_ai_launch",
      name: "Launch",
      price: { USD: { amountMinor: "1900", display: "19.00" } },
      introPrice: { USD: { amountMinor: "500", display: "5.00" } },
      renewsAs: "trading_ai_pro",
      limits: { agentRunsPerDay: 50, deepReasoningPerDay: 10, backtestsPerDay: 20, liveStrategies: 1, apiCallsPerDay: 5000 },
    },
    {
      id: "trading_ai_pro",
      name: "Pro",
      price: { USD: { amountMinor: "1900", display: "19.00" } },
      introPrice: null,
      renewsAs: null,
      limits: { agentRunsPerDay: 50, deepReasoningPerDay: 10, backtestsPerDay: 20, liveStrategies: 1, apiCallsPerDay: 5000 },
    },
  ],
  creditPacks: [],
  billing: { crypto: "prepaid", fiat: "recurring" },
};

const mockMethods: Method[] = [
  { id: "payram_usdt", adapter: "payram", currency: "USD", network: "tron" },
  { id: "usdt_polygon", adapter: "onchain-native", currency: "USDT", network: "polygon" },
];

const mockMerchant: Merchant = {
  legalName: "Jakuraa Commercial Private Limited",
  cin: "U72900KA2021PTC148888",
  gstin: "29AABCJ1234D1ZE",
  address: "Bangalore, Karnataka, India",
  email: "support@satelink.network",
  productDescription: "Quantitative analytics SaaS and paper trading AI platform",
  links: {
    refundPolicy: "https://jakuraa.com/legal/refunds",
    terms: "https://satelink.network/terms",
    privacy: "https://satelink.network/privacy",
    support: "https://satelink.network/support",
    companyInformation: "https://satelink.network/company",
    grievance: "https://satelink.network/grievance",
  },
};

const mockRefundPolicy: RefundPolicy = {
  status: "published",
  url: "https://jakuraa.com/legal/refunds",
  httpStatus: 200,
  completionAllowed: true,
  checkedAt: new Date().toISOString(),
};

describe("OnePageCheckout Component", () => {
  it("answers the 5 core customer questions clearly in static markup", () => {
    const html = renderToStaticMarkup(
      <OnePageCheckout
        plans={mockPlans}
        methods={mockMethods}
        merchant={mockMerchant}
        refundPolicy={mockRefundPolicy}
        testMode={false}
      />
    );

    // Question 1: What am I buying?
    expect(html).toContain("1. What am I buying?");
    expect(html).toContain("Satelink AI Assistance");

    // Question 2: What do I pay now?
    expect(html).toContain("2. What do I pay now?");
    expect(html).toContain("Payable Today:");

    // Question 3: Is this recurring?
    expect(html).toContain("3. Is this recurring?");
    expect(html).toContain("Crypto Rails:");
    expect(html).toContain("Prepaid for 30 days");
    expect(html).toContain("Never automatic wallet debits");

    // Question 4: Which payment methods are available?
    expect(html).toContain("4. Which payment methods are available?");
    expect(html).toContain("Choose Payment Rail");

    // Question 5: What happens after I pay?
    expect(html).toContain("5. What happens after I pay?");
    expect(html).toContain("Payment reconciles into Financial OS single source of truth");
    expect(html).toContain("Capacity entitlement immediately unlocks");
  });

  it("renders only server-available payment methods and includes PayRam", () => {
    const html = renderToStaticMarkup(
      <OnePageCheckout
        plans={mockPlans}
        methods={mockMethods}
        merchant={mockMerchant}
        refundPolicy={mockRefundPolicy}
        testMode={false}
      />
    );

    // PayRam Crypto is available
    expect(html).toContain("PayRam Crypto");
    expect(html).toContain("USDT on Polygon");

    // Unapproved methods like Razorpay or Transacty are NOT rendered when excluded from methods
    expect(html).not.toContain("Razorpay");
    expect(html).not.toContain("India UPI (Transacty)");
  });

  it("renders the Merchant of Record block with legal details", () => {
    const html = renderToStaticMarkup(
      <OnePageCheckout
        plans={mockPlans}
        methods={mockMethods}
        merchant={mockMerchant}
        refundPolicy={mockRefundPolicy}
        testMode={false}
      />
    );

    expect(html).toContain("Jakuraa Commercial Private Limited");
    expect(html).toContain("U72900KA2021PTC148888");
    expect(html).toContain("29AABCJ1234D1ZE");
  });

  it("displays test mode banner when in test mode", () => {
    const html = renderToStaticMarkup(
      <OnePageCheckout
        plans={mockPlans}
        methods={mockMethods}
        merchant={mockMerchant}
        refundPolicy={mockRefundPolicy}
        testMode={true}
      />
    );

    expect(html).toContain("Test Mode / Sandbox:");
  });
});
