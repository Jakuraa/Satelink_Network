// F8 (2026-10-20): Trading Intelligence prices are withheld from every
// machine-readable surface until the founder confirms the price list. This
// fails if a TI price line, offer or price-catalog link reappears.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateLlmsTxt, generateLlmsFullTxt } from "@satelink/seo";
import { getFallbackCatalog } from "@/lib/intelligence";
import { buildLlmsInput, buildPricingJson, buildProductJson, buildWellKnown } from "@/lib/machine";

const catalog = getFallbackCatalog();
const input = buildLlmsInput(catalog);

describe("Trading Intelligence pricing is withheld from machine surfaces (F8)", () => {
  it("the fallback catalog still has TI metrics (so the checks below are meaningful)", () => {
    expect(catalog.metrics.length).toBeGreaterThan(0);
  });

  it("llms.txt and llms-full.txt list no TI price and no TI catalog link", () => {
    for (const txt of [generateLlmsTxt(input), generateLlmsFullTxt(input, [])]) {
      const ti = txt.slice(txt.indexOf("Trading Intelligence ("), txt.indexOf("###", txt.indexOf("Trading Intelligence (") + 1));
      expect(ti).toContain("(pricing: not published)");
      for (const m of catalog.metrics) expect(txt).not.toContain(`${m.slug}: $`);
      expect(txt).not.toContain("/v1/intelligence");
    }
  });

  it("/pricing.json, /products/trading-intelligence.json and /.well-known/satelink.json carry no TI price", () => {
    const pricing = buildPricingJson(catalog);
    expect(pricing.products.find((p) => p.slug === "trading-intelligence")?.prices).toEqual([]);
    expect(buildProductJson("trading-intelligence", catalog).pricing).toEqual([]);
    expect(JSON.stringify(buildWellKnown(catalog))).not.toContain("/v1/intelligence");
    expect(JSON.stringify(pricing)).not.toContain("/v1/intelligence");
  });

  it("the site-wide TI JSON-LD Product has no Offer", () => {
    const src = readFileSync(join(__dirname, "..", "src", "app", "layout.tsx"), "utf8");
    const block = src.slice(src.indexOf("const INTELLIGENCE_PRODUCT_JSON_LD"), src.indexOf("const RPC_PRODUCT_JSON_LD"));
    expect(block).not.toMatch(/offers\s*:/);
    expect(block).not.toMatch(/price\s*:/);
  });
});
