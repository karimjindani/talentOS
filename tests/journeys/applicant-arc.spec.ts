// tests/journeys/applicant-arc.spec.ts
import type { Locator, Page } from "@playwright/test";
import { createJourneyUser, journeyEmail } from "./fixtures/keycloak";
import { JOURNEY_PASSWORD, completeLogin } from "./fixtures/actors";
import { expect, test } from "./fixtures/journey";
import { markRegressionData, submitSubmission } from "@talentos/db";
import { prisma } from "./fixtures/tenant";

const FINAL_PROGRAM_WEEK = 4;
/** Reviewer ratings by week (1-indexed via `ratings[weekNumber - 1]`), integer 1-5 scale. */
const RATINGS = [4, 5, 4, 5];

/**
 * A minimal but valid single-page PDF for the CV upload. Lifted verbatim from
 * scripts/user-guide/capture-screenshots.ts, which Task 8 deletes — this exact byte sequence is
 * already proven to clear the apply form's PDF check in this app.
 */
const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n"
);

/**
 * Clicks a control that submits a Next.js Server Action (native form or `useActionState`) and
 * waits for its POST to land before returning.
 *
 * `locator.click()` immediately followed by `page.waitForLoadState("networkidle")` is a race:
 * "networkidle" is evaluated against the page's *current* load state, which is already idle the
 * instant the click resolves — the click-triggered POST has not necessarily started yet, so the
 * wait can resolve before it does. Verified against the live apply form: click-then-networkidle
 * failed to observe the submission 3/3 times (page stayed on /apply, no application row created),
 * while arming a response listener via Promise.all before the click — so it is watching before the
 * request fires — passed every time. Applied everywhere a step clicks a submitting control.
 *
 * The trailing `networkidle` wait is a courtesy settle, not the correctness check above — it is
 * bounded and swallowed for the same reason `fixtures/actors.ts`'s `settle()` is (v0.20.3): a
 * duplicate concurrent GET (e.g. next-auth's refetch-on-focus racing its mount-time fetch) can
 * leave Playwright's own pending-request ledger permanently off by one, so `networkidle` never
 * fires again for that page's whole lifetime, and this call has no default timeout to fall back on
 * in this environment, so an unbounded version hangs until the whole test's budget is exhausted.
 */
async function settledClick(page: Page, locator: Locator): Promise<void> {
  await Promise.all([page.waitForResponse((response) => response.request().method() === "POST"), locator.click()]);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
}

