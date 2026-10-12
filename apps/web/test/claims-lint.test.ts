// Stage 26 + Phase 7 — claims lint (honest positioning, strict + public tiers), broker-status state machine, public pages.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { lintClaims, lintSource, lintPublicClaims, lintPublicSource } from "../scripts/claims-lint.mjs";
import DISCLAIMERS from "../src/lib/trading-agent/disclaimers.json";
import { CONNECTORS, PLATFORM, STAGE_REQUIREMENTS, canAdvance, stageIndex, stageIsEvidenced, stageLabel, CONNECTOR_STAGES } from "../src/lib/trading-agent/status";
import { TA_PAGES, LEGAL_PLACEHOLDERS } from "../src/lib/trading-agent/copy";

const WEB = resolve(__dirname, "..");
const APP = join(WEB, "src/app/(marketing)");
const pageFile = (href: string) => join(APP, href, "page.tsx");
type Finding = { rule: string; match: string };
const lint = (src: string, file = "x.tsx"): Finding[] => lintSource(file, src, Object.values(DISCLAIMERS)) as Finding[];

describe("claims lint — acceptance: green on Satelink Trading AI pages and every public page", () => {
  it("scans every page, component and copy module and finds nothing", () => {
    const { files, findings } = lintClaims(WEB);
    expect(files.length).toBeGreaterThanOrEqual(16);
    for (const p of TA_PAGES) expect(files, p.href).toContain(join("src/app/(marketing)", p.href, "page.tsx"));
    expect(findings).toEqual([]);
  });
  it("public tier: every marketing page, doc, markdown content file and copy module is free of financial claims", () => {
    const { files, findings } = lintPublicClaims(WEB);
    expect(files.length).toBeGreaterThan(150);
    expect(files).toContain("src/content/docs/node-operators.md");
    expect(findings).toEqual([]);
  });
});

describe("claims lint — public tier catches money claims but not technical copy", () => {
  const pub = (src: string, file = "x.tsx") => (lintPublicSource(file, src) as Finding[]).map((f) => f.rule);
  for (const [src, rule] of [
    ["<p>Run a node and earn a share</p>", "PERFORMANCE"], ["<p>12% APY</p>", "PERFORMANCE"], ["<p>Guaranteed payouts</p>", "PERFORMANCE"],
    ["<p>Official partner of Binance</p>", "PARTNERSHIP"], ["<p>Backed by top funds</p>", "PARTNERSHIP"], ["<p>Start trading today</p>", "AVAILABILITY"],
  ] as [string, string][]) it(`flags ${rule}: ${src}`, () => expect(pub(src)).toContain(rule));
  it("markdown lines are copy", () => expect(pub("# Node operators\n\nOperators earn 50%.", "x.md")).toContain("PERFORMANCE"));
  for (const ok of ["<p>Unpaid calls return HTTP 402</p>", "<p>The MIT-licensed x402-kit</p>", "<p>Attempting to gain unauthorized access</p>", "<p>$0.00003 per call</p>", "<p>It is not yet approved by counsel.</p>"]) {
    it(`does not flag technical copy: ${ok}`, () => expect(pub(ok)).toEqual([]));
  }
});

