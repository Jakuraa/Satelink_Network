/**
 * Release A · Slice S6 — machine commerce over the x402 V2 PREVIEW. The owner creates a key; the scripted machine
 * client (scripts/preview/x402-machine-client.mjs) gets 402 + PAYMENT-REQUIRED, pays with a MOCK-signed
 * PAYMENT-SIGNATURE (local mock facilitator, never /settle), receives PAYMENT-RESPONSE + receipt; the receipt is
 * visible in the owner's usage. A keyless machine run is checked too.
 */
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");
const SHOTS = join(ROOT, "artifacts", "screenshots", "s6");
const API = process.env.PREVIEW_API_URL || "http://127.0.0.1:4500";
const FACILITATOR = process.env.MOCK_FACILITATOR_URL || "http://127.0.0.1:4440";
async function shot(page: Page, project: string, name: string) { const d = join(SHOTS, project); mkdirSync(d, { recursive: true }); await page.screenshot({ path: join(d, `${name}.png`), fullPage: true }); }
async function axe(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`), `axe on ${where}`).toEqual([]);
}
async function signUpAndOnboard(page: Page) {
  await page.goto("/signup");
  await page.getByPlaceholder("Enter your email").fill(`machine.${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@example.com`);
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByTestId("preview-open-link").click();
  await expect(page.getByTestId("onboarding-submit")).toBeEnabled();
  await page.getByTestId("onboarding-submit").click();
  await page.getByTestId("onboarding-continue").click();
}
const machine = (args: string[]) => execFileSync(process.execPath, [join(ROOT, "scripts", "preview", "x402-machine-client.mjs"), "--api", API, ...args], { encoding: "utf8", timeout: 60_000 });

test("S6: machine pays via x402 preview (402 → mock-signed payment → PAYMENT-RESPONSE) → receipt visible in usage", async ({ page }, info) => {
  const P = info.project.name;
  const hydration: string[] = [];
  page.on("pageerror", (e) => { if (/hydrat/i.test(e.message)) hydration.push(`${page.url()}: ${e.message.slice(0, 160)}`); });
  await signUpAndOnboard(page);
  await page.goto("/developer-hub");
  await page.getByTestId("key-name").fill("x402-machine");
  await page.getByTestId("scope-tasks:approve").uncheck();
  await expect(page.getByTestId("create-key")).toBeEnabled();
  await page.getByTestId("create-key").click();
  const secret = (await page.getByTestId("secret-value").textContent())!.trim();

  const out = machine(["--key", secret, "--capability", "dev.data.extract", "--q", `Extract the contacts from: machine-${P}@example.com due 2026-12-31`]);
  expect(out).toMatch(/402 PAYMENT-REQUIRED: x402v2 exact on eip155:84532/);
  expect(out).toContain("simulated=true");
  expect(out).toMatch(/200 PAYMENT-RESPONSE: success=true transaction="" settled=false \(SIMULATED — NO MONEY MOVED\)/);
  const m = /X402_OK (run_[0-9a-f]+) (rcpt_[0-9a-f]+)/.exec(out);
  expect(m, out).not.toBeNull();
  const [, runId, receiptId] = m!;

  await page.goto("/wallet");
  await expect(page.locator(`a[href="/receipts/${receiptId}"]`)).toBeVisible();
  await expect(page.getByTestId("external-revenue")).toContainText("$0.00");
  await shot(page, P, "01-usage-with-x402-receipt");
  await page.goto(`/receipts/${receiptId}`);
  await expect(page.getByTestId("receipt-label")).toHaveText("SIMULATED — NO MONEY MOVED");
  await expect(page.getByTestId("receipt-payment")).toContainText("x402 preview · eip155:84532");
  await expect(page.getByTestId("receipt-payment")).toContainText("x402 Facilitator (MOCK, local)");
  await expect(page.getByTestId("receipt-payment")).toContainText("no /settle call");
  await axe(page, "x402 receipt");
  await shot(page, P, "02-x402-receipt");
  await page.goto(`/tasks/${runId}`);
  await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "SUCCEEDED");
  await expect(page.getByTestId("output-emails")).toHaveText(`machine-${P}@example.com`);
  await shot(page, P, "03-task");
  expect(hydration, "hydration errors in the S6 journey").toEqual([]);

  // Keyless machine: same flow, no account at all.
  expect(machine(["--capability", "dev.data.extract", "--q", "Extract the emails from: keyless@example.com"])).toMatch(/X402_OK run_[0-9a-f]+ rcpt_[0-9a-f]+/);
  // The mock facilitator only ever saw /verify — nothing was settled.
  const log = (await (await fetch(`${FACILITATOR}/requests`)).json()) as { requests: string[] };
  expect(log.requests.length).toBeGreaterThan(0);
  expect(log.requests.every((r) => r === "POST /verify")).toBe(true);
});
