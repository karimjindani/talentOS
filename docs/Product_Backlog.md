# Product Backlog

Code version: `v0.19.6`

Documentation update: `Backlog refreshed as part of the v0.16.2 vision audit (D-070): recorded the v0.15.1 four-week mission seed (D-068) and the v0.16.0 mission-driven dashboard progress + program content management (D-069) as delivered. Refreshed again during v0.18.2 (D-077): corrected the stale "Engineering Journal module" next-slice entry (delivered in v0.17.0/v0.17.1) and the pre-v0.18.0 mission-visibility wording. Refreshed again during v0.19.6 (D-094): reconciled the v0.19.0–v0.19.6 mission-lifecycle, mission-workspace/LMS, curriculum-tooling, submission-readiness and AI Mentor delivery, and recorded AI Mentor as delivered rather than an open boundary slice.`

## MVP

- Applications
- Programs
- Missions
- AI Mentor
- Knowledge Base
- GitHub Integration
- Portfolio
- Certificates
- Leaderboard
- Hiring Recommendations

## V2

- AI Assignment Review
- Slack Community
- AI Interview

## V3

- AI Video Analysis
- AI Customer
- AI Stakeholder Personas

## Engineering Backlog

### Major Platform Items

- IAM with Keycloak — foundation delivered in `v0.3.0`
  - Keycloak is the live IAM for authentication, MFA, password policy, roles and session management; both portals authenticate via OIDC and the admin portal enforces RBAC.
  - Applicant self-signup delivered in `v0.7.1` (Keycloak self-registration, default role APPLICANT).
  - Tenant/org creation delivered in `v0.10.0`: SUPER_ADMIN Organizations console creates tenants and
    assigns the first ORG_ADMIN by email (DB membership).
  - Per-tenant authorization enforced in `v0.10.3` (D-051): admin authority is now bound to the DB
    `TenantMembership`, closing the cross-tenant access gap; the realm role only gates portal entry.
  - Org-admin auto-provisioning delivered in `v0.11.0` (D-053): org creation provisions the Keycloak user
    + `ORG_ADMIN` realm role via the Admin REST API (service-account client, one-time temp password) — no
    manual `kcadm` step.
  - Next: a full Admin Portal Users/Roles management UI (list/edit/deactivate, role changes) on top of the
    `v0.11.0` Keycloak Admin REST integration.

- Separate Admin and Applicant Portals — delivered in `v0.2.0`
  - The Admin Portal and Applicant Portal are two separate Next.js applications, each in its own Docker
    container, sharing only the `packages/*` libraries. As of `v0.2.1` the applicant portal exposes no
    administrator navigation.

- Object storage foundation — delivered in `v0.7.0`
  - MinIO (S3-compatible) self-hosted object storage with presigned upload/download and tenant-scoped
    `StoredFile` metadata. Enables future CV uploads, program materials, certificates and portfolio assets.
  - Applied in `v0.7.3` (CV-on-apply) and `v0.9.0` (tenant logo upload).

- Tenant settings / white-label configuration — delivered in `v0.9.0`
  - Admin-gated (`manageTenantSettings`) branding: organization name, brand colors and logo, persisted,
    audited (`tenant.branding_updated`) and applied live to both portals via CSS variables. Logos are
    stored in MinIO (`Tenant.logoFileId`).

- Super Admin Organizations console — delivered in `v0.10.0`
  - SUPER_ADMIN can create tenants and assign the first ORG_ADMIN by email (DB `User` +
    `TenantMembership`), audited as `organization.created`; the matching Keycloak realm-role grant is
    still manual pending the Keycloak Admin REST API (`v0.3.1`).

- Admin Operations dashboard — delivered in `v0.8.0`
  - Local-development health checks, copyable regression commands and marker-based cleanup guidance;
    does not execute Docker/npm host commands.

### MVP Engineering Deliverables

Mission assignment update (`v0.18.0`): accepted applicants now see assigned published missions, not
every published mission in the accepted program. Week 1 mission variants are seeded from Markdown
source specs and imported into database mission fields.

Mission lifecycle & workspace update (`v0.18.5`–`v0.19.6`): each assignment now has a time-boxed
lifecycle (explicit accept starts the clock) with deadlines on a Thursday cadence, and the applicant
mission page is a tabbed **Mission Workspace** (LMS-style: step/task tabs, in-tab watch-gated
tutorial, live deadline countdown). See the Missions module entry below for the version-by-version
breakdown.

