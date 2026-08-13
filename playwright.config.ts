import { defineConfig, devices } from "@playwright/test";

export const JOURNEY_RESULTS_DIR = ".ops/journey-results";
export const JOURNEY_EVIDENCE_DIR = ".ops/journey-evidence";

export default defineConfig({
  testDir: "tests/journeys",
  // Serial until per-tenant isolation is proven against Keycloak realm write contention.
  workers: 1,
  fullyParallel: false,
  // A journey is long by construction: signup, Keycloak hops, a dozen steps.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: ".ops/playwright-report" }],
    ["json", { outputFile: `${JOURNEY_RESULTS_DIR}/playwright.json` }]
  ],
  use: {
    // journey.step screenshots explicitly on success; Playwright's automatic
    // failure screenshots would muddle the curated evidence set.
    screenshot: "off",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000
  },
  projects: [
    { name: "applicant-arc", use: { ...devices["Desktop Chrome"] }, testMatch: /(applicant-arc|smoke)\.spec\.ts/ },
    { name: "docs-only", use: { ...devices["Desktop Chrome"] }, testMatch: /docs-only\.spec\.ts/ }
  ]
});
