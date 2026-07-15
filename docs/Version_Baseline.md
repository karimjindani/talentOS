# Version Baseline

## Current Baseline

Version: `v0.19.2`

Baseline name: `Logout Regression Fix & Confirmation Gates`

Baseline code commit: `_pending_`

Baseline date: `2026-07-15`

Previous baseline: `v0.19.1`

Previous baseline commit: `d77cb8f`

## Baseline Summary

`v0.19.2` is a patch bundling two small, unrelated fixes that predate the `v0.18.5`–`v0.19.1`
mission-lifecycle work but were left uncommitted until now. The `v0.14.3`/D-066 applicant dashboard
sidebar Logout button had gone missing — a regression from the `feat/applicant-ai-mentor-skeleton`
merge (PR #45) reverting part of an earlier main-branch merge — and is restored in
`ApplicantShell.tsx`, alongside a `vitest.config.ts` alias fix (`@/(.+)` → `apps/applicant/$1`) so
`ApplicantShell.test.ts` can resolve its new mocked import of `@/lib/logout-action`. A new
`AGENTS.md` **Confirmation Gates** section requires stopping to ask the user before starting a
versioned documentation-update process or pushing to a remote branch. No schema change; no
migration; unit suite unchanged at 427 tests across 43 files;
`regression:all` 35/36 passed, 1 pre-existing documented skip, 0 failed. Plan:
`docs/plans/v0.19.2_Logout_Regression_And_Confirmation_Gates.md`; results:
`docs/testing/v0.19.2_Logout_Regression_And_Confirmation_Gates_Test_Results.md`. See `D-083`.

`v0.19.1` is a patch that wires the applicant Dashboard, My Program, Tasks and Missions pages to
the real mission-lifecycle data `v0.18.5`/`v0.19.0` introduced (Days Remaining and every "current
mission" countdown now derive from the actual assignment's `deadlineAt`, not `Program.endsAt`; My
Program's Start/End dates derive from the Week 1 assignment's `acceptedAt` + 4 weeks) and corrects
the `REPEAT` review decision to reassign the applicant an alternate mission for the **same week
that failed** instead of always resetting to Week 1 (`createRepeatFromWeekOneTx` renamed
`createRepeatMissionForSameWeekTx`, now driven by the failed assignment's own `weekNumber`). No
schema change. Unit suite: 427 tests across 43 files; `regression:all` 35/36 passed, 1 pre-existing
documented skip (storage), 0 failed. Plan:
`docs/plans/v0.19.1_Dashboard_Wiring_And_Same_Week_Repeat.md`; results:
`docs/testing/v0.19.1_Dashboard_Wiring_And_Same_Week_Repeat_Test_Results.md`. See `D-082`.

`v0.19.0` replaces the applicant Tasks/Resources experience with a fixed 3-task template driven
directly by each mission assignment (Review the Mission Brief, Study the Tutorial, Build & Submit
Evidence) instead of the legacy program-level `ProgramTask`/`VideoResource` content. A new
`MissionTaskCompletion` model (migration `20260714110000_mission_tasks`) tracks tasks 1 and 2 per
assignment attempt (unique on `[missionAssignmentId, taskIndex]`); task 3 has no completion row —
it is implied complete once the linked `Submission.status` moves beyond `DRAFT`/`NEEDS_REVISION`.
Submission is now gated on tasks 1 and 2 being complete
(`packages/db/src/mission-tasks.ts`, wired into `saveSubmissionDraft`/`submitSubmission`). A new
optional `Mission.tutorialUrl` powers a YouTube IFrame Player watch-gate on Task 2 — "Mark as
complete" stays disabled until the video reaches `YT.PlayerState.ENDED`; a mission with no
`tutorialUrl` has no gate. The legacy dashboard tables are kept in the schema, unused, by explicit
product decision — only the applicant UI and the admin Program Content authoring page (now Calendar
Events only) stop reading/writing them. A new admin **Submissions** tab (`/submissions`, new
sidebar entry between Missions and Operations) lists and filters submissions across every mission
for reviewers, reusing the existing `reviewSubmissions` capability and the existing per-submission
review page — no new authorization surface. A `javascript:`-URI XSS vector in `tutorialUrl`
rendering, found by automated review during this iteration, is closed on both the write side
(`parseOptionalHttpUrl`) and the read side (a defensive scheme re-check). Plan:
`docs/plans/v0.19.0_Mission_Driven_Tasks.md`; results:
`docs/testing/v0.19.0_Mission_Driven_Tasks_Test_Results.md`. See `D-081`.

`v0.18.5` gives every `MissionAssignment` an explicit time-boxed lifecycle instead of an
open-ended `ACTIVE` state (migration `20260714090000_mission_deadlines_and_lifecycle`). A new
`acceptMissionAssignment` action is the applicant's explicit "Accept Mission" step — only accepting
starts the deadline/grace clock, computed from the new per-mission `Mission.deadlineHours`
(default 168h) and `Mission.gracePeriodHours` (default 24h) at the moment of acceptance; an
assignment the applicant never accepts never expires. `MissionAssignmentStatus` becomes
`NOT_STARTED → ACCEPTED → IN_PROGRESS → PENDING_EVALUATION | LATE_SUBMITTED`, with `OVERDUE`
(deadline passed, inside grace) and terminal `FAILED` (grace expired) as deadline-driven side
states, replacing the `v0.18.0` `ACTIVE`/`SUBMITTED` model. A standalone, idempotent deadline sweep
(`packages/db/src/mission-deadlines.ts`, `scripts/mission-deadlines/sweep.ts`, `npm run
mission-deadlines:sweep`) — run as an external scheduled job, deliberately kept out of the app
request path per explicit product direction for future scaling — transitions `OVERDUE` and
`FAILED` in two status-scoped, re-run-safe phases; the grace-period-expired path also sets
`Application.status = DISQUALIFIED` (a deliberately terminal outcome for this version — a future
Back Office "rejoin from Week 1" path is explicitly deferred, not built). A submission made inside
the grace period is still accepted, recorded as `LATE_SUBMITTED`. Accepting a submission
auto-advances the applicant to the next week's mission, capped at `FINAL_PROGRAM_WEEK = 4`. A
`REPEAT` review decision reassigns the applicant a different published mission (this version: back
at Week 1 — corrected to same-week in `v0.19.1`); with no alternate mission available,
`Application.status` becomes `AWAITING_MISSION_ASSIGNMENT` and every `ORG_ADMIN`/`TECH_LEAD` in the
tenant is notified. New `ApplicationStatus` values `DISQUALIFIED`/`AWAITING_MISSION_ASSIGNMENT`
have no outgoing admin-initiated transition (`packages/auth/src/workflow.ts`). All new end-to-end
scenarios are unit-tested but deferred at the scenario-regression level per `D-076` — see
`docs/Regression_Scenarios.md` Known Gaps. Plan:
`docs/plans/v0.18.5_Mission_Deadline_Lifecycle.md`; results:
`docs/testing/v0.18.5_Mission_Deadline_Lifecycle_Test_Results.md`. See `D-080`.

**Process note:** `v0.18.5`, `v0.19.0` and `v0.19.1` all ship from a single implementation commit
instead of one commit per version, mirroring the accepted exception already recorded for
`v0.17.0`/`v0.17.1`/`v0.18.0` under `D-073`. All three versions were built in one continuous local
session before any of it was committed, so there was no prior per-version commit history to
preserve or rewrite; splitting the single working-tree diff into three artificial commits after the
fact (especially where one file, such as the applicant dashboard page, carries both `v0.19.0` and
`v0.19.1` changes in the same hunks) would risk introducing broken intermediate states with no
compensating benefit. This is recorded as a one-time accepted exception, not a precedent for future
multi-version work — future iterations should commit as each version is completed.

`v0.18.3` improves the local Ops Console regression-result experience (D-078). The regression runner
already emitted detailed `REGRESSION_RESULT_JSON.results`; this baseline preserves those scenario rows
in the Ops job model and renders them grouped by area in `http://127.0.0.1:3300/`. Operators now see
each scenario name, pass/fail/skipped status, duration and detail/error text directly in the Ops UI,
while the raw output panel remains unchanged. Existing summary-only payloads still fall back to the
previous area-summary card view. No database migration and no regression-runner rewrite. Plan:
`docs/plans/v0.18.3_Ops_Regression_Scenario_Visibility.md`; results:
`docs/testing/v0.18.3_Ops_Regression_Scenario_Visibility_Test_Results.md`. See `D-078`.

`v0.18.2` closes the specific regression and documentation gaps found in manual PR review of the
`engineering-journal-mvp` branch (D-077). A new `journal` regression area
(`scripts/regression/run.ts`, `packages/auth/src/operations.ts`, `apps/ops`,
`npm run regression:journal`) adds four scenarios: create/edit against the assigned mission with
list/audit assertions, rejection against a published-but-unassigned mission, the
one-entry-per-calendar-day conflict, and lock-after-submission. Two new `missions`-area scenarios add
assigned-mission-only visibility/detail/submission-drafting scoping, and a scenario that deliberately
documents a real PR-review finding — an applicant `ACCEPTED` before any `MissionAssignment` existed
gets no automatic backfill and sees zero missions, now a locked-in regression assertion pending a
product decision (backfill script, lazy on-read assignment, or accepted limitation).
`EngineeringJournalEntry` joins the `RegressionDataMarker` cleanup entity types. The suite grows from
22 to **28 scenarios across 12 areas**; `regression:all` verified 27/28 passed, 1 pre-existing
documented skip, 0 failed. Documentation review corrected: `docs/Deployment.md` (never updated for
`v0.17.0`/`v0.17.1`/`v0.18.0` — added migration procedures plus a `v0.17.1` migration-safety
operational note, and fixed a stale smoke-test claim that accepted applicants see all four seeded
missions rather than their one assigned mission); `docs/vision.md` (Gap Analysis/Phase 4 still
described Engineering Journal as undelivered after `v0.17.0`/`v0.17.1` shipped it); `docs/
Product_Backlog.md` (listed Engineering Journal as a future "next slice" after it shipped);
`docs/user-guides/Back_Office_User_Guide.md` (disambiguated the legacy inline "Engineering journal"
submission field from the unrelated dedicated Engineering Journal module — same name, different
features); `docs/CI_CD_Pipeline.md` (stale unit-test count); `docs/Architecture.md`,
`docs/Testing_Strategy.md`, `docs/Regression_Scenarios.md` and the root `README.md` version history.
No schema change; unit suite unchanged at 243/243; full local gate re-verified clean. Plan:
`docs/plans/v0.18.2_Regression_And_Documentation_Completeness.md`; results:
`docs/testing/v0.18.2_Regression_And_Documentation_Completeness_Test_Results.md`. See `D-077`.

`v0.18.1` is a governance-only patch (no product code, schema, Docker configuration or package file
changed) closing a process gap found auditing `v0.17.0`–`v0.18.0`: the Engineering Journal plan never
named scenario-level test cases, so the feature shipped with strong unit coverage
(`journal.test.ts`, 23 tests) and zero scenario-level regression coverage — a gap only caught later by
manual audit. New required templates `docs/plans/TEMPLATE.md` and `docs/testing/TEMPLATE.md` make a
**Test Scenarios** section (actor/preconditions/steps/expected result/explicit automation call)
mandatory for every future plan, with a matching Scenario Results table required in its test-results
doc; `docs/sdlc.md` (Version and Documentation Control, rule 7), `CONTRIBUTING.md` and
`.github/pull_request_template.md` all point at the templates so the requirement is visible at
write-time and enforced at PR-review time, not left as prose easy to skip. Plan:
`docs/plans/v0.18.1_Plan_Test_Scenarios_Requirement.md`; results:
`docs/testing/v0.18.1_Plan_Test_Scenarios_Requirement_Test_Results.md`. See `D-076`.

`v0.18.0` gives each accepted applicant an assigned Week 1 mission instead of visibility into every
published mission in their accepted program (D-075). A new `MissionAssignment` model (migration
`20260708120000_v0_18_0_mission_assignment_mvp`) links tenant, program, applicant, mission and week,
unique on `[tenantId, programId, applicantId, weekNumber]`; when an application transitions to
`ACCEPTED`, an idempotent helper assigns one Week 1 published mission, picking from the least-assigned
variants with a random tie-break so applicants don't all land on the same brief. Applicant mission
listing, mission detail access, submission drafting and Engineering Journal mission selection
(`v0.17.0`) are all now scoped to the applicant's assigned missions rather than every published mission
in the program, and a journal entry locks once its mission's assignment has been submitted
(`packages/db/src/journal.ts`, `assertJournalMissionNotLocked`). Week 1 now ships four TaskPilot mission
variants (`bugbrief-status-page`, `careercraft-profile-page`, `launchlist-waitlist-page`,
`taskpilot-landing-page`) authored as Markdown under
`packages/db/prisma/seed-data/missions/ai-native-engineering/week-1/` and imported into standard
`Mission` fields by `seed.ts`; the app never reads the Markdown paths at runtime. No auth, Keycloak or
permission-matrix change. Unit suite: 243 tests (34 files); `regression:all` 21/22 passed, 1
pre-existing documented skip, 0 failed, verified after applying this baseline's migrations to a clean
local database. Plan: `docs/plans/v0.18.0_Mission_Assignment_MVP.md`; results:
`docs/testing/v0.18.0_Mission_Assignment_MVP_Test_Results.md`. See `D-075`.

`v0.17.1` is a patch that enforces the Engineering Journal's "one entry per applicant per calendar
date" rule at the database layer (D-074). Migration
`20260708100000_v0_17_1_journal_entry_date_unique` normalizes existing `EngineeringJournalEntry.entryDate`
values to a calendar day and replaces the `v0.17.0` non-unique index with a real unique index on
`[tenantId, applicantId, entryDate]`; `packages/db/src/journal.ts` already enforced this rule in
application code (`JournalEntryDateConflictError`), so this is a defense-in-depth backstop, not a
behavior change. No application code change. Plan:
`docs/plans/v0.17.1_Journal_Entry_Date_Unique.md`; results:
`docs/testing/v0.17.1_Journal_Entry_Date_Unique_Test_Results.md`. See `D-074`.

`v0.17.0` delivers the first dedicated Engineering Journal module for the Applicant Portal (D-073), a
daily structured-reflection system separate from the older inline `Submission.journalMarkdown` field
used during mission submission review. A new `EngineeringJournalEntry` model (migration
`20260707190000_v0_17_0_engineering_journal_mvp`) links tenant, applicant, program, mission and a
derived week number, and carries structured reflection fields (`workedOn`, `challenge`, `solution`,
`learned`, `aiUsage`, `confidenceRating`, `timeSpentHours`, `evidenceLinks`) plus nullable AI-review/scoring
fields as schema placeholders only — no real AI scoring is active. `User` gains
`preferredJournalLanguage`. New applicant dashboard pages (`/dashboard/journal`,
`/dashboard/journal/new`, `/dashboard/journal/[id]`) let an accepted applicant list, create and edit
entries; a profile setting controls the preferred journal language. Writes are tenant-scoped and
applicant-owned, validated against the applicant's published mission in their accepted program (tightened
to assigned-mission-only by `v0.18.0`), and audited (`journal.created`/`journal.updated`). Saved entries
open read-only by default and can only be changed through an explicit Edit action. No auth, Keycloak,
workflow or permission-matrix change. Plan: `docs/plans/v0.17.0_Engineering_Journal_MVP.md`; results:
`docs/testing/v0.17.0_Engineering_Journal_MVP_Test_Results.md`. See `D-073`.

**Process note:** `v0.17.0`, `v0.17.1` and `v0.18.0` shipped from a single implementation commit
(`c7413eb`, branch `engineering-journal-mvp`) instead of one commit per version, and that branch does
not follow the `<type>/vX.Y.Z-<slug>` naming convention. This is recorded as an accepted one-time
process exception rather than corrected by rewriting already-pushed history — see `D-073` in
`docs/Decision_Log.md`.

`v0.16.4` is an audit-only baseline that checks the current repository against `docs/sdlc.md`
without changing product code, schema, Docker configuration or package files. The audit concludes
that TalentOS is substantially SSDLC-aligned but not 100% compliant: Principles 2, 4, 5 and 6 are
compliant; Principles 0, 1, 3 and 7 are partially compliant due to governance and automation gaps.
Key findings: the latest `CODEOWNERS` update appears unversioned; the current two-line `CODEOWNERS`
pattern likely does not express Karim + Waseem as joint owners; GitHub branch-protection enforcement
requires UI verification; scenario regression is not enforced in CI; security scanning is still a
documented target rather than an implemented gate; and three scenario checks remain skipped. Local
validation passed after regenerating Prisma Client: 202/202 unit tests, typecheck, lint, build,
Docker Compose config, local doctor, and `regression:all` with 19 passed, 0 failed and 3 skipped.
Plan: `docs/plans/v0.16.4_SSDLC_Compliance_Audit_Plan.md`; audit:
`docs/audits/v0.16.4_SSDLC_Compliance_Audit.md`; results:
`docs/testing/v0.16.4_SSDLC_Compliance_Audit_Test_Results.md`. See `D-072`.

`v0.16.3` (documentation-only patch) completes the documentation audit started in `v0.16.2` by
realigning the eight SSDLC docs with the shipped `v0.13.0`–`v0.16.1` scope (D-071). The biggest
factual fixes: `docs/Deployment.md` (was stamped `v0.12.2`) gains the required `v0.14.0`/`v0.15.0`
migration notes, current validation URLs and mission/submission/progress smoke tests;
`docs/Data_Model.md`/`docs/Data_Dictionary.md` gain the five `v0.12.0` dashboard models in the
entity list, a regenerated ER diagram covering all 20 models, field tables for the dashboard models
and the four migrated-but-unused schema stubs, plus the missing `Tenant.logoFileId` and
`User.lastLoginAt` rows; `docs/Testing_Strategy.md` (was `v0.14.1`) now states the real totals
(202 unit tests, 22 scenarios) and covers submissions/program-content/mission-progress/Playwright
capture; `docs/Regression_Scenarios.md` gains the three `v0.15.0` submission scenario rows and
`Submission` in the marker entity list; `docs/Architecture.md` now describes `apps/ops` as the
third application, includes `packages/storage`, and its portal diagram shows the
missions/submission-review/program-content/`/logged-out` routes; the two policy docs' headers and
merge-gate description now include the `realm-import` CI job. This file's Portal Scope and Package
Scope sections are refreshed from their `v0.3.0` snapshot to current reality. No product code,
schema or configuration change; unit suite unchanged at 202/202. Plan:
`docs/plans/v0.16.3_SSDLC_Docs_Refresh_Plan.md`; results:
`docs/testing/v0.16.3_SSDLC_Docs_Refresh_Test_Results.md`. See `D-071`.

`v0.16.2` (documentation-only patch) realigns the vision and framework docs with the shipped
product after an audit of `docs/vision.md` against committed code (D-070). `docs/vision.md` gets a
rewritten Current State (now covering the Mission Engine `v0.14.0`, Submission & Review `v0.15.0`,
four-week mission arc `v0.15.1`, and mission-driven dashboard + program content `v0.16.0`), an
honest Gap Analysis (journal module, portfolio/certificates, public talent portal/recruiter side,
AI layer, grading/rubrics, templates, onboarding and portal MFA remain open), and a roadmap with
per-phase status and version references (Phases 2–3 delivered, Phase 1 largely delivered, Phase 4
partial, Phases 5–8 not started). `docs/Mission_Framework.md`'s SEM Authoring Guidance is corrected
from 8 to the canonical 10 lifecycle steps (Analyze and Production Readiness Review were missing),
and `docs/Product_Backlog.md` moves off its stale `v0.15.0` header, recording the D-068/D-069
slices as delivered. No product code, schema or configuration change; unit suite unchanged at
202/202. Plan: `docs/plans/v0.16.2_Vision_Audit_Refresh_Plan.md`; results:
`docs/testing/v0.16.2_Vision_Audit_Refresh_Test_Results.md`. See `D-070`.

`v0.16.1` (documentation/tooling patch) adds the illustrated end-user guide
`docs/user-guide/User_Guide.md`: 26 full-page screenshots (`docs/user-guide/screenshots/`), one per
user-facing test case, with a coverage map linking each screenshot to its regression test area.
Screenshots are captured repeatably by the new Playwright script
`scripts/user-guide/capture-screenshots.ts`, which drives the running local Docker stack through
the real Keycloak OIDC flows — including self-registration plus a genuine `/apply` submission with
a generated PDF CV for the applicant journey — as an anonymous visitor, a fresh applicant,
`accepted@demo.talentos.local`, and `orgadmin@demo.talentos.local` (admin portal + Ops Console),
with a CLI section filter for partial re-captures. No product code, schema or configuration
change; unit suite unchanged at 202/202. Plan: `docs/plans/v0.16.1_User_Guide_Screenshots_Plan.md`;
results: `docs/testing/v0.16.1_User_Guide_Screenshots_Test_Results.md`.

`v0.16.0` closes the loop between the mission engine and the applicant dashboard, and gives
program content a real owner (D-069). The dashboard's Overall Progress, Missions Accepted tile and
per-week Program Progress bars are now computed from the applicant's ACCEPTED mission submissions
(`getApplicantMissionProgress` in `packages/db`) — accepting a submission visibly moves the
dashboard, and a new **Current Mission** card links to the next mission with its submission-status
chip; weekly tasks remain a supplementary checklist. A new `manageProgramContent` capability
(ORG_ADMIN; SUPER_ADMIN bypass) powers the admin **Program Content** page
(`/programs/[id]/content`) for CRUD over video resources, weekly tasks and calendar events —
previously seed-script-only. New `packages/db/src/program-content.ts` helpers are transactional,
tenant-scoped and audited (`resource.*`, `task.*`, `event.*`). No schema change. Unit suite: 202
tests; regression gains a draft→submit→accept dashboard-progress scenario and a content CRUD +
role-denial scenario. See `D-069`.

`v0.15.1` seeds the complete four-week mission arc (D-068) so a fresh install demonstrates the full
AI-Native Software Engineering Apprenticeship, not just Week 1. One continuous product — TaskPilot,
from the Week 1 brief — is taken from idea to production across four published missions:
Week 1 "Build a Public Product Landing Page" (BEGINNER, unchanged), Week 2 "Design and Build the
TaskPilot Application" (INTERMEDIATE, design-first full stack), Week 3 "Containerize, Automate and
Load-Test TaskPilot" (ADVANCED, Docker/CI-CD/performance/threat model) and Week 4 "Take TaskPilot to
Production" (EXPERT, VPS + reverse proxy/SSL, VA/PT, Production Readiness Review). Every mission
embeds the tailored 10-step SEM lifecycle, the curriculum's weekly deliverables, measurable
acceptance criteria, Bronze→Platinum evaluation criteria, and `competencyTags` from the Competency
Framework. `seed.ts` is refactored to a data-driven idempotent `missionSeeds` upsert. Also fixes the
`v0.14.0` mojibake week/difficulty separator (`Â€¢` → `•`) on the three mission pages. No schema
change. See `D-068`.

`v0.15.0` delivers Mission Submission MVP-1 (D-067), the evidence half of the SEM learning loop.
Accepted applicants submit evidence for published missions of their accepted program — Git
repository URL (github.com-allowlisted), deployed-application URL, Loom URL (loom.com-allowlisted)
and an inline Engineering Journal (Markdown) — from a new **My Submission** section on the dashboard
mission detail page (with per-mission status chips in the list). Staff review from a new admin
`/missions/[id]/submissions/[submissionId]` page gated by the new `reviewSubmissions` capability
(ORG_ADMIN + TECH_LEAD; HR read-only; no peer review per the Graduate Profile): accept — terminal,
recording the submission as portfolio/graduation evidence for the mission's `competencyTags` — or
request changes with mandatory written feedback, returning it to the applicant for revision
(`DRAFT→SUBMITTED→ACCEPTED|NEEDS_REVISION`, `NEEDS_REVISION→SUBMITTED`). The applicant is notified
(SUCCESS/WARNING with the feedback) in the same transaction. Schema (migration
`20260706090000_v0_15_0_mission_submissions`): `Submission` gains `tenantId` (backfilled from the
parent mission), `reviewerFeedback`, `reviewedAt`, `reviewerUserId`, unique
`[missionId, applicantId]` and index `[tenantId, status]`; the superseded init-migration
`missions_tenantId_programId_idx` is dropped. New `packages/db/src/submissions.ts` helpers are
tenant-scoped, ownership-checked and audited (`submission.created/updated/submitted/reviewed`);
the submission status machine lives in `packages/auth` next to the mission/program machines.
`Submission` joins the regression cleanup entity types, and the suite grew to **187 unit tests**
plus three new scenarios (full loop with notifications/audit/terminal-acceptance, role matrix,
cross-tenant isolation). See `D-067`.

`v0.14.3` fixes two related logout defects (D-066). Accepted applicants were trapped in the dashboard
with no sign-out: `ApplicantShell` (which replaces `PortalHeader` on `/dashboard`) had no Logout
button, while `v0.12.0` redirects accepted applicants away from every page that had one. Separately,
RP-initiated Keycloak logout had been silently broken on every tenant subdomain in both portals since
`v0.12.1`, because Keycloak does not match hostname wildcards (`http://*.lvh.me:{port}/*`) in
`post_logout_redirect_uri` patterns ("Invalid redirect uri"). The fix centralizes logout in
`buildTenantLogoutUrl` (`packages/auth-web`): logout always returns through the canonical AUTH_URL
origin's new `/logged-out` route with the tenant origin carried in the OIDC `state` parameter, and
`/logged-out` bounces the user back to their tenant via the allow-listed `resolveTenantRedirect`
(no open redirect). Shared per-app `logoutAction` server actions replace the three duplicated inline
forms; `ApplicantShell` gains a sidebar Logout button; `/logged-out` is exempted from the admin auth
middleware. No schema or data-model change; the regression suite grew to 161 tests and the fix was
verified end-to-end in a real browser. See `D-066`.

**Process note:** the `feat/applicant-ai-mentor-skeleton` branch independently tagged its Applicant
AI Mentor work as `v0.15.0` (D-066–D-070, baseline commit `10dce46`, dated `2026-07-06`) while `main`
concurrently used the same version number for Mission Submission MVP-1 (below). Recorded here as an
accepted one-time version-number collision rather than renumbered after the fact — see the `D-073`
process note above for the equivalent `engineering-journal-mvp` exception.

`v0.15.0` (AI Mentor branch) delivers the Applicant AI Mentor — a full conversational AI assistant for
accepted applicants at `/dashboard/mentor`. The chat UI supports multi-conversation management with
per-conversation loading state, auto-scroll, suggested questions, and a "Still working..." timer.
Messages render Markdown (`react-markdown` + `remark-gfm` + Prism syntax highlighting) and rich cards
(task, progress, timeline, tips, badge, warning). Conversations persist to `localStorage` and to the
database via two new Prisma models: `MentorConversation` and `MentorMessage`. The API route
(`/api/ai/mentor`) validates input, guards auth, builds tenant-scoped applicant context, retrieves
knowledge-base snippets, and calls the LLM (ZhipuAI GLM-4.5-air, 1024 max tokens, 60 s timeout, 1
retry). A rule-based system engine (RBSE) classifies user input into `blocked` / `direct_answer` /
`allow_llm` actions against an allowed-topics list. On LLM failure, a stub response keeps the UI
functional. A **smart in-memory LLM response cache** (D-070) avoids redundant LLM calls: dynamic
prompts are keyed per user + context signature, static knowledge prompts are shared across users;
5-minute TTL, 200-entry LRU cap, errors never cached. Key files: `apps/applicant/lib/ai.ts`,
`apps/applicant/lib/ai-rbse.ts`, `apps/applicant/lib/knowledge-base.ts`,
`apps/applicant/lib/ai-context.ts`, `apps/applicant/lib/ai-cache.test.ts`, `packages/db/src/mentor.ts`.
See D-066 through D-070.

`v0.14.2` is a security patch that closes the tenant-isolation gap in the **applicant** portal — the
D-051 fix had only ever covered the admin portal. Sessions are shared across subdomains
(`Domain=.lvh.me`, D-060), so an authenticated user of one tenant could open another tenant's applicant
subdomain and reach `/dashboard` / `/application`, and `/apply`'s `provisionApplicantUser` would silently
enroll them into that tenant. A new `apps/applicant/lib/tenant-guard.ts`
(`resolveTenantAccess`/`requireTenantAccess`, mirroring the admin guard) binds session → Host-resolved
tenant → DB `TenantMembership` (SUPER_ADMIN bypass); `/dashboard` and `/application` require
`accessApplicantPortal` in the resolved tenant and non-members are redirected to a new `/access-denied`
page. `/apply` stays open (public recruitment funnel; applying is what creates membership) but existing
members are redirected to `/application`. The same baseline removes `CONFIGURE_TOTP` from org-admin
provisioning, grants the provisioner `manage-realm`/`view-users`, and pins
`registrationAllowed`/`registrationEmailAsUsername` in the realm import (a drifted live realm had
disabled self-registration). No schema or data-model change; the regression suite grew to 152 tests
(6 new `tenant-guard.test.ts`), and the fix was verified end-to-end in a real browser. See `D-065`.

`v0.14.1` establishes role-facing user guides as living documentation under `docs/user-guides/`
(Applicant Portal + Back Office), and requires every future user-facing route/workflow/role/permission/
status/form/dashboard/navigation change to update the relevant guide in the same PR. Documentation-only;
no application code, schema, package or Docker change. See `D-064`.

`v0.14.0` delivers the Mission Engine MVP. Admins manage missions through the Admin Portal; accepted
applicants see published missions for their accepted program in the dashboard. The `Mission` model now
has status, week/order sequencing, SEM-oriented structured content and competency tags. The demo seed
includes the Week 1 "Build a Public Product Landing Page" mission. See `D-063`.

`v0.13.0` establishes scenario-based regression as a first-class local development capability. The Ops
Console can run the full regression suite or a selected logical area and displays total/passed/failed/
skipped/duration counts. The new runner (`scripts/regression/run.ts`) supports `unit`, `auth`,
`applicant`, `admin`, `programs`, `tenant`, `dashboard`, `storage`, `ops` and `all`. Scenario-generated
records are tagged with `RegressionDataMarker`, and cleanup remains marker-only. The initial local suite
contains 15 scenarios: 13 pass, 0 fail and 2 are documented skips. See `D-062`.

`v0.12.2` hardens the local deployment path. Local OIDC now uses a single browser-and-container reachable
issuer, `http://keycloak.lvh.me:8080/realms/talentos`, eliminating browser-facing
`host.docker.internal` redirects and Ops Console issuer mismatches. MinIO uses the same local pattern via
`http://minio.lvh.me:9000`. New commands `local:bootstrap`, `local:doctor` and `local:smoke-login`
repair local runtime state, validate services and run full login callbacks. Existing local Keycloak
volumes are patched non-destructively for current clients and redirect URIs. Demo data now includes
`accepted@demo.talentos.local` so the applicant dashboard has seed data out of the box. See `D-061`.

`v0.12.1` fixes org admins (and any non-SUPER_ADMIN) being denied their own tenant with "Access denied — not a member of this organization" after signing in on their tenant subdomain. Root cause was a deployment/auth-topology gap: `AUTH_URL` pinned to `localhost:3200` made next-auth build the OIDC `redirect_uri` for `localhost`, so the Keycloak callback returned the browser to the default (`demo`) tenant where the org admin has no membership. Two alternatives were built and empirically disproved (unpinning `AUTH_URL`+`trustHost`, and an nginx `X-Forwarded-Host` proxy) — next-auth v5 beta derives the callback URL from a pinned `AUTH_URL`, not the request host. Fix: canonical-host + base-domain shared-cookie. Login runs through one canonical host per app (`AUTH_URL`=`lvh.me:3200`/`lvh.me:3100`); auth cookies are scoped to `.lvh.me` (`packages/auth-web`) so the session is valid on every tenant subdomain; after login the user is returned to their tenant subdomain via `resolveTenantRedirect` (an allow-list of base-domain subdomains, not an open redirect). `APP_BASE_DOMAIN` moves to `lvh.me` for local dev; the Keycloak clients gain `lvh.me`/`*.lvh.me` redirect URIs, web origins and post-logout URIs; logout post-redirect follows the request Host. Also fixes a latent Next-standalone boot crash (`HOSTNAME=0.0.0.0`). Verified end-to-end with a scripted no-2FA `ORG_ADMIN` login on the real `sbp` tenant (HTTP 200 admin page, no denial). No schema, data-model or RBAC change. Adds 8 `tenant-redirect.test.ts` tests. Builds on the `v0.12.0`/`D-059` dashboard that merged during this work. See `D-060`.

`v0.12.0` delivers the Applicant Dashboard — a professional, sidebar-based dashboard that appears when an
applicant's application is ACCEPTED. When accepted, the "Apply" link in the portal header is replaced with
a "Dashboard" link, the landing page and `/application` page redirect to `/dashboard`, and a full
navigation shell provides access to: overview (quick stats + 4-week progress + current tasks + recent
notifications + upcoming events), My Program (4-week breakdown with per-week tasks/resources/progress),
Tasks (grouped by week with due dates and status), Resources (embedded YouTube/Loom videos by week),
Calendar (upcoming and past events), Notifications (with mark-as-read), and Profile (read-only). Schema
changes: 4 new Prisma models (`ProgramTask`, `VideoResource`, `Notification`, `CalendarEvent`), 1 new
enum (`NotificationType`), 1 join table (`UserTaskCompletion`), migration
`20260703150655_v0_12_0_applicant_dashboard`. DB helpers in `packages/db/src/dashboard.ts`. Seed script
`scripts/seed-dashboard.ts`. The regression suite grew to 125 tests (24 new: 14 dashboard DB helper
tests + 10 ApplicantShell nav tests). See `D-059`.

`v0.11.4` is a UI-only polish iteration with three changes. (1) **Applicant Apply page redesign**:
`apps/applicant/app/apply/page.tsx` render section replaced with a professional, branded, card-based
layout — header banner with icon, sectioned form (Program & Motivation / Documents / Profile Links),
styled inputs with focus rings, dashed-border upload zone, full-width submit button with hover state.
Server action logic unchanged. (2) **Admin sidebar active-state indicator**: extracted the inline `<nav>`
from `apps/admin/app/layout.tsx` into a new client component `apps/admin/components/SidebarNav.tsx` that
uses `usePathname()` to apply `bg-brand-blue text-white font-semibold` to the active link (exact match
for `/`, `startsWith` for others); works for all admin roles. (3) **Review page back button**: added
"← Back to Applications" link to `apps/admin/app/applications/[id]/page.tsx`. No schema, data-model, or
security change. The regression suite grew to 101 tests (12 new `SidebarNav.test.ts`). See `D-058`.

`v0.11.3` is a fix for a crash-looping Keycloak that broke authentication platform-wide on any fresh
deployment. The `talentos-provisioner` service-account client added in `v0.11.0` was written into
`keycloak/import/talentos-realm.json` with an **invalid `serviceAccountClientRoles` field**; Keycloak's
import parser rejects it and aborts at the parse step — before the realm-exists check — so
`start-dev --import-realm` fails on every startup and Keycloak crash-loops (OIDC discovery unreachable,
no portal can log in). The defect escaped `v0.11.0` because that iteration validated the provisioner only
via a live `kcadm.sh` patch, never the baked-in import on a clean volume. Fix: remove the invalid field
and express the service account's realm-management roles the canonical import way — a
`service-account-talentos-provisioner` user with `serviceAccountClientId` + `clientRoles`
(`realm-management`: `manage-users`/`view-realm`/`query-users`). Verified with a destructive fresh-import
test (wiped `keycloak-postgres` volume): Keycloak boots, the realm imports cleanly, the provisioner
authenticates and the Admin `/users` API returns 200. No application code, schema, or data-model change;
the regression suite is unchanged at **78 tests** (validated via the deployment/e2e test). See `D-057`.

`v0.11.2` is a **documentation-only** baseline that closes the engineering-governance gaps in the SSDLC
docs — source control and CI/CD were operated in practice but never written down (violating principle 0).
Two new canonical policies are added: **`docs/Source_Control_Policy.md`** (D-055) codifies the
trunk-based branching model, `<type>/vX.Y.Z-<slug>` naming, Conventional-Commits standard with the
`(vX.Y.Z, D-0NN)` trailer, the PR/review policy — >=1 review + green CI to merge `main`, no direct
pushes — the rebase-then-merge-commit / never-force-push rule, and protected-branch/merge-freeze rules;
and **`docs/CI_CD_Pipeline.md`** (D-056) documents the existing CI gate and **specifies as design
targets** (not built this iteration) a security-scan stage (principle 7), a CD build/push flow, an image
versioning + registry policy (`vX.Y.Z` + git-SHA tags), a dev -> staging -> prod promotion ladder, and a
rollback procedure. `docs/sdlc.md` gains two summary sections linking both policies; `docs/Deployment.md`
gains a Delivery-Pipeline section. Operationalized with repo artifacts `CONTRIBUTING.md`,
`.github/pull_request_template.md`, and `.github/CODEOWNERS`. No application code, pipeline, or schema
change (`.github/workflows/ci.yml` is unchanged); the regression suite is unchanged at **78 tests**.
See `D-055`, `D-056`.

`v0.11.1` completes the user/tenant-management audit hardening. (1) **Reserved-slug blocklist**:
`isValidTenantSlug` (`packages/auth/src/tenant.ts`) now rejects routing/infra-sensitive labels
(`www`, `admin`, `api`, `auth`, `keycloak`, `minio`, `demo`, …) in addition to the DNS-safe check, so a
SUPER_ADMIN cannot mint a tenant on a subdomain that would collide with platform hosts. No schema change.
(2) This baseline also records the **duplicate-active-application** guard delivered via PR #13 (commit
`73c0a78`): a partial unique index `applications_applicantId_programId_active_key` on
`(applicantId, programId) WHERE status IN (DRAFT, SUBMITTED, UNDER_REVIEW, ACCEPTED, WAITLISTED)`
(migration `20260702090000_duplicate_application_active_index`) — REJECTED is excluded so a rejected
applicant may re-apply — plus P2002 handling in the apply flow. The regression suite is 78 tests. See
`D-054`.

