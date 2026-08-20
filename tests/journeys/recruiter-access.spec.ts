// tests/journeys/recruiter-access.spec.ts
import type { Locator, Page } from "@playwright/test";
import { generateSecureToken, hashToken, markRegressionData } from "@talentos/db";
import { journeyEmail } from "./fixtures/keycloak";
import { JOURNEY_PASSWORD, completeLogin } from "./fixtures/actors";
import { expect, test } from "./fixtures/journey";
import { provisionPublishedGraduate, type PublishedGraduate } from "./fixtures/graduate";
import { prisma } from "./fixtures/tenant";

/**
 * Same race this guards against as applicant-arc.spec.ts's settledClick (see that file's longer
 * comment for the full root-cause writeup): a click-then-networkidle wait can resolve before the
 * click's own fetch has even started, so this arms the response listener first.
 *
 * Unlike applicant-arc's version, this journey's mutating buttons don't agree on an HTTP method —
 * RecruiterAccessModal and the save-candidate toggle POST, but RecruiterRequestActions PATCHes
 * (apps/admin/app/api/recruiter-requests/[id]/route.ts) — so this waits for either.
 */
async function settledClick(page: Page, locator: Locator): Promise<void> {
  await Promise.all([
    page.waitForResponse((response) => ["POST", "PATCH"].includes(response.request().method())),
    locator.click()
  ]);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
}

