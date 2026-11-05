/**
 * S1 restart drill in the browser (driven by scripts/preview/restart-drill-browser.sh; skipped otherwise).
 * Approve in the console → task EXECUTING (the mock store holds the order open) → the harness SIGKILLs the API
 * and restarts it → the same page reaches SUCCEEDED and shows a receipt.
 */
import { test, expect } from "@playwright/test";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = process.env.RESTART_DRILL_SIGNAL_DIR || "";
test.skip(!DIR, "run via scripts/preview/restart-drill-browser.sh");

test("browser restart drill: kill -9 during EXECUTING → SUCCEEDED exactly once", async ({ page }) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Enter your email").fill(`drill.${Date.now()}@example.com`);
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByTestId("preview-open-link").click();
  await expect(page.getByTestId("onboarding-submit")).toBeEnabled();
  await page.getByTestId("onboarding-submit").click();
  await page.getByTestId("onboarding-continue").click();
  await page.locator("#assistant-input").fill("Buy a sci-fi e-book gift code under $12");
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
  await page.locator("#assistant-input").press("Enter");
  await page.getByTestId("approve-open").click();
  await page.getByTestId("approve-confirm").click();
  await expect(page).toHaveURL(/\/tasks\/run_[0-9a-f]+$/);
  await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "EXECUTING", { timeout: 20_000 });
  writeFileSync(join(DIR, "executing"), page.url().split("/").pop()!);
  await expect.poll(() => existsSync(join(DIR, "restarted")), { timeout: 60_000 }).toBe(true);
  await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "SUCCEEDED", { timeout: 60_000 });
  await expect(page.getByTestId("receipt-link")).toBeVisible();
});
