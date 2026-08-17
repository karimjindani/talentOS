# TalentOS Weekly Meeting Implementation Audit

Date: 2026-07-14  
Meeting reviewed: Weekly meet TalentOS, 2026-07-12  
Repository baseline: `main` at `f5bc88c`  
Audit scope: current implementation, meeting-gap analysis, and regression-suite visibility improvements

## Executive Summary

TalentOS is no longer an early prototype. The repository contains a substantial multi-tenant platform with separate Applicant, Admin, and local Operations applications; Keycloak authentication; PostgreSQL/Prisma persistence; program and mission management; mission assignment; submissions; Engineering Journal entries; an AI Mentor skeleton; and unit plus scenario regression infrastructure.

The July 12 meeting requirements are **partly implemented**, but the complete applicant learning loop is not yet ready. The strongest completed areas are application acceptance, initial Week 1 mission assignment, journal capture, submission/review foundations, repeat-attempt history, and scenario-level regression output. The largest missing area is the mission lifecycle itself: applicants cannot explicitly accept a mission, no acceptance-based deadline exists, acceptance does not assign the next week's mission, and the repeat flow assigns the same mission rather than a second mission variant.

Submission readiness is also incomplete. The current backend accepts a submission with any one evidence link, does not require four journal entries, does not require all tasks to be complete, and performs no URL reachability or GitHub-public checks. The Admin Portal lacks the requested top-level, filterable Submissions tab and scoring workflow. It still exposes a **Request changes** decision that the meeting explicitly removed.

The regression-suite visibility request was substantially addressed in `v0.18.3`: every executed scenario can now be rendered with its status, duration, and message. However, the page still cannot clearly distinguish **not selected/not run** cases from true runtime skips, an all-skipped area can be labelled “passed,” skip explanations are styled as errors, and the UI behavior lacks a real browser/DOM-level automated test.

## Project Map

### Runtime applications

| Area | Location | Responsibility |
| --- | --- | --- |
| Applicant Portal | `apps/applicant` | Application flow, accepted-applicant dashboard, assigned missions, tasks/resources, Engineering Journal, evidence submission, AI Mentor UI |
| Admin Portal | `apps/admin` | Application review, program/content CRUD, mission CRUD, per-mission submission review, tenant settings and organizations |
| Operations Console | `apps/ops` | Local health checks, scenario regression execution, cleanup/reset controls, Keycloak-gated local operations |

### Shared packages and infrastructure

| Area | Location | Responsibility |
| --- | --- | --- |
| Database | `packages/db` | Prisma schema, migrations, seed data, and tenant-scoped domain helpers |
| Authentication/authorization | `packages/auth` and `packages/auth-web` | Capabilities, status transitions, tenant roles, OIDC/session helpers |
| UI | `packages/ui` | Shared branding and UI helpers |
| Regression runner | `scripts/regression/run.ts` | Area-based product scenarios and structured result JSON |
| Local environment | `docker-compose.yml`, `keycloak`, `scripts/local` | PostgreSQL, Keycloak, MinIO, portals, bootstrapping and diagnostics |
| Engineering records | `docs/plans`, `docs/testing`, `docs/Decision_Log.md` | Versioned plans, test results, decisions and SSDLC evidence |

At the audited baseline the repository contains approximately 401 tracked files and 192 commits. The README's release history documents delivery through `v0.18.2`; versioned plan/test documents also include `v0.18.3`, while the latest merged commits describe AI Mentor streaming work as `v0.18.4`. These version declarations should be reconciled.

## What Is Implemented So Far

### Platform and application foundation

- Separate Applicant and Admin Next.js applications, plus an independent local Ops Console.
- Multi-tenant data model with host-based tenant resolution and tenant-scoped reads/writes.
- Keycloak-based authentication, role/capability checks, logout, and local credentials/bootstrap documentation.
- Program application lifecycle and admin application review.
- Program, mission, task, video-resource, and calendar-event administration.
- MinIO-based file storage foundation.
- White-label tenant settings and organization management.

