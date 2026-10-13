import { test, expect, type Page } from "@playwright/test";

// /api/financial/truth is admin-only (2026-10-13). The public pages read
// /api/public/stats. Backend calls are stubbed: truth answers 401 exactly as
// production does without an admin token.
const STATS = {
  ok: true,
  generated_at: "2026-10-13T00:00:00.000Z",
  nodes_online: 7,
  uptime_pct_24h: 99.5,
  api_uptime_seconds: 1234,
  requests_24h: 123456,
};

async function stubApi(page: Page): Promise<string[]> {
  const truthCalls: string[] = [];
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/financial/truth")) {
      truthCalls.push(url);
      return route.fulfill({ status: 401, json: { ok: false, error: "Unauthorized" } });
    }
    if (url.includes("/api/public/stats")) return route.fulfill({ status: 200, json: STATS });
    return route.fulfill({ status: 404, json: { ok: false } });
  });
  return truthCalls;
}

test("/node renders from public stats and never calls /api/financial/truth", async ({ page }) => {
  const truthCalls = await stubApi(page);
  const res = await page.goto("/node?view=earnings");
  expect(res?.status()).toBe(200);
  await expect(page.getByText("7 nodes online network-wide.", { exact: false })).toBeVisible();
  expect(truthCalls).toEqual([]);
});

test("/machine-console renders from public stats and never calls /api/financial/truth", async ({ page }) => {
  const truthCalls = await stubApi(page);
  const res = await page.goto("/machine-console?view=consumption");
  expect(res?.status()).toBe(200);
  await expect(page.getByText("Requests (24h)")).toBeVisible();
  await expect(page.getByText((123456).toLocaleString("en-US"))).toBeVisible();
  expect(truthCalls).toEqual([]);
});

test("mission-control: public panels from public stats, financial panels admin only", async ({ page }) => {
  await stubApi(page);
  const res = await page.goto("/satelink/os/mission-control");
  expect(res?.status()).toBe(200);
  await expect(page.getByText("123.5K")).toBeVisible();
  await expect(page.getByText("admin only").first()).toBeVisible();
});
