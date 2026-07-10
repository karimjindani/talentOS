# Data Model

Code version: `v0.18.0`

Baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959` (`v0.14.0`); `v0.15.0` commit set on merge

> Assignment-linked journal attempts add `MissionAssignment.attemptNumber/status`, nullable
> `missionAssignmentId` links on `Submission` and `EngineeringJournalEntry`, and
> `EngineeringJournalEntry.lockedAt`. A submission now belongs to one assignment attempt. Submitting
> locks only that attempt's journal entries; a `REPEAT` review closes the old attempt and creates the
> next active attempt without overwriting history. Migration:
> `20260710170000_assignment_linked_journal_attempts`.

> `v0.18.0` (Mission Assignment MVP) adds `MissionAssignment`, a tenant-scoped assignment row that
> links an accepted applicant to one published mission for a program/week. Applicants now see assigned
> missions instead of every published mission in their accepted program. Week 1 demo mission variants
> are stored as Markdown seed specs and imported into existing `Mission` fields during seed; those
> Markdown paths are not runtime dependencies. Migration:
> `20260708120000_v0_18_0_mission_assignment_mvp`.

> `v0.17.0` (Engineering Journal MVP) adds a dedicated `EngineeringJournalEntry` model for daily
> applicant reflections linked to tenant, applicant, program, mission and derived week number. It
> stores the structured journal prompts (worked on, challenge, solution, learning, AI usage),
> confidence rating, time spent and evidence links. Nullable AI review/scoring fields are included
> as placeholders for a future reviewer/mentor workflow; no real AI scoring is implemented in this
> slice. `User.preferredJournalLanguage` stores the applicant's default journal language.
> Migrations: `20260707190000_v0_17_0_engineering_journal_mvp`,
> `20260708100000_v0_17_1_journal_entry_date_unique`.

> `v0.15.0` (Mission Submission Workflow, D-067) activates the previously scaffolded `Submission`
> model: adds `tenantId` (FK→tenants, Cascade — direct tenant scoping, backfilled from the parent
> mission), `reviewerFeedback` (String?), `reviewedAt` (DateTime?), `reviewerUserId` (FK→users,
> SetNull), a unique `[missionId, applicantId]` (one submission per applicant per mission; the SEM
> revision loop reuses the row) and an index on `[tenantId, status]`. The `User` relation splits into
> named `SubmissionApplicant` / `SubmissionReviewer` relations. Also drops the superseded
> `missions_tenantId_programId_idx`. `SubmissionStatus` transitions used by MVP-1:
> `DRAFT→SUBMITTED→ACCEPTED|NEEDS_REVISION`, `NEEDS_REVISION→SUBMITTED` (`REVIEWED` unused). Audit
> actions: `submission.created`, `submission.updated`, `submission.submitted`, `submission.reviewed`.
> Migration: `20260706090000_v0_15_0_mission_submissions`.
>
> `v0.14.0` (Mission Engine MVP) extends `Mission` from a placeholder into a managed learning
> assignment: `MissionStatus` enum (`DRAFT`, `PUBLISHED`, `ARCHIVED`), `status`, `weekNumber`, `order`,
> `objective`, `acceptanceCriteria`, `deliverables`, `evaluationCriteria`, and `competencyTags`.
> Migration: `20260704160000_v0_14_0_mission_engine_mvp`.
>
> `v0.12.0` (applicant dashboard) adds 4 new models + 1 enum + 1 join table:
> `ProgramTask` (id, tenantId, programId, weekNumber 1-4, title, description?, dueAt?, order, timestamps),
> `VideoResource` (id, tenantId, programId, weekNumber?, title, url, description?, timestamps),
> `Notification` (id, tenantId, userId, type NotificationType, title, body?, readAt?, createdAt),
> `CalendarEvent` (id, tenantId, programId, title, description?, startsAt, endsAt?, location?, timestamps),
> `UserTaskCompletion` (id, taskId, userId, completedAt — unique on [taskId, userId]),
> `NotificationType` enum (INFO, WARNING, SUCCESS, TASK_DUE).
> Relations added to `Tenant` (programTasks, videoResources, notifications, calendarEvents),
> `User` (notifications, taskCompletions), and `Program` (tasks, videoResources, calendarEvents).
> Migration: `20260703150655_v0_12_0_applicant_dashboard`.
>
> `v0.11.4` (UI polish) makes no schema change — it is a UI-only iteration (apply page redesign, admin
> sidebar active-state indicator, review page back button).
>
> `v0.11.1` (reserved slugs) makes no schema change. It also records the schema addition delivered via
> PR #13: a **partial unique index** `applications_applicantId_programId_active_key` on
> `applications (applicantId, programId) WHERE status IN (DRAFT, SUBMITTED, UNDER_REVIEW, ACCEPTED,
> WAITLISTED)` (migration `20260702090000_duplicate_application_active_index`) — REJECTED excluded so
> re-application is allowed; it backstops the app-layer duplicate check.
>
> `v0.11.0` (org-admin auto-provisioning) makes no schema change — it adds a Keycloak service-account
> client and a server-side Admin REST call; the DB org-creation transaction is unchanged.
>
> `v0.10.4` (identity linking & email normalization) and `v0.10.3` (tenant isolation fix) make no schema
> change — both are code-only (email normalization + login-time `keycloakSubjectId` backfill; and
> membership-based authorization consulting existing `TenantMembership` rows).
>
> `v0.10.2` (Keycloak SSO logout fix) makes no schema change — auth/Keycloak configuration only.
>
> `v0.10.1` (Keycloak OTP policy fix) and `v0.10.0` (Super Admin Organizations console) make no
> schema change; `v0.10.0` adds the audit action `organization.created` and reuses `Tenant`, `User`,
> `TenantMembership`, `AuditLog`.
>
> `v0.9.0` (Tenant settings / white-label) adds `Tenant.logoFileId` (unique, optional FK → `StoredFile`,
> `onDelete: SetNull`) linking a tenant to its uploaded logo, plus the audit action
> `tenant.branding_updated`. Schema change — migration `20260701120000_tenant_logo_file_id`.
>
> `v0.7.3` (Applicant CV & profile links) adds `cvFileId` (unique, optional FK → `StoredFile`,
> `onDelete: SetNull`), `githubUrl` and `linkedinUrl` to `Application`, giving each application one
> optional stored CV and two optional profile links. Schema change — migration
> `20260630120000_application_cv_links`.
>
> `v0.7.0` (Object storage) adds the `StoredFile` model (tenant-scoped file metadata; bytes live in
> MinIO) and the `FileStatus` enum. Schema change — migration `20260629101218_object_storage`.
>
> `v0.8.0` adds `RegressionDataMarker`, an explicit local/dev cleanup boundary for regression-generated
> records.
>
> `v0.6.0` (Programs management) begins managing `Program` records through admin CRUD (incl. the
> `startsAt`/`endsAt` cohort dates) and adds `program.*` `AuditLog` events. No schema change was required.
>
> `v0.5.0` (Applications lifecycle) persists `Application`, `ApplicationAnswer` and the related
> `AuditLog` events for the first time (authenticated apply → review). No schema change was required —
> these entities already existed.
>
> `v0.3.0` (Keycloak IAM) changes the identity model: `User` gains `keycloakSubjectId` (unique link to
> the Keycloak subject), `emailVerified`, `platformRole` and an optional `passwordHash` (Keycloak owns
> credentials). New enum `PlatformRole { SUPER_ADMIN }`. `TenantRole` becomes the org-scoped roles
> `ORG_ADMIN`, `HR`, `TECH_LEAD`, `APPLICANT`. Migration `20260628000000_keycloak_iam_rbac`.

## Entity Relationship Overview

```mermaid
erDiagram
    Tenant ||--o{ TenantMembership : has
    User ||--o{ TenantMembership : joins
    Tenant ||--o{ Program : owns
    Tenant ||--o{ Application : owns
    Program ||--o{ Application : receives
    User ||--o{ Application : submits
    Application ||--o{ ApplicationAnswer : contains
    Tenant ||--o{ AuditLog : records
    User ||--o{ AuditLog : performs
    Program ||--o{ Mission : contains
    Mission ||--o{ Submission : receives
    User ||--o{ Submission : submits
    Tenant ||--o{ Submission : owns
    User |o--o{ Submission : reviews
    Tenant ||--o{ MissionAssignment : owns
    Program ||--o{ MissionAssignment : schedules
    User ||--o{ MissionAssignment : receives
    Mission ||--o{ MissionAssignment : assigned_as
    MissionAssignment ||--o| Submission : receives
    MissionAssignment ||--o{ EngineeringJournalEntry : groups
    Tenant ||--o{ EngineeringJournalEntry : owns
    User ||--o{ EngineeringJournalEntry : writes
    Program ||--o{ EngineeringJournalEntry : contains
    Mission ||--o{ EngineeringJournalEntry : anchors
    Tenant ||--o{ KnowledgeBaseDocument : owns
    Tenant ||--o{ AIInteraction : records
    Tenant ||--o{ StoredFile : owns
    User ||--o{ StoredFile : uploads
    Application |o--o| StoredFile : "CV"
```

## Core Entities

- `Tenant`: white-label organization using TalentOS.
- `User`: shared identity for applicants, tenant owners and admins; stores the applicant's preferred
  journal language.
- `TenantMembership`: user role within a tenant.
- `Program`: tenant-owned learning/recruitment program.
- `Application`: applicant submission to a program; optionally links a CV (`cvFile` → `StoredFile`) and carries optional `githubUrl` / `linkedinUrl`.
- `ApplicationAnswer`: structured answers inside an application.
- `AuditLog`: security and business action history.
- `Mission`: tenant/program-scoped SEM assignment managed by admins. Published missions are eligible
  to be assigned to accepted applicants.
- `MissionAssignment`: tenant/program/applicant/week attempt row. `attemptNumber` preserves repeat-week
  history and `status` tracks `ACTIVE`, `SUBMITTED`, `PASSED` or `REPEAT`; uniqueness includes the
  attempt number.
- `Submission`: participant mission evidence (repository/deployment/Loom URLs + legacy inline journal
  markdown) moving through the SEM review loop; tenant-scoped, one row per assignment attempt,
  reviewed by staff (`reviewerUserId`, `reviewerFeedback`, `reviewedAt`); an `ACCEPTED` submission is
  terminal portfolio/graduation evidence for the mission's `competencyTags`.
- `EngineeringJournalEntry`: dedicated daily reflection entry for an accepted applicant, linked to a
  published mission and assignment attempt. Each applicant can have only one entry per tenant/date.
  `lockedAt` is set when that attempt is submitted. AI scoring columns remain nullable placeholders.
- `StoredFile`: tenant-scoped metadata for an object stored in MinIO (bytes live in the object store).
- `RegressionDataMarker`: local/dev marker rows identifying records created by regression workflows and
  safe to remove during regression cleanup.

## Future-Ready Entities

- `PortfolioArtifact`: public engineering portfolio item.
- `Certificate`: tenant-issued certificate.
- `KnowledgeBaseDocument`: tenant-owned knowledge content.
- `AIInteraction`: auditable AI mentor/assistant interaction metadata.

## Tenant Isolation Rule

Every tenant-owned table includes `tenantId`. Queries for tenant-owned data must filter by the active tenant, and authorization checks must reject cross-tenant access.