`v0.11.0` delivers the deferred Keycloak-Admin-API provisioning (D-035 / the backlog "v0.3.1" slice):
creating an organization now auto-provisions the org admin in Keycloak instead of requiring a manual
`kcadm` step. `createOrganizationAction` calls a new server-only `provisionOrgAdmin`
(`apps/admin/lib/keycloak-admin.ts`) which authenticates with a confidential `talentos-provisioner`
service-account client (client_credentials; realm-management `manage-users`/`view-realm`/`query-users`),
creates the user (`emailVerified`, required actions `UPDATE_PASSWORD` + `CONFIGURE_TOTP`), sets a
generated one-time temporary password, and grants the `ORG_ADMIN` realm role — idempotent (an existing
user keeps their password and just gains the role). The org form became the admin app's first
`useActionState` client component and shows the one-time password once. This completes the two-layer
model (realm role gates portal entry, `TenantMembership` gates authority, `keycloakSubjectId` links on
login): a freshly created org admin can now sign in with no manual Keycloak step. No DB schema change;
the regression suite grew to 71 tests. See `D-053`.

`v0.10.4` fixes two identity defects from the user-management audit. (1) The DB `User`↔Keycloak link was
dead for admins: `keycloakSubjectId` was only ever written by `provisionApplicantUser` on an applicant's
first apply, so admin/reviewer/super-admin rows stayed `NULL` forever. A server-side, edge-safe
`linkKeycloakIdentity` (called best-effort from the admin guard `resolveTenantAccess`) now backfills the
subject on login for existing rows without creating new ones. (2) Email casing was inconsistent
(`createOrganization` lowercased; `provisionApplicantUser`/`getUserByEmail` did not) against a
case-sensitive unique index, risking duplicate users and broken applicant status lookups; a shared
`normalizeEmail` is applied on every write and `getUserByEmail` is now case-insensitive. The Keycloak
`email_verified` claim is exposed on the session (`session.user.isEmailVerified`) but **not** enforced
(no SMTP yet). No schema or data-model change; the regression suite grew to 65 tests. See `D-052`.

