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
 *   Sections: public, apply, dashboard, workflows, admin, adminflows, ops (default: all)
 *
 * Output: docs/user-guides/screenshots/*.png (referenced by the guides in docs/user-guides/)
 */
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("docs/user-guides/screenshots");
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
  // Use the same seeded accepted user for workflow screenshots. The previous hardcoded
  // guide.applicant.* user was created by a prior CI run's registration flow and does not
  // exist in a fresh Keycloak instance, causing "Login flow did not converge" in CI.
  worked: { username: "accepted@demo.talentos.local", password: "ChangeMe123!" },
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

/**
 * Link to a program by visible name, falling back to the first one. Keeps the guide pointed at the
 * seeded curriculum rather than whichever program happens to sort first.
 */
async function programLinkByName(page: Page, name: string): Promise<string | null> {
  // The row's link is labelled "Edit →", so match the row that carries the program name.
  const link = page.locator(`tr:has-text("${name}") a[href*="/programs/"]`).first();
  if (await link.count()) {
    const href = await link.getAttribute("href");
    if (href) return new URL(href, page.url()).toString();
  }
  return firstDetailLink(page, "/programs/");
}

const GUIDE_PROGRAM = "AI-Native Software Engineering";

async function withContext(browser: Browser, fn: (context: BrowserContext, page: Page) => Promise<void>, evidenceRunId?: string) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  // attach optional network capture for evidence when evidenceRunId provided
  const uiEntries: any[] = [];
  if (evidenceRunId) {
    page.on('request', (req) => {
      uiEntries.push({ type: 'request', url: req.url(), method: req.method(), headers: req.headers(), timestamp: Date.now() });
    });
    page.on('response', async (res) => {
      let size = null;
      try {
        const buf = await res.body().catch(() => null);
        if (buf) size = buf.length;
      } catch {}
      uiEntries.push({ type: 'response', url: res.url(), status: res.status(), headers: res.headers(), size, timestamp: Date.now() });
    });
  }
  try {
    await fn(context, page);
  } finally {
    if (evidenceRunId) {
      try {
        const outDir = path.resolve('.ops', 'evidence', evidenceRunId);
        fs.mkdirSync(outDir, { recursive: true });
        const file = path.join(outDir, `http-evidence-ui.json`);
        fs.writeFileSync(file, JSON.stringify({ runId: evidenceRunId, entries: uiEntries }, null, 2), 'utf8');
        console.log(`Wrote UI network evidence to ${file}`);
      } catch (e) {
        console.warn('Could not write UI network evidence', e);
      }
    }
    await context.close();
  }
}

