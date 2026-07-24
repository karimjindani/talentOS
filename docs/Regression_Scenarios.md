# Regression Scenarios

Code version: `v0.19.6`

## Purpose

This document defines the scenario-based regression suite for TalentOS. Unit tests remain important, but
they are not enough to protect product behavior. Scenario regression validates the logical product areas
a real applicant, admin, operator or tenant would experience.

The suite can be run from the local Ops Console or from npm scripts. As of `v0.18.3`, the Ops Console
shows individual scenario rows grouped by area after a run, so operators can see exactly which
scenario passed, failed or skipped without searching the raw output.

As of `v0.19.6`, `scripts/regression/run.ts` defines **42 scenario objects** (v0.19.6 adds two Missions
scenarios: the Thursday deadline cadence and prerequisite-task persistence). Executed counts and
environmental failures/skips are recorded in the versioned test-results artifact rather than assumed
from source. New scenarios use the existing result envelope and Ops dashboard.

## v0.19.5 Plan Scenario Traceability

These names match the plan one-for-one. A row can combine focused unit and scenario-runner evidence;
"Deferred" means the exact browser DOM assertion was not added even when its parser/data path is tested.

| Plan scenario | Coverage | Status |
| --- | --- | --- |
| S1: Weekly tasks and ordered resources are scoped to program week | Dashboard/program-content/SafeMarkdown unit tests; Applicant/Admin runner scenarios | Automated |
| S2: Weekly task completion is idempotent and tenant scoped | Dashboard unit tests; Applicant/Tenant runner scenarios | Automated |
| S3: Journal dates and structured fields are validated | Journal unit tests; Applicant runner scenario | Automated; physical-keyboard confidence interaction remains manual |
| S4: Readiness counts four journals from only the current attempt | Readiness unit tests; Missions/Tenant repeat and isolation scenarios | Automated |
| S5: Evidence parsing supports one or more deployment URLs | URL/readiness/submission unit tests; Missions readiness fixture | Automated |
| S6: Unsafe or unreachable evidence is rejected per URL | URL/readiness unit tests; Missions failed-URL fixture | Automated with deterministic network stubs |
| S7: Failed submission checks do not change durable state | Submission unit tests; Missions readiness scenario | Automated |
| S8: Successful submission locks only current-attempt journals | Submission unit tests; Missions selective-lock scenario | Automated |
| S9: Revision and repeat attempts remain separated | Submission unit tests; Missions repeat/history scenarios | Automated |
| S10: Admin content management retains authorization and tenant scope | Program-content unit tests; Programs/Admin scenarios | Automated |
| S11: Applicant and Admin render deployment URLs separately | Central link-builder unit test and multi-URL review data fixture | Partial; exact browser DOM assertion deferred |
| S12: Existing Regression Run dashboard reports the new coverage | Existing runner categories and result envelope | Automated runner output; dashboard UI checked manually on 2026-07-16 |

## v0.19.6 Plan Scenario Traceability

Names match `docs/plans/v0.19.6_Mission_Workspace_LMS_And_Scheduling.md` one-for-one. "Deferred" means
the behavior is exercised by unit/data tests but its browser DOM assertion (client-only components in a
node/Vitest environment) is recorded as a Known Gap below.

| Plan scenario | Coverage | Status |
| --- | --- | --- |
| S1: Mission Workspace derives steps, progress and submission mode | `view-model.test.ts` (13 cases) | Automated |
| S2: Accepting a mission sets a Thursday deadline with ≥4 working days | `mission-assignments.test.ts` (`computeMissionDeadline` + accept); Missions runner scenario | Automated |
| S3: A repeat never re-serves a previously-assigned mission | `mission-assignments.test.ts` repeat test; Missions repeat scenarios | Automated |
| S4: Prerequisite tasks lock the mission's steps until complete | `program-content.test.ts`; Missions "Prerequisite weekly tasks…" scenario | Automated (data); step-lock UI Deferred |
| S5: Document learning resources upload and download safely | `program-content.test.ts` DOCUMENT test | Automated (data); download route + uploader Deferred |
| S6: YouTube learning resource gates completion at 90% watched | Manual verification | Deferred (client-only) |
| S7: Weekly learning tasks unlock sequentially in the workspace | Manual verification; underlying completion via task tests | Deferred (client-only) |
| S8: Admin Tasks page manages weekly tasks + resources per program | `program-content.test.ts`; Programs/Admin scenarios | Automated (data/actions); collapsible UI Deferred |
| S9: Admin list pages paginate and filter | `apps/admin/lib/pagination.test.ts` (10 cases) | Automated (logic); page rendering Deferred |
| S10: Admin Overview reports live tenant counts | Manual verification over already-tested list functions | Deferred (read-only aggregation) |