### Learning workflow foundation

- Accepting a program application creates a balanced/random Week 1 mission assignment.
- Applicants see only assigned published missions instead of every published mission.
- Mission assignment attempts are stored separately, preserving repeat history.
- Applicants can save evidence drafts and submit them for review.
- Reviewers can accept, request revision, or repeat an attempt.
- A repeat decision closes the current assignment and creates another attempt.
- Dedicated Engineering Journal pages support structured daily entries, past dates, evidence links, language preference, edit/view modes, and locking after submission.
- Admin review displays current and previous-attempt journal entries.
- Task completion and mission acceptance contribute to dashboard progress calculations.
- AI Mentor scaffolding, contextual data, persistent conversations, and streaming response parsing are present.

### Quality and operations foundation

- Vitest unit/integration-style tests are distributed across the apps and shared packages.
- The scenario runner covers functional areas such as auth, applicant, admin, programs, missions, journal, tenant, dashboard, storage, and ops.
- Runs emit a structured `REGRESSION_RESULT_JSON` payload and save JSON results under `.ops/regression-results` when possible.
- Since `v0.18.3`, the Ops Console retains individual scenario results and shows scenario name, status, duration, and error/detail text.
- The latest committed test record reports 245 unit tests passing and 28 regression scenarios: 25 passed, 0 failed, 3 skipped. This audit could not independently rerun them because dependency installation did not finish within the available environment; see Validation Notes.

## Meeting Requirement Gap Matrix

Legend: **Done** = present and aligned; **Partial** = foundation exists but behavior differs; **Missing** = no end-to-end implementation found.

### Applicant flow and mission assignment

| Requirement | Status | Evidence and gap |
| --- | --- | --- |
| Applicant manually selects a program | Done | Apply flow uses published programs and persists an application. |
| Accepted applicant gets a mission | Done for Week 1 | `assignWeekMissionToAcceptedApplicantTx` assigns a published Week 1 mission after application acceptance. |
| Explicit **Accept Mission** action | Missing | Assignment is created immediately with `ACTIVE`; there is no offered/not-started state, `acceptedAt`, or accept action. See `packages/db/src/mission-assignments.ts`. |
| States: Not Started, Accepted, In Progress, Submitted, Pending Evaluation | Missing/unaligned | `MissionAssignmentStatus` currently has only `ACTIVE`, `SUBMITTED`, `PASSED`, `REPEAT`; submission status is handled separately. The requested applicant-facing lifecycle is not modelled. |
| Countdown starts on acceptance | Missing | Assignment has `assignedAt` but no `acceptedAt` or `dueAt`. |
| Deadline auto-assigned | Missing | Mission assignments have no deadline/duration policy. Program tasks may have independent `dueAt`, which is not the mission deadline. |
| Dashboard headline: accepted, tasks completed, days remaining | Partial | Dashboard shows progress/current mission, but has no acceptance/deadline countdown. It also hardcodes Week 1 tasks as current at `apps/applicant/app/dashboard/page.tsx:59`. |
| Rejected applicant repeats Week 1 with a second mission | Partial and behavior mismatch | Repeat creates Attempt 2, but reuses `assignment.missionId`; it does not select a different Week 1 mission variant. See `packages/db/src/mission-assignments.ts:145`. |
| Accepted submission moves to next week | Missing | Review marks the assignment `PASSED` but does not assign Week N+1. |
| Verify Week 1→2→3 and reject loop end to end | Partial | Repeat-attempt regression exists. No multi-week acceptance/assignment scenario exists because next-week assignment is absent. |

### Tasks, resources, and Engineering Journal

