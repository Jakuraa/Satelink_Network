import { test, expect, type Page } from "@playwright/test";

// Customer workflows beta — end-to-end against the local preview
// (scripts/preview/beta-preview.sh: real console + workflows API on local Postgres).
//
//   Phase 1:  WORKFLOWS_E2E=1 PW_BASE_URL=http://localhost:3400 npx playwright test e2e/workflows-beta.spec.ts
//   restart the preview API process (runs must survive), then
//   Phase 2:  WORKFLOWS_E2E=1 E2E_PHASE=after-restart PW_BASE_URL=http://localhost:3400 npx playwright test e2e/workflows-beta.spec.ts
//
// Real data: Binance public daily klines for backtests, a public Polygon RPC for balances.
test.skip(!process.env.WORKFLOWS_E2E, "needs the workflows preview (scripts/preview/beta-preview.sh)");
test.describe.configure({ mode: "serial" });

const API = process.env.PREVIEW_API || "http://localhost:4400";
const AFTER_RESTART = process.env.E2E_PHASE === "after-restart";
const TREASURY = "0x966E1Ae22996545015b1414B35234b10719d7Ad4";
const SHOTS = process.env.E2E_SHOTS_DIR;

async function signIn(page: Page) {
  await page.goto(`${API}/preview/login`);
  await expect(page).toHaveURL(/\/strategy-lab$/);
}
// next dev compiles a page on first visit; interact only once it has hydrated.
async function ready(page: Page) {
  await page.waitForLoadState("networkidle");
}
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

test.describe("phase 1 — customer journeys", () => {
  test.skip(AFTER_RESTART, "phase 2 only");

  test("auth: signed-out visitors are sent to sign-in", async ({ page }) => {
    await page.goto("/strategy-lab");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("A1 Strategy Lab: describe → spec → walk-forward backtest → labelled scorecard → saved", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);
    await ready(page);
    await page.locator("#lab-prompt").fill("Buy bitcoin when the 20-day moving average crosses above the 50-day");
    await page.getByRole("button", { name: "Build strategy" }).click();
    await expect(page.getByRole("definition").filter({ hasText: "fastPeriod=20" })).toBeVisible();
    await page.getByRole("button", { name: "Run backtest" }).click();
    await expect(page.getByText(/Verdict: (PASS|FAIL)/)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("SIMULATED / BACKTEST — NOT ACTUAL RETURNS", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue to paper trading" })).toBeVisible();
    await shot(page, "e2e-01-scorecard");
    await page.getByRole("link", { name: "Saved strategy" }).click();
    await expect(page.getByRole("heading", { name: /Moving-average crossover · BTCUSDT/ })).toBeVisible();
    await expect(page.getByText("Backtests of this strategy")).toBeVisible();
    await shot(page, "e2e-02-saved-strategy");
  });

  test("A2 Strategy Lab: ambiguous request → clarification → spec; unsupported request → reasons", async ({ page }) => {
    await signIn(page);
    await page.locator("#lab-prompt").fill("A trend-following strategy for crypto");
    await page.getByRole("button", { name: "Build strategy" }).click();
    await expect(page.getByText("A few questions first")).toBeVisible();
    await page.getByRole("button", { name: "ETHUSDT" }).click();
    await page.getByRole("button", { name: /Breakout/ }).click();
    await expect(page.getByText("Donchian channel breakout · ETHUSDT")).toBeVisible();
    await page.locator("#lab-prompt").fill("Short BTC with 5x leverage when RSI is above 70");
    await page.getByRole("button", { name: "Build strategy" }).click();
    await expect(page.getByText("This request can't be evaluated")).toBeVisible();
    await expect(page.getByText(/Short selling is not supported/)).toBeVisible();
  });

  test("B Marketplace: compare → quote → capped purchase → approve → verified result → receipt", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page);
    await page.goto("/marketplace");
    await expect(page.getByText("Wallet balance check")).toBeVisible();
    await expect(page.getByText("Under evaluation").first()).toBeVisible();
    await page.getByRole("link", { name: /Wallet balance check/ }).click();
    await expect(page.getByRole("heading", { name: "Compare suppliers" })).toBeVisible();
    await ready(page);
    await page.getByPlaceholder("0x…").fill(TREASURY);
    await page.getByRole("button", { name: "Compare suppliers & quote" }).click();
    await expect(page.getByText("Best available: Satelink Polygon RPC")).toBeVisible();
    await page.getByRole("button", { name: "Create capped purchase" }).click();
    await page.getByRole("button", { name: "Approve & run" }).click();
    await expect(page.getByText(/Verified result from Satelink Polygon RPC/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("withheld · money moved: false")).toBeVisible();
    await shot(page, "e2e-03-purchase-receipt");
  });

  test("B Marketplace: unavailable supplier networks are blocked with reasons (nothing runs)", async ({ page }) => {
    await signIn(page);
    await page.goto("/marketplace/token.risk?network=base");
    await ready(page);
    await page.getByPlaceholder("0x…").fill("0x940181a94A35A4569E4529A3CDfB74e38FD98631");
    await page.getByRole("button", { name: "Compare suppliers & quote" }).click();
    await expect(page.getByText("No supplier can run this on base right now.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create capped purchase" })).toHaveCount(0);
  });

  test("C/D API & MCP: live RPC price, REST contract and MCP tools", async ({ page }) => {
    await signIn(page);
    await page.goto("/api-mcp");
    await expect(page.getByText(/\$0\.00003 per call/)).toBeVisible();
    await expect(page.getByRole("cell", { name: "/v1/workflows/runs/{id}/approve" })).toBeVisible();
    for (const tool of ["list_capabilities", "approve_purchase", "run_backtest"]) await expect(page.getByText(tool, { exact: true })).toBeVisible();
    await expect(page.getByText("Beta · not published")).toBeVisible();
    await shot(page, "e2e-04-api-mcp");
  });

  test("history: runs listed with their trace", async ({ page }) => {
    await signIn(page);
    await page.goto("/workflows");
    await expect(page.getByRole("link", { name: /Wallet balance check · polygon/ }).first()).toBeVisible();
    await page.getByRole("link", { name: /Wallet balance check · polygon/ }).first().click();
    await expect(page.getByText("Execution trace (hash-chained journal)")).toBeVisible();
    await expect(page.getByRole("cell", { name: "SETTLE", exact: true })).toBeVisible();
  });

  test("mobile: marketplace and run pages fit a 390px screen without horizontal page scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    for (const path of ["/marketplace", "/marketplace/wallet.balance", "/workflows", "/api-mcp"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("phase 2 — after the preview API restarted", () => {
  test.skip(!AFTER_RESTART, "phase 1 only");

  test("workflow history, receipts and saved strategies survive the restart", async ({ page }) => {
    await signIn(page);
    const health = await (await page.request.get(`${API}/health`)).json();
    expect(health.store).toBe("postgres");
    expect(health.runs).toBeGreaterThan(1);
    await page.goto("/workflows");
    await expect(page.getByRole("link", { name: /Wallet balance check · polygon/ }).first()).toBeVisible();
    await page.getByRole("link", { name: /Wallet balance check · polygon/ }).first().click();
    await expect(page.getByText("withheld · money moved: false")).toBeVisible();
    await page.goto("/strategy-lab");
    await expect(page.getByText("Your saved strategies")).toBeVisible();
    await shot(page, "e2e-05-after-restart");
  });
});
