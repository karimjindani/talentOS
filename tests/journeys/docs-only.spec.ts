// tests/journeys/docs-only.spec.ts
/**
 * Produces the user-guide screenshots in `docs/user-guides/screenshots/`, replacing
 * `scripts/user-guide/capture-screenshots.ts` (deleted in this iteration).
 *
 * Why this is a spec and not a script. The retired tool photographed pages and asserted nothing, so
 * a screenshot could silently go stale — the page could break and the guide would keep showing a
 * picture of it working. Here every capture is preceded by an assertion, and `shoot()` cannot write
 * a file until that assertion holds. A broken page fails the run instead of producing a misleading
 * image.
 *
 * It also drops the retired tool's `optionalShot`/`skipped` pattern, which downgraded "this page has
 * nothing to photograph" to a warning nobody read. Missing seed data is a failure here: these
 * screenshots document the seeded state, so if the seed stops producing it, the guides are wrong and
 * someone should hear about it.
 *
 * These use the seeded `demo` tenant deliberately, NOT a journey tenant — the guides describe the
 * seeded curriculum, so the pictures have to show it.
 */
import { expect, test, type Page } from "@playwright/test";
import { completeLogin } from "./fixtures/actors";
import { createJourneyUser, deleteJourneyUser, journeyEmail } from "./fixtures/keycloak";

const SHOTS = "docs/user-guides/screenshots";

const URLS = {
  applicant: "http://lvh.me:3100",
  tenantApplicant: "http://demo.lvh.me:3100",
  tenantAdmin: "http://demo.lvh.me:3200",
  ops: "http://127.0.0.1:3300"
};

/** Every seeded demo user shares this password (keycloak/import/talentos-realm.json). */
const SEEDED_PASSWORD = "ChangeMe123!";
const USERS = {
  accepted: "accepted@demo.talentos.local",
  orgAdmin: "orgadmin@demo.talentos.local"
};

/** Keeps the guide pointed at the seeded curriculum rather than whichever program sorts first. */
const GUIDE_PROGRAM = "AI-Native Software Engineering";

/** A minimal but valid single-page PDF for the CV upload. */
const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n"
);

test.use({ viewport: { width: 1440, height: 900 } });

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  // Client components (branding, dashboards, charts) need a beat to hydrate before they photograph.
  await page.waitForTimeout(750);
}

/**
 * Asserts the page is the one we mean to document, then photographs it.
 *
 * The assertion is not decoration — it is the whole difference between this spec and the tool it
 * replaces. `expect` throws on failure, so no file is written for a page that did not render.
 */
async function shoot(page: Page, file: string, assertion: () => Promise<unknown>): Promise<void> {
  await settle(page);
  await assertion();
  await page.screenshot({ path: `${SHOTS}/${file}`, fullPage: true });
}

async function goTo(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
}

/**
 * Asserts the page's own <h1> reads what we expect.
 *
 * By name, not merely "an h1 exists": the admin shell renders a branding <h1> of its own
 * ("Demo TalentOS Academy Admin") above every page heading, so a bare level-1 lookup is both
 * ambiguous and satisfied by a page that failed to render its content. All names below were read
 * off the running app, not guessed.
 */
function heading(page: Page, name: string | RegExp) {
  return async () => {
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  };
}

/**
 * For detail pages whose heading is seeded content we should not hard-code. The page's own <h1> is
 * the last in the DOM — the admin branding heading precedes it.
 */
function anyPageHeading(page: Page) {
  return async () => {
    await expect(page.getByRole("heading", { level: 1 }).last()).toBeVisible();
  };
}