`v0.10.3` is a security patch closing the tenant-isolation gap accepted as a known limitation in
`v0.10.0` (D-048). Admin authorization derived the role from the realm-wide Keycloak token and the tenant
from the Host header without ever checking that the actor is a member of the tenant being acted on, so an
`ORG_ADMIN`/`HR`/`TECH_LEAD` of one tenant could read/modify another tenant's programs, application
decisions, branding and candidate CVs by switching subdomains. The fix makes the DB `TenantMembership`
the authoritative per-tenant authority (Keycloak realm role remains the coarse portal-entry gate): a
shared guard (`apps/admin/lib/tenant-guard.ts`, backed by `getActorTenantRoles` + `tenantRolesGrant`)
binds session → host tenant → membership across the admin layout, every mutating action, and the CV
download + operations-health routes, with SUPER_ADMIN bypass. The three DB mutators additionally scope
their writes by `{ id, tenantId }` for defense-in-depth. No schema or data-model change; the regression
suite grew to 62 tests. See `D-051`.

`v0.10.2` is a patch fixing ineffective logout: after signing out, refreshing a portal silently
re-authenticated the user because only the app's NextAuth cookie was cleared while the Keycloak SSO
session stayed alive. The fix implements OIDC RP-initiated logout — the `id_token` is persisted on the
session and both portals now redirect to Keycloak's `end_session_endpoint`
(`id_token_hint` + `post_logout_redirect_uri`) after clearing the app cookie, terminating the SSO
session. A shared `buildEndSessionUrl` helper (`packages/auth-web/src/logout.ts`) builds the URL; both
Keycloak clients register `post.logout.redirect.uris` (live-patched via `kcadm.sh`, and added to the
realm import). Verified: valid post-logout redirect → 302, arbitrary URL → 400 (no open redirect). No
schema change; the regression suite grew from 47 to 50 tests. See `D-050`.

