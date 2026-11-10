/**
 * Release A · Slice S3 — Trading AI in the browser (synthetic recorded data; deterministic risk; paper only).
 */
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const SHOTS = resolve(import.meta.dirname, "..", "..", "artifacts", "screenshots", "s3");
async function shot(page: Page, project: string, name: string) { const d = join(SHOTS, project); mkdirSync(d, { recursive: true }); await page.screenshot({ path: join(d, `${name}.png`), fullPage: true }); }
async function axe(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`), `axe on ${where}`).toEqual([]);
}
async function signUpAndOnboard(page: Page) {
  await page.goto("/signup");
  await page.getByPlaceholder("Enter your email").fill(`trader.${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@example.com`);
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByTestId("preview-open-link").click();
  await expect(page.getByTestId("onboarding-submit")).toBeEnabled();
  await page.getByTestId("onboarding-submit").click();
  await page.getByTestId("onboarding-continue").click();
}
async function askAndApprove(page: Page, text: string) {
  await page.locator("#assistant-input").fill(text);
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
  await page.locator("#assistant-input").press("Enter");
  await page.getByTestId("approve-open").last().click();
  await page.getByTestId("approve-confirm").last().click();
  await expect(page).toHaveURL(/\/tasks\/run_[0-9a-f]+$/);
  await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "SUCCEEDED", { timeout: 60_000 });
}

test("S3: NL strategy → walk-forward scorecard → GO with trace → paper trade → simulated fill → labelled receipt + CSV", async ({ page }, info) => {
  const P = info.project.name;
  await signUpAndOnboard(page);
  await askAndApprove(page, "Backtest an ETH breakout strategy, 20 day channel");
  const res = page.getByTestId("trading-result");
  await expect(res.getByTestId("risk-decision")).toHaveText("GO");
  await expect(res.getByTestId("risk-trace")).toContainText("L1 no look-ahead leakage");
  await expect(res.getByTestId("trading-label")).toContainText("SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS");
  await expect(res.getByTestId("trading-label")).toContainText("not investment advice");
  await expect(res.getByTestId("dataset-label")).toContainText("SYNTHETIC RECORDED DATASET");
  await axe(page, "evaluation result");
  await shot(page, P, "01-evaluation-go");

  await res.getByTestId("paper-trade").click();
  await expect(page).toHaveURL(/\/tasks\/run_[0-9a-f]+$/);
  await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "AWAITING_APPROVAL", { timeout: 30_000 });
  await expect(page.getByTestId("credit-charge")).toHaveText("$0.05");
  await shot(page, P, "02-paper-quote");
  await page.getByTestId("approve-open").click();
  await page.getByTestId("approve-confirm").click();
  await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "SUCCEEDED", { timeout: 60_000 });
  await expect(page.getByTestId("paper-fill")).toContainText("InternalPaperBroker");
  await expect(page.getByTestId("paper-fill").getByTestId("trading-label")).toBeVisible();
  await shot(page, P, "03-paper-fill");
  await page.getByTestId("receipt-link").click();
  await expect(page.getByTestId("receipt-trading-label")).toContainText("SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS");
  const rid = page.url().split("/").pop();
  const csv = await (await page.request.get(`/api/console/tasks/receipts/${rid}?format=csv`)).text();
  expect(csv).toContain("SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS");
  await shot(page, P, "04-receipt");
});

test("S3: a strategy that fails out of sample is WAIT — no paper trading offered", async ({ page }, info) => {
  await signUpAndOnboard(page);
  await askAndApprove(page, "Backtest BTC 10/30 moving average crossover");
  await expect(page.getByTestId("risk-decision")).toHaveText("WAIT");
  await expect(page.getByTestId("risk-trace")).toContainText("R1 walk-forward verdict PASS");
  await expect(page.getByTestId("paper-trade")).toHaveCount(0);
  await shot(page, info.project.name, "05-evaluation-wait");
});
