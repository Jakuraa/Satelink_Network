/**
 * Release A · Slice S5 — AI agent commerce. The owner creates an agent key (no approve scope) in the Developer Hub;
 * an agent (official MCP SDK client → satelink-mcp stdio) discovers, quotes and requests approval; the owner approves
 * in the console; the agent fetches the receipt. Also: the A2A Agent Card is served from the registry.
 */
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { connectAgent } from "../agents/mcp-client.e2e";

const ROOT = resolve(import.meta.dirname, "..", "..");
const SHOTS = join(ROOT, "artifacts", "screenshots", "s5");
const API = process.env.PREVIEW_API_URL || "http://127.0.0.1:4500";
async function shot(page: Page, project: string, name: string) { const d = join(SHOTS, project); mkdirSync(d, { recursive: true }); await page.screenshot({ path: join(d, `${name}.png`), fullPage: true }); }
async function axe(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`), `axe on ${where}`).toEqual([]);
}
async function signUpAndOnboard(page: Page) {
  await page.goto("/signup");
  await page.getByPlaceholder("Enter your email").fill(`agent.${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@example.com`);
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByTestId("preview-open-link").click();
  await expect(page.getByTestId("onboarding-submit")).toBeEnabled();
  await page.getByTestId("onboarding-submit").click();
  await page.getByTestId("onboarding-continue").click();
}

test("S5: MCP agent discovers → quotes → requests approval; the person approves in the console; the agent gets the receipt", async ({ page }, info) => {
  const P = info.project.name;
  const hydration: string[] = [];
  page.on("pageerror", (e) => { if (/hydrat/i.test(e.message)) hydration.push(`${page.url()}: ${e.message.slice(0, 160)}`); });
  await signUpAndOnboard(page);

  // The owner mints an agent key WITHOUT tasks:approve (and the API enforces $0 agent pre-authorization regardless).
  await page.goto("/developer-hub");
  await page.getByTestId("key-name").fill("my-agent");
  await page.getByTestId("scope-tasks:approve").uncheck();
  await page.getByTestId("scope-usage:read").uncheck();
  await expect(page.getByTestId("create-key")).toBeEnabled();
  await page.getByTestId("create-key").click();
  const secret = (await page.getByTestId("secret-value").textContent())!.trim();

  const agent = await connectAgent({ apiBase: API, apiKey: secret });
  try {
    expect(agent.client.getServerVersion()).toMatchObject({ name: "satelink-mcp" });
    const tools = await agent.tools();
    for (const t of ["satelink_discover", "satelink_quote", "satelink_request_approval", "satelink_task_status", "satelink_receipt"]) expect(tools).toContain(t);
    expect(tools.some((t: string) => /approve$/.test(t) && t !== "satelink_request_approval")).toBe(false);

    const found = await agent.call("satelink_discover", { query: "extract emails" });
    expect(found.data.capabilities[0].id).toBe("dev.data.extract");
    const quote = await agent.call("satelink_quote", { capability_id: "dev.data.extract", request: "Extract the contacts from: agent-buyer@example.com, due 2026-12-24" });
    expect(quote.isError, JSON.stringify(quote.data)).toBe(false);
    expect(quote.data).toMatchObject({ state: "AWAITING_APPROVAL", simulation_label: "SIMULATED — NO MONEY MOVED" });
    const taskId: string = quote.data.task_id;
    const asked = await agent.call("satelink_request_approval", { task_id: taskId, note: "Needed for the CRM import" });
    expect(asked.data.approve_in_console).toBe(`http://localhost:3400/tasks/${taskId}`);
    expect((await agent.call("satelink_receipt", { task_id: taskId })).isError).toBe(true); // nothing to show before approval

    // The person approves in the console.
    await page.goto(`/tasks/${taskId}`);
    await expect(page.getByTestId("agent-approval-request")).toContainText("An agent (MCP) asked you to approve this");
    await expect(page.getByTestId("timeline")).toContainText("Approval requested by an agent (MCP)");
    await axe(page, "agent approval request");
    await shot(page, P, "01-agent-approval-request");
    await page.getByTestId("approve-open").click();
    await page.getByTestId("approve-confirm").click();
    await expect(page.getByTestId("task-state")).toHaveAttribute("data-state", "SUCCEEDED", { timeout: 60_000 });
    await expect(page.getByTestId("output-emails")).toHaveText("agent-buyer@example.com");
    await shot(page, P, "02-approved-result");

    // The agent sees the outcome and fetches the receipt.
    expect((await agent.call("satelink_task_status", { task_id: taskId })).data.state).toBe("SUCCEEDED");
    const receipt = await agent.call("satelink_receipt", { task_id: taskId });
    expect(receipt.data).toMatchObject({ outcome: "succeeded", simulation_label: "SIMULATED — NO MONEY MOVED" });
    await page.goto("/wallet");
    await expect(page.locator(`a[href="/receipts/${receipt.data.receipt_id}"]`)).toBeVisible();
    expect(hydration, "hydration errors in the S5 journey").toEqual([]);
  } finally {
    await agent.close();
  }

  // A2A: Agent Card + capabilities JSON generated from the same registry.
  const card = (await (await fetch(`${API}/.well-known/agent-card.json`)).json()) as { supportedInterfaces: unknown[]; skills: { id: string }[] };
  expect(card.supportedInterfaces[0]).toMatchObject({ protocolBinding: "JSONRPC", protocolVersion: "1.0" });
  expect(card.skills.map((s: { id: string }) => s.id)).toContain("dev.data.extract");
  const caps = (await (await fetch(`${API}/.well-known/satelink-capabilities.json`)).json()) as { capabilities: { id: string }[] };
  expect(caps.capabilities.map((c: { id: string }) => c.id).sort()).toEqual(card.skills.map((s: { id: string }) => s.id).sort());
});
