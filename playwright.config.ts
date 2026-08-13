/**
 * Playwright configuration for journey-level end-to-end tests against the running local deployment.
 *
 * Prerequisites:
 *   - `npm run local:bootstrap` completed (all containers healthy, demo data seeded).
 *   - Playwright Chromium installed (`npx playwright install chromium`); if the default
 *     browser directory is not writable, set PLAYWRIGHT_BROWSERS_PATH to a writable
 *     directory before both the install and any test run.
 *
 * Usage:
 *   npx playwright test [--project=applicant-arc|docs-only] [--grep pattern]
 *
 * Outputs:
 *   - .ops/playwright-report/ (HTML report)
 *   - .ops/journey-results/playwright.json (JSON results)
 *   - test-results/ (Playwright artifacts: traces, videos)
 */

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
    { name: "applicant-arc", use: { ...devices["Desktop Chrome"] }, testMatch: /applicant-arc\.spec\.ts/ },
    { name: "docs-only", use: { ...devices["Desktop Chrome"] }, testMatch: /docs-only\.spec\.ts/ },
    // Temporary: proves the runner works before any journey exists.
    // Removed together with tests/journeys/smoke.spec.ts in Task 8.
    { name: "smoke", use: { ...devices["Desktop Chrome"] }, testMatch: /smoke\.spec\.ts/ }
  ]
});
