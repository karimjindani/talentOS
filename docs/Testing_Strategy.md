# Testing Strategy

Code version: `v0.20.3`

Test evidence commit: `43e7537` (+ `v0.20.3` uncommitted at documentation time)

## Goals

Testing must preserve previously committed and tested work on every iteration.

The regression suite has three layers:

- Unit regression: fast Vitest coverage for utilities, server actions, guards and DB helpers.
- Scenario regression: local-development journeys that exercise logical product areas end to end through
  OIDC login flows, portal routes and database state transitions.
- Journey E2E evidence (`v0.20.3`): Playwright-driven, multi-actor browser sessions that exercise a
  whole real user arc through the applicant/admin portals — not HTTP/DB-level assertions like the
  scenario runner above, but the actual UI a reviewer would see — producing screenshot evidence, a
  Markdown summary and a combined PDF report. See the dedicated section below and
  `Architecture.md`'s Journey E2E Evidence Pipeline section.

The Ops Console can run the full scenario suite or a specific area and shows pass/fail/skip counts plus
individual scenario rows after each run.

The `v0.20.3` runner defines **59 scenarios across 12 concrete areas plus the `all` orchestrator**
(up from 53 in `v0.20.1`). The current unit and executed-regression totals are recorded in the
versioned test-results artifact, not inferred here.

CI (`.github/workflows/ci.yml`) runs the unit suite in the `ci` job **and the full scenario suite plus
the journey suite in the `e2e-evidence` job**, which boots the Docker stack on the runner for every
pull request (scenario suite added in `v0.20.1`, PR #57; journeys added in `v0.20.3` — see
[`CI_CD_Pipeline.md`](CI_CD_Pipeline.md)). Scenario and journey regression both remain available
locally from npm scripts (`npm run regression:*`, `npm run journeys*`) or the Ops Console for the
scenario suite; neither is *only* local.