| Requirement | Status | Evidence and gap |
| --- | --- | --- |
| Tasks linked to week, not mission | Done | `ProgramTask` has `programId` and `weekNumber`, not `missionId`. |
| All tasks complete before mission submission | Missing | `submitSubmission` does not query `ProgramTask`/`UserTaskCompletion`. |
| Every task links to Markdown + YouTube resource | Missing | `ProgramTask` and `VideoResource` are independent models with no relation. There is no Markdown resource model/content field. |
| Week 1 setup/Git/GitHub/AI-assisted coding tasks | Missing from seed | Program-content CRUD exists, but the audited seed does not create these three paired Week 1 resources/tasks. |
| Intro to TalentOS video | External content pending | No verified seeded TalentOS introduction video was found. Recording/hosting is a team content task outside the codebase. |
| Journal fields requested | Mostly done | Date, work, challenge, solution, learning, AI use, confidence, time, and evidence links exist. `solution` and `learned` are useful additions. |
| Placeholder/example text on text fields | Done | Textareas contain guidance placeholders. |
| Confidence as 1–5 stars with tooltip | Partial | Backend validates 1–5, but UI is a numeric select with no star interaction or rating explanation tooltip. |
| Block future dates | Missing | The form has no `max` date, and `normalizeEntryDate` normalizes but does not reject future dates. This must be enforced server-side as well as in the UI. |
| Multiple entries per week; past dates allowed | Done with one restriction | Multiple dates per week work. Database uniqueness permits only one entry per applicant per calendar date, regardless of week/mission. Confirm this policy is desired. |
| Store actual submission date separately | Done | `EngineeringJournalEntry.createdAt` is separate from `entryDate`; mission `Submission.submittedAt` is also stored. |
| Minimum four journal entries before submit | Missing | No count check exists in `submitSubmission`. |

### Submission checklist

| Requirement | Status | Evidence and gap |
| --- | --- | --- |
| Require GitHub, deployed app, and Loom URLs | Missing | Backend only requires at least one of the three (`packages/db/src/submissions.ts:231`). |
| GitHub repository must be public | Missing | Host is validated as GitHub, but repository visibility is not checked. |
| Deployed URL must be accessible | Missing | URL syntax is checked; no reachability check runs. |
| Loom URL required and checked | Partial | Loom host validation exists, but it is optional and not checked for reachability/visibility. |
| Minimum journal count shown in checklist | Missing | No applicant-facing readiness checklist or server validation. |
| Basic URL checks immediately on submit | Missing | No timeout-controlled network validation service/result model exists. |

### Admin review portal and scoring

| Requirement | Status | Evidence and gap |
| --- | --- | --- |
| Top-level Submissions tab | Missing | Admin navigation contains Missions but no Submissions item. Submissions are nested under each mission. |
| Pending reviews table | Partial | Each mission page lists its own submissions; no tenant-wide pending queue. |
| Filter by status and program | Missing | No global submission list/query/filter UI. |
| Review URLs and journals | Done | Per-submission review page shows evidence and current/previous journal entries. |
| 1–5 star scoring | Missing | Journal schema has future AI scoring fields, but submission/human review scoring and UI are absent. |
| AI score first, human accept/override | Missing | No submission AI score contract or pending placeholder on the review page. |
| Accept or Repeat Week only | Not aligned | UI and state machine still support `NEEDS_REVISION` and show **Request changes** (`apps/admin/app/missions/[id]/submissions/[submissionId]/page.tsx:333`). |
| Front-end checks prevent bad reviewer submissions | Missing | Required task/journal/URL readiness checks do not exist. |
| Team Loom walkthrough | External team action | Cannot be verified from repository code. A recording URL/process can be documented once completed. |

## Prioritized Improvement Findings

### P0 — Complete the mission assignment state machine

Create a single authoritative applicant-facing lifecycle rather than inferring it from assignment plus submission records.

Recommended minimum changes:

1. Add assignment states such as `OFFERED`, `ACCEPTED`, `IN_PROGRESS`, `SUBMITTED`, `PENDING_EVALUATION`, `PASSED`, and `REPEAT` (exact naming can follow product language).
2. Add `acceptedAt`, `dueAt`, and optionally `completedAt` to `MissionAssignment`.
3. Add an applicant accept action that atomically changes `OFFERED → ACCEPTED`, sets `acceptedAt`, and computes `dueAt` from an automatic program/week policy.
4. Define when `ACCEPTED → IN_PROGRESS` happens: first task completion, first journal entry, or first submission draft. Do not leave this implicit.
5. On submission, atomically transition to the pending-evaluation state.
6. On review acceptance, mark the current attempt passed and assign a Week N+1 mission in the same transaction.
7. On repeat, choose another eligible mission for the same week, excluding previously attempted mission IDs where possible. Define a fallback if a week has only one published mission.
8. Make review idempotent and preserve the existing latest-attempt guard.

Required regression scenarios:

- Applicant sees an offered mission and explicitly accepts it.
- Acceptance sets `acceptedAt` and deterministic `dueAt` exactly once.
- Duplicate accept is harmless/rejected without resetting the deadline.
- Week 1 acceptance by reviewer creates exactly one Week 2 assignment.
- Week 2 acceptance creates exactly one Week 3 assignment.
- Repeat creates Attempt 2 in the same week with a different mission when available.
- Reviewing an old attempt cannot create another assignment.
- Concurrent review requests cannot create duplicate next-week/repeat assignments.

### P0 — Enforce submission readiness on the server

The UI may explain readiness, but the transaction must be the authority. Before changing a submission to submitted:

- Require all three evidence URLs.
- Require all program tasks for the assignment week to be complete.
- Require at least four journal entries linked to the current `missionAssignmentId`.
- Validate URLs using a dedicated, timeout-controlled service.
- Verify a GitHub repository is public through the GitHub API or a carefully defined unauthenticated response policy.
- Record each check's status, timestamp, normalized URL, HTTP outcome, and safe failure reason so results are auditable and not repeated unnecessarily.
- Protect the reachability feature against SSRF: allow only HTTP(S), resolve and reject loopback/private/link-local targets, limit redirects, cap response size, and use short connect/overall timeouts.

Do not rely only on disabling the button: stale pages, direct requests, and concurrent changes must still be rejected in `submitSubmission`.

### P0 — Align the review decision model

The meeting chose only **Accept** or **Repeat Week**. Remove `NEEDS_REVISION` from new transitions and UI after confirming whether old database rows must remain readable. A safe migration strategy is to keep the enum value for historical compatibility temporarily but make it unreachable for new reviews.

Add a confirmation step for Repeat Week because it closes an attempt and creates a new assignment. Require reviewer feedback for Repeat; decide whether Accept feedback is optional.

### P1 — Add the Admin Submissions queue and scoring

Add a top-level `/submissions` route with:

- Default filter: pending evaluation.
- Filters: status, program, week, reviewer/unassigned, and date range.
- Stable pagination and deterministic newest-first ordering.
- Columns: applicant, program, mission/week/attempt, submitted time, validation readiness, AI score status, and review status.
- Deep link to the existing review page.

Add a review score model rather than overloading journal AI fields. It should preserve AI and human values separately, for example: AI score/details/version/status, human score, override reason, reviewer, and timestamps. Display **AI review pending** until integration exists, then let the reviewer explicitly accept or override the AI recommendation.

### P1 — Link tasks to real resource records

Replace the current parallel task/video lists with explicit relations. A task may need more than one resource, so a join model is more flexible than a single foreign key:

- `LearningResource`: title, type (`MARKDOWN`, `YOUTUBE`, etc.), Markdown body/file reference, external URL, duration, publication status.
- `ProgramTaskResource`: task ID, resource ID, order, required/optional.

Seed the three agreed Week 1 tasks and paired content. Avoid treating a Markdown filename as trusted content without a controlled content root and rendering policy.