/** The first same-app detail link under `hrefPart`, excluding index and `new` routes. */
async function firstDetailLink(page: Page, hrefPart: string): Promise<string> {
  const links = page.locator(`a[href*="${hrefPart}"]`);
  for (let i = 0; i < (await links.count()); i++) {
    const href = await links.nth(i).getAttribute("href");
    if (!href) continue;
    const absolute = new URL(href, page.url());
    const tail = absolute.pathname.split(hrefPart)[1] ?? "";
    if (tail && tail !== "/" && !tail.startsWith("new")) return absolute.toString();
  }
  // Deliberately fatal. The retired tool warned and moved on here, which is how a guide ends up
  // referencing a screenshot nobody has regenerated in months.
  throw new Error(`No detail link matching "${hrefPart}" on ${page.url()} — seed data may have changed.`);
}

test("public pages", async ({ page }) => {
  await goTo(page, `${URLS.tenantApplicant}/`);
  await shoot(page, "01-applicant-home.png", anyPageHeading(page));

  await goTo(page, `${URLS.applicant}/login`);
  await shoot(page, "02-applicant-login.png", async () => {
    await expect(page.getByRole("button", { name: /sign in with keycloak/i })).toBeVisible();
  });

  // The Keycloak credential form, reached by starting a real sign-in.
  await page.getByRole("button", { name: /sign in with keycloak/i }).first().click();
  await shoot(page, "03-keycloak-signin.png", async () => {
    await expect(page.locator("#kc-form-login")).toBeVisible();
  });
});

test("apply flow", async ({ page }) => {
  // A brand-new applicant: existing tenant members are redirected away from /apply. Created through
  // the Admin API rather than by driving Keycloak's registration form — that form is not what these
  // two screenshots document, and the API path cannot half-succeed.
  //
  // Named with the journey prefix on purpose, so that if this test dies before its cleanup,
  // sweepOrphanJourneyUsers reaps it within 24h. The retired tool registered
  // `guide.applicant.<stamp>@demo.talentos.local` accounts and deleted none of them — one such
  // leftover is still in the demo tenant, and its 17 journal entries are the only reason the journal
  // screenshots below ever looked populated.
  const email = journeyEmail(`docs${Date.now().toString(36)}`, "applicant");
  const userId = await createJourneyUser({
    email,
    password: SEEDED_PASSWORD,
    firstName: "Guide",
    lastName: "Applicant",
    realmRoles: ["APPLICANT"]
  });

  try {
    await goTo(page, `${URLS.tenantApplicant}/apply`);
    await completeLogin(page, email, SEEDED_PASSWORD);
    await goTo(page, `${URLS.tenantApplicant}/apply`);

    await page.fill("#motivation", "I want to build real products with AI-native engineering practices and grow with mentor feedback.");
    await page.fill("#githubUrl", "https://github.com/guide-applicant");
    await page.setInputFiles("#cv", {
      name: "guide-applicant-cv.pdf",
      mimeType: "application/pdf",
      buffer: MINIMAL_PDF
    });
    await shoot(page, "04-applicant-apply.png", async () => {
      await expect(page.getByRole("button", { name: /submit application/i })).toBeVisible();
    });

    await Promise.all([
      page.waitForURL("**/application", { timeout: 30_000 }),
      page.getByRole("button", { name: /submit application/i }).click()
    ]);
    await shoot(page, "05-applicant-application-status.png", async () => {
      await expect(page).toHaveURL(/\/application/);
    });
  } finally {
    await deleteJourneyUser(userId);
  }
});

test("applicant dashboard", async ({ page }) => {
  await goTo(page, `${URLS.tenantApplicant}/dashboard`);
  await completeLogin(page, USERS.accepted, SEEDED_PASSWORD);

  const pages: [string, string, string | RegExp][] = [
    ["/dashboard", "06-dashboard-overview.png", /welcome back/i],
    ["/dashboard/missions", "07-dashboard-missions.png", "Missions"],
    ["/dashboard/tasks", "09-dashboard-tasks.png", "Tasks"],
    ["/dashboard/resources", "10-dashboard-resources.png", "Learning resources"],
    ["/dashboard/calendar", "11-dashboard-calendar.png", "Calendar"],
    ["/dashboard/notifications", "12-dashboard-notifications.png", "Notifications"],
    ["/dashboard/profile", "13-dashboard-profile.png", "Profile"],
    ["/dashboard/program", "14-dashboard-program.png", "My Program"]
  ];
  for (const [path, file, name] of pages) {
    await goTo(page, `${URLS.tenantApplicant}${path}`);
    await shoot(page, file, heading(page, name));
  }

  await goTo(page, `${URLS.tenantApplicant}/dashboard/missions`);
  await goTo(page, await firstDetailLink(page, "/dashboard/missions/"));
  await shoot(page, "08-dashboard-mission-detail.png", anyPageHeading(page));
});