`v0.10.1` is a patch fixing an internal server error on first-login authenticator-app (TOTP) setup. The
realm import (`keycloak/import/talentos-realm.json`) declared `otpPolicyType: "totp"` but omitted the
period, so Keycloak used `otpPolicyPeriod = 0` and threw `ArithmeticException: / by zero` in
`TimeBasedOTP.getCurrentInterval` when validating the enrollment code. The fix adds the full OTP policy
(period 30, digits 6, HmacSHA1, look-ahead 1) to the realm import and applies the same policy live to
the running realm via `kcadm.sh`. A new regression test (`packages/auth-web/src/realm-otp.test.ts`)
asserts a non-zero OTP period so the misconfiguration cannot silently return. No application code,
schema, or data-model change. The regression suite grew from 46 to 47 tests. See `D-049`.

`v0.10.0` adds a SUPER_ADMIN-only Organizations console to the Admin Portal, filling the gap where new
tenants could previously be created only by the DB seed script. A new `/organizations` page lists all
tenants (with member/program counts and brand swatches) and a form creates a tenant (name, DNS-safe
slug, brand colors) and assigns its first ORG_ADMIN by email in one audited transaction
(`organization.created`). The page and `createOrganizationAction` are gated on the pre-existing
`createOrganization` capability (SUPER_ADMIN only); the slug is validated with `isValidTenantSlug`
because it becomes the tenant subdomain (`{slug}.localhost:3200`). The assigned org admin's DB
membership scopes them to the tenant; the matching `ORG_ADMIN` Keycloak realm role is still granted
separately (documented limitation, D-048). No schema change; the regression suite grew from 45 to 46
tests. See `D-048`.

