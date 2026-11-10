/**
 * Release A · P5 — the websites match the preview. Runs against local builds of satelink.network and jakuraa.com
 * (never production): internal link check, axe on the key pages, preview labelling, machine-readable surfaces, no
 * horizontal overflow. PR only; nothing here deploys.
 */
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const WEB = process.env.P5_WEB_URL || "http://localhost:3000";
const CORP = process.env.P5_CORP_URL || "http://localhost:3100";

/** Scroll through the page so reveal-on-scroll content is shown, then let every animation finish. */
async function settle(page: Page) {
  await page.evaluate("(async()=>{const h=document.documentElement.scrollHeight;for(let y=0;y<h;y+=600){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60))}window.scrollTo(0,0)})()");
  await page.waitForTimeout(2000); // fixed wait: pulse effects are infinite, so awaiting getAnimations() would hang
}
async function axe(page: Page, where: string) {
  await settle(page);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`), `axe on ${where}`).toEqual([]);
}
async function noOverflow(page: Page, where: string) {
  const o = await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth");
  expect(o as number, `horizontal overflow on ${where}`).toBeLessThanOrEqual(1);
}
/** Every same-origin link on a page must answer 2xx/3xx. External links are not fetched (never touches third parties). */
async function linkCheck(page: Page, origin: string, url: string) {
  await page.goto(url);
  const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => (a as unknown as { href: string }).href));
  const internal = [...new Set(hrefs.filter((h) => h.startsWith(origin)).map((h) => h.split("#")[0]))];
  expect(internal.length, `links on ${url}`).toBeGreaterThan(0);
  const bad: string[] = [];
  for (const h of internal) { const s = (await page.request.get(h, { maxRedirects: 5 })).status(); if (s >= 400) bad.push(`${s} ${h}`); }
  expect(bad, `broken links on ${url}`).toEqual([]);
  expect(hrefs.filter((h) => /app\.satelink\.network/.test(h)), "dead domain").toEqual([]);
}

// Measure final colours: scroll-reveal animations otherwise leave elements mid-fade during the axe scan.
test.use({ contextOptions: { reducedMotion: "reduce" } });

test("satelink.network: positioning, preview labels, real screenshots, machine-readable surfaces", async ({ page, request }) => {
  test.setTimeout(240_000);
  await page.goto(`${WEB}/`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Describe the outcome");
  await expect(page.getByTestId("home-status")).toContainText("Preview — simulated, no charges.");
  await expect(page.locator("body")).not.toContainText("Trading Intelligence");
  await noOverflow(page, "home"); await axe(page, "home");

  await page.goto(`${WEB}/preview`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Preview — simulated, no charges.");
  await expect(page.getByTestId("preview-status")).toContainText("SIMULATED — NO MONEY MOVED");
  await expect(page.getByTestId("preview-status")).toContainText("Local preview only");
  const imgs = page.getByTestId("journeys").locator("img");
  await expect(imgs).toHaveCount(6);
  for (let i = 0; i < 6; i++) { await imgs.nth(i).scrollIntoViewIfNeeded(); await expect.poll(() => imgs.nth(i).evaluate((e) => (e as unknown as { naturalWidth: number }).naturalWidth), { timeout: 15_000 }).toBeGreaterThan(0); }
  await noOverflow(page, "preview"); await axe(page, "preview");
  expect(await page.locator('script[type="application/ld+json"]').count()).toBeGreaterThan(0);

  const caps = await (await request.get(`${WEB}/.well-known/satelink-capabilities.json`)).json();
  expect(caps).toMatchObject({ simulated: true, fees_status: "PROPOSED — NOT APPROVED" });
  await expect(page.getByTestId("capabilities").locator("li")).toHaveCount(caps.capabilities.length);
  const llms = await (await request.get(`${WEB}/llms.txt`)).text();
  expect(llms).toContain("## Satelink AI Assistance (preview)");
  for (const c of caps.capabilities) expect(llms).toContain(c.id);
  expect(await (await request.get(`${WEB}/sitemap.xml`)).text()).toContain("/preview");

  await linkCheck(page, WEB, `${WEB}/`);
  await linkCheck(page, WEB, `${WEB}/preview`);
});

test("jakuraa.com: company identity, Satelink as the product, contact and legal pages", async ({ page, request }) => {
  test.setTimeout(240_000);
  await page.goto(`${CORP}/`);
  await expect(page.locator("body")).toContainText("Satelink");
  await expect(page.locator("body")).toContainText("PREVIEW — SIMULATED, NO CHARGES");
  await expect(page.locator("body")).toContainText("U52190TZ2019PTC033093");
  await expect(page.locator("body")).not.toContainText("cryptographic certainty");
  await noOverflow(page, "corporate home"); await axe(page, "corporate home");
  for (const p of ["/contact", "/legal", "/legal/privacy", "/legal/terms", "/legal/company-information", "/legal/grievance"]) {
    const r = await page.goto(`${CORP}${p}`);
    expect(r?.status(), p).toBe(200);
    await noOverflow(page, p);
  }
  await page.goto(`${CORP}/legal/company-information`); await axe(page, "company information");
  expect(await (await request.get(`${CORP}/llms.txt`)).text()).toContain("Satelink AI Assistance is in a local preview");
  await linkCheck(page, CORP, `${CORP}/`);
});