test("applicant working flows", async ({ page }) => {
  await goTo(page, `${URLS.tenantApplicant}/dashboard`);
  await completeLogin(page, USERS.accepted, SEEDED_PASSWORD);

  await goTo(page, `${URLS.tenantApplicant}/dashboard/journal`);
  await shoot(page, "28-applicant-journal-grouped.png", heading(page, "Engineering Journal"));

  await goTo(page, `${URLS.tenantApplicant}/dashboard/journal/new`);
  await shoot(page, "31-applicant-journal-new.png", heading(page, "New journal entry"));

});

/**
 * Three screenshots blocked by one seed gap, not by this spec.
 *
 * The documented applicant, `accepted@demo.talentos.local`, is accepted but **idle**: zero journal
 * entries, and a single Week 1 assignment still `NOT_STARTED`. So:
 *
 *   - `29-applicant-journal-expanded.png` has no mission group to expand,
 *   - `30-applicant-journal-entry.png` has no entry to open,
 *   - `32-applicant-mission-workspace.png` has no workspace — the mission page only renders its tab
 *     panels once the assignment is ACCEPTED/IN_PROGRESS/OVERDUE (missions/[id]/page.tsx:86).
 *
 * The retired tool hid this rather than reporting it: its summary-expanding loop iterated over zero
 * elements and still captured "grouped" and "expanded" shots of the same empty page, and
 * `optionalShot` downgraded the two missing detail pages to warnings. The only demo-tenant accounts
 * that do hold journal entries are leftovers — regression-run debris, and a `guide.applicant.*`
 * account the retired tool itself created and never deleted. On a fresh database, such as CI's,
 * there would be none, and these three would document nothing.
 *
 * The fix belongs in the seed: give the documented applicant an accepted mission and a few journal
 * entries. Doing it from this spec would mutate seeded state the regression scenarios depend on.
 * Tracked as a Known Gap; `fixme` rather than deletion so the run keeps saying so out loud.
 */
test.fixme("applicant work-in-progress screenshots", async ({ page }) => {
  await goTo(page, `${URLS.tenantApplicant}/dashboard/journal`);
  await completeLogin(page, USERS.accepted, SEEDED_PASSWORD);

  for (const summary of await page.locator("details:not([open]) summary").all()) {
    await summary.click().catch(() => undefined);
  }
  await shoot(page, "29-applicant-journal-expanded.png", async () => {
    await expect(page.locator("details[open]").first()).toBeVisible();
  });

  await goTo(page, await firstDetailLink(page, "/dashboard/journal/"));
  await shoot(page, "30-applicant-journal-entry.png", anyPageHeading(page));

  await goTo(page, `${URLS.tenantApplicant}/dashboard/missions`);
  await goTo(page, await firstDetailLink(page, "/dashboard/missions/"));
  await shoot(page, "32-applicant-mission-workspace.png", async () => {
    await expect(page.getByRole("tab").first()).toBeVisible();
  });
});