`v0.9.0` makes white-labelling real: an admin-gated Settings page (ORG_ADMIN + SUPER_ADMIN only) lets each tenant configure their organisation name, primary/secondary brand colors, and logo. Brand colors are applied live across both portals using CSS custom properties (`--brand-blue`, `--brand-navy`, `--brand-mist`) injected as a per-tenant `<style>` block in each root layout; Tailwind classes reference `var()` with hex fallbacks so all existing brand-class usages become dynamically themable with zero component changes. Logos are stored in MinIO as `StoredFile` records (`Tenant.logoFileId` FK, migration `20260701120000_tenant_logo_file_id`). The applicant portal header shows the tenant name and logo, served via a new public unauthenticated route `/api/branding/logo` (IDOR-safe, 302 presigned redirect). A new `manageTenantSettings` capability gates the settings page and server action, backed by audit log (`tenant.branding_updated`). The regression suite grew from 44 to 45 tests. See `D-047`.

`v0.8.0` adds a local-development Operations page to the Admin Portal. The page provides live
app-visible health checks, copyable regression/reset commands, and a safe regression data cleanup
foundation using explicit `RegressionDataMarker` rows. The Admin app does not run Docker or npm commands
on the host.

`v0.7.3` lets applicants attach a CV (required, PDF, ≤ 5 MB) and provide optional GitHub and LinkedIn
profile URLs when they apply. It wires the v0.7.0 object-storage foundation into the applicant portal:
the apply server action validates the CV server-side, streams it to MinIO via the new
`putObject` helper, records it as a `StoredFile` (status `READY`), and links it to the application
through new `Application.cvFileId` / `githubUrl` / `linkedinUrl` columns. The admin application-detail
page surfaces the CV download (reusing the existing tenant-scoped `/api/files/[id]/download` route) and
the profile links. Profile URLs are host-allowlisted to github.com / linkedin.com. A new migration
(`20260630120000_application_cv_links`) adds the columns; the regression suite is unchanged at 33 tests.
Recorded as a patch by explicit choice (it is functionally a new capability). See `D-045`.
`v0.7.2` is a documentation/test-results baseline that validates latest GitHub `main` locally through
Docker Compose. It confirms the v0.7.1 runtime runs locally with Applicant Portal, Admin Portal,
PostgreSQL, Keycloak, Keycloak PostgreSQL, MinIO, and MinIO setup. Alibaba Cloud deployment was skipped
for this iteration.