## Execution Areas

| Area | Command | Current status |
| --- | --- | --- |
| Unit | `npm.cmd run regression:unit` | Automated |
| Auth | `npm.cmd run regression:auth` | Automated |
| Applicant | `npm.cmd run regression:applicant` | Automated |
| Admin | `npm.cmd run regression:admin` | Automated |
| Programs | `npm.cmd run regression:programs` | Automated |
| Missions | `npm.cmd run regression:missions` | Automated |
| Journal | `npm.cmd run regression:journal` | Automated |
| Tenant isolation | `npm.cmd run regression:tenant` | Partially automated |
| Dashboard | `npm.cmd run regression:dashboard` | Automated |
| Storage | `npm.cmd run regression:storage` | Missing |
| Ops | `npm.cmd run regression:ops` | Automated |
| All | `npm.cmd run regression:all` | Automated orchestration |

## Scenario Matrix

The matrix below is finer-grained than the runner: `scripts/regression/run.ts` currently contains
**40 scenario objects**, and several matrix rows map onto a single combined runner scenario (for
example, applicant submit + duplicate block are one scenario, and the three Programs lifecycle rows
are one scenario).

| Logical area | Scenario | Status | Notes |
| --- | --- | --- | --- |
| Unit | Existing Vitest regression suite passes. | Automated | Run as the `unit` area. |
| Auth | Keycloak realm discovery returns HTTP 200. | Automated | Guards local issuer and realm availability. |
| Auth | Org Admin completes OIDC login and reaches the demo admin portal. | Automated | Validates admin callback, issuer and shared-cookie behavior. |
| Auth | Applicant completes OIDC login and reaches the application page. | Automated | Validates applicant callback and portal access. |
| Auth | Accepted applicant reaches the dashboard. | Automated | Validates accepted-applicant seed and dashboard gating. |
| Ops | Org Admin completes Ops Console login. | Automated | Catches issuer mismatch and Ops client issues. |
| Ops | Ops session endpoint returns the local session envelope. | Automated | Complements the full Ops login scenario. |
| Applicant | Applicant submits an application and sees submitted status. | Automated | Uses marked regression data. |
| Applicant | Duplicate active application is blocked. | Automated | Uses `DUPLICATE_APPLICATION_ERROR_MESSAGE`. |
| Applicant | Applicant completes an assigned-week task and future journal dates are rejected. | Automated | Validates current-week visibility, tenant-safe completion progress, and the server-side future-date guard. |
| Applicant | Submitted assignment journals are read-only and remain preserved. | Automated | Verifies exact-attempt locking and update rejection after submission. |
| Admin | Org Admin reviews an application and changes status. | Automated | Current automated status path accepts an application. |
| Admin | Status change writes an audit log. | Automated | Validates `application.status_changed`. |
| Admin | Admin content path exposes ordered Markdown and YouTube resources for a weekly task. | Automated | Uses the existing audited program-content helpers; accepts an explicit pending YouTube URL. |
| Admin | Reviewer loads assignment-linked journals and completes submission review. | Automated | Confirms read-only current-attempt journal context remains available after the readiness changes. |
| Admin | Reviewer-specific rejected/waitlisted transitions. | Missing | Add browser/server-action coverage for all reviewer status paths. |
| Admin | Role-specific UI/route denial for HR, Tech Lead and Applicant. | Manual | Unit/RBAC coverage exists; scenario coverage should be expanded. |
| Programs | Org Admin creates a draft program. | Automated | Data-level scenario through DB helpers. |
| Programs | Published program appears in applicant-visible list. | Automated | Validates `listPublishedPrograms`. |
| Programs | Archived program is removed from applicant-visible list. | Automated | Validates lifecycle visibility. |
| Programs | Org Admin manages program content (resources/tasks/events); roles without `manageProgramContent` are denied. | Automated | v0.16.0 (D-069): CRUD round-trip, audit entries, capability matrix, cross-tenant delete rejection. |
| Programs | Ordered program-week task returns attached Markdown and YouTube resources. | Automated | Confirms task week is authoritative even when a conflicting resource week is supplied. |
| Missions | Org Admin creates a draft mission, publishes it, and accepted applicants can see it. | Automated | Validates mission lifecycle visibility. |
| Missions | Archived mission is removed from applicant-visible mission list. | Automated | Validates published-only visibility. |
| Missions | HR, Tech Lead and Applicant cannot manage missions. | Automated | Validates `manageMissions` capability. |
| Missions | Submission loop: draft, submit, request changes, resubmit, accept — with notifications and audit. | Automated | v0.15.0 (D-067): full SEM review loop; acceptance is terminal and notifies the applicant. |
| Missions | Submission readiness requires weekly tasks, four current-attempt journals, and all evidence URLs. | Automated | Proves incomplete readiness cannot submit/lock and a complete assignment locks exactly its four attempt journals. Network checks use a deterministic stub. |
| Missions | Repeat-week attempts preserve journal history without duplicate or infinite loops. | Automated | Also proves week-level task completion carries forward while new-attempt journal progress starts at zero. |
| Missions | Only Org Admin and Tech Lead can review submissions. | Automated | v0.15.0 (D-067): validates the `reviewSubmissions` capability (HR read-only, applicants denied). |
| Missions | Accepting an application creates exactly one `MissionAssignment` for the applicant, idempotently. | Automated | v0.18.0 (D-075): asserted as part of the submission fixture; the runner fails loudly if no assignment row is created. |
| Missions | Applicant mission list/detail and submission drafting are limited to assigned missions (a published-but-unassigned mission is not visible/usable). | Automated | v0.18.0 (D-075), added `v0.18.2` (D-077): asserts `listAssignedProgramMissions`/`getAssignedProgramMission` exclude the unassigned mission and `saveSubmissionDraft` rejects it. |
| Missions | An applicant already accepted before any mission assignment existed has no assigned missions and no automatic backfill. | Automated (documents a known gap) | v0.18.2 (D-077): asserts current behavior — no scenario/migration backfills a `MissionAssignment` for applications that were `ACCEPTED` directly (bypassing `applyStatusTransition`). See Known Gaps: a product decision is still needed on whether existing accepted applicants should be backfilled. |
| Missions | A rejected (`REPEAT`) submission's replacement assignment keeps the same `weekNumber` as the failed attempt. | Automated | v0.19.1 (D-082): the "Repeat-week attempts preserve journal history without duplicate or infinite loops" and "Repeated-week history stays separate across mission variants and attempt boundaries" fixtures assert the alternate mission is created at `fixture.mission.weekNumber`, exercising the same-week correction (`createRepeatMissionForSameWeekTx`) rather than a reset to Week 1. |
| Journal | Applicant creates and edits a daily Engineering Journal entry against their assigned mission; entries are listed and audited (`journal.created`/`journal.updated`). | Automated | v0.18.2 (D-077) closes the `v0.17.0` coverage gap. |
| Journal | Applicant cannot create a journal entry against a published mission that is not assigned to them. | Automated | v0.18.2 (D-077). |
| Journal | One journal entry per applicant per calendar date is enforced. | Automated | v0.18.2 (D-077) exercises the `v0.17.1` database-level unique constraint via `JournalEntryDateConflictError`. |
| Journal | Journal entries lock once the mission's assignment is submitted. | Automated | v0.18.2 (D-077) exercises `isJournalMissionLockedForApplicant`/`assertJournalMissionNotLocked`. |
| Tenant isolation | Tenant-scoped program read rejects another tenant. | Partially automated | Skips when only one local tenant exists. Needs a second marked tenant fixture. |
| Tenant isolation | Tenant-scoped submission read rejects another tenant. | Automated | v0.15.0 (D-067): cross-tenant submission access is denied. |
| Tenant isolation | Submission readiness ignores task completions from another tenant, applicant, or week. | Automated | Only tenant + applicant + target week-task completion is counted. |
| Tenant isolation | Engineering Journal review lookup remains tenant-scoped. | Automated | Current-attempt journal review cannot leak records from another tenant. |
| Tenant isolation | Realm role alone does not grant authority without `TenantMembership`. | Automated | Validates the D-051 authorization principle. |
| Tenant isolation | Applicant portal denies a non-member of the Host-resolved tenant (`/dashboard`, `/application` → `/access-denied`; SUPER_ADMIN bypass). | Automated | Unit-covered by `apps/applicant/lib/tenant-guard.test.ts`; also validated end-to-end via browser. Ports the D-051 guard to the applicant portal. |
| Tenant isolation | Cross-tenant file and settings denial through admin browser routes. | Missing | Add Playwright/browser route coverage. |
| Dashboard | Accepted applicant dashboard pages load. | Automated | Covers overview, program, tasks, resources, calendar, notifications and profile. |
| Dashboard | Task completion persists. | Automated | Uses dashboard DB helpers. |
| Dashboard | Notification read state persists. | Automated | Uses dashboard DB helpers. |
| AI Mentor | Cache hit: same dynamic prompt + same context returns cached response (no LLM call). | Automated | `ai-cache.test.ts` — verifies fetch call count stays at 1. |
| AI Mentor | Cache miss: context changed (task completed) forces fresh LLM call. | Automated | `ai-cache.test.ts` — different context signature triggers new fetch. |
| AI Mentor | Static cache: knowledge prompt shared across users. | Automated | `ai-cache.test.ts` — 1 fetch for 2 different users on same static prompt. |
| AI Mentor | Errors are never cached: failed LLM retries on next call. | Automated | `ai-cache.test.ts` — error then success on same prompt. |
| AI Mentor | User isolation: same dynamic prompt for different users → separate cache entries. | Automated | `ai-cache.test.ts` — 2 fetch calls for 2 users. |
| AI Mentor | RBSE direct answers bypass cache entirely. | Automated | `ai-cache.test.ts` — no fetch call for direct_answer patterns. |
| Storage | CV upload/download round-trip. | Missing | `storage` area currently reports a documented skip. |
| Storage | Cross-tenant file denial. | Missing | Should cover both metadata lookup and download URL path. |
| Ops | Run full regression from Ops UI and show counts. | Automated/API + manual UI check | Unit/server coverage plus local manual validation. |
| Ops | Run one selected area from Ops UI. | Automated/API + manual UI check | Ops API accepts `area`; UI includes selector. |
| Ops | Regression results show individual scenario pass/fail/skipped rows. | Automated parser + manual UI check | v0.18.3: Ops stores `REGRESSION_RESULT_JSON.results` and renders scenario rows grouped by area. |
| Ops | Cleanup is a safe no-op when no markers exist. | Automated via existing cleanup command behavior | Should gain a direct scenario assertion in a later hardening pass. |
| Ops | Cleanup removes marked data only. | Automated by runner + cleanup validation | Scenario data uses `RegressionDataMarker`. |
| AI Mentor | Mentor page loads for accepted applicant. | Manual | `/dashboard/mentor` renders chat UI with conversation list and input. |
| AI Mentor | Send a message and receive a mentor response. | Manual | Validates API route, LLM/stub fallback, and message persistence. |
| AI Mentor | New Chat creates an isolated conversation. | Manual | Previous conversation history is preserved; new conversation starts empty. |
| AI Mentor | Conversation persists across page reloads. | Manual | localStorage + DB persistence; conversations reload on refresh. |
| AI Mentor | Per-conversation loading state is independent. | Manual | Sending a message in one conversation does not show loading in another. |
| AI Mentor | Auto-scroll to latest message on response. | Manual | Chat container scrolls to bottom when new message arrives. |
| AI Mentor | RBSE blocks off-topic questions. | Manual | Questions outside allowed topics receive a blocked response. |
| AI Mentor | Markdown and code blocks render correctly. | Manual | `react-markdown` + Prism syntax highlighting in MessageBubble. |
| AI Mentor | LLM failure falls back to stub response. | Manual | API route returns stub when `GLM_Z_API_KEY` is absent or call fails. |