test("recruiter completes the full access-request lifecycle through real browser sessions on both portals", async ({
  journey
}) => {
  const recruiterEmail = journeyEmail(journey.runId, "recruiter");
  let graduate!: PublishedGraduate;
  let recruiterRequestId!: string;
  let pendingRawToken!: string;
  let approvedRawToken!: string;

  await journey.step("A published, consented graduate profile exists", {
    actor: "system",
    process: "Recruiter Journey",
    proves: "Seeds one applicant with four accepted, rated missions and a published graduate profile — not a user action, the shared precondition every step below needs (see fixtures/graduate.ts)"
  }, async () => {
    graduate = await provisionPublishedGraduate(journey.tenant, journey.runId);
  });

  await journey.step("Recruiter browses the public directory and requests full-profile access", {
    actor: "recruiter",
    process: "Recruiter Journey",
    proves: "The published graduate is publicly discoverable, and the directory's 'Access Full Profiles' modal creates a PENDING RecruiterAccessRequest"
  }, async (page) => {
    await page.goto("/graduates");
    // The directory defaults to 6-per-page, sorted by highest rating, across every tenant's
    // published graduates (a public, cross-tenant directory by design — v0.20.3). Searching by
    // name is what a real visitor would do to find this specific graduate, and avoids depending
    // on where this run's rating happens to sort among everyone else's.
    await page.fill('input[placeholder="Search by name or skills..."]', graduate.name);
    await expect(page.getByRole("heading", { name: graduate.name, level: 3 })).toBeVisible();

    await page.getByRole("button", { name: /access full profiles/i }).click();
    await page.fill('input[name="recruiterName"]', "Jordan Rivera");
    await page.fill('input[name="recruiterEmail"]', recruiterEmail);
    await page.fill('input[name="recruiterOrganization"]', "Talent Scouts Inc.");
    await page.fill('input[name="recruiterDesignation"]', "Senior Technical Recruiter");
    await page.fill('textarea[name="hiringRequirement"]', "Hiring for a platform engineering role.");
    await settledClick(page, page.getByRole("button", { name: /submit access request/i }));
    await expect(page.getByText(/access request submitted/i)).toBeVisible();

    const request = await prisma.recruiterAccessRequest.findFirstOrThrow({ where: { recruiterEmail } });
    recruiterRequestId = request.id;
    expect(request.status).toBe("PENDING");
    // RecruiterAccount has no relation back to User/Tenant (v0.20.3, D-103) — it must be marked
    // for regression cleanup explicitly or this run leaks one row.
    if (request.recruiterId) {
      await markRegressionData({ runId: journey.runId, entityType: "RecruiterAccount", entityId: request.recruiterId });
    }
    // The request attaches to "the first public graduate profile" in the whole database
    // (apps/applicant/app/api/graduates/request-access/route.ts) — not necessarily this run's own
    // one — so its GraduateProfile/User cascade cannot be relied on to reap it (v0.20.5).
    await markRegressionData({ runId: journey.runId, entityType: "RecruiterAccessRequest", entityId: request.id });
  });

  await journey.step("A known access token is bound to the still-PENDING request", {
    actor: "system",
    process: "Recruiter Journey",
    proves: "RecruiterAccessRequest.token is a one-way hash never returned to any caller, by design (packages/db/src/graduates.ts:176) — the harness injects a known value here so a browser-only journey can drive /graduates/verify itself. See docs/plans/v0.20.4_Recruiter_Access_Browser_Journey.md Security and Data Rules"
  }, async () => {
    pendingRawToken = generateSecureToken();
    await prisma.recruiterAccessRequest.update({
      where: { id: recruiterRequestId },
      data: { token: hashToken(pendingRawToken) }
    });
  });

  await journey.step("The still-PENDING request refuses verification", {
    actor: "recruiter",
    process: "Recruiter Journey",
    proves: "consumeRecruiterAccessToken refuses a PENDING request until admin approval (packages/db/src/graduates.ts:264) and the UI surfaces that as 'Access Pending Review'"
  }, async (page) => {
    await page.goto(`/graduates/verify?token=${pendingRawToken}`);
    await expect(page.getByRole("heading", { name: /access pending review/i })).toBeVisible();
  });

  await journey.step("Admin approves the request via a real browser session", {
    actor: "reviewer",
    process: "Recruiter Journey",
    proves: "The 'Approve & Send Email' button transitions the request from PENDING to APPROVED"
  }, async (page) => {
    await page.goto("/recruiter-requests?status=PENDING");
    await completeLogin(page, journey.tenant.adminEmail, JOURNEY_PASSWORD);
    await page.getByRole("link", { name: /review/i }).first().click();
    await settledClick(page, page.getByRole("button", { name: /approve & send email/i }));
    await expect(page.getByText(/request approved/i)).toBeVisible();

    const updated = await prisma.recruiterAccessRequest.findUniqueOrThrow({ where: { id: recruiterRequestId } });
    expect(updated.status).toBe("APPROVED");
  });

  await journey.step("A known access token is bound to the now-APPROVED request", {
    actor: "system",
    process: "Recruiter Journey",
    proves: "Same unrecoverable-token constraint as the PENDING case above — the real email route embeds whatever generateSecureToken() produced inside approveAccessRequest's own transaction, which this harness cannot observe"
  }, async () => {
    approvedRawToken = generateSecureToken();
    await prisma.recruiterAccessRequest.update({
      where: { id: recruiterRequestId },
      data: { token: hashToken(approvedRawToken) }
    });
  });

  await journey.step("Recruiter verifies and reaches the full portfolio", {
    actor: "recruiter",
    process: "Recruiter Journey",
    proves: "A valid APPROVED token grants a recruiter session (cookie) and redirects to a portfolio; the grant covers every published graduate, not just the one the request happened to attach to (v0.20.3 regression scenario 6, now proven through a real browser)"
  }, async (page) => {
    await page.goto(`/graduates/verify?token=${approvedRawToken}`);
    // /api/graduates/request-access attaches the request to "the first public graduate profile"
    // (apps/applicant/app/api/graduates/request-access/route.ts) — which one that is depends on
    // however many other graduates already exist in the database, not on this test's own fixture.
    // The redirect target is therefore whichever graduate that turned out to be, not necessarily
    // this journey's own one — proving the redirect landed on *some* portfolio is what verify
    // itself guarantees; reaching this journey's own graduate (checked next) is what the
    // directory-wide grant guarantees.
    await expect(page).toHaveURL(/\/graduates\/[^/]+\/portfolio/);

    await page.goto(`/graduates/${graduate.slug}/portfolio`);
    await expect(page.getByRole("heading", { name: graduate.name, level: 1 })).toBeVisible();
  });

  await journey.step("Recruiter saves the candidate", {
    actor: "recruiter",
    process: "Recruiter Journey",
    proves: "toggleSavedCandidate persists a SavedCandidate row for this recruiter+graduate pair"
  }, async (page) => {
    await settledClick(page, page.getByRole("button", { name: /save candidate/i }));
    await expect(page.getByRole("button", { name: /^saved$/i })).toBeVisible();
  });

  await journey.step("The saved candidate appears on the recruiter's own dashboard", {
    actor: "recruiter",
    process: "Recruiter Journey",
    proves: "getRecruiterDashboard reflects the save immediately, on a different page than where it was made"
  }, async (page) => {
    await page.goto("/recruiter");
    await expect(page.getByRole("heading", { name: graduate.name, level: 3 })).toBeVisible();
  });

  await journey.step("Admin revokes access via a real browser session", {
    actor: "reviewer",
    process: "Recruiter Journey",
    proves: "The 'Revoke Access' button transitions the request to REVOKED and deletes the recruiter's session"
  }, async (page) => {
    await page.goto(`/recruiter-requests/${recruiterRequestId}`);
    await settledClick(page, page.getByRole("button", { name: /revoke access/i }));
    await expect(page.getByText(/access revoked/i)).toBeVisible();

    const updated = await prisma.recruiterAccessRequest.findUniqueOrThrow({ where: { id: recruiterRequestId } });
    expect(updated.status).toBe("REVOKED");
  });

  await journey.step("The revoked token is refused at verification — revocation is total, not partial", {
    actor: "recruiter",
    process: "Recruiter Journey",
    proves: "The same previously-valid token can never be reused once revoked (consumeRecruiterAccessToken's REVOKED branch, packages/db/src/graduates.ts:262)"
  }, async (page) => {
    await page.goto(`/graduates/verify?token=${approvedRawToken}`);
    await expect(page.getByRole("heading", { name: /access revoked/i })).toBeVisible();
  });
});

