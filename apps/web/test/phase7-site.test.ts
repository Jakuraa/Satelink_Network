// Phase 7 — satelink.network repositioning: Satelink Trading AI first, node-operator earnings claims
// (C1–C6) replaced by the paused notice, navigation, internal surfaces, metadata.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { navigationFallback, footerFallback } from "@satelink/content";
import { isInternalSurface, isProductionDeploy } from "../src/lib/internal-surfaces";
import { OPERATOR_PROGRAM_PAUSED } from "../src/lib/operator-program";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";

const WEB = resolve(__dirname, "..");
const read = (p: string) => readFileSync(join(WEB, p), "utf8");
const STATUS = "Paper trading in controlled beta. Live execution is not yet available.";

describe("C1–C6: node-operator earnings claims are gone; the paused notice replaces them", () => {
  it("the notice is the exact founder sentence", () => {
    expect(OPERATOR_PROGRAM_PAUSED).toBe("The node operator program is paused. Operator payouts are not active.");
  });
  const places: [string, string][] = [
    ["C1 docs index", "src/app/docs/page.tsx"],
    ["C2 docs list", "src/lib/docs.ts"],
    ["C3 node-operators doc", "src/content/docs/node-operators.md"],
    ["C4 FAQ", "src/content/docs/faq.md"],
    ["C5 operator terms", "src/lib/legal.ts"],
    ["C6 node dashboard", "src/app/(node)/node/page.tsx"],
  ];
  for (const [name, file] of places) {
    it(`${name} carries the notice and no earnings promise`, () => {
      const src = read(file);
      expect(src.includes(OPERATOR_PROGRAM_PAUSED) || src.includes("OPERATOR_PROGRAM_PAUSED")).toBe(true);
      expect(src).not.toMatch(/\bearn(s|ing)? (50%|a share)|Your 50%|How much can I earn|Earnings Trend|operators receive 50%/i);
    });
  }
  it("the earnings estimator is deleted and /network pages are the noindex paused notice", () => {
    expect(existsSync(join(WEB, "src/app/(marketing)/network/EarningsEstimator.tsx"))).toBe(false);
    for (const p of ["src/app/(marketing)/network/page.tsx", "src/app/(marketing)/network/run-a-node/page.tsx"]) {
      const src = read(p);
      expect(src).toMatch(/<ProgramPaused \/>/);
      expect(src).toMatch(/robots: \{ index: false/);
    }
  });
});

describe("navigation", () => {
  const items = navigationFallback.menus.flatMap((m) => m.groups.flatMap((g) => g.items));
  const footerLinks = [...footerFallback.columns, ...footerFallback.secondary].flatMap((c) => c.links);
  it("no Network / Run-a-node anywhere in the header or footer", () => {
    for (const l of [...items, ...footerLinks]) expect(l.href, l.label).not.toMatch(/^\/network/);
  });
  it("Products leads with Machine commerce & rails; the primary CTA is Quickstart", () => {
    expect(navigationFallback.menus[0].groups[0].title).toBe("Machine commerce & rails");
    expect(navigationFallback.menus[0].groups[0].items[0].href).toBe("/products/machine-commerce");
    const primary = navigationFallback.cta.find((c) => c.variant === "primary");
    expect(primary).toMatchObject({ label: "Quickstart", href: "/developers/quickstart" });
  });
  it("RPC, x402 and developer tools sit under Developers", () => {
    const dev = navigationFallback.menus.find((m) => m.label === "Developers")!.groups.flatMap((g) => g.items.map((i) => i.label));
    expect(dev).toEqual(expect.arrayContaining(["RPC Infrastructure", "x402 Protocol", "Docs", "Quickstart"]));
  });
  it("no footer link points at a jakuraa.com path that 404s", () => {
    for (const l of footerLinks) expect(l.href).not.toMatch(/jakuraa\.com\/company\/(mission|research|news)/);
  });
});

describe("internal surfaces: 404 in production, noindex, not in the sitemap", () => {
  it("matches builder, distributor, design, styleguide — and nothing public", () => {
    for (const p of ["/builder", "/builder/keys", "/distributor", "/distributor/referrals", "/design", "/styleguide"]) expect(isInternalSurface(p), p).toBe(true);
    for (const p of ["/", "/builders", "/designs", "/developers", "/trading-agent", "/docs/design-system", "/styleguides"]) expect(isInternalSurface(p), p).toBe(false);
  });
  it("production is VERCEL_ENV=production only", () => {
    expect(isProductionDeploy({ VERCEL_ENV: "production" })).toBe(true);
    expect(isProductionDeploy({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isProductionDeploy({})).toBe(false);
  });
  it("middleware 404s them in production and sends X-Robots-Tag noindex otherwise", () => {
    const mw = read("src/middleware.ts");
    expect(mw).toMatch(/if \(isInternalSurface\(url\.pathname\)\) \{\n\s+if \(isProductionDeploy\(\)\) return new NextResponse\('Not Found', \{ status: 404 \}\)/);
    expect(mw).toMatch(/X-Robots-Tag', 'noindex, nofollow'/);
  });
  it("sitemap lists the Trading AI pages and none of the internal or paused routes", () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname);
    expect(urls).toContain("/trading-agent");
    expect(urls).toContain("/trading-agent/how-it-works");
    for (const u of urls) expect(u).not.toMatch(/^\/(network|builder|distributor|design|styleguide)(\/|$)/);
    const disallow = ([] as string[]).concat(...robots().rules instanceof Array ? (robots().rules as { disallow?: string | string[] }[]).map((r) => ([] as string[]).concat(r.disallow ?? [])) : []);
    expect(disallow).toEqual(expect.arrayContaining(["/builder", "/distributor", "/design", "/styleguide"]));
  });
});

describe("homepage and metadata", () => {
  const home = read("src/app/(marketing)/page.tsx");
  it("positioning, verbatim status line, beta CTA, loop, safety boundary, three interfaces", () => {
    expect(home).toMatch(/Infrastructure for AI agents that discover and use digital services\./);
    expect(home).toMatch(/Discover, evaluate, authorize, access, meter, pay, settle/);
    expect(home).toContain(`"${STATUS}"`);
    expect(home).toMatch(/Request beta access/);
    for (const s of ["GO", "WAIT", "REJECT"]) expect(home).toContain(`label: "${s}"`);
    expect(home).toMatch(/AI proposes\. Deterministic risk and your signed mandate decide\./);
    expect(home).toMatch(/withdrawals are never enabled/);
    for (const i of ["Web", "API", "MCP"]) expect(home).toContain(`name: "${i}"`);
  });
  it("root metadata reflects Satelink infrastructure positioning and nothing says DePIN", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/default: "Satelink — AI-Agent & Machine-Commerce Infrastructure"/);
    expect(layout).not.toMatch(/DePIN/i);
    for (const f of ["src/app/docs/layout.tsx", "src/app/docs/page.tsx", "src/app/feed.xml/route.ts", "src/content/docs/glossary.md"]) expect(read(f), f).not.toMatch(/DePIN/i);
  });
  it("beta CTA reuses the existing contact-sales lead form", () => {
    expect(read("src/app/(marketing)/contact-sales/page.tsx")).toMatch(/interest === "beta"/);
    expect(read("src/app/(marketing)/contact-sales/ContactSalesForm.tsx")).toMatch(/Satelink Trading AI beta/);
  });
});
