# TalentOS Portal Workflow QA Report

**Date:** 2026-07-14  
**Tester:** Local developer QA assisted by Codex  
**Environment:** Docker-based local TalentOS environment on Windows/Google Chrome

## Executive summary

The core TalentOS environment is operational. All five portal surfaces were opened and authenticated successfully: Applicant, Admin, Operations, Keycloak Administration, and MinIO. The automated end-to-end regression suite completed with **35 passed, 0 failed, and 1 documented skip**. Across 30 authenticated browser page checks, no page-level crash, access-denied result, generic error page, or not-found page was detected when using the correct account.

The most important issues found are:

1. The Admin Operations page incorrectly reports the Applicant Portal as unhealthy even while the applicant portal and the separate Operations Console confirm it is healthy.
2. Applicant learning resources contain the Rick Astley placeholder video instead of real curriculum videos.
3. A submitted assignment still exposes the **New entry** journal action, but the destination is locked and cannot be used.
4. One applicant navigation produced a React hydration error in the browser console even though the page remained usable.
5. The storage upload/download regression case is still skipped, so this workflow does not yet have complete automated coverage.

## Test scope and results

| Area | Checks performed | Result |
|---|---|---|
| Environment health | Docker, PostgreSQL, Keycloak, MinIO, Applicant, Admin, and Operations health checks | Passed |
| Authentication smoke tests | Normal applicant, accepted applicant, organisation admin, and Operations access | Passed |
| Applicant Portal | Dashboard, program, missions, mission detail, journal, new journal entry, tasks, resources, calendar, notifications, profile, and AI mentor | All pages opened successfully |
| Admin Portal | Overview, applications, application detail, programs, program detail/content, missions, mission detail, operations, and settings | All pages opened successfully |
| Operations Console | Authenticated access and full health run | Passed; 13 healthy checks |
| Keycloak Administration | Signed in and reached the master administration console | Passed |
| MinIO Console | Signed in and reached Object Browser | Passed |
| Automated regression | Application, mission assignment, journals, submissions, review decisions, repeat flow, CRUD, persistence, progress, and tenant isolation | 35 passed, 0 failed, 1 skipped |

The three supplied Chrome recordings were also reviewed frame-by-frame and compared with the live environment.

## Findings

### P1 — Admin Operations gives a false Applicant Portal health failure

**Observed:** The Admin Portal's Operations page shows the Applicant Portal as unhealthy and reports a failed fetch to `http://lvh.me:3100`. At the same time:

- the Applicant Portal is usable in Chrome;
- the local environment doctor reports it healthy; and
- the separate Operations Console health run reports all 13 checks healthy.

**Impact:** An administrator can be told that production-like infrastructure is broken when it is actually available. This reduces confidence in the health dashboard and can waste debugging time.

**Likely cause:** The check appears to run from inside a container. In that context, `lvh.me` resolves to loopback for that container rather than to the Applicant service. The server-side check should use the Docker service hostname/internal URL, while any browser-side check can continue using the public local URL.

**Recommendation:** Configure separate internal and public health URLs, and show which check failed (server-side or browser-side) in the Operations UI.

### P1 — Placeholder videos are exposed as real learning resources

**Observed:** The Applicant Resources page contains five YouTube embeds using video ID `dQw4w9WgXcQ` (Rick Astley), including resources presented as legitimate TalentOS curriculum.

**Impact:** Applicants can interpret placeholder content as finished learning material. It damages trust and prevents proper completion of resource-based tasks.

**Recommendation:** Replace seed placeholders with the actual Week 1 videos. Until the videos exist, visibly label these resources as draft/unavailable rather than embedding unrelated content.

### P2 — New journal entry action remains visible after journal lock

**Observed:** For the accepted applicant whose assigned mission has already been submitted, the Journal page still allows navigation to **New entry**. The destination then says that the journal is locked because the mission was submitted.

**Impact:** The button suggests an available action and leads to a dead end.

**Recommendation:** Disable or hide **New entry** when the current assignment is locked. Show the lock reason directly on the journal page and retain read-only access to existing entries.

### P2 — Applicant browser emitted a React hydration error

**Observed:** During the authenticated applicant page sweep, Chrome emitted React minified error `#418`, indicating that server-rendered text did not match the client render. The visible page remained usable.

**Impact:** Hydration mismatches can cause brief visual changes, discarded server markup, inconsistent event binding, and harder-to-reproduce UI bugs.