test("pending and rejected recruiter access requests are refused in the browser, with the rejection reason shown on-page", async ({
  journey
}) => {
  const pendingEmail = journeyEmail(journey.runId, "recruiter-pending");
  const rejectedEmail = journeyEmail(journey.runId, "recruiter-rejected");
  let graduate!: PublishedGraduate;
  let pendingRequestId!: string;
  let rejectedRequestId!: string;
  let pendingRawToken!: string;
  let rejectedRawToken!: string;

  await journey.step("A published, consented graduate profile exists", {
    actor: "system",
    process: "Recruiter Journey",
    proves: "Same shared precondition as the lifecycle test above (see fixtures/graduate.ts)"
  }, async () => {
    graduate = await provisionPublishedGraduate(journey.tenant, journey.runId);
  });

  await journey.step("Two recruiters submit full-profile access requests for the same graduate", {
    actor: "recruiter",
    process: "Recruiter Journey",
    proves: "Each submission through the public directory's 'Access Full Profiles' modal creates its own independent PENDING request"
  }, async (page) => {
    await page.goto("/graduates");
    // Same directory-pagination reasoning as the lifecycle test's directory step above.
    await page.fill('input[placeholder="Search by name or skills..."]', graduate.name);
    await expect(page.getByRole("heading", { name: graduate.name, level: 3 })).toBeVisible();

    for (const [name, org, email] of [
      ["Alex Pending", "Pending Talent Co.", pendingEmail],
      ["Sam Rejected", "Rejected Talent Co.", rejectedEmail]
    ] as const) {
      await page.getByRole("button", { name: /access full profiles/i }).click();
      await page.fill('input[name="recruiterName"]', name);
      await page.fill('input[name="recruiterEmail"]', email);
      await page.fill('input[name="recruiterOrganization"]', org);
      await page.fill('input[name="recruiterDesignation"]', "Technical Recruiter");
      await settledClick(page, page.getByRole("button", { name: /submit access request/i }));
      await expect(page.getByText(/access request submitted/i)).toBeVisible();
      await page.getByRole("button", { name: /^close$/i }).click();
    }

    const pendingRow = await prisma.recruiterAccessRequest.findFirstOrThrow({ where: { recruiterEmail: pendingEmail } });
    const rejectedRow = await prisma.recruiterAccessRequest.findFirstOrThrow({ where: { recruiterEmail: rejectedEmail } });
    pendingRequestId = pendingRow.id;
    rejectedRequestId = rejectedRow.id;
    for (const request of [pendingRow, rejectedRow]) {
      if (request.recruiterId) {
        await markRegressionData({ runId: journey.runId, entityType: "RecruiterAccount", entityId: request.recruiterId });
      }
      // See the lifecycle test's identical note above: the request's graduate is whichever one
      // happened to be "first" in the whole database, not necessarily this run's own.
      await markRegressionData({ runId: journey.runId, entityType: "RecruiterAccessRequest", entityId: request.id });
    }
  });

  await journey.step("Admin rejects one request via a real browser session, leaving the other PENDING", {
    actor: "reviewer",
    process: "Recruiter Journey",
    proves: "The Reject action stores an admin-authored reason and moves only the rejected request out of PENDING"
  }, async (page) => {
    await page.goto(`/recruiter-requests/${rejectedRequestId}`);
    await completeLogin(page, journey.tenant.adminEmail, JOURNEY_PASSWORD);
    await page.getByRole("button", { name: /^reject$/i }).click();
    await page.getByPlaceholder(/explain why the request is being rejected/i)
      .fill("This organization's hiring focus does not match our graduates' specializations.");
    await settledClick(page, page.getByRole("button", { name: /confirm reject/i }));
    await expect(page.getByText(/request rejected/i)).toBeVisible();

    const updated = await prisma.recruiterAccessRequest.findUniqueOrThrow({ where: { id: rejectedRequestId } });
    expect(updated.status).toBe("REJECTED");
    expect(updated.rejectionReason).toContain("hiring focus");

    const untouched = await prisma.recruiterAccessRequest.findUniqueOrThrow({ where: { id: pendingRequestId } });
    expect(untouched.status).toBe("PENDING");
  });

  await journey.step("Known access tokens are bound to both requests", {
    actor: "system",
    process: "Recruiter Journey",
    proves: "Same unrecoverable-token constraint documented in the lifecycle test above — injected here for both outcomes at once"
  }, async () => {
    pendingRawToken = generateSecureToken();
    rejectedRawToken = generateSecureToken();
    await prisma.recruiterAccessRequest.update({ where: { id: pendingRequestId }, data: { token: hashToken(pendingRawToken) } });
    await prisma.recruiterAccessRequest.update({ where: { id: rejectedRequestId }, data: { token: hashToken(rejectedRawToken) } });
  });

  await journey.step("The PENDING request's token is refused", {
    actor: "recruiter",
    process: "Recruiter Journey",
    proves: "consumeRecruiterAccessToken's PENDING branch refuses a session and the UI renders 'Access Pending Review'"
  }, async (page) => {
    await page.goto(`/graduates/verify?token=${pendingRawToken}`);
    await expect(page.getByRole("heading", { name: /access pending review/i })).toBeVisible();
  });

  await journey.step("The REJECTED request's token is refused, and the admin's stated reason reaches the recruiter", {
    actor: "recruiter",
    process: "Recruiter Journey",
    proves: "consumeRecruiterAccessToken's REJECTED branch surfaces the admin's exact rejectionReason text, not a generic failure"
  }, async (page) => {
    await page.goto(`/graduates/verify?token=${rejectedRawToken}`);
    await expect(page.getByRole("heading", { name: /request rejected/i })).toBeVisible();
    await expect(page.getByText(/hiring focus does not match/i)).toBeVisible();
  });
});
