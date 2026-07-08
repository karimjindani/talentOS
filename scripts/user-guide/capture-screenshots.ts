/**
 * Captures the User Guide screenshots against the running local Docker deployment.
 *
 * Prerequisites:
 *   - `npm run local:bootstrap` completed (all containers healthy, demo data seeded).
 *   - Playwright Chromium installed (`npx playwright install chromium`); if the default
 *     browser directory is not writable, set PLAYWRIGHT_BROWSERS_PATH to a writable
 *     directory before both the install and this script.
 *
 * Usage:
 *   npx tsx scripts/user-guide/capture-screenshots.ts [section ...]
 *   Sections: public, apply, dashboard, admin, ops (default: all)
 *
 * Output: docs/user-guide/screenshots/*.png (referenced by docs/user-guide/User_Guide.md)
 */
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("docs/user-guide/screenshots");
const VIEWPORT = { width: 1440, height: 900 };

const URLS = {
  applicant: "http://lvh.me:3100",
  tenantApplicant: "http://demo.lvh.me:3100",
  admin: "http://lvh.me:3200",
  tenantAdmin: "http://demo.lvh.me:3200",
  ops: "http://127.0.0.1:3300"
};

const USERS = {
  accepted: { username: "accepted@demo.talentos.local", password: "ChangeMe123!" },
  orgAdmin: { username: "orgadmin@demo.talentos.local", password: "ChangeMe123!" }
};

// A minimal but valid single-page PDF, used as the CV upload in the apply flow.
const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n"
);

let keycloakCaptured = false;
const captured: string[] = [];
const skipped: string[] = [];

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  // Give client components (branding, dashboards) a beat to hydrate.
  await page.waitForTimeout(750);
}

async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true });
  captured.push(name);
  console.log(`captured ${name} (${page.url()})`);
}

/**
 * Drives whatever login hop the current page shows (portal "Sign in with Keycloak"
 * button or the Keycloak credential form) until the page is neither of those.
 */
async function completeLogin(page: Page, username: string, password: string) {
  for (let step = 0; step < 15; step++) {
    await settle(page);

    const keycloakForm = page.locator("#kc-form-login");
    if (await keycloakForm.count()) {
      if (!keycloakCaptured) {
        keycloakCaptured = true;
        await shot(page, "03-keycloak-signin.png");
      }
      await page.fill("#username", username);
      await page.fill("#password", password);
      await page.click("#kc-login");
      continue;
    }

    const signInButton = page.locator('button:has-text("Sign in with Keycloak")');
    if (await signInButton.count()) {
      await signInButton.first().click();
      continue;
    }

    return; // authenticated (or the target page needed no login)
  }
  throw new Error(`Login flow did not converge for ${username} at ${page.url()}`);
}

async function goTo(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
}

/** Finds the first same-app detail link matching `hrefPart` and returns its absolute URL. */
async function firstDetailLink(page: Page, hrefPart: string): Promise<string | null> {
  const links = page.locator(`a[href*="${hrefPart}"]`);
  const count = await links.count();
  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute("href");
    if (!href) continue;
    const absolute = new URL(href, page.url());
    const tail = absolute.pathname.split(hrefPart)[1] ?? "";
    if (tail && tail !== "/" && !tail.startsWith("new")) return absolute.toString();
  }
  return null;
}

async function optionalShot(page: Page, url: string | null, name: string, what: string) {
  if (!url) {
    skipped.push(`${name} — no ${what} link found`);
    console.warn(`skipped ${name}: no ${what} link found`);
    return;
  }
  await goTo(page, url);
  await shot(page, name);
}

async function withContext(browser: Browser, fn: (context: BrowserContext, page: Page) => Promise<void>) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  try {
    await fn(context, page);
  } finally {
    await context.close();
  }
}