## Data Ownership and Cleanup

Regression-generated records must be explicitly marked with `RegressionDataMarker`.

Current marker-tagged entity types:

- `User`
- `TenantMembership`
- `Program`
- `Mission`
- `MissionAssignment`
- `EngineeringJournalEntry`
- `Submission`
- `Application`
- `ApplicationAnswer`

The cleanup command is:

```powershell
npm.cmd run ops:cleanup-regression
```

Cleanup rules:

1. Delete only records referenced by `RegressionDataMarker`.
2. Delete in dependency order.
3. Do not delete seeded demo data.
4. Do not delete user-created data.
5. Prefer deterministic regression names such as `regression-<runId>` and
   `applicant+<runId>@regression.talentos.local`.

## Known Gaps (as of `v0.18.3`)

- Full browser-level Playwright coverage is not yet complete for every scenario. The runner currently
  combines OIDC HTTP login flows with DB/service-level scenario checks.
- Storage upload/download is documented but not automated.
- Cross-tenant route-level denial needs a second regression tenant fixture and browser route checks.
- Admin review should expand from one accepted-path status transition to all reviewer transitions and
  role-specific denial paths.
- **Product decision needed:** applicants already `ACCEPTED` before Mission Assignment (`v0.18.0`)
  shipped have no `MissionAssignment` row and no automated backfill — they see zero missions until an
  admin/ops action (if any) assigns one. This was raised in PR review of the `engineering-journal-mvp`
  branch and is now a regression scenario (`missions`: "An applicant already accepted before any
  mission assignment exists sees no missions") that documents and locks in the current behavior rather
  than silently allowing it to change. Someone needs to decide: add a backfill migration/script for
  already-accepted applicants, add a lazy on-read assignment fallback, or explicitly accept the gap.
- The `v0.17.1` journal date-uniqueness migration (`20260708100000_v0_17_1_journal_entry_date_unique`)
  has no pre-flight duplicate check: if a target environment already has two journal entries for the
  same applicant on the same calendar day (possible pre-`v0.17.1`), `CREATE UNIQUE INDEX` will fail the
  migration outright rather than silently corrupting data — but there's no tooling to detect or resolve
  that conflict ahead of time. See `docs/Deployment.md` for the operational note; not applicable to any
  environment today since this hasn't been deployed beyond local dev.
- **Mission deadline & lifecycle (`v0.18.5`, D-080)** — the following are unit-tested
  (`packages/db/src/mission-assignments.test.ts`, `packages/db/src/mission-deadlines.test.ts`,
  `packages/db/src/submissions.test.ts`) but have **no dedicated `scripts/regression/run.ts`
  scenario** driving them through the real applicant/admin action end-to-end: the explicit Accept
  Mission action starting the deadline/grace clock; the idempotent deadline sweep transitioning
  `OVERDUE`/`FAILED`+`DISQUALIFIED` and re-running as a no-op; a late submission inside the grace
  period being accepted as `LATE_SUBMITTED`; the week auto-advance cap at `FINAL_PROGRAM_WEEK`; the
  reject-reassignment / no-alternate-mission notification path; and a `FAILED` assignment rejecting
  new submissions.
- **Mission-driven tasks & Submissions admin tab (`v0.19.0`, D-081)** — unit-tested
  (`packages/db/src/mission-tasks.test.ts`, `apps/applicant/lib/youtube.test.ts`) but with no
  dedicated scenario: the submission gate on Tasks 1/2 completion; the YouTube watch-gate itself
  (only `parseYouTubeVideoId` is automated — the IFrame Player `onStateChange` gate has no
  Playwright coverage); the admin Submissions tab's reachability/filtering (the underlying
  `reviewSubmissions` capability boundary it reuses is already covered by the existing `missions`
  role-matrix scenario).
- **Dashboard wiring (`v0.19.1`, D-082)** — the Dashboard/My Program/Tasks/Missions pages reading
  live mission-lifecycle data (Days Remaining from the current assignment's `deadlineAt`; My
  Program's start/end dates from the Week 1 `acceptedAt`; the countdown appearing only on the
  current, unsubmitted mission) were verified manually in a real browser session but have no
  automated scenario coverage.
- **AI Mentor RBSE name blocking (`v0.19.3`, D-084)** — the personal-name regex patterns
  (`PERSONAL_NAME_PATTERNS` in `ai-rbse.ts`) are unit-tested (`ai-rbse.test.ts`,
  `ai.test.ts`) but have no dedicated `scripts/regression/run.ts` scenario: a real applicant
  typing "explain hitesh" in the AI Mentor chat and receiving the blocked response without
  a GLM API call. The token usage tracking (`stream_options.include_usage`) is also only
  verified manually via Docker logs.