### P1 — Fix Engineering Journal date and confidence UX

- Reject `entryDate` later than the applicant's current calendar date on the server using an explicit tenant/user timezone policy.
- Set the date input's `max` for immediate feedback, but do not use it as the only enforcement.
- Render five accessible star buttons/radios with labels such as “1 — very unsure” through “5 — very confident.”
- Add a tooltip/help description explaining that confidence reflects how independently and clearly the applicant understands the day's work.
- Confirm whether the global one-entry-per-day uniqueness rule is intentional; the meeting only said multiple entries per week, not one per day.

### P1 — Make dashboard progress assignment-driven

Remove the hardcoded Week 1 task filter. Derive the current week from the latest active/offered assignment and show:

- Mission accepted/not accepted.
- Completed tasks / total tasks for that assignment week.
- Exact days, hours, and minutes remaining using `dueAt`.
- Overdue state and timezone.
- Submission/readiness state.

The server should return timestamp values; the client may update the countdown display, but authorization and deadline decisions must remain server-side.

### P2 — Reconcile release and documentation versions

The README says the current documentation version is `v0.18.2`; `v0.18.3` plan/results are present; recent merged commit messages reference `v0.18.4`. Reconcile the authoritative version declarations and follow `AGENTS.md` version-allocation rules before assigning the next version.

## Regression Suite Page Review

### What already works

The `v0.18.3` work addresses the core first step well:

- The runner emits every executed scenario with `area`, `name`, `status`, `durationMs`, and optional detail/error.
- Ops job parsing retains scenario-level results.
- Results are grouped by functional area.
- Passed, failed, and skipped scenarios receive visible text status pills.
- Failure and skip messages can be read without searching raw logs.
- Aggregate-only payloads remain backward compatible.

### Remaining clarity problems

1. **Not run is invisible.** Running one selected area returns only selected scenarios. Cases from other areas disappear, so a viewer cannot tell whether they were not selected, not discovered, or accidentally omitted.
2. **Skipped and not run are not distinct concepts in the UI.** A runtime skip is shown, but the complete expected-case catalog is unavailable for comparison.
3. **An all-skipped area can appear passed.** Area status is computed only as `failed > 0 ? failed : passed` in `apps/ops/src/ui.ts:1219`. An area with zero passed and one skipped is labelled passed.
4. **Skip reasons look like errors.** Skips are transported in the `error` property and `scenario.error` triggers `regression-scenario-error` styling at `apps/ops/src/ui.ts:1238-1243`.
5. **Passed cases often lack useful performed-step detail.** The name states the outcome but not necessarily the concrete checks performed. A short assertion/evidence summary would make the run auditable.
6. **No stable case identifier.** Names are human-readable but can change, making history comparison and linking difficult.
7. **Limited navigation for larger suites.** There is no status filter, search, expand/collapse-all control, or dedicated skipped-only view.
8. **UI behavior is weakly tested.** Current coverage verifies parser behavior and that generated assets contain expected strings. It does not execute DOM rendering and assert that names, statuses, reasons, and counts appear correctly.
9. **Historical results are not surfaced.** JSON files are written locally, but the page focuses on the current job and does not compare runs or expose the last run per area.

### Recommended regression result contract

Maintain a static scenario catalog and join it to run results:

```ts
type RegressionCaseDefinition = {
  id: string;             // e.g. MISS-REPEAT-002
  area: RegressionArea;
  name: string;
  purpose: string;
};

type RegressionCaseResult = {
  caseId: string;
  status: "passed" | "failed" | "skipped" | "not_run";
  durationMs?: number;
  summary?: string;       // what was performed/verified
  reason?: string;        // mandatory for skipped/not_run; useful for failure
  startedAt?: string;
};
```

Use `reason`, not `error`, for skipped/not-run states. Reserve `error` or structured diagnostics for failures.

### Recommended page layout