As of `v0.20.3`, the unit suite comprises **1018 tests across 80 files** (up from 927/72 at `v0.20.2`).
The `v0.20.3` growth is 91 tests in 2 new files: `packages/db/src/graduates.test.ts` (48 tests — the
public-portal consent/eligibility/recruiter-access module had none before) and
`scripts/ci/journey-pdf-report.test.ts` (10 tests), plus the rest from files touched incidentally by
the merge that brought the graduate-portal feature (PR #62) into `main` ahead of this baseline. See
`D-103` and `docs/plans/v0.20.3_Journey_E2E_Evidence_Pipeline_And_Public_Portal_Fixes.md`.

The `v0.19.7` audit added 138 tests in 10 new files covering tenant CRUD, program CRUD, tenant
resolution edge cases, the RBAC capability matrix, journal validation helpers, and server actions
for applicant and admin portals. See `D-101` and `docs/REGRESSION_TEST_PLAN.md` for the complete
coverage matrix.

## Test Levels

### Unit Tests

- Tenant resolution from host/subdomain.
- Role authorization (admin-portal access for SUPER_ADMIN / ORG_ADMIN / HR / TECH_LEAD; APPLICANT denied).
- Capability matrix (`can(capability, { platformRole, orgRole })`).
- Keycloak realm-role mapping and access-token decoding (`packages/auth-web`).
- Cross-tenant access rejection.
- Password hashing and verification.
- TOTP generation and verification.
- Application status transitions.

### Auth / RBAC Tests (v0.3.0)

- Keycloak realm OIDC discovery is reachable.
- Unauthenticated admin routes redirect to Keycloak sign-in; the applicant `/application` redirects to `/login`.
- Authenticated APPLICANT is sent to `/forbidden` on the admin portal; admin-capable roles reach admin routes.
- Super Admin first login forces password change and TOTP setup (Keycloak required actions).
- Applicant self-signup (`v0.7.1`): Keycloak registration is enabled, a new account defaults to APPLICANT,
  and the new applicant can sign in and reach `/apply`.

### Application Lifecycle Tests (v0.5.0)

- `nextStatusesFor` exposes only valid reviewer transitions per status (unit, `workflow.test.ts`).
- Authenticated apply creates a `SUBMITTED` application with answers and an `application.submitted`
  audit row; duplicate active applications per program are blocked.
- Admin review enforces `reviewApplications` (TECH_LEAD denied), valid status transitions only, and
  writes `application.status_changed`; the applicant sees the updated status.

### Programs Management Tests (v0.6.0)

- Program state machine (`canTransitionProgramStatus`/`nextProgramStatuses`) offers only valid
  `DRAFT ⇄ PUBLISHED ⇄ ARCHIVED` transitions (unit, `workflow.test.ts`).
- Admin program CRUD enforces `managePrograms` (HR/TECH_LEAD read-only), is tenant-scoped, and writes
  `program.created`/`program.updated`/`program.status_changed` audit rows.
- Only `PUBLISHED` programs appear on the applicant apply form; archiving removes them.

### Tenant Settings & Organizations Tests (v0.9.0 / v0.10.0)

- `manageTenantSettings` is granted only to ORG_ADMIN/SUPER_ADMIN; branding writes are hex-validated
  and audited (`tenant.branding_updated`).
- `createOrganization` is SUPER_ADMIN-only; `isValidTenantSlug` rejects non-DNS-safe slugs
  (unit, `auth.test.ts`); tenant creation writes `organization.created` and an ORG_ADMIN membership.

### Keycloak OTP Policy Guard (v0.10.1)

- The realm import declares `otpPolicyType: "totp"` with a non-zero `otpPolicyPeriod` and
  `otpPolicyDigits` (unit, `realm-otp.test.ts`) — guards against the divide-by-zero that broke
  first-login TOTP enrollment.

### SSO Logout Tests (v0.10.2)

- `buildEndSessionUrl` emits `id_token_hint` when available and falls back to `client_id`, always sets
  `post_logout_redirect_uri`, and normalizes the issuer (unit, `logout.test.ts`).
- Manual/endpoint check: a registered `post_logout_redirect_uri` returns 302 from the Keycloak
  `end_session_endpoint`; an unregistered host returns 400 (no open redirect).

### Object Storage Tests (v0.7.0)

- `sanitizeFilename`/`buildObjectKey` produce safe, tenant-namespaced keys (unit, `keys.test.ts`).
- Presigned upload then download round-trips the bytes; `StoredFile` rows + `file.created`/`file.deleted`
  audit entries are written.
- The bucket is private: unsigned direct object access is denied (403).
- File access is tenant-scoped: a file id from another tenant is not resolvable.
- Note: the presign/round-trip and cross-tenant checks are validated at unit and manual level; the
  `storage` **scenario** area is a documented skip in `scripts/regression/run.ts` (see
  `docs/Regression_Scenarios.md`) pending automation.

### Mission Submission Tests (v0.15.0)

- Submission state machine (`DRAFT→SUBMITTED→ACCEPTED|NEEDS_REVISION`, `NEEDS_REVISION→SUBMITTED`)
  offers only valid transitions (unit, `packages/auth` workflow tests).
- `packages/db/src/submissions.test.ts` (20 tests): draft save/update, submit, ownership checks,
  URL host-allowlists (github.com / loom.com), tenant scoping, review accept / request-changes with
  mandatory feedback, notification + audit writes (`submission.*`), and
  `getApplicantMissionProgress`.
- `reviewSubmissions` capability: ORG_ADMIN + TECH_LEAD may review, HR is read-only, applicants are
  denied (unit + `missions` scenario area).
- Scenario coverage: full submission loop with notifications/audit/terminal acceptance, reviewer
  role matrix, and cross-tenant submission-read denial (see `docs/Regression_Scenarios.md`).

### Program Content & Mission-Driven Progress Tests (v0.16.0)

- `packages/db/src/program-content.test.ts` (6 tests): tenant-scoped, audited CRUD for video
  resources, weekly tasks and calendar events; `manageProgramContent` granted to ORG_ADMIN only
  (SUPER_ADMIN bypass; HR/TECH_LEAD read-only).
- Scenario coverage: accepted mission submission moves the mission-driven dashboard progress
  (draft→submit→accept; only ACCEPTED moves the bar), and program-content CRUD with role denial.

### Engineering Journal Tests (v0.17.0 / v0.17.1)

- `packages/db/src/journal.test.ts` (23 tests): create/update ownership and tenant scoping, mission
  validation (must be published and belong to the applicant's accepted program/assigned mission),
  `weekNumber` derived server-side from the selected mission (not client-trusted), evidence-link
  parsing, confidence-rating and time-spent validation, `JournalEntryDateConflictError` on a same-day
  duplicate (`v0.17.1` backs this with a database-level unique constraint), and lock behavior once a
  mission's assignment is submitted (`isJournalMissionLockedForApplicant`).
- `apps/applicant/app/dashboard/journal/view-model.test.ts`: view-model shaping for the journal list
  and detail pages.
- `apps/applicant/components/ApplicantShell.test.ts`: journal nav item present in
  `APPLICANT_NAV_ITEMS`.
- Scenario coverage (`journal` area, added `v0.18.2`/D-077): create + edit against the assigned
  mission with list/audit assertions; create rejected against a published-but-unassigned mission;
  one entry per applicant per mission per calendar date enforced (`JournalEntryDateConflictError`, v0.20.1 updated
  from per-applicant to per-applicant-per-mission uniqueness); entries lock once the
  mission's assignment is submitted. See `docs/Regression_Scenarios.md`.

### Mission Assignment Tests (v0.18.0)

- `packages/db/src/mission-assignments.test.ts` (7 tests): idempotent Week 1 assignment on
  `ACCEPTED` transition (repeated acceptance does not duplicate rows), uniqueness on
  `[tenantId, programId, applicantId, weekNumber]`, least-assigned-with-random-tie-break selection
  among published Week 1 mission variants, and that applicant mission listing/detail, submission
  drafting and journal mission selection are all scoped to assigned missions.
- `packages/db/src/mission-seed.test.ts` (1 test): the Week 1 Markdown mission specs seed correctly
  into `Mission` fields.
- Scenario coverage (`missions` area): the submission fixture in `scripts/regression/run.ts` asserts
  that accepting an application creates exactly one `MissionAssignment` row. Added `v0.18.2`/D-077:
  a published-but-unassigned mission is excluded from `listAssignedProgramMissions`/
  `getAssignedProgramMission` and rejected by `saveSubmissionDraft`; and a scenario documenting the
  known backfill gap for applicants accepted before assignment existed (see
  `docs/Regression_Scenarios.md` Known Gaps).

### Mission Deadline & Lifecycle Tests (v0.18.5)

- `packages/db/src/mission-assignments.test.ts` (15 tests): explicit-accept gating (`NOT_STARTED`
  only, double-accept rejected), `deadlineAt`/`graceEndsAt` computed from the mission's own
  `deadlineHours`/`gracePeriodHours` at acceptance time, reject-reassignment to an alternate
  published mission, and the no-alternate-mission `AWAITING_MISSION_ASSIGNMENT` + reviewer
  notification path.
- `packages/db/src/mission-deadlines.test.ts` (4 tests, new): the idempotent two-phase sweep —
  `ACCEPTED`/`IN_PROGRESS` past deadline → `OVERDUE`; `OVERDUE` past grace → `FAILED` +
  `DISQUALIFIED`; re-running either phase against already-transitioned rows is a no-op.
- `packages/db/src/submissions.test.ts` (33 tests): late submission inside the grace period recorded
  as `LATE_SUBMITTED`; week auto-advance on acceptance capped at `FINAL_PROGRAM_WEEK`; a `FAILED`
  assignment rejects new submissions.
- `packages/auth/src/workflow.ts` tests: `DISQUALIFIED`/`AWAITING_MISSION_ASSIGNMENT` have no
  outgoing admin-initiated transitions.
- No scenario-level regression coverage yet for the accept action, the sweep script, or the
  reject-reassignment flow through the real applicant/admin actions — see
  `docs/Regression_Scenarios.md` Known Gaps.

### Mission-Driven Tasks & Submissions Admin Tab Tests (v0.19.0)

- `packages/db/src/mission-tasks.test.ts` (15 tests, new): task listing per assignment, the
  Task-1/2-required completion check gating submission, mark/unmark, and Task 3's derivation from
  `Submission.status`.
- `apps/applicant/lib/youtube.test.ts` (9 tests, new): `parseYouTubeVideoId` across watch/share/
  embed URL forms and invalid input; the IFrame Player `onStateChange` watch-gate itself has no
  automated (Playwright) coverage, only manual browser verification.
- `apps/admin/components/SidebarNav.test.ts` (15 tests): new Submissions nav item, updated
  standard-nav-items integrity assertion.
- `packages/db/src/missions.test.ts`: fixture coverage for `tutorialUrl`.
- No scenario-level regression coverage yet for the submission task-gate, the watch-gate, or the
  admin Submissions tab's reachability/filtering — the `reviewSubmissions` capability boundary it
  reuses is already covered by the existing `missions` role-matrix scenario. See
  `docs/Regression_Scenarios.md` Known Gaps.

### Dashboard Wiring & Same-Week Repeat Tests (v0.19.1)

- `packages/db/src/mission-assignments.test.ts`: dedicated test asserting a Week 3 `REPEAT` decision
  reassigns Week 3 (not Week 1); existing `missions`-area regression scenarios ("Repeat-week attempts
  preserve journal history without duplicate or infinite loops", "Repeated-week history stays
  separate across mission variants and attempt boundaries") already assert the replacement
  assignment keeps the failed assignment's `weekNumber`, so this correction is scenario-covered as
  well as unit-covered.
- Dashboard/My Program/Tasks/Missions wiring to live deadline and task-completion data was verified
  manually in a real browser session (`accepted@demo.talentos.local`); no automated scenario yet
  asserts the dashboard stat's source field. See `docs/Regression_Scenarios.md` Known Gaps.

### User-Guide Screenshot Capture (v0.16.1, manual — retired v0.20.3)

- `scripts/user-guide/capture-screenshots.ts` (Playwright/Chromium) drove the running local Docker
  stack through real Keycloak OIDC flows to capture the illustrated user-guide screenshots, with a
  section filter for partial re-captures. It was run manually per release when user-facing screens
  changed; it was not part of CI or scenario regression. **Deleted in `v0.20.3`**: it asserted
  nothing — a documentation tool that photographed pages — and `tests/journeys/docs-only.spec.ts`
  (below) covers the same screenshot set while also asserting the page actually rendered what it
  claims to document.

### Journey E2E Evidence Pipeline (v0.20.3)

A Playwright-driven `tests/journeys/` suite complements the scenario runner above with real,
multi-actor browser sessions — not HTTP/DB-level assertions, but the actual UI a reviewer or new
team member would see, captured as evidence.

- `tests/journeys/fixtures/journey.ts`: a shared fixture provisioning a fully isolated tenant per run
  (`jrn-<runId>.lvh.me`), independent per-actor browser contexts, step-level full-page screenshots
  (`.ops/journey-evidence/<journey>/<runId>/`), and layered teardown — a Prisma transaction, direct
  Keycloak user deletion, and a 24h orphan sweep for runs killed before reaching teardown.
- `tests/journeys/applicant-arc.spec.ts` (`npm run journeys:applicant`): 13 steps — applicant signup,
  apply, org-admin acceptance, mission acceptance, mission tasks, four dated journal entries, evidence
  submission, admin review and acceptance, and a final dashboard check.
- `tests/journeys/docs-only.spec.ts` (`npm run journeys:docs`): 7 test blocks covering public pages,
  the apply flow, the applicant dashboard and its working flows, the admin portal and its
  authoring/review flows, and the Ops console — the illustrated-guide screenshot set, now with an
  assertion behind every capture. 3 applicant work-in-progress screenshots are `test.fixme()`; see
  `Regression_Scenarios.md` Known Gaps.
- CI (`e2e-evidence` job) runs both after the scenario suite, renders a Markdown step summary and
  per-journey `evidence.md` (`scripts/ci/journey-report.ts`), renders a combined PDF with every
  journey's step table and embedded screenshots via Playwright's own Chromium
  (`scripts/ci/journey-pdf-report.ts`), and uploads all of it as the `e2e-evidence-<run>` artifact.
  Both report scripts are non-throwing under `if: always()`, matching `regression-summary.ts`'s
  existing contract.
- **A real hang was found and fixed while verifying this suite** (D-103): every
  `page.waitForLoadState("networkidle")` call site was unbounded, and a next-auth
  duplicate-session-fetch pattern (mount-time fetch racing refetch-on-window-focus after the Keycloak
  redirect) could leave Playwright's own request ledger permanently off by one, hanging the affected
  step until the whole test's budget ran out. All three call sites are now bounded to 5s.

### Server-Action & CRUD Coverage Audit Tests (v0.19.7)

A comprehensive test-coverage audit identified that the server-action layer — the boundary
between UI forms and business logic — had no automated tests. The `v0.19.7` iteration adds
138 tests in 10 new files:

- `packages/db/src/tenants.test.ts` (12 tests): tenant CRUD, `createOrganization` with P2002
  duplicate-slug handling, email normalization, audit log, `updateTenantBranding` with
  logo variations.
- `packages/db/src/programs.test.ts` (12 tests): program CRUD, `slugify` edge cases,
  `createProgram` with P2002, tenant-scoped `updateProgram` with not-found rejection.
- `packages/db/src/journal-validation.test.ts` (33 tests): `normalizeJournalLanguage`,
  `parseJournalEvidenceLinks` (newline/comma, empty, max 10, credentials, non-HTTP),
  `validateConfidenceRating` (1–5, non-integer, NaN), `validateTimeSpentHours`
  (0.25–24, negative), `normalizeJournalEntryDate` with timezone boundary.
- `packages/auth/src/tenant.test.ts` (25 tests): `resolveTenantFromHost` edge cases
  (null, port, protocol, case, multi-level, look-alikes), `isValidTenantSlug` (DNS-safe,
  reserved, length boundaries).
- `packages/auth/src/capabilities.test.ts` (17 tests): `canEnterAdminPortal` for all roles,
  `can()` capability matrix (8 capabilities × 5 roles), `assertTenantScopedAccess`.
- `apps/applicant/app/dashboard/missions/[id]/actions.test.ts` (9 tests):
  `acceptMissionAction` and `saveSubmissionAction` happy/negative/error paths.
- `apps/applicant/app/dashboard/journal/actions.test.ts` (8 tests):
  `saveJournalEntryAction` create/update/conflict/error paths.
- `apps/admin/app/programs/actions.test.ts` (7 tests):
  `createProgramAction`, `updateProgramAction`, `setProgramStatusAction`.
- `apps/admin/app/missions/submission-actions.test.ts` (8 tests):
  `reviewSubmissionAction` accept/changes/repeat/invalid/backfill paths.
- `apps/admin/app/organizations/actions.test.ts` (7 tests):
  `createOrganizationAction` with validation, Keycloak provisioning, and failure recovery.

All 809 tests pass. No production code was modified. See `D-101` and
`docs/REGRESSION_TEST_PLAN.md` for the complete coverage matrix.

### Integration Tests

Planned integration tests:

- applicant Keycloak login to application submission (signup/2FA are owned by Keycloak),
- admin login to application review to status update,
- tenant A admin cannot access tenant B application data.

### Security Tests

- Unauthenticated admin access is blocked.
- Applicant role cannot access admin-only actions.
- Secrets are not logged.
- Cross-tenant reads and writes are rejected.

### Deployment Tests

- Docker Compose starts PostgreSQL and the isolated applicant and admin web containers.
- Prisma migrations complete.
- Smoke tests confirm the applicant portal (`http://localhost:3100`) and admin portal (`http://localhost:3200`, routes served at root) load.
- Module isolation: each web container returns 404 for the other module's routes (admin routes on the applicant container and applicant routes on the admin container).

### Documentation Regression Tests (`v0.14.1`)

User-facing documentation is part of the regression baseline. Any portal workflow, route, role,
permission, status, form or navigation change must update the relevant guide under `docs/user-guides/`
in the same pull request.

Documentation validation checks:

- Applicant guide includes current Applicant Portal URLs and supported applicant workflows.
- Back Office guide includes current Admin Portal URLs, roles and capability boundaries.
- Root `README.md` links the user guide index.
- User guides distinguish implemented workflows from known limitations.
- Documentation-only patches do not change application code, schema, package or Docker files.

### Scenario Regression Tests (`v0.13.0`)

Scenario regression is run through `scripts/regression/run.ts` and surfaced in the Ops Console.

Commands:

- `npm.cmd run regression:unit`
- `npm.cmd run regression:auth`
- `npm.cmd run regression:applicant`
- `npm.cmd run regression:admin`
- `npm.cmd run regression:programs`
- `npm.cmd run regression:missions`
- `npm.cmd run regression:journal`
- `npm.cmd run regression:tenant`
- `npm.cmd run regression:dashboard`
- `npm.cmd run regression:storage`
- `npm.cmd run regression:ops`
- `npm.cmd run regression:all`

The runner emits `REGRESSION_RESULT_JSON` with total, passed, failed, skipped, duration counts and
individual scenario results. Ops parses this payload and displays the summary per run plus scenario
rows grouped by area. If a payload has only aggregate summary data, Ops falls back to the existing
summary-card display.

Scenario data ownership rules:

- Scenario-created users, memberships, programs, missions, mission assignments, journal entries,
  submissions, applications and answers must be tagged with `RegressionDataMarker`.
- Cleanup must delete only marker-tagged records.
- Seeded demo data and user-created data are never cleanup targets unless explicitly marker-tagged.

## Regression Rule

Every implementation iteration must add or update tests for newly committed behavior and keep the existing suite passing.

From `v0.2.0`, the regression baseline also covers deployment-level module isolation: the applicant and administrator containers must continue to start independently and reject each other's routes.

From `v0.3.0`, the regression baseline also covers IAM/RBAC: Keycloak must start and import the realm, both portals must authenticate via OIDC, and the admin portal must reject non-admin roles.

From `v0.5.0`, the regression baseline also covers the application lifecycle: authenticated apply must
persist a submitted application, admin review must enforce `reviewApplications` and valid status
transitions, and every submit/decision must write an `AuditLog` entry.

From `v0.6.0`, the regression baseline also covers programs management: admin program CRUD must enforce
`managePrograms` and valid status transitions, only published programs may appear on the apply form, and
every program write must record an `AuditLog` entry.

From `v0.7.0`, the regression baseline also covers object storage: MinIO must start with a private
bucket, presigned upload/download must round-trip, file metadata must be tenant-scoped, and file
create/delete must record an `AuditLog` entry.

From `v0.8.0`, the regression baseline also covers local operations safety: the Admin Operations page
must not execute host Docker/npm commands, health checks must use app-visible dependencies, and
regression cleanup must delete only explicitly marked `RegressionDataMarker` records.

From `v0.10.3`, the regression baseline also covers per-tenant authorization: `tenantRolesGrant` must
grant a capability only when the actor's tenant-scoped roles include it (unit,
`packages/auth/src/permissions.test.ts`), and an actor must never authorize an admin action in a tenant
they hold no `TenantMembership` in (a realm-wide role no longer suffices).

From `v0.10.4`, the regression baseline also covers identity normalization: `normalizeEmail` must fold
casing/whitespace to one canonical address (unit, `packages/db/src/users.test.ts`); email lookups are
case-insensitive; and `keycloakSubjectId` is backfilled on login for existing users without creating new
rows.

From `v0.11.0`, the regression baseline also covers org-admin auto-provisioning
(`apps/admin/lib/keycloak-admin.test.ts`): `generateTempPassword` must satisfy the realm password policy;
`provisionOrgAdmin` must create a new user with `emailVerified` + required actions + a temp password and
grant `ORG_ADMIN`, and must be idempotent for an existing user (no password reset, role ensured); and the
realm import must declare the `talentos-provisioner` service-account client with `manage-users`.

From `v0.11.1`, the regression baseline also covers reserved tenant slugs: `isValidTenantSlug` must reject
the `RESERVED_SLUGS` blocklist (`www`, `admin`, `api`, `demo`, `keycloak`, …) while still allowing normal
slugs and slugs that merely contain a reserved substring (unit, `packages/auth/src/auth.test.ts`); and
duplicate active applications are blocked at the DB via the partial unique index (PR #13,
`packages/db/src/applications.test.ts`). The current regression suite is **78 tests**.

From `v0.11.4`, the regression baseline also covers the admin sidebar active-state route-matching logic
(unit, `apps/admin/components/SidebarNav.test.ts`): `isActive` must return `true` for exact-match routes
(`/` only on `/`) and `startsWith`-match routes (`/applications` on `/applications` and
`/applications/[id]`); no false positives across routes; `NAV_ITEMS` contains the five standard admin
nav items in order with only Overview using exact matching. The current regression suite is **101 tests**.

From `v0.12.0`, the regression baseline also covers the applicant dashboard DB helpers
(unit, `packages/db/src/dashboard.test.ts`, 14 tests): `listProgramTasks`, `listTasksByWeek`,
`listVideoResources`, `listCalendarEvents`, `listUserNotifications`, `countUnreadNotifications`,
`markNotificationRead`, `createNotification`, `listCompletedTaskIds`, `markTaskCompleted`, and
`getApplicantProgramProgress` (progress calculation across 4 weeks with percentage computation and
empty-week handling). Also covers the applicant shell nav active-state route-matching logic
(unit, `apps/applicant/components/ApplicantShell.test.ts`, 10 tests): `isApplicantNavActive` for
exact-match (`/dashboard`) and `startsWith`-match routes, plus `APPLICANT_NAV_ITEMS` completeness
(7 items, all expected routes present). The current regression suite is **125 tests**.

From `v0.13.0`, the regression baseline also covers scenario-based product journeys. The Ops Console
can run all regression areas or a selected area, and displays total/passed/failed/skipped counts. The
initial automated scenario suite contains 15 scenarios across `unit`, `auth`, `applicant`, `admin`,
`programs`, `tenant`, `dashboard`, `storage` and `ops`. Current status: 13 automated scenarios pass,
0 fail and 2 are intentionally skipped/documented gaps in the local one-tenant environment: cross-tenant
read denial that needs a second tenant fixture, and full CV upload/download storage automation.

From `v0.14.0`, the regression baseline also covers the Mission Engine MVP: mission status transitions,
`manageMissions` authorization, tenant-scoped mission reads/writes, published-only applicant visibility,
mission ordering, admin/applicant mission navigation, and the `regression:missions` scenario area. The
unit suite is **146 tests** before final v0.14.0 validation, and the missions scenario currently passes
2/2.

From `v0.14.1`, the regression baseline also covers user-guide currency: Applicant Portal and Back
Office guide updates are mandatory for user-facing workflow, route, role, permission, status, form or
navigation changes.

From `v0.14.2`, the regression baseline also covers the applicant-portal tenant guard
(`apps/applicant/lib/tenant-guard.test.ts`, 6 tests): `/dashboard` and `/application` require
`accessApplicantPortal` membership in the Host-resolved tenant (SUPER_ADMIN bypass); non-members are
redirected to `/access-denied`. The suite is **152 tests**.

From `v0.14.3`, the regression baseline also covers centralized logout (`buildTenantLogoutUrl` in
`packages/auth-web`): logout returns through the canonical host's `/logged-out` route with the tenant
carried in OIDC `state`, and redirect targets are allow-listed (no open redirect). The suite is
**161 tests**.

From `v0.15.0`, the regression baseline also covers the mission submission workflow: the submission
state machine, tenant-scoped/ownership-checked/audited DB helpers (`submissions.test.ts`, 20 tests),
`reviewSubmissions` authorization, and three new scenarios (full submission loop with
notifications/audit/terminal acceptance; reviewer role matrix; cross-tenant submission-read denial).
The suite is **187 tests**; `Submission` joins the regression cleanup entity types.

From `v0.15.1`, the regression baseline also covers the seeded four-week mission arc: the
data-driven `missionSeeds` upsert must remain idempotent and the four published TaskPilot missions
must be visible to the seeded accepted applicant.

From `v0.16.0`, the regression baseline also covers program content management and mission-driven
dashboard progress: `manageProgramContent` authorization with tenant-scoped audited CRUD
(`program-content.test.ts`, 6 tests), `getApplicantMissionProgress`, and two new scenarios
(draft→submit→accept moves the dashboard progress; content CRUD + role denial). The suite is
**202 tests** — the current baseline.

From `v0.16.1`, the regression baseline also covers illustrated-guide currency: the Playwright
capture script must be re-run for releases that change user-facing screens, keeping
`docs/user-guide/` screenshots in sync with the running product.

From `v0.17.0`, the regression baseline also covers the Engineering Journal module: applicant-owned,
tenant-scoped daily reflection entries validated against the applicant's mission/program
(`journal.test.ts`, 23 tests), the journal navigation entry (`ApplicantShell.test.ts`, 12 tests) and
view-model shaping (`view-model.test.ts`, 5 tests). No scenario-level coverage yet (see
`docs/Regression_Scenarios.md`).

From `v0.17.1`, the regression baseline also covers the journal entry-date uniqueness constraint:
`entryDate` values are normalized to a calendar day and a database-level unique index on
`[tenantId, applicantId, entryDate]` backs the `JournalEntryDateConflictError` application-level check.

From `v0.18.0`, the regression baseline also covers mission assignment: idempotent Week 1 assignment
on `ACCEPTED` (`mission-assignments.test.ts`, 7 tests), Week 1 Markdown mission seeding
(`mission-seed.test.ts`, 1 test), and a `missions`-area scenario assertion that acceptance creates
exactly one `MissionAssignment` row. The suite is **243 tests across 34 files**;
`regression:all` is verified 21/22 passed, 1 pre-existing documented skip, 0 failed against a freshly
migrated local database.

From `v0.15.0`, the regression baseline also covers AI Mentor functionality: Rule-Based System Engine (RBSE) classification (`ai-rbse.test.ts`, 41 tests), knowledge base retrieval (`knowledge-base.test.ts`, 22 tests), applicant context building (`ai-context.test.ts`, 11 tests), LLM integration with smart caching and SSE stream parsing (`ai.test.ts`, 19 tests; `ai-cache.test.ts`, 6 tests), and mentor database operations (`mentor.test.ts`, 13 tests). The suite is **265 tests across 33 files**; AI Mentor scenarios include SSE stream parsing (multi-fragment concatenation, empty fragments, malformed lines, `[DONE]` sentinel), cache behavior (hit/miss, static/dynamic keys, error handling, user isolation, RBSE bypass), conversation persistence, and UI interactions (load, send, new chat, scroll, render).

From `v0.18.1`, every implementation plan must use `docs/plans/TEMPLATE.md` and fill in a **Test
Scenarios** section — end-to-end behavioral cases distinct from unit tests, written before or during
implementation — and every scenario listed there must be added to this document (automated) or to its
Known Gaps (deferred, with a reason) in the same iteration; test-results docs must use
`docs/testing/TEMPLATE.md` and report one Scenario Results row per plan scenario. This closes the gap
found auditing `v0.17.0`: the Engineering Journal plan never named scenario-level test cases, so the
feature shipped with 23 solid unit tests (`journal.test.ts`) and no scenario-level regression coverage
at all — see `docs/Regression_Scenarios.md` Known Gaps and `D-076`.

From `v0.18.2`, the regression baseline adds a new `journal` scenario area (four scenarios: create/edit
with audit assertions, assigned-mission-only creation, one-entry-per-day conflict, lock-after-submission)
and two new `missions`-area scenarios (assigned-mission-only visibility/detail/submission-drafting;
and a scenario documenting the known gap that applicants accepted before Mission Assignment existed get
no automatic backfill). `EngineeringJournalEntry` joins the `RegressionDataMarker` cleanup entity types
(`packages/db/src/regression.ts`). The suite is **28 scenarios across 12 areas**; `regression:all` is
verified 27/28 passed, 1 pre-existing documented skip, 0 failed. See `D-077`.

From `v0.18.3`, the Ops Console regression result view shows individual scenario rows grouped by area,
including each scenario name, status, duration and detail/error text. This closes the usability gap
where operators could see area-level counts but had to search raw logs to identify exactly which
scenario passed, failed or skipped.

From `v0.18.5`, the regression baseline also covers the mission deadline/lifecycle state machine:
explicit-accept gating and deadline/grace computation (`mission-assignments.test.ts`), the
idempotent two-phase deadline sweep (`mission-deadlines.test.ts`, 4 tests), late-submission
acceptance and the week auto-advance cap (`submissions.test.ts`), and the terminal
`DISQUALIFIED`/`AWAITING_MISSION_ASSIGNMENT` application statuses having no outgoing transition. See
`D-080`.

From `v0.19.0`, the regression baseline also covers mission-driven tasks: the fixed 3-task
completion model gating submission (`mission-tasks.test.ts`, 15 tests), YouTube video ID parsing for
the tutorial watch-gate (`youtube.test.ts`, 9 tests), and the admin Submissions nav item
(`SidebarNav.test.ts`). See `D-081`.

From `v0.19.1`, the regression baseline also covers the same-week repeat correction: a dedicated
unit test and the existing repeat-loop `missions`-area scenarios assert a `REPEAT` decision
reassigns the same week that failed, not Week 1. The suite is **427 tests across 43 files**;
`regression:all` is verified 35/36 passed, 1 pre-existing documented skip, 0 failed. See `D-082`.

From `v0.19.2`, the regression baseline also covers the restored applicant dashboard Logout button
(`ApplicantShell.test.ts`, 13 tests, now with the `@/lib/logout-action` mock so the file resolves)
and the `vitest.config.ts` `@/(.+)` alias that makes `@/`-style imports resolvable for
`apps/applicant` tests. No unit-test-count change (427 tests across 43 files). See `D-083`.

From `v0.19.5`, focused unit coverage protects the separate weekly-task track, Markdown/YouTube
resources, task-completion idempotency and scope, journal date/attempt eligibility, centralized
submission readiness, semicolon-delimited deployment parsing, public URL reachability/SSRF controls,
concurrent submission guards and safe Markdown rendering. Scenario coverage remains in the existing
runner: Applicant covers completion/future dates/locked journals; Admin and Programs cover weekly
content and review context; Missions covers readiness, failed-URL atomicity, selective locking and
repeat separation; Tenant covers completion/journal boundaries; Unit executes the full Vitest suite.
See `D-086` through `D-090` and the `v0.19.5` plan/test-results pair.

From `v0.19.6`, the Mission Workspace LMS and curriculum/scheduling changes are protected by pure-logic
unit tests where a DOM is not required, with client-only UI behavior recorded as explicit Known Gaps.
New coverage: `apps/applicant/app/dashboard/missions/[id]/view-model.test.ts` (13 cases — step statuses,
progress, continue target, countdown visibility, submission mode, canSubmit, reviewer feedback);
`mission-assignments.test.ts` (`computeMissionDeadline` seven-weekday Thursday/≥4-working-day cases, the
accept path, and repeat exclusion of every prior mission); `program-content.test.ts` (prerequisite-task
persistence and the `DOCUMENT` resource with in-tenant/foreign `fileId` validation); and
`apps/admin/lib/pagination.test.ts` (10 cases — page-size clamping, slicing, page-window ellipsis, empty
list). `submissions.test.ts` was made date-independent by defaulting the assignment deadline relative to
`now` (previously a hardcoded `2026-07-21/22` date that expired and produced three spurious failures).
The full Vitest suite is **507 tests across 49 files**. Client-only scenarios — the ≥90% YouTube gate,
sequential learning-task unlock, applicant step-lock UI, admin collapsible/auto-collapse and page
rendering, and the Overview aggregation — are deferred to a future jsdom/browser harness and listed as
Known Gaps in `Regression_Scenarios.md`. See `D-091` through `D-093` and the `v0.19.6` plan/test-results
pair.

### Configuration & Deployment Regression Tests (`v0.19.7`)

Production-impacting issues were discovered that passed the existing suite but failed during manual QA:
stale Prisma Client after schema changes, incorrect `NEXTAUTH_URL`, Keycloak redirect URI
misconfiguration, SSR `window is not defined` in the login page, and missing admin `.env`. The following
unit tests were added to detect these classes of issues automatically in CI before manual QA.

**Environment & configuration validation** (`packages/auth-web/src/config.test.ts`, 23 tests):
validates the applicant and admin `.env` files — `NEXTAUTH_URL` scheme/port/host-on-base-domain,
`NEXTAUTH_SECRET` presence, `APP_BASE_DOMAIN` consistency across portals, `KEYCLOAK_ISSUER`/client ID
correctness, `DATABASE_URL` scheme, cross-portal consistency (shared realm, base domain, database), and
the `baseDomainCookieConfig` env-dependent branches (cookie domain scoping, `__Secure-` prefix for HTTPS,
`__Host-` rejection, localhost fallback). Protects against: `NEXTAUTH_URL` pointing to `localhost`
instead of the tenant base domain, missing `NEXTAUTH_SECRET` (MissingSecret runtime error), mismatched
`APP_BASE_DOMAIN` breaking cookie sharing, and single-host vs multi-tenant cookie misconfiguration.

**Prisma schema synchronization** (`packages/db/src/schema-sync.test.ts`, 14 tests):
validates that the generated `@prisma/client` in `node_modules/.prisma/client` is in sync with
`schema.prisma` — every schema model appears as a type in the generated client, every enum is declared,
and every model has a `PrismaClient` delegate accessor. Also validates schema file integrity (datasource,
generator, expected models/enums/enum-values) and migration directory structure. Protects against: stale
Prisma Client after schema changes (the exact issue that caused 5 unit + 24 regression failures when a
developer edited `schema.prisma` but forgot `npm run db:generate`).

**Keycloak realm configuration** (`packages/auth-web/src/realm-config.test.ts`, 25 tests):
comprehensive validation of the realm import JSON — realm enabled/registration/OTP policy, applicant and
admin client redirect URIs (canonical callback, wildcard `*.lvh.me`, explicit `demo.lvh.me`, web origins,
post-logout URIs, default scopes), ops client, all required realm roles (`ORG_ADMIN`, `HR`, `TECH_LEAD`,
`APPLICANT`, `SUPER_ADMIN`), seed user email validity, no `CONFIGURE_TOTP` on non-superadmin users
(2FA disabled platform-wide), provisioner service-account with `manage-users`, and redirect URI safety
(no arbitrary external hosts, http/https only). Protects against: missing redirect URIs for subdomain
tenants (Keycloak rejects `*.lvh.me` wildcards at runtime), missing realm roles causing `/forbidden`
redirects, disabled registration breaking "Create account", and open-redirect via overly broad URIs.

**Login callback URL & SSR safety** (`apps/applicant/lib/login-callback.test.ts`, 13 tests):
validates the extracted `resolveCallbackUrl` pure function — relative path prefixing, absolute URL
pass-through, query string preservation, tenant subdomain preservation (paysyslabs/acme), empty origin
SSR fallback, non-http scheme handling, and SSR safety (callable without `window` defined). The login
page component was refactored to call this function at click time (not render time) so `window` is always
available. Protects against: SSR `window is not defined` crash during server-side rendering of the login
page, and tenant subdomain loss where login redirects to the canonical `AUTH_URL` host instead of the
user's tenant subdomain.

**Middleware route protection & redirect validation** (`packages/auth-web/src/middleware-redirect.test.ts`, 27 tests):
validates applicant middleware protected-route detection (`/dashboard`, `/apply`, `/application` and
sub-routes protected; public routes and `_next` assets not protected), admin middleware route exemptions
(`/api/auth`, `/forbidden`, `/logged-out` exempt; business routes not), tenant callback URL construction
(preserves subdomain and query params, falls back to localhost), post-login redirect validation
(`resolveTenantRedirect` allows canonical/tenant-subdomain/apex, rejects foreign/look-alike/malformed,
resolves relative paths), tenant resolution from host header (subdomain/localhost/127.0.0.1/multi-level),
and cookie domain sharing (`isSameBaseDomain`). Protects against: unauthenticated users reaching
protected routes, tenant subdomain loss during redirect, open redirect to foreign hosts, and
APPLICANT role reaching admin portal.

**Deployment configuration validation** (`packages/db/src/deployment.test.ts`, 30 tests):
validates `docker-compose.yml` (all services, ports, health checks, volumes, images, dependencies,
read-only realm mount), `Dockerfile` (multi-stage build, `db:generate` before build, all package.json
copies, SWC binary, standalone output, openssl, `NODE_ENV=production`), CI workflow (Node 24, `npm ci`,
`db:generate`, typecheck/lint/test/build, realm-import validation job), port consistency across env
files, and realm import JSON validity. Protects against: missing `db:generate` in Docker/CI producing
stale clients, service port/dependency misconfiguration, and realm import JSON corruption.

The full Vitest suite is **639 tests across 55 files**. The `@talentos/auth-web` alias was added to
`vitest.config.ts` so auth-web tests can import the package's exports. The `baseDomainCookieConfig`
function was exported from `packages/auth-web/src/auth.ts` for testability.

## v0.20.0 — Mission-Scoped Curriculum, Review History And Markdown Authoring

`npm run regression:all`: **41/42 passed, 0 failed, 1 skipped** (the pre-existing, documented storage
upload scenario). Unit coverage is 729 tests across 57 files.

The suite earned its keep this iteration: its first run failed 12 of 42 scenarios, all caused by this
iteration's own changes. Eleven were fixtures writing journal entries dated before the fixture's
`acceptedAt`, invalid under the new start-date rule (D-099); one was a fixture creating a
`ProgramTask` without the now-required `missionId` (D-096). Both were fixture defects. A third was a
real contract change: "a repeat attempt retains week tasks" is false once tasks are mission-scoped,
because a repeat is served a different mission carrying its own tasks — that assertion now encodes the
new contract and additionally asserts the earlier mission's completion is preserved.

Fixture convention introduced here: any assignment a scenario writes journals against must carry an
explicit acceptance date. `createSubmissionFixture` backdates `acceptedAt` to a constant, and every
directly-built `missionAssignment.create` sets `assignedAt`/`acceptedAt`. Otherwise a fixture accepted
"now" has exactly one legal journal date, which collides with the one-entry-per-applicant-per-day
rule. Scenarios asserting on the acceptance → deadline calculation opt out via
`backdateAcceptanceTo: null`.

Four behaviours are covered by unit tests and manual portal verification rather than the runner, and
are recorded in `Regression_Scenarios.md` Known Gaps: dangling-repeat rescue on publish, backfill
advancing to the next week, the grouped Journal tab, and Markdown mission import (blocked on the
harness lacking a multipart upload helper). See `D-096` through `D-100` and the `v0.20.0`
plan/test-results artifacts.

## v0.20.2 — Decision Log Integrity And Opt-In Request Logging

A correction iteration; no new product behavior. Its testing interest is that it edits both app
middlewares, which are the authorization boundary for the two portals, so the change had to be proven
invisible to the existing authorization and tenant-isolation scenarios rather than merely compiling.

`packages/auth-web/src/request-log.test.ts` adds 13 cases: the `REQUEST_LOG` enable rule (including
that `"0"`, `"true"`, `"yes"` and `""` are all off, and that `NODE_ENV` is deliberately ignored because
the local Docker stack runs `NODE_ENV: production`), the `_next`/static path filter, the line format,
and the guarantee that a throwing `console.log` cannot propagate into the middleware. Unit suite:
**927 tests across 72 files**.

Two false statements were removed from this document and `CI_CD_Pipeline.md`: that CI runs the unit
suite only, and that scenario regression is a local-only capability. Both stopped being true when the
`e2e-evidence` job merged in PR #57, and neither document was updated at the time — the version header
of `CI_CD_Pipeline.md` was bumped to `v0.20.1` with no content change at all. Scenario counts of 40 and
42 in `Regression_Scenarios.md` were likewise stale against the runner's 53.

The `v0.20.1` iteration is also reconstructed here in retrospect: see
`docs/plans/v0.20.1_Request_Logging_Journal_Date_Rule_And_Scenario_Coverage.md` and its test-results
counterpart, whose evidence is `v0.20.1`'s own CI artifact (run `31614137916`: 53 scenarios, 52 passed,
0 failed, 1 documented skip) rather than a local re-run.

## v0.20.3 — Journey E2E Evidence Pipeline And Public-Portal Fixes

`npm run regression:all`: **58/59 passed, 0 failed, 1 skipped** (run
`regression-20260819101751-ed270347`). `npm run journeys`: **8/9 passed, 0 failed, 1 documented
`test.fixme()`**. Unit suite: **1018 tests across 80 files**. Full detail:
`docs/plans/v0.20.3_Journey_E2E_Evidence_Pipeline_And_Public_Portal_Fixes.md` and its test-results
counterpart.

Two independent efforts land in this baseline. First, the Playwright journey suite described above —
built to give this repo a real, browser-driven evidence trail instead of only HTTP/DB-level scenario
checks. Second, hardening the public-portal graduate-consent and recruiter-access-request feature that
had merged (PR #62) with a real bug and almost no test coverage: `declineGraduateProfilePublishing`
and `skipGraduateConsent` silently discarded the applicant's decision whenever no `GraduateProfile` row
existed yet — the API returned success, but nothing was written, and the consent modal reappeared on
the next page load. Fixed to mirror the already-correct `createOrUpdateGraduateProfile` (acknowledge)
path; `packages/db/src/graduates.ts` — previously untested — gained 48 unit tests, and the
`public-portal` scenario area grew from 1 scenario to 6.

The suite earned its keep again this iteration, the same way `v0.20.0`'s did: the first full journey
run for this baseline's own verification evidence hung and failed 3 of 9 tests, reproducible every
time. Root-caused live rather than shipped as a "known flaky test" — see the Journey E2E Evidence
Pipeline section above and `D-103` for the full writeup (a next-auth duplicate-session-fetch pattern
colliding with an unbounded `networkidle` wait, not an application defect). Fixed and reverified twice
before this document was written.

`RecruiterAccount` joins the `RegressionDataMarker`-tracked entity types
(`packages/db/src/regression.ts`) — it has no relation back to `User`/`Tenant`, so nothing in the
existing cleanup chain could reach it, and every regression run touching the recruiter flow would have
leaked one row forever. See `D-103`.