const requestedSections = process.argv.slice(2).map((arg) => arg.toLowerCase());
function sectionEnabled(name: string) {
  return requestedSections.length === 0 || requestedSections.includes(name);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  // --- Anonymous: public landing and login pages -------------------------------------------
  if (sectionEnabled("public")) {
    await withContext(browser, async (_context, page) => {
      await goTo(page, `${URLS.tenantApplicant}/`);
      await shot(page, "01-applicant-home.png");
      await goTo(page, `${URLS.applicant}/login`);
      await shot(page, "02-applicant-login.png");
    });
  }

  // --- New applicant: self-register, apply and track the application -----------------------
  // Existing tenant members are redirected away from /apply, so this flow registers a fresh
  // Keycloak account each run — the same journey a real applicant takes.
  if (sectionEnabled("apply")) {
    await withContext(browser, async (_context, page) => {
      const stamp = Date.now().toString(36);
      const email = `guide.applicant.${stamp}@demo.talentos.local`;

      await goTo(page, `${URLS.applicant}/login`);
      await settle(page);
      await page.click('button:has-text("Create account")');
      // Depending on Keycloak's handling of prompt=create this lands either directly on the
      // registration form or on the login form, which links to it via "Register".
      await page.waitForSelector('input[name="email"], a:has-text("Register")', { timeout: 20000 });
      if (!(await page.locator('input[name="email"]').count())) {
        await page.click('a:has-text("Register")');
        await page.waitForSelector('input[name="email"]', { timeout: 20000 });
      }
      await shot(page, "03b-keycloak-register.png");

      const fillIfPresent = async (selector: string, value: string) => {
        if (await page.locator(selector).count()) await page.fill(selector, value);
      };
      await fillIfPresent('input[name="firstName"]', "Guide");
      await fillIfPresent('input[name="lastName"]', "Applicant");
      await fillIfPresent('input[name="username"]', email);
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', "ChangeMe123!");
      await fillIfPresent('input[name="password-confirm"]', "ChangeMe123!");
      await page.click('input[type="submit"], button[type="submit"]');
      await settle(page);

      await goTo(page, `${URLS.tenantApplicant}/apply`);
      await settle(page);
      await page.fill("#motivation", "I want to build real products with AI-native engineering practices and grow with mentor feedback.");
      await page.fill("#githubUrl", "https://github.com/guide-applicant");
      await page.setInputFiles("#cv", { name: "guide-applicant-cv.pdf", mimeType: "application/pdf", buffer: MINIMAL_PDF });
      await shot(page, "04-applicant-apply.png");

      await page.click('button:has-text("Submit Application")');
      await page.waitForURL("**/application", { timeout: 30000 });
      await shot(page, "05-applicant-application-status.png");
    });
  }

  // --- Accepted applicant: the full dashboard ----------------------------------------------
  if (sectionEnabled("dashboard")) await withContext(browser, async (_context, page) => {
    await goTo(page, `${URLS.tenantApplicant}/dashboard`);
    await completeLogin(page, USERS.accepted.username, USERS.accepted.password);
    await goTo(page, `${URLS.tenantApplicant}/dashboard`);
    await shot(page, "06-dashboard-overview.png");

    await goTo(page, `${URLS.tenantApplicant}/dashboard/missions`);
    await shot(page, "07-dashboard-missions.png");
    await optionalShot(page, await firstDetailLink(page, "/dashboard/missions/"), "08-dashboard-mission-detail.png", "mission detail");

    await goTo(page, `${URLS.tenantApplicant}/dashboard/tasks`);
    await shot(page, "09-dashboard-tasks.png");
    await goTo(page, `${URLS.tenantApplicant}/dashboard/resources`);
    await shot(page, "10-dashboard-resources.png");
    await goTo(page, `${URLS.tenantApplicant}/dashboard/calendar`);
    await shot(page, "11-dashboard-calendar.png");
    await goTo(page, `${URLS.tenantApplicant}/dashboard/notifications`);
    await shot(page, "12-dashboard-notifications.png");
    await goTo(page, `${URLS.tenantApplicant}/dashboard/profile`);
    await shot(page, "13-dashboard-profile.png");
    await goTo(page, `${URLS.tenantApplicant}/dashboard/program`);
    await shot(page, "14-dashboard-program.png");
  });

  // --- Org Admin: admin portal ---------------------------------------------------------------
  if (sectionEnabled("admin")) await withContext(browser, async (_context, page) => {
    await goTo(page, `${URLS.tenantAdmin}/applications`);
    await completeLogin(page, USERS.orgAdmin.username, USERS.orgAdmin.password);

    await goTo(page, `${URLS.tenantAdmin}/`);
    await shot(page, "15-admin-overview.png");

    await goTo(page, `${URLS.tenantAdmin}/applications`);
    await shot(page, "16-admin-applications.png");
    await optionalShot(page, await firstDetailLink(page, "/applications/"), "17-admin-application-detail.png", "application detail");

    await goTo(page, `${URLS.tenantAdmin}/programs`);
    await shot(page, "18-admin-programs.png");
    const programDetail = await firstDetailLink(page, "/programs/");
    await optionalShot(page, programDetail, "19-admin-program-detail.png", "program detail");
    if (programDetail) {
      await goTo(page, `${programDetail.replace(/\/$/, "")}/content`);
      await shot(page, "20-admin-program-content.png");
    } else {
      skipped.push("20-admin-program-content.png — no program detail link found");
    }

    await goTo(page, `${URLS.tenantAdmin}/missions`);
    await shot(page, "21-admin-missions.png");
    const missionDetail = await firstDetailLink(page, "/missions/");
    await optionalShot(page, missionDetail, "22-admin-mission-detail.png", "mission detail");
    if (missionDetail) {
      await optionalShot(page, await firstDetailLink(page, "/submissions/"), "23-admin-submission-review.png", "submission review");
    } else {
      skipped.push("23-admin-submission-review.png — no mission detail link found");
    }

    await goTo(page, `${URLS.tenantAdmin}/settings`);
    await shot(page, "24-admin-settings.png");
    await goTo(page, `${URLS.tenantAdmin}/operations`);
    await shot(page, "25-admin-operations.png");
  });

  // --- Org Admin: local Ops Console ----------------------------------------------------------
  if (sectionEnabled("ops")) await withContext(browser, async (_context, page) => {
    await goTo(page, `${URLS.ops}/`);
    await completeLogin(page, USERS.orgAdmin.username, USERS.orgAdmin.password);
    await shot(page, "26-ops-console.png");
  });

  await browser.close();

  console.log(`\n${captured.length} screenshots captured to ${OUT_DIR}`);
  if (skipped.length) {
    console.warn(`Skipped ${skipped.length}:`);
    for (const line of skipped) console.warn(`  - ${line}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