`v0.7.1` is a patch that enables applicant self-signup via Keycloak self-registration
(`registrationAllowed`, `registrationEmailAsUsername`, default role `APPLICANT`) and adds a
"Create account" entry to the applicant portal (OIDC `prompt=create`). Keycloak owns the signup form,
password policy and TOTP. No schema change; the regression suite is unchanged at 33 tests. Applying the
realm change to an existing environment requires re-importing the realm (recreate the Keycloak DB
volume) or toggling it in the Keycloak admin console.

`v0.7.0` adds the object-storage foundation using **MinIO** (S3-compatible), self-hosted as a Docker
Compose service in every environment. Files transfer directly between the browser and MinIO via
short-lived presigned URLs; the bucket is private; object keys are tenant-namespaced; file metadata is
stored in PostgreSQL (`StoredFile`) so access is tenant-scoped and audited (`file.created`,
`file.deleted`). A new `@talentos/storage` package wraps the S3 API; the admin app exposes reference
presign-upload/confirm/download endpoints (reusable later for CV-on-apply and program materials). This is
the first schema change since `v0.3.0` (migration `20260629101218_object_storage`). The regression suite
grew from 28 to 33 tests. Earlier baselines are carried forward unchanged.

`v0.6.0` delivers the Programs MVP module: tenant-scoped, capability-gated, audited admin CRUD for
programs (create / edit / publish / archive). Admins with `managePrograms` (ORG_ADMIN/SUPER_ADMIN)
manage programs through a light `DRAFT ⇄ PUBLISHED ⇄ ARCHIVED` state machine; HR/TECH_LEAD may view but
not mutate. Published programs feed the applicant apply form, closing the apply→review loop from
`v0.5.0`. Apply/review/program writes are Next.js server actions over `packages/db` helpers; new audit
actions `program.created`, `program.updated`, `program.status_changed`. No schema change was required.
The regression suite grew from 24 to 28 tests. Earlier baselines are carried forward unchanged.

