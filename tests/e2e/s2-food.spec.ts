/**
 * Release A · Slice S2 — food procurement over MCP in the browser (local preview stack + mock food MCP/OAuth server).
 * connect (OAuth 2.1 + PKCE consent) → quote (merchant paid at checkout; fee from credits) → approve → verified receipt;
 * Connections page shows permissions and revokes; menu prompt-injection never reaches the UI's plan/quote/receipt.
 */
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const SHOTS = resolve(import.meta.dirname, "..", "..", "artifacts", "screenshots", "s2");
async function shot(page: Page, project: string, name: string) { const d = join(SHOTS, project); mkdirSync(d, { recursive: true }); await page.screenshot({ path: join(d, `${name}.png`), fullPage: true }); }
async function axe(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `axe on ${where}`).toEqual([]);
}
const INJECTION = /IGNORE ALL PREVIOUS|dEaD|10 more items/i;

async function signUpAndOnboard(page: Page, tag: string) {
  await page.goto("/signup");
  await page.getByPlaceholder("Enter your email").fill(`${tag}.${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@example.com`);
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByTestId("preview-open-link").click();
  await expect(page.getByTestId("onboarding-submit")).toBeEnabled();
  await page.getByTestId("onboarding-submit").click();
  await page.getByTestId("onboarding-continue").click();
  await expect(page).toHaveURL(/\/assistant$/);
}

test("S2: connect food service (OAuth+PKCE) → quote → approve → verified receipt → revoke", async ({ page }, info) => {
  const P = info.project.name;
  await signUpAndOnboard(page, "food");
  await page.locator("#assistant-input").fill("Order 2 masala dosa and a filter coffee under $6");
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
  await page.locator("#assistant-input").press("Enter");
  const turn = page.getByTestId("task-turn").last();
  await expect(turn.getByTestId("connect-needed")).toContainText("Connect Food Delivery (MOCK — not connected to Swiggy)");
  await shot(page, P, "01-connect-needed");

  // OAuth 2.1 consent on the mock provider (PKCE S256; verifier never leaves the API)
  await turn.getByTestId("connect-food_delivery_mock").click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/oauth\/authorize/);
  await expect(page.getByRole("heading", { name: /Connect Food Delivery \(MOCK/ })).toBeVisible();
  await expect(page.getByText("It is not Swiggy", { exact: false })).toBeVisible();
  await shot(page, P, "02-consent");
  await page.getByRole("button", { name: "Allow (mock)" }).click();

  // Back on the task: resumes automatically and quotes
  await expect(page).toHaveURL(/\/tasks\/run_[0-9a-f]+/);
  await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "AWAITING_APPROVAL", { timeout: 30_000 });
  const quote = page.getByTestId("quote-card");
  await expect(quote.getByTestId("merchant-total")).toHaveText("$4.20");
  await expect(quote.getByTestId("credit-charge")).toHaveText("$0.42");
  await expect(page.getByTestId("plan-panel")).toContainText("Food Delivery (MOCK — not connected to Swiggy)");
  await expect(page.locator("main")).not.toContainText(INJECTION);
  await axe(page, "food quote");
  await shot(page, P, "03-quote");

  await page.getByTestId("approve-open").click();
  const dialog = page.getByTestId("approve-dialog");
  await expect(dialog).toContainText("paid by you directly to the merchant at its checkout (simulated)");
  await expect(dialog).toContainText("from Satelink credits (simulated); charged only after merchant confirmation");
  await shot(page, P, "04-approval");
  await dialog.getByTestId("approve-confirm").click();
  await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "SUCCEEDED", { timeout: 60_000 });
  await page.getByTestId("receipt-link").click();
  await expect(page.getByTestId("receipt-label")).toHaveText("SIMULATED — NO MONEY MOVED");
  await expect(page.getByTestId("receipt-credits")).toHaveText("$0.42");
  await expect(page.locator("main")).not.toContainText(INJECTION);
  await shot(page, P, "05-receipt");

  // Connections: status, permissions, revoke
  await page.goto("/connections");
  const c = page.getByTestId("connection-food_delivery_mock");
  await expect(c.getByTestId("connection-status")).toHaveText("connected");
  await expect(c).toContainText("Place simulated orders after your approval");
  await axe(page, "connections");
  await shot(page, P, "06-connections");
  await c.getByTestId("revoke-food_delivery_mock").click();
  await expect(c.getByTestId("connection-status")).toHaveText("revoked");
  await expect(page.getByText(/Zomato: not available/)).toBeVisible();
});
