import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OnePageCheckout } from "../src/components/payments/OnePageCheckout";
import { BuyUsageCreditsModal } from "../src/components/v2/BuyUsageCreditsModal";
import { UpgradeModal } from "../src/components/v2/UpgradeModal";
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
    {
      id: "trading_ai_max",
      name: "Max",
      price: { USD: { amountMinor: "7900", display: "79.00" } },
      introPrice: null,
      renewsAs: null,
      limits: { agentRunsPerDay: 500, deepReasoningPerDay: 100, backtestsPerDay: 200, liveStrategies: 5, apiCallsPerDay: 50000 },
    },
  ],
  creditPacks: [
    { id: "trading_ai_credits_10", name: "10 USD credit pack", price: { USD: { amountMinor: "1000", display: "10.00" } } },
    { id: "trading_ai_credits_50", name: "50 USD credit pack", price: { USD: { amountMinor: "5000", display: "50.00" } } },
  ],
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

describe("Checkout Plan Routing & Credit-Pack Regression Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Usage-credit purchases open the correct credit-pack flow", () => {
    it("BuyUsageCreditsModal renders credit packs without routing to invalid subscription plans", () => {
      const html = renderToStaticMarkup(
        <BuyUsageCreditsModal isOpen={true} onClose={() => {}} currentBalanceUu={50000} />
      );

      expect(html).toContain("Buy Additional Usage Credits");
      expect(html).toContain("$100 Pack");
      expect(html).toContain("$250 Pack");
      expect(html).toContain("$1,000 Pack");
    });

    it("prevents credit pack IDs from being misrouted to OnePageCheckout", () => {
      // If a credit pack ID like pack_250 reaches OnePageCheckout, it must NOT select Pro
      const html = renderToStaticMarkup(
        <OnePageCheckout
          plans={mockPlans}
          methods={mockMethods}
          merchant={mockMerchant}
          refundPolicy={mockRefundPolicy}
          testMode={false}
          initialPlanId="pack_250"
        />
      );

      expect(html).toContain('Invalid plan ID &quot;pack_250&quot;');
      expect(html).not.toContain("Satelink AI Assistance — Pro Plan");
      expect(html).toContain("Satelink AI Assistance — No plan selected");
    });
  });

  describe("2. Upgrade actions select the intended valid plan", () => {
    it("UpgradeModal renders valid Max tiers matching supported catalog plans", () => {
      const html = renderToStaticMarkup(
        <UpgradeModal isOpen={true} onClose={() => {}} currentPlanId="pro" />
      );

      expect(html).toContain("Upgrade to Satelink Max");
      expect(html).toContain("Max 5×");
      expect(html).toContain("Max 20×");
    });

    it("OnePageCheckout selects trading_ai_max when target plan is Max", () => {
      const html = renderToStaticMarkup(
        <OnePageCheckout
          plans={mockPlans}
          methods={mockMethods}
          merchant={mockMerchant}
          refundPolicy={mockRefundPolicy}
          testMode={false}
          initialPlanId="trading_ai_max"
        />
      );

      expect(html).not.toContain("Invalid plan ID");
      expect(html).toContain("Satelink AI Assistance — Max Plan");
    });

    it("OnePageCheckout selects trading_ai_pro when target plan is Pro", () => {
      const html = renderToStaticMarkup(
        <OnePageCheckout
          plans={mockPlans}
          methods={mockMethods}
          merchant={mockMerchant}
          refundPolicy={mockRefundPolicy}
          testMode={false}
          initialPlanId="trading_ai_pro"
        />
      );

      expect(html).not.toContain("Invalid plan ID");
      expect(html).toContain("Satelink AI Assistance — Pro Plan");
    });
  });

  describe("3. Invalid IDs never silently select Pro or another plan", () => {
    const invalidIds = ["pack_100", "pack_250", "max_5x", "max_20x", "bogus_plan_id", "pro_unsupported"];

    for (const invalidId of invalidIds) {
      it(`invalid ID '${invalidId}' produces a clear error and never silently selects Pro`, () => {
        const html = renderToStaticMarkup(
          <OnePageCheckout
            plans={mockPlans}
            methods={mockMethods}
            merchant={mockMerchant}
            refundPolicy={mockRefundPolicy}
            testMode={false}
            initialPlanId={invalidId}
          />
        );

        // Produces clear error
        expect(html).toContain(`Invalid plan ID &quot;${invalidId}&quot;`);
        // Never silently falls back to Pro or another plan
        expect(html).not.toContain("Satelink AI Assistance — Pro Plan");
        expect(html).not.toContain("Satelink AI Assistance — Launch Plan");
        expect(html).not.toContain("Satelink AI Assistance — Max Plan");
        expect(html).toContain("Satelink AI Assistance — No plan selected");
        expect(html).toContain("Select a Plan to Continue");
      });
    }

    it("renders normal default only when initialPlanId is omitted (not an invalid ID)", () => {
      const html = renderToStaticMarkup(
        <OnePageCheckout
          plans={mockPlans}
          methods={mockMethods}
          merchant={mockMerchant}
          refundPolicy={mockRefundPolicy}
          testMode={false}
        />
      );

      expect(html).not.toContain("Invalid plan ID");
      expect(html).toContain("Satelink AI Assistance — Launch Plan");
    });
  });
});