describe("claims lint — it actually catches bad copy", () => {
  const cases: [string, string][] = [
    ["<p>Official Binance partner</p>", "PARTNERSHIP"],
    ["<p>Approved by SEBI</p>", "PARTNERSHIP"],
    ["const t = 'Integrated with Upstox, trusted by traders';", "PARTNERSHIP"],
    ["<p>Backed by leading exchanges</p>", "PARTNERSHIP"],
    ["<p>Earn steady monthly returns</p>", "PERFORMANCE"],
    ["<p>Our strategies are profitable</p>", "PERFORMANCE"],
    ["<p>Guaranteed, risk-free</p>", "PERFORMANCE"],
    ["<p>Find alpha with AI</p>", "PERFORMANCE"],
    ["<p>Start trading in minutes</p>", "AVAILABILITY"],
    ["<p>Available now for everyone</p>", "AVAILABILITY"],
    ["<p>Our AI predicts the market</p>", "AI_OVERCLAIM"],
    ["<p>Fully automated trading bot</p>", "AI_OVERCLAIM"],
    ["<p>Up 40% this year</p>", "UNLABELLED_NUMBER"],
    ["<p>Made $1,200 last week</p>", "UNLABELLED_NUMBER"],
    ["<p>Limit 30,000 USDT</p>", "UNLABELLED_NUMBER"],
  ];
  for (const [src, rule] of cases) {
    it(`flags ${rule}: ${src}`, () => expect(lint(src).map((f) => f.rule)).toContain(rule));
  }

  it("does not flag code, class names, links, approved disclaimers or labelled hypotheticals", () => {
    expect(lint("export function f() { return 1; }")).toEqual([]);
    expect(lint('<div className="partner-grid"><a href="/partners">Docs</a></div>')).toEqual([]);
    expect(lint(`<p>{"${DISCLAIMERS.noAffiliation}"}</p>`)).toEqual([]);
    expect(lint(`<Hypothetical><p>Buy 0.001 BTC at 30,000 USDT, up 5%</p></Hypothetical>`)).toEqual([]);
    expect(lint(`<div><Hypothetical><p>ok 5%</p></Hypothetical><p>not ok 5%</p></div>`).map((f) => f.rule)).toEqual(["UNLABELLED_NUMBER"]);
  });

  it("a legal placeholder must be marked RPrC", () => {
    expect(lint("export function LegalPlaceholder() { return <p>Terms go here</p>; }").map((f) => f.rule)).toContain("LEGAL_WITHOUT_REVIEW");
    expect(lint("export function LegalPlaceholder() { return <p>RPrC — review</p>; }")).toEqual([]);
  });

  it("the disclaimers themselves deny every relationship and promise", () => {
    expect(DISCLAIMERS.noAffiliation).toMatch(/not affiliated with, endorsed by or a partner of/);
    expect(DISCLAIMERS.noAffiliation).toMatch(/no broker, exchange or regulator has reviewed or approved/);
    expect(DISCLAIMERS.notAdvice).toMatch(/^Nothing on these pages is investment advice/);
    expect(DISCLAIMERS.notAdvice).toMatch(/nobody can promise any outcome/);
    expect(DISCLAIMERS.aiCanBeWrong).toMatch(/can be wrong/);
    expect(DISCLAIMERS.notAvailable).toBe("Paper trading in controlled beta. Live execution is not yet available.");
  });
});

describe("broker status — one config, a state machine, copy derived from state", () => {
  it("every connector's current stage is fully evidenced; none is beyond 'sandbox_verified' while live trading is locked", () => {
    expect(PLATFORM.liveTradingLocked).toBe(true);
    for (const c of CONNECTORS) {
      expect(stageIsEvidenced(c), c.id).toBe(true);
      expect(stageIndex(c.stage), c.id).toBeLessThanOrEqual(stageIndex("sandbox_verified"));
      expect(stageLabel(c.stage).available, c.id).toBe(false);
    }
  });

  it("advancing is forward, one step, with evidence; pilot/live need live trading unlocked", () => {
    const b = CONNECTORS.find((c) => c.id === "binance")!;
    expect(canAdvance(b, "sandbox_verified")).toEqual({ ok: false, missing: ["sandboxRun"] });
    expect(canAdvance({ ...b, evidence: { ...b.evidence, sandboxRun: "2026-10-07" } }, "sandbox_verified").ok).toBe(true);
    expect(canAdvance(b, "pilot").ok).toBe(false); // skipping a step
    const verified = { ...b, stage: "sandbox_verified" as const, evidence: { ...b.evidence, sandboxRun: "x", brokerAgreement: "x", legalReview: "x" } };
    expect(canAdvance(verified, "pilot").missing).toEqual(["liveTradingUnlocked"]);
    expect(canAdvance(verified, "pilot", { ...PLATFORM, liveTradingLocked: false }).ok).toBe(true);
    expect(canAdvance(b, "implemented").ok).toBe(false); // never backwards
  });

  it("only LIVE reads as available; every stage has requirements that only grow", () => {
    expect(CONNECTOR_STAGES.filter((s) => stageLabel(s).available)).toEqual(["live"]);
    for (let i = 1; i < CONNECTOR_STAGES.length; i++) {
      for (const r of STAGE_REQUIREMENTS[CONNECTOR_STAGES[i - 1]]) expect(STAGE_REQUIREMENTS[CONNECTOR_STAGES[i]]).toContain(r);
    }
  });
});

