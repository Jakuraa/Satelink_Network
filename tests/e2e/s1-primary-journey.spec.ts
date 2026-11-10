/**
 * Release A · Slice S1 — primary journey in the browser on the shared engine (local preview stack).
 *   signup → onboarding → assistant → model routing → registry plan → quote → approval → simulated
 *   execution → verification → receipt → wallet & usage → explore
 * plus: supplier failure (no charge), expired quote, tenant isolation, SimulationBadge on every money surface,
 * axe (zero serious/critical) on every page, screenshots per step at 390 / 768 / 1440 px.
 */
import { test, expect, type Page, type Browser } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const API = process.env.PREVIEW_API || "http://127.0.0.1:4500";
const SHOTS = resolve(import.meta.dirname, "..", "..", "artifacts", "screenshots", "s1");

async function shot(page: Page, project: string, name: string) {
  const dir = join(SHOTS, project);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
}

async function axe(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`), `axe on ${where}`).toEqual([]);
}

const email = (tag: string, project: string) => `${tag}.${project}.${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@example.com`;

async function signUp(page: Page, address: string, project?: string) {
  await page.goto("/signup");
  await expect(page).toHaveURL(/sign-in\?mode=signup/);
  await expect(page.getByText("Satelink AI Assistance · Preview")).toBeVisible();
  if (project) { await axe(page, "sign-up"); await shot(page, project, "01-signup"); }
  await page.getByPlaceholder("Enter your email").fill(address);
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByTestId("preview-open-link").click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

async function onboard(page: Page, project?: string) {
  await expect(page.getByTestId("onboarding-form")).toBeVisible();
  await expect(page.getByTestId("currency-note")).toContainText("USD"); // default country India → honest INR note
  if (project) { await axe(page, "onboarding"); await shot(page, project, "02-onboarding"); }
  await expect(page.getByTestId("onboarding-submit")).toBeEnabled();
  await page.getByTestId("onboarding-submit").click();
  await expect(page.getByTestId("onboarding-credit")).toHaveText("$1.00");
  await expect(page.getByTestId("onboarding-done").getByTestId("simulation-badge")).toBeVisible();
  await page.getByTestId("onboarding-continue").click();
  await expect(page).toHaveURL(/\/assistant$/);
}

async function ask(page: Page, text: string) {
  await page.locator("#assistant-input").fill(text);
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled(); // hydrated
  await page.locator("#assistant-input").press("Enter");
  return page.getByTestId("task-turn").last();
}

async function approveFromAssistant(page: Page) {
  await page.getByTestId("approve-open").last().click();
  const dialog = page.getByTestId("approve-dialog").last();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("paid by you directly to the merchant at its checkout (simulated)");
  await expect(dialog).toContainText("from Satelink credits (simulated)");
  await dialog.getByTestId("approve-confirm").click();
  await expect(page).toHaveURL(/\/tasks\/run_[0-9a-f]+$/);
}

test.describe("S1 primary journey", () => {
  test("signup → onboarding → assistant → quote → approve → execute → verify → receipt → usage → explore", async ({ page }, info) => {
    const P = info.project.name;
    await signUp(page, email("ana", P), P);
    await onboard(page, P);

    // Assistant: automatic model routing (fixture without a key) + registry-driven plan + quote
    await expect(page.getByTestId("model-badge")).toHaveText("Model: fixture (no live key)");
    await axe(page, "assistant (empty)");
    await shot(page, P, "03-assistant");
    const turn = await ask(page, "Buy a sci-fi e-book gift code under $12");
    await expect(turn.getByTestId("task-turn-state")).toHaveText("Awaiting your approval");
    await expect(turn.getByTestId("turn-model")).toContainText("fixture/");
    await expect(turn.getByTestId("plan-panel")).toContainText("Demo Digital Store (MOCK)");
    const quote = turn.getByTestId("quote-card");
    await expect(quote.getByTestId("simulation-badge").first()).toBeVisible(); // the approval dialog inside the card has its own badge
    await expect(quote.getByTestId("merchant-total")).toHaveText("$9.99");
    await expect(quote.getByTestId("credit-charge")).toHaveText("$0.999");
    await expect(quote).toContainText("PROPOSED — NOT APPROVED");
    await axe(page, "assistant (quote)");
    await shot(page, P, "04-quote");

    // Approval modal: exact action, amount, who pays whom, simulated
    await page.getByTestId("approve-open").click();
    await expect(page.getByTestId("approve-dialog")).toContainText("Sci-fi e-book gift code");
    await axe(page, "approval dialog");
    await shot(page, P, "05-approval");
    await page.getByTestId("approve-confirm").click();
    await expect(page).toHaveURL(/\/tasks\/run_[0-9a-f]+$/);

    // Live timeline → SUCCEEDED
    await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "SUCCEEDED", { timeout: 60_000 });
    await expect(page.getByTestId("timeline")).toContainText("Verifying");
    await expect(page.getByTestId("timeline")).toContainText("Succeeded");
    await expect(page.getByTestId("simulation-badge").first()).toBeVisible();
    await axe(page, "task detail");
    await shot(page, P, "06-task-succeeded");

    // Receipt: immutable, labelled, ledger-hashed; JSON + CSV downloads
    await page.getByTestId("receipt-link").click();
    await expect(page.getByTestId("receipt-label")).toHaveText("SIMULATED — NO MONEY MOVED");
    await expect(page.getByTestId("receipt-outcome")).toContainText("Completed");
    await expect(page.getByTestId("receipt-credits")).toHaveText("$0.999");
    await expect(page.getByTestId("ledger-hash")).toHaveText(/^[0-9a-f]{64}$/);
    await axe(page, "receipt");
    await shot(page, P, "07-receipt");
    const rid = page.url().split("/").pop()!;
    const json = await page.request.get(`/api/console/tasks/receipts/${rid}`);
    expect((await json.json()).receipt).toMatchObject({ simulated: true, outcome: "succeeded" });
    const csv = await page.request.get(`/api/console/tasks/receipts/${rid}?format=csv`);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("SIMULATED — NO MONEY MOVED");

    // Wallet & usage: simulated spend, promo balance, external revenue $0.00
    await page.goto("/wallet");
    await expect(page.getByTestId("sim-spend")).toHaveText("$0.999");
    await expect(page.getByTestId("promo-available")).toHaveText("$0.001");
    await expect(page.getByTestId("external-revenue")).toContainText("External revenue: $0.00 (preview)");
    await axe(page, "wallet");
    await shot(page, P, "08-wallet");

    // Tasks list + Explore (registry-driven; internal providers never shown)
    await page.goto("/tasks");
    await expect(page.getByRole("link", { name: /sci-fi e-book/i })).toBeVisible();
    await axe(page, "tasks");
    await shot(page, P, "09-tasks");
    await page.goto("/explore");
    await expect(page.getByTestId("capability-card").filter({ hasText: "Buy a digital product" })).toContainText("Simulated");
    await expect(page.getByTestId("capability-list")).not.toContainText(/eulerpool/i);
    await axe(page, "explore");
    await shot(page, P, "10-explore");
  });

  test("supplier failure → clear failure, no capture, receipt 'failed — no charge'", async ({ page }, info) => {
    const P = info.project.name;
    await signUp(page, email("fail", P));
    await onboard(page);
    const turn = await ask(page, "Buy the unavailable test voucher under $6");
    await expect(turn.getByTestId("task-turn-state")).toHaveText("Awaiting your approval");
    await approveFromAssistant(page);
    await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "FAILED", { timeout: 60_000 });
    await expect(page.getByTestId("task-error")).toContainText("Nothing was charged");
    await page.getByTestId("receipt-link").click();
    await expect(page.getByTestId("receipt-outcome")).toContainText("Failed — no charge");
    await expect(page.getByTestId("receipt-credits")).toHaveText("$0.00");
    await axe(page, "failed receipt");
    await shot(page, P, "11-failed-receipt");
    await page.goto("/wallet");
    await expect(page.getByTestId("promo-available")).toHaveText("$1.00");
  });

  test("expired quote → approval refused, task Expired", async ({ page }, info) => {
    const P = info.project.name;
    await signUp(page, email("late", P));
    await onboard(page);
    const turn = await ask(page, "Buy a cookbook e-book gift code under $8");
    await expect(turn.getByTestId("task-turn-state")).toHaveText("Awaiting your approval");
    const taskUrl = await turn.getByRole("link", { name: "Open task" }).getAttribute("href");
    await page.goto(taskUrl!);
    const ttl = Number(process.env.PREVIEW_QUOTE_TTL_MS || 25_000);
    await page.waitForTimeout(ttl + 1_500);
    await expect(page.getByText("This quote has expired.")).toBeVisible();
    // Cannot approve: the button is disabled (client timer) or gone (server sweep already expired the task).
    const approve = page.getByTestId("approve-open");
    if (await approve.count()) await expect(approve).toBeDisabled();
    // The server refuses too (the UI is not the control): approving the stale quote expires the task.
    const id = taskUrl!.split("/").pop()!;
    const t = await (await page.request.get(`/api/console/tasks/tasks/${id}`)).json();
    const r = await page.request.post(`/api/console/tasks/tasks/${id}/approve`, {
      headers: { Origin: new URL(page.url()).origin }, data: { quote_id: t.task.quote.quote_id, quote_version: t.task.quote.version },
    });
    expect(r.status()).toBe(409);
    expect((await r.json()).error.code).toBe("QUOTE_EXPIRED");
    await page.reload();
    await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "EXPIRED");
    await shot(page, P, "12-expired");
  });

  test("tenant isolation: another user gets 404 for my task and receipt", async ({ page, browser }, info) => {
    const P = info.project.name;
    await signUp(page, email("owner", P));
    await onboard(page);
    await ask(page, "Buy a cookbook e-book gift code under $8");
    await approveFromAssistant(page);
    await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "SUCCEEDED", { timeout: 60_000 });
    const taskUrl = page.url();
    await page.getByTestId("receipt-link").click();
    const receiptUrl = page.url();

    const other = await (browser as Browser).newContext({ viewport: page.viewportSize()! });
    const p2 = await other.newPage();
    await signUp(p2, email("intruder", P));
    for (const u of [taskUrl, receiptUrl]) {
      const res = await p2.goto(u);
      expect(res?.status(), u).toBe(404);
    }
    const api = await p2.request.get(`/api/console/tasks/tasks/${taskUrl.split("/").pop()}`);
    expect(api.status()).toBe(404);
    await other.close();
  });
});

test("preview API is local and simulated (sanity)", async ({ request }) => {
  const h = await (await request.get(`${API}/health`)).json();
  expect(h).toMatchObject({ preview: true, simulated: true });
});
