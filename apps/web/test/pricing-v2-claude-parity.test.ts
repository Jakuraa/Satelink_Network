import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const catalog = JSON.parse(
  readFileSync(resolve(__dirname, "..", "..", "api", "config", "plan_catalog.v2.json"), "utf8")
);

describe("Claude-Inspired Pricing V2 & Unit Economics Parity", () => {
  it("ships Free discovery tier with controlled backend limits", () => {
    const free = catalog.plans.find((p: any) => p.id === "free");
    expect(free).toBeDefined();
    expect(free.price_usd).toBe(0);
    expect(free.allowance.weekly_uu).toBe(500);
    expect(free.allowance.session_uu).toBe(100);
    expect(free.limits.api_keys).toBe(1);
    expect(free.limits.machines).toBe(1);
  });

  it("ships Pro tier at ₹999/mo and ₹9,990/yr with exact 16.7% annual discount", () => {
    const pro = catalog.plans.find((p: any) => p.id === "pro");
    const proYearly = catalog.plans.find((p: any) => p.id === "pro_yearly");
    expect(pro).toBeDefined();
    expect(proYearly).toBeDefined();

    expect(pro.inr_price).toBe(999);
    expect(proYearly.inr_price).toBe(9990);
    expect(pro.allowance.weekly_uu).toBe(7500);
    expect(pro.allowance.session_uu).toBe(1500);

    const discount = (12 * pro.inr_price - proYearly.inr_price) / (12 * pro.inr_price);
    expect(discount).toBeCloseTo(0.1667, 3);
  });

  it("ships Max 5× at ₹3,999/mo and ₹39,990/yr with 5× allowance multiplier", () => {
    const pro = catalog.plans.find((p: any) => p.id === "pro");
    const max5 = catalog.plans.find((p: any) => p.id === "max_5x");
    const max5Yearly = catalog.plans.find((p: any) => p.id === "max_5x_yearly");

    expect(max5).toBeDefined();
    expect(max5Yearly).toBeDefined();
    expect(max5.inr_price).toBe(3999);
    expect(max5Yearly.inr_price).toBe(39990);

    // 5x allowance of Pro
    expect(max5.allowance.weekly_uu).toBe(pro.allowance.weekly_uu * 5);
    expect(max5.allowance.session_uu).toBe(pro.allowance.session_uu * 5);
    expect(max5.limits.api_keys).toBe(20);
    expect(max5.limits.machines).toBe(20);

    const discount = (12 * max5.inr_price - max5Yearly.inr_price) / (12 * max5.inr_price);
    expect(discount).toBeCloseTo(0.1667, 3);
  });

  it("ships Max 20× at ₹7,999/mo and ₹79,990/yr with 20× allowance multiplier", () => {
    const pro = catalog.plans.find((p: any) => p.id === "pro");
    const max20 = catalog.plans.find((p: any) => p.id === "max_20x");
    const max20Yearly = catalog.plans.find((p: any) => p.id === "max_20x_yearly");

    expect(max20).toBeDefined();
    expect(max20Yearly).toBeDefined();
    expect(max20.inr_price).toBe(7999);
    expect(max20Yearly.inr_price).toBe(79990);

    // 20x allowance of Pro
    expect(max20.allowance.weekly_uu).toBe(pro.allowance.weekly_uu * 20);
    expect(max20.allowance.session_uu).toBe(pro.allowance.session_uu * 20);
    expect(max20.limits.api_keys).toBe(50);
    expect(max20.limits.machines).toBe(50);

    const discount = (12 * max20.inr_price - max20Yearly.inr_price) / (12 * max20.inr_price);
    expect(discount).toBeCloseTo(0.1667, 3);
  });

  it("ships candidate credit packs ($100, $250, $1,000) with verified INR prices", () => {
    const p100 = catalog.packs.find((p: any) => p.id === "pack_100");
    const p250 = catalog.packs.find((p: any) => p.id === "pack_250");
    const p1000 = catalog.packs.find((p: any) => p.id === "pack_1000");

    expect(p100).toBeDefined();
    expect(p250).toBeDefined();
    expect(p1000).toBeDefined();

    expect(p100.inr_price).toBe(8400);
    expect(p100.grant_uu).toBe(100000);

    expect(p250.inr_price).toBe(21000);
    expect(p250.grant_uu).toBe(250000);

    expect(p1000.inr_price).toBe(84000);
    expect(p1000.grant_uu).toBe(1000000);
  });

  it("guarantees 100% exclusion of Razorpay across active payment modules", () => {
    const pricingView = readFileSync(
      resolve(__dirname, "..", "src", "components", "PricingView.tsx"),
      "utf8"
    );
    const upgradeModal = readFileSync(
      resolve(__dirname, "..", "..", "console", "src", "components", "v2", "UpgradeModal.tsx"),
      "utf8"
    );
    const buyCreditsModal = readFileSync(
      resolve(__dirname, "..", "..", "console", "src", "components", "v2", "BuyUsageCreditsModal.tsx"),
      "utf8"
    );

    expect(pricingView.toLowerCase()).not.toContain("razorpay");
    expect(upgradeModal.toLowerCase()).not.toContain("razorpay");
    expect(buyCreditsModal.toLowerCase()).not.toContain("razorpay");
  });
});