test("applicant arc", async ({ journey }) => {
  const applicantEmail = journeyEmail(journey.runId, "applicant");

  // --- Process 1: Applicant Signup & Approval ------------------------------------------------

  await journey.step("Applicant account is created in Keycloak", {
    actor: "system",
    process: "Applicant Signup & Approval",
    proves: "Signup identity exists in the realm — not a user action, it stands in for self-registration"
  }, async () => {
    const userId = await createJourneyUser({
      email: applicantEmail,
      password: JOURNEY_PASSWORD,
      firstName: "Journey",
      // Run-scoped, not the fixed "Applicant": v0.20.5 publishes this applicant's graduate
      // profile to the *shared, cross-tenant* public directory, so a literal duplicate name
      // across runs would both collide in that directory's UI and make this journey's own final
      // assertion ambiguous (multiple identically-named cards match). Mirrors the run-scoped name
      // fixtures/tenant.ts already gives the admin identity ("Journey <runId> Admin").
      lastName: `Applicant ${journey.runId}`,
      // Without this the login succeeds and the session carries orgRole: null — every portal
      // guard then denies a user the evidence would claim is an applicant.
      realmRoles: ["APPLICANT"]
    });
    await journey.registerKeycloakUser(userId);
    expect(userId).toBeTruthy();
  });

  await journey.step("Applicant signs in and reaches the apply page", {
    actor: "applicant",
    process: "Applicant Signup & Approval",
    proves: "Keycloak login succeeds and an unaccepted applicant is routed to /apply"
  }, async (page) => {
    await page.goto("/apply");
    await completeLogin(page, applicantEmail, JOURNEY_PASSWORD);
    await expect(page).toHaveURL(/\/apply/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  await journey.step("Applicant submits an application", {
    actor: "applicant",
    process: "Applicant Signup & Approval",
    proves: "Application is persisted as SUBMITTED against the journey tenant"
  }, async (page) => {
    // Both are `required` on the form and re-checked server-side (apply/page.tsx:74,80). The
    // program select defaults to the tenant's only program, so it needs no interaction.
    await page.fill('textarea[name="motivation"]', "I want to prove the end-to-end journey works.");
    await page.setInputFiles('input[name="cv"]', {
      name: "journey-cv.pdf",
      mimeType: "application/pdf",
      buffer: MINIMAL_PDF
    });
    await settledClick(page, page.getByRole("button", { name: /submit application/i }));

    const application = await prisma.application.findFirst({
      where: { tenantId: journey.tenant.tenantId, applicant: { email: applicantEmail } }
    });
    expect(application?.status).toBe("SUBMITTED");

    // Submitting the application is what actually creates the Prisma User row (and its
    // TenantMembership) — self-signup only provisions the Keycloak identity; neither of these
    // exists until the applicant's first tenant-scoped write, so neither could be marked any
    // earlier. Both were previously unmarked entirely: harmless while no journey ever published a
    // graduate profile, but this one does, and an unmarked User's GraduateProfile leaks into the
    // shared public directory on every run otherwise (found live while verifying this iteration —
    // 28 orphaned applicant Users had accumulated in the local database before this fix).
    const applicantUser = await prisma.user.findUniqueOrThrow({ where: { email: applicantEmail } });
    await markRegressionData({ runId: journey.runId, entityType: "User", entityId: applicantUser.id });
    const memberships = await prisma.tenantMembership.findMany({
      where: { userId: applicantUser.id, tenantId: journey.tenant.tenantId }
    });
    for (const membership of memberships) {
      await markRegressionData({ runId: journey.runId, entityType: "TenantMembership", entityId: membership.id });
    }
  });

  await journey.step("Reviewer accepts the application", {
    actor: "reviewer",
    process: "Applicant Signup & Approval",
    proves: "Acceptance assigns the Week 1 mission — an accepted applicant is never left with none"
  }, async (page) => {
    await page.goto("/applications");
    await completeLogin(page, journey.tenant.adminEmail, JOURNEY_PASSWORD);
    // Rows link out under the text "Review", not the applicant's name (applications/page.tsx:127).
    // The journey tenant holds exactly one application, so the first row is the right one.
    await page.getByRole("link", { name: /review/i }).first().click();
    // Decision buttons render the raw status with underscores replaced (applications/[id]/page.tsx:204),
    // so the accept control reads "ACCEPTED".
    await settledClick(page, page.getByRole("button", { name: /^accepted$/i }));

    const assignment = await prisma.missionAssignment.findFirst({
      where: { tenantId: journey.tenant.tenantId, missionId: journey.tenant.missionIds[0] }
    });
    expect(assignment).not.toBeNull();
  });

  // --- Weeks 1-4: Mission Acceptance & Journal, then Submission & Mission Acceptance ---------
  //
  // Week 1 additionally proves the revision loop (NEEDS_REVISION -> applicant sees feedback ->
  // resubmit -> accepted) that this journey has covered since v0.20.3 — every other week accepts
  // on the first submission, since that loop is already proven once. Accepting week N < 4
  // auto-assigns week N+1 (reviewSubmission's existing auto-advance,
  // packages/db/src/submissions.ts) — this loop never assigns a week itself.
  for (let weekNumber = 1; weekNumber <= FINAL_PROGRAM_WEEK; weekNumber += 1) {
    const missionId = journey.tenant.missionIds[weekNumber - 1];
    const missionTitle = `Journey Week ${weekNumber} Mission`;
    const missionLink = new RegExp(missionTitle.replace(/\s+/g, "\\s+"), "i");
    const isFinalWeek = weekNumber === FINAL_PROGRAM_WEEK;
    const submissionProcess = isFinalWeek ? "Final Mission & Public Profile" : "Submission & Mission Acceptance";

    await journey.step(`Applicant accepts the Week ${weekNumber} mission`, {
      actor: "applicant",
      process: "Mission Acceptance & Journal",
      proves: "Acceptance sets a Thursday deadline at least four working days out"
    }, async (page) => {
      await page.goto("/dashboard/missions");
      await page.getByRole("link", { name: missionLink }).click();
      await settledClick(page, page.getByRole("button", { name: /accept mission/i }));

      const assignment = await prisma.missionAssignment.findFirstOrThrow({
        where: { tenantId: journey.tenant.tenantId, missionId }
      });
      expect(assignment.acceptedAt).not.toBeNull();
      expect(assignment.deadlineAt?.getUTCDay()).toBe(4); // Thursday
    });

    await journey.step(`Week ${weekNumber} mission acceptance is backdated by four days`, {
      actor: "system",
      process: "Mission Acceptance & Journal",
      proves: "Simulates elapsed time — NOT a user action. Four journal entries need four distinct dates on or after mission start and not in the future, so a mission accepted today has only one legal date"
    }, async () => {
      const backdated = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      // Both columns, deliberately: the journal form's minimum entry date is the mission's
      // `startedAt`, which listAssignedProgramMissions derives as `acceptedAt ?? assignedAt`
      // (packages/db/src/mission-assignments.ts:74). Moving only one leaves the date picker's
      // lower bound at today and the next step's four backdated entries are rejected.
      const { count } = await prisma.missionAssignment.updateMany({
        where: { tenantId: journey.tenant.tenantId, missionId },
        data: { acceptedAt: backdated, assignedAt: backdated }
      });
      expect(count).toBe(1);
    });

    await journey.step(`Applicant writes four journal entries for Week ${weekNumber}`, {
      actor: "applicant",
      process: "Mission Acceptance & Journal",
      proves: "One entry per applicant per mission per date holds across four dates and submission readiness reaches 4 of 4 journals"
    }, async (page) => {
      for (let daysAgo = 4; daysAgo >= 1; daysAgo--) {
        const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        await page.goto("/dashboard/journal/new");
        // Field names verified against apps/applicant/app/dashboard/journal/JournalEntryForm.tsx.
        // `missionId` needs no input: with a single assigned mission the form locks it into a
        // hidden field (new/page.tsx:44). `confidenceRating` is a radio group that arrives
        // pre-selected.
        await page.fill('input[name="entryDate"]', date);
        await page.fill('textarea[name="workedOn"]', `Week ${weekNumber}, day ${5 - daysAgo}: implemented and tested a slice.`);
        await page.fill('textarea[name="challenge"]', "Wiring the review loop end to end.");
        await page.fill('textarea[name="solution"]', "Read the assignment state machine and traced the transition.");
        await page.fill('textarea[name="learned"]', "Reinforced how the review loop closes.");
        await page.fill('textarea[name="aiUsage"]', "None for this slice.");
        await page.fill('input[name="timeSpentHours"]', "3");
        await settledClick(page, page.getByRole("button", { name: /save journal entry/i }));
      }

      const entries = await prisma.engineeringJournalEntry.count({
        where: { tenantId: journey.tenant.tenantId, missionId }
      });
      expect(entries).toBe(4);
    });

    await journey.step(`Applicant completes the Week ${weekNumber} mission tasks`, {
      actor: "applicant",
      process: "Mission Acceptance & Journal",
      proves: "Mission-scoped task completion is recorded per assignment (v0.20.0, D-096)"
    }, async (page) => {
      await page.goto("/dashboard/missions");
      await page.getByRole("link", { name: missionLink }).click();
      // The mission workspace (missions/[id]/page.tsx) is a tabbed layout (WorkspaceTabs.tsx)
      // whose Step 1/2 panels are `hidden` until their tab is selected; their titles are fixed
      // (packages/db/src/mission-tasks.ts:11-14). Their control is ToggleTaskComplete.tsx:41,
      // which reads "Mark as complete" — singular per step, not "Mark complete".
      await page.getByRole("tab", { name: /review the mission brief/i }).click();
      await settledClick(page, page.getByRole("button", { name: /mark as complete/i }));
      await page.getByRole("tab", { name: /study the tutorial/i }).click();
      await settledClick(page, page.getByRole("button", { name: /mark as complete/i }));

      const completions = await prisma.missionTaskCompletion.count({
        where: { tenantId: journey.tenant.tenantId, missionAssignment: { missionId } }
      });
      expect(completions).toBe(2);
    });

    await journey.step(`Applicant fills in the Week ${weekNumber} mission evidence and saves a draft`, {
      actor: "applicant",
      process: submissionProcess,
      proves: "Evidence URLs pass the host allow-lists (github.com, loom.com share/watch) and persist as a DRAFT"
    }, async (page) => {
      await page.goto("/dashboard/missions");
      await page.getByRole("link", { name: missionLink }).click();
      // The submission form lives in the Step 3 tab, hidden by default (WorkspaceTabs.tsx renders
      // every panel but keeps inactive ones `hidden`) — the mission page opens on Overview.
      await page.getByRole("tab", { name: /build & submit evidence/i }).click();
      // Field names verified against apps/applicant/app/dashboard/missions/[id]/SubmissionForm.tsx:
      // the walkthrough field is `loomUrl`, not `walkthroughUrl`, and the two buttons are
      // distinguished by `name="intent"` value, not by their labels alone.
      await page.fill('input[name="repositoryUrl"]', `https://github.com/karimjindani/talentOS`);
      await page.fill('input[name="deploymentUrl"]', "https://example.com");
      await page.fill('input[name="loomUrl"]', `https://www.loom.com/share/journey-walkthrough-week-${weekNumber}`);
      await settledClick(page, page.getByRole("button", { name: /save draft/i }));

      const submission = await prisma.submission.findFirstOrThrow({
        where: { tenantId: journey.tenant.tenantId, missionId }
      });
      expect(submission.status).toBe("DRAFT");
      expect(submission.loomUrl).toBe(`https://www.loom.com/share/journey-walkthrough-week-${weekNumber}`);
    });

    if (weekNumber === 1) {
      await journey.step("Every readiness gate is satisfied and the submit control unlocks", {
        actor: "applicant",
        process: submissionProcess,
        proves: "Four journals, completed tasks and three valid evidence URLs together enable 'Submit for review' — the gate the applicant actually has to clear"
      }, async (page) => {
        await expect(page.getByRole("button", { name: /submit for review/i })).toBeEnabled();
      });
    }

    await journey.step(`The Week ${weekNumber} submission is transitioned to SUBMITTED`, {
      actor: "system",
      process: submissionProcess,
      proves: "Server-side transition with public-URL reachability stubbed — NOT a user action. The click is not driven because submitSubmission performs a live HTTP reachability check on every evidence URL, and no synthetic loom.com share URL is reachable; the preceding step proves the applicant's own gate was open"
    }, async () => {
      const submission = await prisma.submission.findFirstOrThrow({
        where: { tenantId: journey.tenant.tenantId, missionId }
      });
      const submitted = await submitSubmission(
        { id: submission.id, tenantId: journey.tenant.tenantId, applicantId: submission.applicantId },
        // The same stub scripts/regression/run.ts:101 injects, and for the same reason: a journey
        // must not fail because a third-party site is down or rate-limiting the runner.
        { checkEvidenceUrl: async (url) => ({ reachable: true, finalUrl: url, statusCode: 200, error: null }) }
      );
      expect(submitted.status).toBe("SUBMITTED");
    });

    if (weekNumber === 1) {
      // Week 1 alone demonstrates the revision loop: request changes, applicant sees the
      // feedback, resubmit, then accepted — proven once here rather than on every week.
      await journey.step("Reviewer requests changes on Week 1", {
        actor: "reviewer",
        process: submissionProcess,
        proves: "A NEEDS_REVISION decision appends an immutable SubmissionReview round (v0.20.0, D-098)"
      }, async (page) => {
        await page.goto("/submissions");
        // Same pattern as the applications list: the row's link text is "Review", and the detail
        // page lives at /missions/<missionId>/submissions/<submissionId> (submissions/page.tsx:114).
        await page.getByRole("link", { name: /review/i }).first().click();
        // The field is `reviewerFeedback` and it is `required` — "Request changes" cannot submit
        // without it (missions/[id]/submissions/[submissionId]/page.tsx:353).
        await page.fill('textarea[name="reviewerFeedback"]', "Add tests for the failure path, then resubmit.");
        await settledClick(page, page.getByRole("button", { name: /request changes/i }));

        const reviews = await prisma.submissionReview.count({
          where: { missionAssignment: { tenantId: journey.tenant.tenantId, missionId } }
        });
        expect(reviews).toBe(1);
      });

      await journey.step("Applicant sees the reviewer's feedback on Week 1", {
        actor: "applicant",
        process: submissionProcess,
        proves: "Review feedback reaches the applicant's workspace — closing the loop the arc exists to prove"
      }, async (page) => {
        await page.goto("/dashboard/missions");
        await page.getByRole("link", { name: missionLink }).click();
        // Reviewer feedback renders inside the Step 3 panel (page.tsx:286-297), hidden by default
        // like the submission form was in the earlier step.
        await page.getByRole("tab", { name: /build & submit evidence/i }).click();
        await expect(page.getByText(/add tests for the failure path/i)).toBeVisible();
      });

      await journey.step("Week 1's submission is resubmitted after revisions", {
        actor: "system",
        process: submissionProcess,
        proves: "NEEDS_REVISION -> SUBMITTED is a legal transition (submitSubmission's status guard); same reachability stub as the first submission"
      }, async () => {
        const submission = await prisma.submission.findFirstOrThrow({
          where: { tenantId: journey.tenant.tenantId, missionId }
        });
        const resubmitted = await submitSubmission(
          { id: submission.id, tenantId: journey.tenant.tenantId, applicantId: submission.applicantId },
          { checkEvidenceUrl: async (url) => ({ reachable: true, finalUrl: url, statusCode: 200, error: null }) }
        );
        expect(resubmitted.status).toBe("SUBMITTED");
      });
    }

    await journey.step(
      isFinalWeek ? "Reviewer accepts the final (Week 4) mission" : `Reviewer accepts the Week ${weekNumber} mission`,
      {
        actor: "reviewer",
        process: submissionProcess,
        proves: isFinalWeek
          ? "Accepting the 4th rated mission is the exact eligibility gate getGraduateEligibility checks (packages/db/src/graduates.ts) — this is the real 'graduation' moment, not a simulated one"
          : weekNumber === 1
            ? "Accepting the resubmission closes the revision loop and auto-assigns Week 2 (reviewSubmission, weekNumber < FINAL_PROGRAM_WEEK)"
            : `Acceptance auto-assigns Week ${weekNumber + 1} (reviewSubmission, weekNumber < FINAL_PROGRAM_WEEK)`
      },
      async (page) => {
        await page.goto("/submissions");
        await page.getByRole("link", { name: /review/i }).first().click();
        // The submission review page's accept control reads "Accept submission" (distinct from
        // the application-review page's "Accepted" button the earlier acceptance step clicks) and
        // requires a 1-5 rating on accept — `reviewSubmission` throws without one
        // (missions/[id]/submissions/[submissionId]/page.tsx).
        await page.selectOption('select[name="rating"]', String(RATINGS[weekNumber - 1]));
        await settledClick(page, page.getByRole("button", { name: /accept submission/i }));

        const submission = await prisma.submission.findFirstOrThrow({
          where: { tenantId: journey.tenant.tenantId, missionId }
        });
        expect(submission.status).toBe("ACCEPTED");
        expect(submission.rating).not.toBeNull();

        if (!isFinalWeek) {
          const nextAssignment = await prisma.missionAssignment.findFirst({
            where: { tenantId: journey.tenant.tenantId, missionId: journey.tenant.missionIds[weekNumber] }
          });
          expect(nextAssignment).not.toBeNull();
        }
      }
    );
  }

  // --- Process 4 continued: Final Mission & Public Profile -----------------------------------

  await journey.step("Applicant agrees to publish their profile once training is complete", {
    actor: "applicant",
    process: "Final Mission & Public Profile",
    proves: "isGraduateConsentRequired flips true the moment the 4th mission is accepted; DashboardConsentGate shows the modal and acknowledging auto-publishes because training is already complete (apps/applicant/app/api/graduates/profile/acknowledge/route.ts)"
  }, async (page) => {
    await page.goto("/dashboard");
    await settledClick(page, page.getByRole("button", { name: /i agree & continue/i }));
    // DashboardConsentGate's onPublish immediately router.push()es to /dashboard/consent — the
    // transient "Consent recorded" success text this same click also sets is replaced by that
    // navigation before it would ever be observable here. That page's own status banner (built
    // from the freshly-persisted consentStatus) is the durable, actually-checkable outcome.
    await expect(page).toHaveURL(/\/dashboard\/consent/);
    await expect(page.getByText(/consent given.*visible to recruiters/i)).toBeVisible();

    const profile = await prisma.graduateProfile.findFirstOrThrow({
      where: { user: { email: applicantEmail } }
    });
    expect(profile.consentStatus).toBe("ACKNOWLEDGED");
    expect(profile.publicProfileEnabled).toBe(true);
  });

  await journey.step("The published profile is visible in the public graduate directory", {
    actor: "applicant",
    process: "Final Mission & Public Profile",
    proves: "The full loop closes end to end: /api/graduates requires no authentication (apps/applicant/app/api/graduates/route.ts), so this is exactly what an outside visitor — not just the applicant's own session — would see"
  }, async (page) => {
    // publicName() (packages/db/src/graduates.ts) falls back to the email's local part whenever
    // User.name is unset, so this reads the actual persisted value rather than assuming Keycloak's
    // firstName/lastName made it onto the Prisma row on first login.
    const user = await prisma.user.findUniqueOrThrow({ where: { email: applicantEmail } });
    const displayName = user.name?.trim() || applicantEmail.split("@")[0];

    await page.goto("/graduates");
    // The directory defaults to 6-per-page, sorted by highest rating, across every tenant's
    // published graduates (it is a public, cross-tenant directory by design — v0.20.3). With
    // enough other fixtures' profiles in the local database, this applicant's rating can easily
    // land past page 1 — searching by name is what a real visitor would do to find them, and
    // sidesteps depending on where this run's rating happens to sort among everyone else's.
    await page.fill('input[placeholder="Search by name or skills..."]', displayName);
    await expect(page.getByRole("heading", { name: displayName, level: 3 })).toBeVisible();
  });
});
