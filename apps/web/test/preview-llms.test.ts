// Release A P5: llms.txt snapshot (reviewable diff on every change) and truth checks for the preview surfaces.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateLlmsTxt } from "@satelink/seo";
import { getFallbackCatalog } from "@/lib/intelligence";
import { buildLlmsInput, previewLlmsSection } from "@/lib/machine";
import PREVIEW from "@/content/preview-capabilities.generated.json";

const txt = generateLlmsTxt(buildLlmsInput(getFallbackCatalog())) + previewLlmsSection();
const page = readFileSync(resolve(__dirname, "../src/app/(marketing)/preview/page.tsx"), "utf8");

describe("llms.txt with the preview section", () => {
  it("matches the committed snapshot", () => { expect(txt).toMatchSnapshot(); });
  it("states the preview truthfully and lists every registry capability with its status", () => {
    expect(txt).toContain("SIMULATED — NO MONEY MOVED");
    expect(txt).toContain("PROPOSED — NOT APPROVED");
    expect(txt).toContain("Local preview only");
    for (const c of PREVIEW.capabilities) expect(txt).toContain(`- ${c.id} [${c.release_status}]`);
  });
});

describe("/preview page", () => {
  it("labels simulation, mocks and fees, and publishes no price", () => {
    for (const s of ["Preview — simulated, no charges.", "Demo Digital Store (MOCK)", "Food Delivery (MOCK — not connected to Swiggy)", "Demo Data API (MOCK)", "SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS", "Not investment advice", "no mandatory subscription"]) expect(page).toContain(s);
    expect(page).not.toMatch(/[$₹€£]\s?\d/);
    expect(page).not.toMatch(/app\.satelink\.network|Eulerpool/i);
  });
  it("has a real screenshot file for every journey", () => {
    const imgs = [...page.matchAll(/img: "([^"]+)"/g)].map((m) => m[1]);
    expect(imgs).toHaveLength(6);
    for (const i of imgs) expect(() => readFileSync(resolve(__dirname, "../public/product/preview", i))).not.toThrow();
  });
});