const rawArgs = process.argv.slice(2);
const requestedSections = rawArgs.filter((arg) => !arg.startsWith('--')).map((arg) => arg.toLowerCase());
const evidenceRunArg = rawArgs.find((a) => a.startsWith('--evidence-run-id='));
const EVIDENCE_RUN_ID = evidenceRunArg ? evidenceRunArg.split('=')[1] : undefined;
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
    }, EVIDENCE_RUN_ID);
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
    }, EVIDENCE_RUN_ID);
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
  }, EVIDENCE_RUN_ID);

  // --- Accepted applicant: the working flows (v0.20.0) ---------------------------------------
  // Journal grouping, the mission workspace and the submission gate are the screens applicants
  // actually spend time in, and none were captured before.
  if (sectionEnabled("workflows")) await withContext(browser, async (_context, page) => {
    await goTo(page, `${URLS.tenantApplicant}/dashboard`);
    await completeLogin(page, USERS.worked.username, USERS.worked.password);

    await goTo(page, `${URLS.tenantApplicant}/dashboard/journal`);
    await shot(page, "28-applicant-journal-grouped.png");

    // Expand every mission group so the guide can show the entry rows and their View/Edit actions.
    const groups = page.locator("details");
    for (let i = 0; i < (await groups.count()); i++) {
      await groups.nth(i).locator("summary").first().click().catch(() => undefined);
    }
    await shot(page, "29-applicant-journal-expanded.png");

    await optionalShot(
      page,
      await firstDetailLink(page, "/dashboard/journal/"),
      "30-applicant-journal-entry.png",
      "journal entry"
    );

    await goTo(page, `${URLS.tenantApplicant}/dashboard/journal/new`);
    await shot(page, "31-applicant-journal-new.png");

    await goTo(page, `${URLS.tenantApplicant}/dashboard/missions`);
    await optionalShot(
      page,
      await firstDetailLink(page, "/dashboard/missions/"),
      "32-applicant-mission-workspace.png",
      "mission workspace"
    );
  }, EVIDENCE_RUN_ID);

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

    // Top-level Tasks workspace (v0.20.0): weekly task + resource management with a program selected.
    const programId = programDetail
      ? new URL(programDetail).pathname.split("/programs/")[1]?.replace(/\/$/, "")
      : "";
    await goTo(page, `${URLS.tenantAdmin}/tasks${programId ? `?programId=${programId}` : ""}`);
    await shot(page, "27-admin-tasks.png");

    await goTo(page, `${URLS.tenantAdmin}/missions`);
    await shot(page, "21-admin-missions.png");
    const missionDetail = await firstDetailLink(page, "/missions/");
    await optionalShot(page, missionDetail, "22-admin-mission-detail.png", "mission detail");
    // 23-admin-submission-review.png retired: the mission detail page no longer lists submissions
    // (v0.20.0), so it can never be reached from here. Submission review is captured as
    // 35-admin-review-history.png via the Submissions list, which is the real route.

    await goTo(page, `${URLS.tenantAdmin}/settings`);
    await shot(page, "24-admin-settings.png");
    // 25-admin-operations.png retired: the admin Operations page was removed (c562e0f) in favour of
    // the standalone Ops Console below. The number is left unused so other references keep working.
  }, EVIDENCE_RUN_ID);

  // --- Org Admin: authoring and review flows (v0.20.0) ---------------------------------------
  // Mission Markdown import, per-mission task authoring and the submission review timeline.
  if (sectionEnabled("adminflows")) await withContext(browser, async (_context, page) => {
    await goTo(page, `${URLS.tenantAdmin}/missions`);
    await completeLogin(page, USERS.orgAdmin.username, USERS.orgAdmin.password);

    // Mission creation, showing the Markdown import panel above the manual form.
    await goTo(page, `${URLS.tenantAdmin}/missions/new`);
    const format = page.locator('details:has-text("Required format")').first();
    if (await format.count()) await format.locator("summary").first().click().catch(() => undefined);
    await shot(page, "33-admin-mission-import.png");

    // Tasks are authored per mission, so pick a program then a mission to reach the editor.
    await goTo(page, `${URLS.tenantAdmin}/programs`);
    const programDetail = await programLinkByName(page, GUIDE_PROGRAM);
    const programId = programDetail
      ? new URL(programDetail).pathname.split("/programs/")[1]?.replace(/\/$/, "")
      : "";
    if (programId) {
      await goTo(page, `${URLS.tenantAdmin}/tasks?programId=${programId}`);
      const missionSelect = page.locator('select[name="missionId"]');
      if (await missionSelect.count()) {
        const value = await missionSelect.locator("option").nth(1).getAttribute("value");
        if (value) {
          await missionSelect.selectOption(value);
          await page.locator('button:has-text("Load tasks")').first().click().catch(() => undefined);
          await settle(page);
        }
      }
      await shot(page, "34-admin-tasks-by-mission.png");
    } else {
      skipped.push("34-admin-tasks-by-mission.png — no program detail link found");
    }

    // Submission review, with the round-by-round history expanded.
    // Defaults to status=SUBMITTED, which is usually empty. ACCEPTED is the useful filter here:
    // an accepted submission has been reviewed at least once, so it has a history to show.
    await goTo(page, `${URLS.tenantAdmin}/submissions?status=ACCEPTED`);
    const submission = await firstDetailLink(page, "/submissions/");
    if (submission) {
      await goTo(page, submission);
      const previous = page.locator('details:has-text("Previous Attempt History")').first();
      if (await previous.count()) await previous.locator("summary").first().click().catch(() => undefined);
      await shot(page, "35-admin-review-history.png");
    } else {
      skipped.push("35-admin-review-history.png — no submission link found");
    }
  }, EVIDENCE_RUN_ID);

  // --- Org Admin: local Ops Console ----------------------------------------------------------
  // The Ops Console is a standalone app not included in docker-compose, so it may not be running
  // in every environment (e.g. CI). Skip gracefully instead of failing the whole script.
  if (sectionEnabled("ops")) await withContext(browser, async (_context, page) => {
    try {
      await goTo(page, `${URLS.ops}/`);
    } catch {
      skipped.push("26-ops-console.png — Ops Console not reachable at " + URLS.ops);
      console.warn(`skipped 26-ops-console.png: Ops Console not reachable at ${URLS.ops}`);
      return;
    }
    await completeLogin(page, USERS.orgAdmin.username, USERS.orgAdmin.password);
    await shot(page, "26-ops-console.png");
  }, EVIDENCE_RUN_ID);

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
