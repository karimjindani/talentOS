# Regression Scenarios

Code version: `v0.20.11`

## Purpose

This document defines the scenario-based regression suite for TalentOS. Unit tests remain important, but
they are not enough to protect product behavior. Scenario regression validates the logical product areas
a real applicant, admin, operator or tenant would experience.

A second, complementary layer exists as of `v0.20.3`: the Playwright-driven `tests/journeys/` suite
drives real multi-actor browser sessions through the applicant/admin portals end to end (not just
HTTP/DB-level assertions like the runner below), producing screenshot evidence, a Markdown summary and
a combined PDF report. See `Architecture.md`'s Journey E2E Evidence Pipeline section and
`Testing_Strategy.md`. This document covers `scripts/regression/run.ts` only.

The suite can be run from the local Ops Console or from npm scripts. As of `v0.18.3`, the Ops Console
shows individual scenario rows grouped by area after a run, so operators can see exactly which
scenario passed, failed or skipped without searching the raw output.

As of `v0.20.11`, `scripts/regression/run.ts` defines **64 scenario objects** (up from 59 at
`v0.20.3`). `v0.20.3` added five to a new `public-portal` scenario area (which previously held one
scenario left over from the graduate-portal merge, PR #62): decline/skip consent persistence with
no prior graduate profile, decline unpublishing an already-public profile, and the full recruiter
approve→verify→access→revoke lifecycle including pending/rejected-token refusal. `v0.20.7` (D-107)
added three more to `public-portal`: apply-time GitHub/LinkedIn/avatar defaults carrying into a
brand-new graduate profile, the null-defaults edge case, and the no-overwrite-on-update case.
`v0.20.8` (D-108) added one to `missions`: an admin cannot act twice on the same submission
(covers both the `NEEDS_REVISION` and `ACCEPTED` terminal-state cases in a single scenario).
`v0.20.10` (D-109) added no new scenario objects (its plan scenarios are covered by existing unit
tests and manual verification). `v0.20.11` (D-110) added one to `public-portal`: the graduate
directory and recruiter access grants stay tenant-isolated across two genuinely separate tenants
created within the scenario. Executed counts and environmental failures/skips are recorded in the
versioned test-results artifact rather than assumed from source. New scenarios use the existing
result envelope and Ops dashboard.

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

## v0.20.1 Plan Scenario Traceability

Names match `docs/plans/v0.20.1_Request_Logging_Journal_Date_Rule_And_Scenario_Coverage.md`
one-for-one, and the automated ones are verbatim scenario names in `scripts/regression/run.ts`.
Verified on the runner in workflow run `31614137916` (53 total: 52 passed, 0 failed, 1 skipped).

Both the plan and this section were written retroactively during `v0.20.2` — `v0.20.1` shipped without
them. See `D-102`.

| Plan scenario | Coverage | Status |
| --- | --- | --- |
| One journal entry per applicant per mission per calendar date is enforced | `regression:journal`; `packages/db/src/journal.test.ts` | Automated |
| Reviewer can request revisions and applicant can resubmit (v0.20.1) | `regression:admin` | Automated |
| Reviewer can reject with REPEAT and a new attempt is created (v0.20.1) | `regression:admin` | Automated |
| Review writes immutable SubmissionReview history record (v0.20.1) | `regression:admin` | Automated |
| Cross-tenant submission access is denied via getTenantSubmission (v0.20.1) | `regression:tenant` | Automated |
| Cross-tenant journal review lookup is denied (v0.20.1) | `regression:tenant` | Automated |
| Cross-tenant mission visibility is rejected (v0.20.1) | `regression:tenant` | Automated |
| Deadline sweep marks overdue assignments and disqualifies after grace (v0.20.1) | `regression:missions` | Automated |
| Deadline sweep is idempotent — running twice produces no new changes (v0.20.1) | `regression:missions` | Automated |
| FAILED assignment rejects new submissions (v0.20.1) | `regression:missions` | Automated |
| Applicant and admin portals use separate Keycloak clients (v0.20.1) | `regression:auth` | Automated |
| Applicant session cookie does not grant admin portal access (v0.20.1) | `regression:auth` | Automated |
| Request logging reaches container stdout without altering responses | `packages/auth-web/src/request-log.test.ts` (v0.20.2) | Deferred — see Known Gaps |

## v0.20.2 Plan Scenario Traceability

Names match `docs/plans/v0.20.2_Decision_Log_Integrity_And_Opt_In_Request_Logging.md` one-for-one.
A correction iteration: it edits both app middlewares, so the scenarios that matter most are the
existing authorization and tenant-isolation ones, which must stay green unchanged. Verified locally
against the rebuilt stack (run `regression-20260813055040-db1f4b18`: 53 total, 52 passed, 0 failed,
1 skipped).

| Plan scenario | Coverage | Status |
| --- | --- | --- |
| Request logging is silent unless explicitly enabled | `packages/auth-web/src/request-log.test.ts`; confirmed live with `REQUEST_LOG=0` | Automated |
| Request logging is enabled for the local Docker stack | Manual — `docker compose logs applicant admin` | Deferred — see Known Gaps |
| Asset and Next-internal requests do not produce log lines | `packages/auth-web/src/request-log.test.ts`; confirmed live | Automated |
| An applicant session still cannot reach the admin portal | `regression:auth` — "Applicant session cookie does not grant admin portal access (v0.20.1)" | Automated (coverage retained) |
| Tenant resolution and the tenant response header are unchanged | `regression:tenant` (9/9) | Automated (coverage retained) |
| A failing console cannot break a request | `packages/auth-web/src/request-log.test.ts` | Automated |
| Every decision identifier in the log is unique | `grep -oE "^## D-[0-9]+" docs/Decision_Log.md \| sort \| uniq -d` | Deferred — documentation check; CI guard recorded in `Product_Backlog.md` |

## v0.20.3 Plan Scenario Traceability

Names match `docs/plans/v0.20.3_Journey_E2E_Evidence_Pipeline_And_Public_Portal_Fixes.md` one-for-one.
Verified on the rebuilt local stack: `regression:all` run `regression-20260819101751-ed270347`
(58/59 passed, 0 failed, 1 documented skip) and `npm run journeys` (8/9 passed, 0 failed, 1 documented
`test.fixme()`, after the `D-103` networkidle fix).

| Plan scenario | Coverage | Status |
| --- | --- | --- |
| Applicant completes the full apprenticeship arc through a real browser session | `tests/journeys/applicant-arc.spec.ts` (`journeys:applicant`) | Automated |
| Every reachable portal surface renders and is captured for the illustrated user guide | `tests/journeys/docs-only.spec.ts` (`journeys:docs`) | Automated (6/7 blocks; see Known Gaps for the 3 `test.fixme()` screenshots) |
| Journey evidence (JSON, screenshots, Markdown, and a combined PDF) is produced in CI | `.github/workflows/ci.yml` `e2e-evidence` job; `scripts/ci/journey-report.ts`; `scripts/ci/journey-pdf-report.ts` | Automated |
| Declining consent before a graduate profile ever existed still persists the decision | `regression:public-portal`; `packages/db/src/graduates.test.ts` | Automated |
| Skipping consent before a graduate profile ever existed still persists the decision | `regression:public-portal`; `packages/db/src/graduates.test.ts` | Automated |
| An approved recruiter access request is verified, grants access to every published graduate, and revocation removes it everywhere | `regression:public-portal`; `packages/db/src/graduates.test.ts` | Automated |
| Pending and rejected recruiter access requests cannot be verified, and the rejection reason reaches the recruiter | `regression:public-portal`; `packages/db/src/graduates.test.ts` | Automated |

## v0.20.4 Plan Scenario Traceability

Names match `docs/plans/v0.20.4_Recruiter_Access_Browser_Journey.md` one-for-one. Verified on the
rebuilt local stack: `npm run journeys:recruiter` (2/2 passed) and `npm run journeys:applicant`
(1/1 passed, regression check for the shared `Actor`/`portalUrl` fixture changes both journeys use).

| Plan scenario | Coverage | Status |
| --- | --- | --- |
| Recruiter completes the full access-request lifecycle through real browser sessions on both portals | `tests/journeys/recruiter-access.spec.ts` (`journeys:recruiter`) | Automated |
| Pending and rejected recruiter access requests are refused in the browser, with the rejection reason shown on-page | `tests/journeys/recruiter-access.spec.ts` (`journeys:recruiter`) | Automated |

## v0.20.11 Plan Scenario Traceability

Names match `docs/plans/v0.20.11_Deadline_Timezone_Tenant_Isolation_And_Recruiter_Data.md`
one-for-one. Verified via unit tests, `regression:public-portal`, `regression:missions`, and
`regression:all`, against a rebuilt Docker stack with the new migration applied.

| Plan scenario | Coverage | Status |
| --- | --- | --- |
| A mission deadline lands before Friday starts in the tenant's local time | `regression:missions` — "Accepting a mission sets a Thursday deadline with at least four working days (v0.20.0)"; `mission-assignments.test.ts` | Automated |
| The public graduate directory is tenant-isolated | `regression:public-portal` — "The graduate directory and recruiter access grants are tenant-isolated (v0.20.11, D-110)" | Automated |
| An approved recruiter access grant does not cross tenants | Same `regression:public-portal` scenario, second half | Automated |
| A tenant admin cannot approve, reject, or revoke another tenant's recruiter access request | `packages/db/src/graduates.test.ts` | Automated (unit-level) |
| The recruiter portfolio surfaces competency tags and revision-round history | `packages/db/src/graduates.test.ts` | Automated (unit-level) |

### Known Gaps (as of `v0.20.11`)

- **`toggleSavedCandidate` never calls `recruiterHasActiveAccess`** — any recruiter session (even
  without an approved grant for the current tenant) can save/unsave a public candidate. This is
  pre-existing and platform-wide (unrelated to tenant isolation specifically — it was equally true
  before this iteration), not introduced by `v0.20.11`, and not fixed here to keep this iteration
  scoped to tenant isolation and the two named data gaps. Left open for a future iteration.
- **The graduate portal's general Portal Layout description is still missing** from
  `Architecture.md` (see the top-of-file note there) — `v0.20.11` only backfills the Multi-Tenancy
  section for this feature, not its full architecture description. Carried forward from `v0.20.3`.

## v0.20.10 Plan Scenario Traceability

Names match `docs/plans/v0.20.10_Feature_Flags_And_Journal_Testing_Mode.md` one-for-one. Verified
via unit tests (1024 pass) and manual testing.

| Plan scenario | Coverage | Status |
| --- | --- | --- |
| S1: Journal testing mode off — normal restrictions enforced | `packages/db/src/journal.test.ts` | Automated — `featureFlagFindUnique` mocked to `{ enabled: false }` |
| S2: Journal testing mode on — duplicate date allowed | Manual verification | Deferred — requires real DB with flag set |
| S3: Journal testing mode on — future date allowed | Manual verification | Deferred — requires real DB with flag set |
| S4: Journal testing mode on — locked entry editable | Manual verification | Deferred — requires real DB with flag set |
| S5: Submission readiness — 4-entry gate skipped in testing mode | `packages/db/src/submission-readiness.test.ts` | Automated — `requiredJournalCount` = 0 when flag on |
| S6: Ops console flag toggle — live, no restart | Manual verification | Deferred — requires both services running |
| S7: Ops console flag API — list, set, delete | Manual verification | Deferred — requires ops console auth session |
| S8: Flag defaults to off when no row exists | All test files | Automated — `featureFlagFindUnique` defaults to `{ enabled: false }` |

### Known Gaps (as of `v0.20.10`)

- **S2–S4, S6–S7 deferred to manual**: these require a running DB with the flag set and/or an ops
  console auth session. Automating them would require an integration test that sets the flag in the
  DB, calls the journal/readiness functions, and verifies the relaxed behavior — a future enhancement.

## v0.20.8 Plan Scenario Traceability

Names match `docs/plans/v0.20.8_Submission_Review_Double_Action_Guard.md` one-for-one. Verified via
unit tests (1024 pass), `regression:missions` (16/16 pass), and `regression:all` (62/63 pass, 1
pre-existing documented skip).

| Plan scenario | Coverage | Status |
| --- | --- | --- |
| Admin cannot re-review a submission after requesting changes | `regression:missions` — "Admin cannot re-review a submission after already requesting changes or a repeat week" | Automated |
| Accepting a submission is also terminal for further review | Same `regression:missions` scenario, second half | Automated |
| Concurrent review attempts (double-click / two admin tabs) cannot both commit | `packages/db/src/submissions.test.ts` — "guards concurrent review attempts with a status-scoped update (double-click / two tabs)" | Automated (unit-level) |
| A legitimate resubmission still reopens the review form | `packages/auth/src/workflow.test.ts` — "only a SUBMITTED submission offers reviewer decisions"; end-to-end loop covered by the pre-existing "Submission loop…" scenario | Automated |

### Known Gaps (as of `v0.20.8`)

- **The concurrent-review race guard has no true two-transaction regression coverage** — the
  `scripts/regression/run.ts` runner executes scenarios sequentially, so it cannot exercise two
  actually-overlapping Postgres transactions racing on the same `Submission` row. The guard clause
  (`reviewSubmission`'s status-scoped `updateMany` + row-count check) is proven at the unit level
  instead, and its race-safety follows from the same read-committed-isolation reasoning already
  relied on for `submitSubmission`'s identical pattern (in production since `v0.15.0`/D-067 with no
  known lost-update incident). Automating a genuine concurrent-transaction test would need two
  parallel DB connections driven from the regression harness — deferred as a future enhancement
  rather than taken on incidentally here.

## v0.20.7 Plan Scenario Traceability

Names match `docs/plans/v0.20.7_Applicant_Profile_Photo_And_Graduate_Defaults.md` one-for-one.
Verified via unit tests (1022 pass), `regression:public-portal` (9/9 pass), and manual Playwright
browser verification for the two apply-time-upload scenarios.

| Plan scenario | Coverage | Status |
| --- | --- | --- |
| Applicant uploads an optional profile photo at apply time | Deferred — manual Playwright browser verification | Verified — real CV + photo uploaded end-to-end, `User.avatarFileId` confirmed linked |
| An invalid profile photo is rejected server-side | Deferred — code review | Verified — validation order matches `graduates/profile/photo/route.ts` exactly |
| A brand-new graduate profile inherits GitHub/LinkedIn and avatar from the applicant's accepted application | `regression:public-portal` | Automated |
| A graduate profile created with no accepted application or avatar gets null defaults, not a crash | `regression:public-portal` | Automated |
| Apply-time defaults are only applied on first creation — an existing profile's photo and links are never overwritten | `regression:public-portal` | Automated |

### Known Gaps (as of `v0.20.7`)

- **Apply-time photo upload and its validation have no `scripts/regression/run.ts` coverage** —
  that suite calls `packages/db` functions directly and does not exercise the Next.js
  page/server-action layer where `submitApplication`'s validation lives. This is consistent with
  the pre-existing CV upload validation in the same file, which has never had regression-suite
  coverage either (only ever verified by Playwright journeys / manual testing). Verified manually
  this iteration instead; automating it would mean either extending a Playwright journey to cover
  `/apply`'s new photo field, or restructuring the CV/photo validation into testable functions —
  both deferred as a future enhancement rather than taken on incidentally here.
- **`GraduateProfileForm` still has no `initialData` wiring** — `GraduateConsentModal.tsx` renders
  it blank regardless of any existing `GraduateProfile` data, including the new apply-time
  carry-over defaults from this iteration. Pre-existing gap (not introduced by `v0.20.7`), left
  open — see `Decision_Log.md` D-107.

## v0.20.6 Plan Scenario Traceability

Names match `docs/plans/v0.20.6_AI_Mentor_UI_RAG_Context_Fix.md` one-for-one. Verified via unit
tests (1020 pass) and manual testing against the running Docker container with a LiteLLM proxy.

| Plan scenario | Coverage | Status |
| --- | --- | --- |
| S1: Mentor answers "tell me about mission 1" with correct status | Manual verification (LLM + seeded data) | Deferred — verified manually; context unit tests assert `missionStatus` fields |
| S2: "tell me about mission 1" is not blocked by RBSE | `apps/applicant/lib/ai-rbse.test.ts` | Automated — `classifyQuestion` returns `allow_llm` |
| S3: "tell me about John" is still blocked by RBSE | `apps/applicant/lib/ai-rbse.test.ts` | Automated — personal-name patterns still block |
| S4: Mentor does not append "Next step" follow-up questions | Manual verification (system prompt review) | Deferred — `buildSystemPrompt` rule verified by code review |
| S5: Suggested questions send immediately | Manual verification (UI) | Deferred — UI interaction |
| S6: Card CTAs are functional | Manual verification (UI) | Deferred — UI interaction |
| S7: Per-message actions work | Manual verification (UI) | Deferred — UI interaction |
| S8: Mobile drawer opens and closes | Manual verification (UI) | Deferred — responsive UI |
| S9: Conversation search, rename, and pin | Manual verification (UI) | Deferred — UI interaction |
| S10: Context shows correct per-mission journal count and task completion | `apps/applicant/lib/ai-context.test.ts` | Automated — `missionStatus` fields + `contextToPromptSection` labels asserted |
| S11: RAG retrieves from docs index for documented topics | `apps/applicant/lib/knowledge-base.test.ts` | Automated — `retrieveKnowledge` returns docs-index snippets |
| S12: Off-topic questions are still blocked | `apps/applicant/lib/ai-rbse.test.ts` | Automated — off-topic blocked |

### Known Gaps (as of `v0.20.6`)

- **S1, S4–S9 deferred to manual**: these scenarios require either a running LLM endpoint with
  seeded applicant data (S1, S4) or browser-level UI interaction (S5–S9). They are verified
  manually in this iteration; automating them would require a Playwright journey for the mentor
  page with a mocked or real LLM endpoint, which is a future enhancement.
- The mentor page has no Playwright journey coverage — all existing journeys
  (`applicant-arc.spec.ts`, `recruiter-access.spec.ts`) skip the `/dashboard/mentor` route. Adding
  a mentor journey is recorded as a future gap.

## v0.20.5 Plan Scenario Traceability

Names match `docs/plans/v0.20.5_Full_Apprenticeship_Arc_And_Per_Process_Evidence_Reports.md`
one-for-one. Verified on the rebuilt local stack: `npm run journeys:applicant` (1/1, 38 steps) and
`npm run journeys:recruiter` (2/2) run together, `npm run journeys:report:pdf` (5 PDFs, one per
process), and `npm run regression:all` (58/59 passed, 0 failed, 1 documented skip, run
`regression-20260820070848-83fcda66`).

| Plan scenario | Coverage | Status |
| --- | --- | --- |
| An applicant completes all four apprenticeship missions through a real browser session and their profile publishes to the public portal | `tests/journeys/applicant-arc.spec.ts` (`journeys:applicant`) | Automated |
| Journey evidence is produced as one PDF per named business process, not one combined report | `scripts/ci/journey-pdf-report.ts` (`journeys:report:pdf`) | Automated |

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
| Public Portal | `npm.cmd run regression:public-portal` | Automated |
| Ops | `npm.cmd run regression:ops` | Automated |
| All | `npm.cmd run regression:all` | Automated orchestration |

## Scenario Matrix

The matrix below is finer-grained than the runner: `scripts/regression/run.ts` currently contains
**59 scenario objects**, and several matrix rows map onto a single combined runner scenario (for
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
| Missions | Admin cannot re-review a submission after already requesting changes or a repeat week. | Automated | v0.20.8 (D-108): a second review decision is rejected and the first decision's status/feedback are unchanged, for both the `NEEDS_REVISION` and `ACCEPTED` terminal states. |
| Missions | Submission readiness requires weekly tasks, four current-attempt journals, and all evidence URLs. | Automated | Proves incomplete readiness cannot submit/lock and a complete assignment locks exactly its four attempt journals. Network checks use a deterministic stub. |
| Missions | Repeat-week attempts preserve journal history without duplicate or infinite loops. | Automated | Also proves week-level task completion carries forward while new-attempt journal progress starts at zero. |
| Missions | Only Org Admin and Tech Lead can review submissions. | Automated | v0.15.0 (D-067): validates the `reviewSubmissions` capability (HR read-only, applicants denied). |
| Missions | Accepting an application creates exactly one `MissionAssignment` for the applicant, idempotently. | Automated | v0.18.0 (D-075): asserted as part of the submission fixture; the runner fails loudly if no assignment row is created. |
| Missions | Applicant mission list/detail and submission drafting are limited to assigned missions (a published-but-unassigned mission is not visible/usable). | Automated | v0.18.0 (D-075), added `v0.18.2` (D-077): asserts `listAssignedProgramMissions`/`getAssignedProgramMission` exclude the unassigned mission and `saveSubmissionDraft` rejects it. |
| Missions | An applicant already accepted before any mission assignment existed has no assigned missions and no automatic backfill. | Automated (documents a known gap) | v0.18.2 (D-077): asserts current behavior — no scenario/migration backfills a `MissionAssignment` for applications that were `ACCEPTED` directly (bypassing `applyStatusTransition`). See Known Gaps: a product decision is still needed on whether existing accepted applicants should be backfilled. |
| Missions | A rejected (`REPEAT`) submission's replacement assignment keeps the same `weekNumber` as the failed attempt. | Automated | v0.19.1 (D-082): the "Repeat-week attempts preserve journal history without duplicate or infinite loops" and "Repeated-week history stays separate across mission variants and attempt boundaries" fixtures assert the alternate mission is created at `fixture.mission.weekNumber`, exercising the same-week correction (`createRepeatMissionForSameWeekTx`) rather than a reset to Week 1. |
| Journal | Applicant creates and edits a daily Engineering Journal entry against their assigned mission; entries are listed and audited (`journal.created`/`journal.updated`). | Automated | v0.18.2 (D-077) closes the `v0.17.0` coverage gap. |
| Journal | Applicant cannot create a journal entry against a published mission that is not assigned to them. | Automated | v0.18.2 (D-077). |
| Journal | One journal entry per applicant per mission per calendar date is enforced. | Automated | v0.20.1 updates the unique constraint from `(tenantId, applicantId, entryDate)` to `(tenantId, applicantId, missionId, entryDate)`. Applicants can now write separate entries for different missions on the same day. Same mission + same date is still blocked. |
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
| Public Portal | Four weekly missions are completed before an applicant consents to publish a graduate profile. | Automated | Pre-existing scenario from the graduate-portal merge (PR #62); exercises `createOrUpdateGraduateProfile`'s acknowledge path directly. |
| Public Portal | Declining consent before a graduate profile ever existed still persists the decision. | Automated | v0.20.3 (D-103): regression coverage for the fixed decline/skip persistence bug — see `Decision_Log.md`. |
| Public Portal | Skipping consent before a graduate profile ever existed still persists the decision. | Automated | v0.20.3 (D-103). |
| Public Portal | Declining consent after a profile is already public immediately removes it from public discovery. | Automated | v0.20.3 (D-103). |
| Public Portal | An approved recruiter access request is verified, grants access to every published graduate, and revocation removes it everywhere. | Automated | v0.20.3 (D-103): full create→approve→verify→access→revoke lifecycle, including reusability within the approved window. |
| Public Portal | Pending and rejected recruiter access requests cannot be verified, and the rejection reason reaches the recruiter. | Automated | v0.20.3 (D-103). |
| Public Portal | A brand-new graduate profile inherits GitHub/LinkedIn and avatar from the applicant's accepted application. | Automated | v0.20.7 (D-107): `getGraduateProfileDefaults` wired into decline/skip/acknowledge. |
| Public Portal | A graduate profile created with no accepted application or avatar gets null defaults, not a crash. | Automated | v0.20.7 (D-107). |
| Public Portal | Apply-time defaults are only applied on first creation — an existing profile's photo and links are never overwritten. | Automated | v0.20.7 (D-107): defaults only apply on the create branch, protecting a graduate's own later edits. |
| Public Portal | The graduate directory and recruiter access grants are tenant-isolated. | Automated | v0.20.11 (D-110): creates a genuine second tenant and proves neither the directory nor an approved recruiter grant crosses into it. |
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
| Config | Applicant and admin `.env` files have valid, consistent configuration. | Automated | `config.test.ts` (23 tests): NEXTAUTH_URL, secrets, base domain, Keycloak issuer, cross-portal consistency, cookie config. |
| Config | Prisma generated client is in sync with schema. | Automated | `schema-sync.test.ts` (14 tests): model/enum/delegate presence in generated client, schema integrity, migration directory. |
| Config | Keycloak realm import has all required clients, roles, redirect URIs and safety properties. | Automated | `realm-config.test.ts` (25 tests): client config, redirect URIs, realm roles, seed users, provisioner, redirect URI safety. |
| Config | Login callback URL preserves tenant subdomain and is SSR-safe. | Automated | `login-callback.test.ts` (13 tests): relative/absolute URL handling, tenant preservation, SSR safety. |
| Config | Middleware route protection and redirect validation. | Automated | `middleware-redirect.test.ts` (27 tests): protected route detection, tenant callback URL, post-login redirect, tenant resolution, cookie domain. |
| Config | Docker, Dockerfile, CI workflow, and port configuration are consistent. | Automated | `deployment.test.ts` (30 tests): service definitions, build stages, CI steps, port consistency, realm JSON validity. |

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
- `StoredFile`
- `Tenant`
- `KeycloakUser` — reaped over Keycloak's Admin REST API after the Prisma transaction commits, since
  it has no Prisma table to delete alongside the rest (`tests/journeys/fixtures/journey.ts`, v0.20.3).
- `RecruiterAccount` — added v0.20.3 (D-103): has no relation back to `User`/`Tenant`, so nothing in
  the rest of the cleanup chain could ever reach it; every regression run touching the recruiter flow
  would have leaked one row without this.
- `RecruiterAccessRequest` — added v0.20.5 (D-105): `graduate` cascades from `GraduateProfile`/`User`
  in principle (Prisma `onDelete: Cascade`), but `/api/graduates/request-access` attaches every
  request to "the first public graduate profile" in the whole database, not necessarily one the
  requesting run owns — so that cascade only fires when the attached graduate happens to belong to
  the same run. Found live once the local database held more than one published graduate.

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

## Known Gaps (as of `v0.20.5`)

- **`/api/graduates/profile/acknowledge`'s placeholder-profile path sets `overallRating: 0`
  unconditionally**, unlike `createOrUpdateGraduateProfile` (which computes the real average from
  `getCompletionSnapshot`). A profile published through the dashboard consent gate alone (no
  `GraduateProfileForm` submission — the path `applicant-arc.spec.ts` exercises, matching what a
  real applicant does from `/dashboard`) shows "0.0" in the public directory even with four real
  reviewer ratings behind it. Observed via this iteration's own PDF evidence, not fixed —
  changing it is an app-behavior decision outside a test-coverage iteration's scope. See `D-105`.
- **The graduate-portal/recruiter feature (PR #62) remains undocumented** in `Data_Model.md`,
  `Data_Dictionary.md`, `Architecture.md` (beyond a pointer to the journey/regression pipelines that
  now test parts of it) and the user guides, beyond the specific consent decline/skip behavior
  `v0.20.3` (D-103) fixed and the recruiter-lifecycle scenarios it added. That merge landed with none
  of the usual SSDLC artifacts; fully backfilling them is a separate, larger undertaking than a
  bug-fix-and-evidence-pipeline iteration, and is recorded here rather than silently expanded into
  `v0.20.3`'s scope.
- **`feature/e2e-evidence-pipeline` (PR #67, closed unmerged 2026-08-19)** built an independent,
  differently-architected E2E-evidence mechanism — screenshot-capture-driven rather than
  Playwright-journey-driven, with explicit PII masking — under the same `v0.20.3`/`D-103` identifiers
  this baseline uses. The two approaches were never reconciled; see `D-103`.
- **3 `docs-only` screenshots remain `test.fixme()`** (applicant work-in-progress views:
  `tests/journeys/docs-only.spec.ts`) — the seeded `accepted@demo.talentos.local` applicant has zero
  journal entries and only one `NOT_STARTED` mission assignment, so there is no representative
  "in progress" state to photograph without fabricating data or mutating seed state that 58 other
  regression scenarios depend on. A seed-data fix is its own iteration.
- Full browser-level Playwright coverage is not yet complete for every scenario. The runner currently
  combines OIDC HTTP login flows with DB/service-level scenario checks. The `tests/journeys/` suite
  (v0.20.3, extended v0.20.4/v0.20.5) is a separate, complementary layer that does drive a real
  browser end to end — see `Architecture.md`'s Journey E2E Evidence Pipeline section — but it covers
  two journeys (`applicant-arc`, now the full four-week apprenticeship arc through publishing;
  `recruiter-access`) plus documentation screenshots, not every scenario below. Journeys 2 (admin
  authoring) and 3 (org onboarding + team collaboration) from the original design doc remain
  deferred.
- Storage upload/download is documented but not automated.
- ~~Cross-tenant route-level denial needs a second regression tenant fixture and browser route
  checks.~~ **Closed in `v0.20.1`** at the data-access layer by three `regression:tenant` scenarios
  (submission, journal review lookup, mission visibility). Browser route-level checks remain open.
- ~~Admin review should expand from one accepted-path status transition to all reviewer transitions
  and role-specific denial paths.~~ **Closed in `v0.20.1`** by three `regression:admin` scenarios
  covering the revision, REPEAT and review-history transitions. Role-specific denial is covered by the
  two `regression:auth` portal-separation scenarios.
- **Configuration & deployment regression (`v0.19.7`)** — the following classes of production-impacting
  issues that previously passed automated tests but failed during manual QA are now covered by unit
  tests (132 tests across 6 files): stale Prisma Client after schema changes (`schema-sync.test.ts`),
  incorrect `NEXTAUTH_URL` / missing `NEXTAUTH_SECRET` / mismatched `APP_BASE_DOMAIN`
  (`config.test.ts`), Keycloak redirect URI / realm role / client misconfiguration
  (`realm-config.test.ts`), SSR `window is not defined` in login page and tenant subdomain loss
  (`login-callback.test.ts`), middleware route protection / open redirect / tenant resolution
  (`middleware-redirect.test.ts`), and Docker/Dockerfile/CI/port misconfiguration
  (`deployment.test.ts`). These run in CI as part of `npm test` (Vitest).
- **v0.19.6 QA bug fixes (4 bugs, 17 regression tests):** End-to-end QA of the applicant
  onboarding flow found and fixed: BUG-1 tenant subdomain lost on middleware redirect
  (HIGH — `requestOrigin()` helper using Host header), BUG-2 logout "Invalid redirect uri"
  (MEDIUM — verified Keycloak `post.logout.redirect.uris` config is correct), BUG-3 React
  hydration error #418 on Missions page (LOW — `DeadlineCountdown` now uses `null` initial
  state), BUG-4 duplicate program entries in admin filter (LOW — deduplication by name +
  197 duplicate DB rows cleaned). Regression tests added to `middleware-redirect.test.ts`
  (40 total tests, all passing). See `docs/audits/v0.19.6_Applicant_Onboarding_QA_Report.md`.
- **Comprehensive test coverage audit (v0.19.7, D-101):** A full audit of the codebase
  identified that the server-action layer had no automated tests. 138 tests were added
  in 10 new files covering: tenant CRUD (`tenants.test.ts`), program CRUD
  (`programs.test.ts`), tenant resolution edge cases (`tenant.test.ts`), RBAC capability
  matrix (`capabilities.test.ts`), journal validation helpers (`journal-validation.test.ts`),
  applicant mission/journal server actions, and admin program/submission/organization
  server actions. Total: 809 tests across 65 files, all passing. No production code was
  modified. Complete coverage matrix documented in `docs/REGRESSION_TEST_PLAN.md`.
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
- **Dangling repeat rescue on publish (`v0.20.0`, D-097)** — publishing a mission for a week an
  applicant is waiting on assigns them the new mission at the next attempt number, and a `DRAFT`
  mission must not. Covered by `mission-assignments.test.ts` and verified manually in the admin
  portal (8/8), but there is no `scripts/regression/run.ts` scenario, because the fixture needs an
  applicant deliberately left with a dangling `REPEAT`.
- **Backfill advancing to the applicant's next week (`v0.20.0`, D-097)** — publishing Week N+1 after
  an applicant passes Week N assigns Week N+1 rather than re-checking Week 1. Verified against the
  live database (8/8) and unit-tested via `nextAssignableWeekForApplicantTx`; the existing
  `regression:missions` scenario still only documents the "accepted before any mission existed" case.
- **Journal grouped by mission (`v0.20.0`, D-099)** — the Journal tab rendering one collapsible
  section per mission, a repeated week appearing twice with attempt labels, and locked entries showing
  **Locked** instead of Edit. Pure UI over already-covered data; verified in the portal (11/11) and by
  `apps/applicant/app/dashboard/journal/view-model.test.ts`.
- **Mission import from Markdown (`v0.20.0`, D-100)** — uploading a spec creates a populated DRAFT; a
  file missing sections is refused naming every missing heading and writes nothing; a non-Markdown
  file is refused. Verified in the portal (19/19) and by `mission-spec.test.ts` against the real seed
  corpus. Not automated because the regression harness has no multipart file-upload helper; adding one
  is the prerequisite for closing this gap.

- **Request logging output (`v0.20.1`/`v0.20.2`, D-102)** — the middleware request log is asserted only
  at the unit level (`packages/auth-web/src/request-log.test.ts`: the `REQUEST_LOG` enable rule, the
  static/`_next` path filter, the line format, and the guarantee that a console failure cannot break
  the auth middleware). No runner scenario asserts that a line actually reaches container stdout,
  because the runner checks HTTP responses and database state and has no log-capture helper. Verified
  manually via `docker compose logs applicant admin`.