`v0.5.0` delivers the Applications-first MVP vertical slice: an authenticated apply → submit → admin
review lifecycle. Applicants sign in via Keycloak and submit an application (motivation answer) to a
published program; their DB `User` is provisioned/linked by email with an `APPLICANT` membership.
Admins (ORG_ADMIN/HR/SUPER_ADMIN) review applications and move them through
`UNDER_REVIEW`/`ACCEPTED`/`REJECTED`/`WAITLISTED` via guarded status transitions; TECH_LEAD may enter
the portal but cannot decide. All writes are tenant-scoped and audited
(`application.submitted`, `application.status_changed`). Apply and review are Next.js server actions
backed by new `packages/db/src` data-access helpers. No schema change was required. The regression
suite grew from 19 to 24 tests. Earlier baselines are carried forward unchanged.

`v0.4.0` establishes the first Alibaba Cloud deployment baseline for TalentOS. It targets a single
Alibaba Cloud ECS instance in Singapore (`ap-southeast-1`) running the existing Docker Compose topology:
Applicant Portal, Admin Portal, TalentOS PostgreSQL, Keycloak, and Keycloak PostgreSQL. This baseline is
for public-IP validation and is not the final production topology. Follow-up hardening includes
HTTPS/domain routing, Keycloak production mode, backups, monitoring, and managed database evaluation.