describe("pages — public, indexed, disclosures, legal placeholders", () => {
  it("every page is public: no flag gate, not noindex, listed in the sitemap, not disallowed in robots", () => {
    expect(existsSync(join(WEB, "src/lib/trading-agent/flag.ts"))).toBe(false);
    const layout = readFileSync(join(APP, "trading-agent/layout.tsx"), "utf8");
    expect(layout).not.toMatch(/requireSiteTradingAgent|index: false|notFound/);
    for (const p of TA_PAGES) {
      expect(existsSync(pageFile(p.href)), p.href).toBe(true);
      const src = readFileSync(pageFile(p.href), "utf8");
      expect(src, p.href).not.toMatch(/requireSiteTradingAgent|index: false/);
    }
    expect(readFileSync(join(WEB, "src/app/robots.ts"), "utf8")).not.toMatch(/"\/trading-agent/);
    expect(readFileSync(join(WEB, "src/app/sitemap.ts"), "utf8")).toMatch(/"\/trading-agent"/);
  });

  it("status line is verbatim and pricing reads pricing at launch", () => {
    expect(DISCLAIMERS.notAvailable).toBe("Paper trading in controlled beta. Live execution is not yet available.");
    expect(readFileSync(join(WEB, "src/lib/trading-agent/copy.ts"), "utf8")).toMatch(/Pricing at launch\./);
  });

  it("all 11 brief pages exist; the AI page carries the AI disclosure; every page frame carries advice + independence notes", () => {
    expect(TA_PAGES.map((p) => p.label)).toEqual(["Home", "Product", "How it works", "Brokers", "AI", "Risk", "Pricing", "Security", "Documentation", "Status", "Log in"]);
    expect(readFileSync(pageFile("/trading-agent/ai"), "utf8")).toMatch(/<Disclosure title="AI disclosure"[^>]*>\{AI_NOTE\}/);
    const parts = readFileSync(join(WEB, "src/components/trading-agent/Parts.tsx"), "utf8");
    expect(parts).toMatch(/DISCLAIMERS\.notAdvice/);
    expect(parts).toMatch(/DISCLAIMERS\.noAffiliation/);
    expect(parts).toMatch(/DISCLAIMERS\.notAvailable/);
  });

  it("legal text is not written: Risk and Pricing show RPrC placeholders only", () => {
    expect(LEGAL_PLACEHOLDERS.map((l) => l.title)).toEqual(["Risk disclosure", "Satelink Trading AI terms"]);
    expect(readFileSync(pageFile("/trading-agent/risk"), "utf8")).toMatch(/<LegalPlaceholder \{\.\.\.LEGAL_PLACEHOLDERS\[0\]\} \/>/);
    expect(readFileSync(pageFile("/trading-agent/pricing"), "utf8")).toMatch(/<LegalPlaceholder \{\.\.\.LEGAL_PLACEHOLDERS\[1\]\} \/>/);
    expect(readFileSync(join(WEB, "src/components/trading-agent/Parts.tsx"), "utf8")).toMatch(/RPrC — this section requires professional \(legal\) review/);
  });

  it("broker and status pages read the one config (no hand-written status strings)", () => {
    for (const p of ["/trading-agent/brokers", "/trading-agent/status"]) {
      const src = readFileSync(pageFile(p), "utf8");
      expect(src, p).toMatch(/CONNECTORS/);
      expect(src, p).toMatch(/<StageBadge stage=\{c\.stage\} \/>/);
    }
  });
});