- Applications module — delivered in `v0.5.0` (authenticated apply → submit → admin review with accept/reject/under-review/waitlist, tenant-scoped and audited).
- Programs module — delivered in `v0.6.0` (admin CRUD: create/edit/publish/archive, `managePrograms`-gated, tenant-scoped and audited; published programs feed the apply form).
- Missions module — delivered in `v0.14.0` (admin create/edit/publish/archive; accepted applicants
  see assigned published missions for their accepted program as of `v0.18.0` — see the update above).
  - Submission workflow MVP-1 delivered in `v0.15.0` (D-067): applicant evidence submission with the
    SEM review loop (accept / request changes → resubmit).
  - Engineering Journal module delivered in `v0.17.0`/`v0.17.1` (D-073/D-074): dedicated daily
    structured-reflection entries, separate from the legacy `Submission.journalMarkdown` evidence
    field. Attempt-scoped journal readiness gating (≥4 current-attempt entries required to submit)
    added in `v0.19.5` (D-087). Next slices still deferred (D-090): real AI review/scoring for
    journal entries, recruiter/portfolio journal view, competency rollup and badges.
  - Four-week mission arc seeded in `v0.15.1` (D-068): the full TaskPilot apprenticeship
    (BEGINNER → EXPERT) with the 10-step SEM lifecycle, Bronze→Platinum criteria and competency tags.
  - Mission-driven dashboard progress + program content management delivered in `v0.16.0` (D-069):
    dashboard progress computed from ACCEPTED submissions; admin Program Content CRUD
    (`manageProgramContent`) for video resources, weekly tasks and calendar events.
  - Mission deadline lifecycle delivered in `v0.18.5` (D-080): every assignment gets an explicit
    time-boxed lifecycle where the applicant's accept (not assignment) starts the clock; deadline
    enforcement runs as an external, idempotent scheduled job (`npm run mission-deadlines:sweep`),
    with OVERDUE / grace-period / terminal FAILED states and grace-window late submissions accepted.
  - Mission-driven tasks delivered in `v0.19.0` (D-081): the applicant Tasks experience is a fixed
    three-task-per-assignment template (Review Brief / Study Tutorial / Build & Submit); submission
    is gated on tasks 1–2, the tutorial uses a YouTube watch-gate, and reviewers get a cross-mission
    admin Submissions tab.
  - Dashboard/lifecycle wiring + same-week repeat delivered in `v0.19.1` (D-082): dashboard,
    My Program and countdown read the real assignment lifecycle data; a reviewer rejection now
    repeats the same week with a different mission instead of resetting to Week 1.
  - Weekly learning tasks + submission readiness delivered in `v0.19.5` (D-086–D-090): weekly
    learning tasks (`ProgramTask`) kept separate from the mission workflow checklist; central
    evidence-URL validation with public-reachability/SSRF checks before any DB mutation; up to ten
    deployment URLs parsed from `Submission.deploymentUrl`.
  - Mission Workspace LMS + curriculum tooling + Thursday scheduling delivered in `v0.19.6`
    (D-091–D-093): the applicant mission page is rebuilt as a tabbed, view-model-driven Mission
    Workspace (≥90% watch-gate, sequentially-unlocked learning tasks, live countdown); admin
    curriculum tooling adds a top-level Tasks page, `DOCUMENT` learning resources (real file
    upload), `isPrerequisite` tasks that lock mission steps, an Overview KPI dashboard, and list
    pagination + filters; mission deadlines follow a Thursday cadence (≥4 working days) and a
    repeat excludes every mission the applicant already had that week.
- AI Mentor — delivered in `v0.19.3` (D-084): a GLM-backed streaming chat with conversation
  history, a Rule-Based System Engine (RBSE) topic boundary that always runs (including
  personal-name blocking) and LLM token-usage tracking. Next slices: richer scoring/analytics and
  competency-linked mentoring.
- Knowledge Base — not yet delivered as a standalone module; program curriculum / learning-resource
  tooling (Markdown / YouTube / Document resources, `manageProgramContent`-gated) landed in `v0.19.6`
  (D-092).
- GitHub Integration
- Portfolio
- Certificates
- Leaderboard
- Hiring Recommendations