1. Run header: run ID, selected scope, branch/commit, start/end time, duration, environment, and overall result.
2. Four summary counters: Passed, Failed, Skipped, Not Run.
3. Filter bar: area, status, text search, and “show only attention needed.”
4. Area sections with correct roll-up states:
   - Failed if any case failed.
   - Warning/Skipped if none failed and at least one skipped.
   - Not Run if no case executed.
   - Passed only if every selected/required case passed.
5. Case row: stable ID, case name, performed summary, status, duration, and reason/diagnostics.
6. Skipped cases expanded by default, because the reason is the important information.
7. Historical link/download for the saved JSON result.

### Regression page acceptance tests

- A payload with one pass, one fail, one skip, and one catalog-only case renders all four statuses.
- Every skipped case without a reason is treated as invalid data or shows “Reason not provided.”
- An area containing only skipped cases is not labelled passed.
- A selected-area run marks unselected catalog cases `not_run`, with reason “Outside selected run scope.”
- Status filters return the correct visible rows and counts.
- HTML is escaped for scenario names, summaries, reasons, and diagnostics.
- Keyboard users can expand/collapse area and case details.
- Parser fallback still displays aggregate cards for legacy payloads.
- A DOM-level test verifies the exact scenario rows rather than only checking source strings.

## Suggested Delivery Sequence

1. Product decision pass: finalize exact mission states, deadline policy, repeat mission-selection fallback, timezone, and whether legacy Request Changes remains readable only.
2. Mission lifecycle migration and domain service, including explicit acceptance and next-week/repeat assignment.
3. End-to-end lifecycle regression: Week 1→2→3 plus repeat loop and concurrency/idempotency cases.
4. Task-resource relation and Week 1 seeded learning content.
5. Submission-readiness service with task, journal, required URL, reachability, GitHub-public, and SSRF protections.
6. Applicant readiness checklist and dashboard countdown/current-week correction.
7. Admin global Submissions queue and two-decision review flow.
8. AI/human scoring contract and pending placeholder.
9. Regression catalog plus `not_run`, reason semantics, roll-up correction, filters, and DOM tests.
10. Documentation/version reconciliation and updated user guides/screenshots.

## Definition of Done for the Meeting Slice

The meeting work should not be considered complete until a fresh applicant can complete this automated journey:

1. Apply to a selected program and receive one Week 1 mission offer after acceptance.
2. Explicitly accept the mission and receive an immutable automatic deadline.
3. Complete every Week 1 task, with each task opening its Markdown and YouTube resource.
4. Create at least four valid, non-future Engineering Journal entries.
5. Provide all three valid evidence URLs and pass immediate safe reachability/public checks.
6. Submit; verify the mission enters pending evaluation and evidence/journals lock consistently.
7. Reviewer finds it in the global pending Submissions queue, sees AI pending/score, chooses a 1–5 human score, and accepts or repeats.
8. Accept path creates Week 2 exactly once; a later accept creates Week 3 exactly once.
9. Repeat path creates a different Week 1 mission Attempt 2 when available and preserves Attempt 1 evidence/journals.
10. The Ops Console lists every expected regression case as passed, failed, skipped with a reason, or not run with a reason.

## Validation Notes

- Repository cloned successfully from `karimjindani/talentOS` into `C:\Users\Rashid\Documents\TalentOS\talentOS`.
- Audit was performed against clean `main` at commit `f5bc88c` before this document was added.
- Source, schema, versioned plans/test reports, recent history, and regression runner/Ops renderer were inspected.
- `npm.cmd ci --ignore-scripts` was attempted twice. The sandboxed attempt was denied registry/cache access; the approved attempt timed out before producing a complete `node_modules` installation.
- `npm.cmd test` could therefore not run because `vitest` was unavailable. This report cites the committed `v0.18.3` results but does not claim a fresh passing test run.
- Full scenario regression additionally requires the bootstrapped Docker/Keycloak/PostgreSQL/MinIO local environment.

