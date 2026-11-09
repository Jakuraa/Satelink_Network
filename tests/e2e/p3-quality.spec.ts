/**
 * Release A · P3 — product quality pass. Every main preview page at 390/768/1440: renders (no 404), has its heading,
 * is axe-clean (serious/critical), has no horizontal overflow and no hydration error. Plus the approved navigation
 * order, six-domain suggestions, and the Home pending-approvals widget with a real task.
 */
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const SHOTS = resolve(import.meta.dirname, "..", "..", "artifacts", "screenshots", "p3");
const PAGES: [string, string][] = [
  ["/home", "Home"], ["/assistant", "Assistant"], ["/tasks", "My tasks"], ["/explore", "Explore"],
  ["/agent-marketplace", "Agent Marketplace"], ["/trading-ai", "Trading AI"], ["/connections", "Connections"],
  ["/wallet", "Wallet"], ["/developer-hub", "Developer & Agent Hub"], ["/activity", "Activity & Security"], ["/settings", "Settings"],
];
const NAV = ["Home", "Assistant", "My Tasks", "Explore", "Agent Marketplace", "Trading AI", "Connections", "Wallet & Usage", "Developer & Agent Hub", "Activity & Security", "Settings"];

async function signUpAndOnboard(page: Page) {
  await page.goto("/signup");
  await page.getByPlaceholder("Enter your email").fill(`p3.${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@example.com`);
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByTestId("preview-open-link").click();
  await expect(page.getByTestId("onboarding-submit")).toBeEnabled();
  await page.getByTestId("onboarding-submit").click();
  await page.getByTestId("onboarding-continue").click();
}

test("P3: navigation, six-domain suggestions, pending approvals on Home, and every main page clean at this viewport", async ({ page }, info) => {
  test.setTimeout(240_000);
  const P = info.project.name;
  const hydration: string[] = [];
  page.on("pageerror", (e) => { if (/hydrat/i.test(e.message)) hydration.push(`${page.url()}: ${e.message.slice(0, 160)}`); });
  await signUpAndOnboard(page);

  // Six-domain suggestions; a suggestion pre-fills the assistant (never auto-sends).
  await page.goto("/home");
  await expect(page.getByTestId("suggested-tasks").getByRole("link")).toHaveCount(6);
  await expect(page.getByTestId("pending-empty")).toBeVisible();
  await page.getByTestId("suggested-tasks").getByRole("link", { name: /Shopping/ }).click();
  await expect(page.locator("#assistant-input")).toHaveValue("Buy a sci-fi e-book gift code under $12");
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
  await page.locator("#assistant-input").press("Enter");
  await expect(page.getByTestId("approve-open").last()).toBeVisible({ timeout: 30_000 });
  await page.goto("/home");
  await expect(page.getByTestId("pending-approvals")).toContainText("Buy a sci-fi e-book gift code under $12");

  // Every task-type suggestion must really start its journey from the chat (not fall back to small talk).
  for (const [domain, next] of [["Food", "connect-food_delivery_mock"], ["Trading AI", "approve-open"], ["Developer APIs", "approve-open"]] as const) {
    await page.goto("/home");
    await page.getByTestId("suggested-tasks").getByRole("link", { name: new RegExp(domain) }).click();
    await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
    await page.locator("#assistant-input").press("Enter");
    await expect(page.getByTestId(next).last(), `${domain} suggestion`).toBeVisible({ timeout: 30_000 });
  }

  // Approved navigation order (desktop sidebar; on small screens it lives in the drawer).
  if (P === "desktop-1440") {
    const labels = await page.locator('aside nav a').allInnerTexts();
    expect(labels.slice(0, NAV.length).map((l) => l.replace(/\s*g [a-z]$/, "").trim())).toEqual(NAV);
  }

  for (const [path, heading] of PAGES) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: heading }), path).toBeVisible();
    await page.waitForLoadState("networkidle").catch(() => {});
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} horizontal overflow at ${P}`).toBeLessThanOrEqual(1);
    const a = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(a.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`), `axe on ${path} at ${P}`).toEqual([]);
    const d = join(SHOTS, P); mkdirSync(d, { recursive: true });
    await page.screenshot({ path: join(d, `${path.slice(1).replace(/\//g, "_")}.png`), fullPage: true });
  }
  await page.goto("/agent-marketplace");
  await expect(page.getByTestId("coming-soon")).toContainText("Not available in this preview");
  expect(hydration, "hydration errors").toEqual([]);
});
