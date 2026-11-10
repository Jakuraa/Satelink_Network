import { defineConfig, devices } from "@playwright/test";

// Release A E2E: runs against the local preview stack (bash scripts/preview/start-s1.sh with
// PREVIEW_QUOTE_TTL_MS=25000). Three viewports per the mandate: 390 / 768 / 1440 px.
export default defineConfig({
  testDir: ".",
  testMatch: /[sp]\d-.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["json", { outputFile: "../../artifacts/e2e/s1-results.json" }]],
  outputDir: "../../artifacts/e2e/test-output",
  use: { baseURL: process.env.PW_BASE_URL || "http://localhost:3400", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: true } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