`v0.3.0` established Keycloak as the live IAM and wires OIDC authentication + role-based authorization
into both portals (Auth.js / NextAuth v5). It introduces the 5-role model (`SUPER_ADMIN` platform;
`ORG_ADMIN`/`HR`/`TECH_LEAD`/`APPLICANT` org-scoped) with a capability matrix, a seeded Super Admin,
Keycloak password policy and first-login password/TOTP, and admin-portal RBAC gating. Org/role mapping
uses Keycloak realm roles for identity and the TalentOS DB for org scoping. Schema change: `User` gains
`keycloakSubjectId`, `emailVerified`, `platformRole`, optional `passwordHash`; new `PlatformRole` enum;
`TenantRole` becomes the org roles. This is staged — the Admin user/org/role management UI (Keycloak
Admin REST API) follows in `v0.3.1`.

`v0.2.2` was a documentation-only update that refreshed the root README and documentation overview after
the separated-portal implementation. No schema change.

`v0.2.1` removed all administrator navigation from the applicant application (no `Admin` link, dropped
`NEXT_PUBLIC_ADMIN_URL`), completing module isolation. No schema change.

`v0.2.0` isolated the applicant and administrator modules into two separate Next.js applications, each
running in its own Docker container, sharing only the `packages/*` libraries. There was no Prisma
schema change in that baseline. It realized the portal-separation direction recorded in `v0.1.2`.

`v0.1.2` was a documentation-only update that established the architecture engineering backlog
direction: Keycloak as the target IAM system, separate Applicant and Admin portals, and
architecture-level Engineering To-Do tracking mapped from the Product Backlog.

`v0.1.1` established local Docker deployment support with configurable host ports.

`v0.1.0` remains the first platform architecture baseline.

This baseline includes:

- Keycloak IAM (`talentos-keycloak`) + dedicated `talentos-keycloak-postgres`, realm `talentos`
  auto-imported with the 5 roles, password policy, first-login password/TOTP and demo users,
- OIDC authentication on both portals via `packages/auth-web` (Auth.js / NextAuth v5, JWT sessions),
- the 5-role model and capability matrix in `packages/auth` (`SUPER_ADMIN`; `ORG_ADMIN`/`HR`/`TECH_LEAD`/`APPLICANT`),
- admin-portal RBAC gating (non-admin roles redirected to `/forbidden`) and applicant `/application` gating,
- `User` identity fields (`keycloakSubjectId`, `emailVerified`, `platformRole`, optional `passwordHash`) and migration `20260628000000_keycloak_iam_rbac`,
- the regression suite expanded to 19 tests (RBAC capability matrix + Keycloak role mapping), all passing.

Carried forward from earlier baselines: the two isolated applicant/admin containers (v0.2.0) with the
applicant exposing no admin navigation (v0.2.1); the shared `packages/ui`; the PostgreSQL data model via
Prisma; tenant resolution/isolation utilities; the AI mentor service boundary stub; and SSDLC
documentation for architecture, data model, data dictionary, deployment and testing.

## Portal Scope

As of `v0.19.0` (previously a `v0.3.0` snapshot, refreshed at `v0.16.3` and `v0.18.0`).

Public Applicant Portal routes (`apps/applicant`, container `talentos-applicant`):

- `/`
- `/apply`
- `/login` (Keycloak sign-in)
- `/application` (authenticated)
- `/access-denied` (`v0.14.2` tenant guard)
- `/logged-out` (`v0.14.3` post-logout return, canonical host)
- `/dashboard` + `program`, `tasks`, `resources`, `calendar`, `notifications`, `profile` (`v0.12.0`, accepted applicants; `program`/`tasks` rewired to mission-driven data at `v0.19.0`/`v0.19.1`)
- `/dashboard/missions`, `/dashboard/missions/[id]` (`v0.14.0`; My Submission section `v0.15.0`; assigned-missions-only `v0.18.0`; Accept Mission action + deadline countdown `v0.18.5`; task-completion submission gate `v0.19.0`)
- `/dashboard/tasks/[assignmentId]/[taskIndex]` (`v0.19.0`, per-task resource page with YouTube watch-gate for the tutorial task)
- `/dashboard/journal`, `/dashboard/journal/new`, `/dashboard/journal/[id]` (`v0.17.0`, Engineering Journal)
- `/api/auth/[...nextauth]`
- `/api/branding/logo` (public tenant logo, `v0.9.0`)
- `/api/ai/mentor` (stub boundary)

(Signup and 2FA setup are owned by Keycloak as of `v0.3.0`.)

Program Admin Portal routes (`apps/admin`, container `talentos-admin`, served at root, RBAC-gated):

- `/`
- `/applications`, `/applications/[id]`
- `/programs`, `/programs/new`, `/programs/[id]`
- `/programs/[id]/content` (`v0.16.0`, `manageProgramContent`; Video Resources/Weekly Tasks sections removed at `v0.19.0` — Calendar Events only)
- `/missions`, `/missions/new`, `/missions/[id]` (`v0.14.0`; `tutorialUrl` field `v0.19.0`)
- `/missions/[id]/submissions/[submissionId]` (`v0.15.0` submission review)
- `/submissions` (`v0.19.0`, cross-mission filterable review list, `reviewSubmissions`)
- `/operations` (`v0.8.0`)
- `/settings` (`v0.9.0` branding)
- `/organizations` (SUPER_ADMIN only, `v0.10.0`)
- `/forbidden`
- `/logged-out` (`v0.14.3`)
- `/api/auth/[...nextauth]`
- `/api/files/presign-upload`, `/api/files/[id]/confirm`, `/api/files/[id]/download` (`v0.7.0`)
- `/api/operations/health`

Local Ops Console (`apps/ops`, host-run on `127.0.0.1:3300`, not containerized): Keycloak-gated
operations UI running regression/cleanup/reset jobs (`v0.8.0`/`v0.12.2`/`v0.13.0`).

External scheduled job (not a portal route): `scripts/mission-deadlines/sweep.ts`
(`npm run mission-deadlines:sweep`, `v0.18.5`) — run by an external cron, not reachable over HTTP.

## Package Scope

Packages, apps and infrastructure included as of `v0.19.0` (no new top-level package since `v0.16.3`):

- `apps/applicant`
- `apps/admin`
- `apps/ops` (host-run local Ops Console)
- `packages/auth`
- `packages/auth-web`
- `packages/db`
- `packages/storage` (`v0.7.0`, MinIO/S3)
- `packages/ui`
- `keycloak/import` (realm definition)
- `scripts/` (seed, regression runner, local bootstrap, user-guide capture)

## Documentation Rule

All future documentation updates must reference the relevant code version.

All future implementation plans must be stored in `docs/plans/`, using `docs/plans/TEMPLATE.md`,
with its **Test Scenarios** section filled in before or during implementation (`v0.18.1`, D-076).

All future testing details and results must be stored in `docs/testing/`, using
`docs/testing/TEMPLATE.md`, with one Scenario Results row per plan scenario (`v0.18.1`, D-076).

## Versioning Convention

TalentOS uses semantic versioning:

- Patch versions, such as `v0.1.1`, are used for documentation fixes or small non-breaking implementation updates.
- Minor versions, such as `v0.2.0`, are used for new product capabilities.
- Major version `v1.0.0` is reserved for the first production-ready release.
