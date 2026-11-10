/**
 * Release A · Slice S4 — developer service procurement: key created in the Developer Hub UI, the curl script
 * (tests/dev/procure.sh) run with it, the receipt and key usage visible back in the console, then revoked.
 */
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");
const SHOTS = join(ROOT, "artifacts", "screenshots", "s4");
const API = process.env.PREVIEW_API_URL || "http://127.0.0.1:4500";
async function shot(page: Page, project: string, name: string) { const d = join(SHOTS, project); mkdirSync(d, { recursive: true }); await page.screenshot({ path: join(d, `${name}.png`), fullPage: true }); }
async function axe(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`), `axe on ${where}`).toEqual([]);
}
async function signUpAndOnboard(page: Page) {
  await page.goto("/signup");
  await page.getByPlaceholder("Enter your email").fill(`dev.${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@example.com`);
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByTestId("preview-open-link").click();
  await expect(page.getByTestId("onboarding-submit")).toBeEnabled();
  await page.getByTestId("onboarding-submit").click();
  await page.getByTestId("onboarding-continue").click();
}
const procure = (key: string, run: string) => execFileSync("bash", [join(ROOT, "tests", "dev", "procure.sh")], {
  env: { ...process.env, SATELINK_API_KEY: key, API, PROCURE_RUN_ID: run }, encoding: "utf8", timeout: 60_000,
});

test("S4: create a scoped key in the UI → curl procure script → receipt + key usage visible → revoke blocks the key", async ({ page }, info) => {
  const P = info.project.name;
  const hydration: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && /hydrat/i.test(m.text())) hydration.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => { if (/hydrat/i.test(e.message)) hydration.push(`${page.url()}: ${e.message.slice(0, 160)}`); });
  await signUpAndOnboard(page);
  await page.goto("/developer-hub");
  await expect(page.getByRole("heading", { name: "Developer & Agent Hub" })).toBeVisible();
  await expect(page.getByTestId("keys-empty")).toBeVisible();
  await axe(page, "developer hub (empty)");

  await page.getByTestId("key-name").fill("ci-script");
  await expect(page.getByTestId("create-key")).toBeEnabled();
  await page.getByTestId("create-key").click();
  const secret = (await page.getByTestId("secret-value").textContent())!.trim();
  expect(secret).toMatch(/^slk_preview_/);
  await expect(page.getByTestId("key-ci-script").getByTestId("key-status")).toHaveText("active");
  await shot(page, P, "01-key-created");

  // Shown once: a reload never shows the secret again.
  await page.reload();
  await expect(page.getByTestId("new-key-secret")).toHaveCount(0);
  await expect(page.getByTestId("key-ci-script").getByTestId("key-last-used")).toHaveText("never");
  await expect(page.locator("body")).not.toContainText(secret.slice(16));

  const out = procure(secret, `${P}-${Date.now()}`);
  const m = /PROCURE_OK (run_[0-9a-f]+) (rcpt_[0-9a-f]+)/.exec(out);
  expect(m, out).not.toBeNull();
  const [, runId, receiptId] = m!;
  expect(out).toContain("replay → changed=false");
  expect(out).toContain("SIMULATED — NO MONEY MOVED");

  await page.reload();
  const row = page.getByTestId("key-ci-script");
  await expect(row.getByTestId("key-last-used")).not.toHaveText("never");
  expect(Number(await row.getByTestId("key-requests-total").textContent())).toBeGreaterThanOrEqual(6);
  await shot(page, P, "02-key-usage");
  expect(hydration, "hydration errors on the Developer Hub").toEqual([]);

  // Receipt visible in usage; result visible on the task.
  await page.goto("/wallet");
  await expect(page.locator(`a[href="/receipts/${receiptId}"]`)).toBeVisible();
  await expect(page.getByTestId("external-revenue")).toContainText("$0.00");
  await page.goto(`/tasks/${runId}`);
  await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "SUCCEEDED");
  await expect(page.getByTestId("output-emails")).toHaveText("billing@example.com");
  await axe(page, "task with supplier output");
  await shot(page, P, "03-task-output");
  await page.goto(`/receipts/${receiptId}`);
  await expect(page.locator("body")).toContainText("SIMULATED — NO MONEY MOVED");

  // Revoke → the same key is refused.
  await page.goto("/developer-hub");
  await page.getByTestId("revoke-key-ci-script").click();
  await expect(page.getByTestId("key-ci-script").getByTestId("key-status")).toHaveText("revoked");
  const after = await fetch(`${API}/v1/tasks`, { headers: { authorization: `Bearer ${secret}` } });
  expect(after.status).toBe(401);
  await shot(page, P, "04-key-revoked");
  expect(hydration, "hydration errors anywhere in the S4 journey").toEqual([]);
});
