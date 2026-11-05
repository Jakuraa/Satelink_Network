/**
 * Release A · P4 — browser-side adversarial checks: XSS through chat text, task titles and supplier output renders as
 * inert text; supplier output never becomes links; cross-site requests with the user's cookies are refused (CSRF).
 */
import { test, expect, type Page } from "@playwright/test";

async function signUpAndOnboard(page: Page) {
  await page.goto("/signup");
  await page.getByPlaceholder("Enter your email").fill(`p4.${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@example.com`);
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByTestId("preview-open-link").click();
  await expect(page.getByTestId("onboarding-submit")).toBeEnabled();
  await page.getByTestId("onboarding-submit").click();
  await page.getByTestId("onboarding-continue").click();
}
const xss = (page: Page) => page.evaluate(() => (window as unknown as { __xss?: number }).__xss ?? null);

test("P4: injected HTML/script in chat, titles and supplier output stays text; cross-site POST is refused", async ({ page }) => {
  test.setTimeout(180_000);
  const dialogs: string[] = [];
  page.on("dialog", (d) => { dialogs.push(d.message()); void d.dismiss(); });
  await signUpAndOnboard(page);

  const payload = `Extract the contacts from: <img src=x onerror="window.__xss=1"><script>window.__xss=2</script><svg onload=window.__xss=3> javascript:alert(1) https://evil.example/"><script>alert(1)</script> owner@example.com`;
  await page.locator("#assistant-input").fill(payload);
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
  await page.locator("#assistant-input").press("Enter");
  await expect(page.getByTestId("approve-open").last()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('<img src=x onerror="window.__xss=1">', { exact: false }).first()).toBeVisible();
  expect(await xss(page)).toBeNull();

  await page.getByTestId("approve-open").last().click();
  await page.getByTestId("approve-confirm").last().click();
  await expect(page).toHaveURL(/\/tasks\/run_[0-9a-f]+$/);
  await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "SUCCEEDED", { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("body")).toContainText("<script>window.__xss=2</script>");
  const out = page.getByTestId("task-output");
  await expect(out).toBeVisible();
  await expect(out.locator("a, script, img, svg, iframe")).toHaveCount(0); // supplier output is text only
  expect(await xss(page)).toBeNull();

  for (const path of ["/tasks", "/home", "/activity"]) { await page.goto(path); expect(await xss(page), path).toBeNull(); }
  expect(dialogs).toEqual([]);

  // CSRF: the console proxy refuses a mutation whose Origin is another site, even with the user's session cookie.
  const forged = await page.request.post("/api/console/tasks/tasks", { headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, data: { text: "Buy a sci-fi e-book gift code under $12", idempotency_key: "csrf-forged-0001" } });
  expect(forged.status()).toBe(403);
  const sameSite = await page.request.post("/api/console/tasks/tasks", { headers: { Origin: new URL(page.url()).origin, "Content-Type": "application/json" }, data: { text: "Buy a sci-fi e-book gift code under $12", idempotency_key: "csrf-legit-00001" } });
  expect(sameSite.status()).toBe(201);
});