test("admin portal", async ({ page }) => {
  await goTo(page, `${URLS.tenantAdmin}/applications`);
  await completeLogin(page, USERS.orgAdmin, SEEDED_PASSWORD);

  await goTo(page, `${URLS.tenantAdmin}/`);
  await shoot(page, "15-admin-overview.png", heading(page, "Overview"));

  await goTo(page, `${URLS.tenantAdmin}/applications`);
  await shoot(page, "16-admin-applications.png", heading(page, "Applications"));
  await goTo(page, await firstDetailLink(page, "/applications/"));
  await shoot(page, "17-admin-application-detail.png", anyPageHeading(page));

  await goTo(page, `${URLS.tenantAdmin}/programs`);
  await shoot(page, "18-admin-programs.png", heading(page, "Programs"));
  const programDetail = await firstDetailLink(page, "/programs/");
  await goTo(page, programDetail);
  await shoot(page, "19-admin-program-detail.png", anyPageHeading(page));

  await goTo(page, `${programDetail.replace(/\/$/, "")}/content`);
  await shoot(page, "20-admin-program-content.png", anyPageHeading(page));

  const programId = new URL(programDetail).pathname.split("/programs/")[1]?.replace(/\/$/, "") ?? "";
  await goTo(page, `${URLS.tenantAdmin}/tasks?programId=${programId}`);
  await shoot(page, "27-admin-tasks.png", heading(page, "Tasks"));

  await goTo(page, `${URLS.tenantAdmin}/missions`);
  await shoot(page, "21-admin-missions.png", heading(page, "Missions"));
  await goTo(page, await firstDetailLink(page, "/missions/"));
  await shoot(page, "22-admin-mission-detail.png", anyPageHeading(page));

  // 23-admin-submission-review.png and 25-admin-operations.png are retired: the mission detail page
  // no longer lists submissions (v0.20.0) and the admin Operations page was removed (c562e0f). The
  // numbers stay unused so the surviving references keep working.
  await goTo(page, `${URLS.tenantAdmin}/settings`);
  await shoot(page, "24-admin-settings.png", heading(page, "Tenant settings"));
});

test("admin authoring and review flows", async ({ page }) => {
  await goTo(page, `${URLS.tenantAdmin}/missions`);
  await completeLogin(page, USERS.orgAdmin, SEEDED_PASSWORD);

  // Mission creation, showing the Markdown import panel above the manual form.
  await goTo(page, `${URLS.tenantAdmin}/missions/new`);
  const format = page.locator('details:has-text("Required format")').first();
  if (await format.count()) await format.locator("summary").first().click().catch(() => undefined);
  await shoot(page, "33-admin-mission-import.png", heading(page, "New mission"));

  // Tasks are authored per mission, so pick the seeded program then a mission to reach the editor.
  await goTo(page, `${URLS.tenantAdmin}/programs`);
  const programRow = page.locator(`tr:has-text("${GUIDE_PROGRAM}") a[href*="/programs/"]`).first();
  const href = (await programRow.count()) ? await programRow.getAttribute("href") : null;
  const programDetail = href ? new URL(href, page.url()).toString() : await firstDetailLink(page, "/programs/");
  const programId = new URL(programDetail).pathname.split("/programs/")[1]?.replace(/\/$/, "") ?? "";

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
  await shoot(page, "34-admin-tasks-by-mission.png", heading(page, "Tasks"));

  // Submission review with the round-by-round history expanded. ACCEPTED rather than the default
  // SUBMITTED filter: an accepted submission has been reviewed at least once, so it has a history.
  await goTo(page, `${URLS.tenantAdmin}/submissions?status=ACCEPTED`);
  await goTo(page, await firstDetailLink(page, "/submissions/"));
  const previous = page.locator('details:has-text("Previous Attempt History")').first();
  if (await previous.count()) await previous.locator("summary").first().click().catch(() => undefined);
  await shoot(page, "35-admin-review-history.png", anyPageHeading(page));
});

test("ops console", async ({ page }) => {
  await goTo(page, `${URLS.ops}/`);
  await completeLogin(page, USERS.orgAdmin, SEEDED_PASSWORD);
  await shoot(page, "26-ops-console.png", anyPageHeading(page));
});
