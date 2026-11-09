import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCT_ORDER } from "./products";
import { buildLlmsInput, buildPricingJson, buildWellKnown } from "./machine";
import { getFallbackCatalog } from "./intelligence";
import { middleware } from "../middleware";
import { NextRequest } from "next/server";

// D14: Trading Intelligence is internal metered tooling inside Trading AI, not a
// standalone product. Checkout, Dodo and legal text still describe the live sale and
// are deliberately not covered here (founder + counsel decision).
const PUBLIC_SOURCES = [
  "lib/solutions.ts",
  "lib/platform.ts",
  "lib/search-index.ts",
  "lib/academy.ts",
  "app/sitemap.ts",
  "components/ExplorePlans.tsx",
  "components/landing/UnderTheHood.tsx",
  "components/home/CinematicVideoSection.tsx",
  "content/docs/billing.md",
  "app/(marketing)/machine/page.tsx",
  "app/(marketing)/product/overview/page.tsx",
  "app/(marketing)/developers/api/page.tsx",
  "app/(marketing)/developers/quickstart/page.tsx",
  "app/(marketing)/developers/sdks/page.tsx",
  "../../../packages/web-ui/src/blocks/LifecycleStepper.tsx",
];
const SRC = join(__dirname, "..");
const redirectOf = (path: string) =>
  middleware(new NextRequest(`https://satelink.network${path}`, { headers: { host: "satelink.network" } }));

describe("D14 public claims", () => {
  it.each(PUBLIC_SOURCES)("%s does not promote Trading Intelligence", (file) => {
    const text = readFileSync(join(SRC, file), "utf8");
    expect(text).not.toMatch(/Trading Intelligence/);
    expect(text).not.toMatch(/\/v1\/intelligence/);
  });

  it("generated machine-readable surfaces omit it", () => {
    const catalog = getFallbackCatalog();
    expect(PRODUCT_ORDER).not.toContain("trading-intelligence");
    const generated = JSON.stringify([buildLlmsInput(catalog), buildPricingJson(catalog), buildWellKnown(catalog)]);
    expect(generated).not.toMatch(/Trading Intelligence|trading-intelligence/);
  });

  it.each([
    "/intelligence",
    "/products/trading-intelligence",
    "/products/trading-intelligence/funding-rate-heatmap",
    "/intelligence/liquidation-clusters",
  ])("%s redirects to Trading AI", (path) => {
    const res = redirectOf(path);
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/trading-agent/product");
  });

  it("does not redirect the real checkout claim page", () => {
    expect(redirectOf("/intelligence/success").headers.get("location")).toBeNull();
  });
});