**Recommendation:** Run the Applicant Portal in development mode and reproduce navigation across dashboard/resources/mentor pages to obtain the full component stack. Check client-only dates, countdowns, locale-formatted text, and browser-dependent rendering first.

### P2 — Storage upload/download workflow lacks automated coverage

**Observed:** The regression suite intentionally skipped the storage browser upload/download scenario. Its recorded reason is that the full CV upload/download scenario is still missing and is planned for a storage-focused slice.

**Impact:** A regression in CV upload, object persistence, authorization, or download could reach reviewers without being detected by the main suite.

**Recommendation:** Add a real browser test that uploads a small fixture, confirms it appears for the correct applicant/reviewer, downloads it, verifies its contents, and removes test data.

### P2 — Existing accepted applicants have a documented mission backfill gap

**Observed:** The suite currently treats “a pre-existing accepted applicant with no mission assignment sees no missions” as the expected behavior.

**Impact:** Existing accepted users can become stuck without work after assignment automation is introduced.

**Recommendation:** Add an idempotent backfill/migration for accepted applications without assignments, followed by a regression test that expects a valid Week 1 assignment.

### P3 — Local hostname resolution depends on `lvh.me`

**Observed:** One automated run temporarily failed to resolve `demo.lvh.me`. The application itself remained healthy, and forcing the Chrome resolver to map `*.lvh.me` to `127.0.0.1` made the browser pass stable.

**Impact:** Local development can fail when DNS or internet access is restricted even though all services are running locally.

**Recommendation:** Add the required local hostnames to the developer setup instructions/hosts file, or provide a local DNS-free alternative.

### P3 — Login UI loads an external provider icon

**Observed:** The Admin login flow requested the Keycloak provider icon from `https://authjs.dev`. In an offline/restricted environment the request fails, although login remains functional.

**Impact:** Cosmetic degradation and an unnecessary third-party runtime dependency.

**Recommendation:** Bundle the provider icon with the application.

## Workflow observations from the recordings

- Applicant navigation among Missions, Tasks, Resources, Notifications, Profile, and AI Mentor was smooth and consistent.
- The AI Mentor rendered its guidance cards successfully in the supplied recording and live portal pass.
- Admin access was correctly denied when an accepted-applicant session was used. This is correct role-based access control, not a security defect.
- The testing dashboard should tell testers to sign out or use an Incognito window before switching from Applicant to Admin, otherwise the correct access-denied behavior can look like a broken portal.
- Keycloak and MinIO both accepted the repository's configured local credentials and reached their authenticated consoles.

## Regression presentation improvement

The regression page should make every case auditable rather than showing only totals. Recommended columns:

| Field | Purpose |
|---|---|
| Case ID and name | Makes the exact behavior identifiable |
| Portal/workflow | Groups Applicant, Admin, Storage, Auth, and Infrastructure cases |
| Status | Passed, Failed, Skipped, or Not Run |
| Duration | Highlights slow or hanging cases |
| Steps performed | Shows what the automated test actually did |
| Expected and actual result | Makes failures understandable without reading logs |
| Skip reason | Required whenever status is Skipped |
| Evidence | Screenshot, trace, video, or log link |

Skipped cases should appear as their own visible section with a reason, owner, and planned follow-up—not only as a small count in the summary. The current run would therefore clearly show **35 Passed / 0 Failed / 1 Skipped**, with the storage browser upload/download case listed by name and reason.

## Suggested retest order

1. Correct the Admin Operations Applicant health URL and verify both internal and browser checks.
2. Replace placeholder resource videos and verify every resource-task pairing.
3. Correct journal locked-state actions and test before and after mission submission.
4. Investigate the applicant hydration mismatch in a development build.
5. Automate the skipped storage workflow and remove the accepted-applicant backfill gap.
6. Repeat the full regression suite and a short Chrome walkthrough for Applicant and Admin.

## Evidence produced

- Browser audit data: `.ops/qa/portal-audit.json`
- Authenticated infrastructure audit: `.ops/qa/infra-auth-audit.json`
- Portal screenshots: `.ops/qa/screenshots/`
- Recording contact sheets: `.ops/video-review/`
- Regression run ID: `regression-20260714143627-9d234fa9`

The `.ops` evidence directory is local/ignored test output. This report is the shareable source-controlled artifact.
