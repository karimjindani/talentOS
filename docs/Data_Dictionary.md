# Data Dictionary

Code version: `v0.18.0`

Baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959` (`v0.14.0`); `v0.15.0` commit set on merge

> `v0.18.0` (Mission Assignment MVP) adds `mission_assignments`, a tenant-scoped table connecting
> accepted applicants to assigned published missions by program and week. Accepted applicants now see
> assigned missions only. Week 1 assignment variants are authored as Markdown seed files and imported
> into normal `missions` fields during seed. Migration:
> `20260708120000_v0_18_0_mission_assignment_mvp`.

> `v0.17.0` (Engineering Journal MVP) adds `engineering_journal_entries`, a tenant-scoped daily
> reflection table linked to user, program and mission, plus `User.preferredJournalLanguage`.
> Journal entries store structured reflection fields, confidence, time spent and evidence links.
> AI review/scoring columns are nullable placeholders; real AI scoring remains future work.
> Audit actions in use: `journal.created`, `journal.updated`.
> Migrations: `20260707190000_v0_17_0_engineering_journal_mvp`,
> `20260708100000_v0_17_1_journal_entry_date_unique`.

> `v0.15.0` (Mission Submission Workflow, D-067) activates `submissions`: adds `tenantId`
> (FK→tenants), `reviewerFeedback`, `reviewedAt`, `reviewerUserId` (FK→users, SetNull), unique
> `[missionId, applicantId]` and index `[tenantId, status]`; drops the superseded
> `missions_tenantId_programId_idx`. Audit actions in use: `submission.created`,
> `submission.updated`, `submission.submitted`, `submission.reviewed`.
> Migration: `20260706090000_v0_15_0_mission_submissions`.
>
> `v0.14.0` (Mission Engine MVP) adds `MissionStatus` and extends `missions` with `status`,
> `weekNumber`, `order`, `objective`, `acceptanceCriteria`, `deliverables`, `evaluationCriteria` and
> `competencyTags`. Audit actions in use: `mission.created`, `mission.updated`,
> `mission.status_changed`.
>
> `v0.12.0` (applicant dashboard) adds new tables and fields:
>
> **program_tasks**: `id` (cuid PK), `tenantId` (FK→tenants), `programId` (FK→programs), `weekNumber`
> (Int, 1-4), `title` (String), `description` (String?), `dueAt` (DateTime?), `order` (Int, default 0),
> `createdAt`, `updatedAt`. Index on `[tenantId, programId, weekNumber]`.
>
> **video_resources**: `id` (cuid PK), `tenantId` (FK→tenants), `programId` (FK→programs), `weekNumber`
> (Int?), `title` (String), `url` (String), `description` (String?), `createdAt`, `updatedAt`. Index on
> `[tenantId, programId, weekNumber]`.
>
> **notifications**: `id` (cuid PK), `tenantId` (FK→tenants), `userId` (FK→users), `type`
> (NotificationType: INFO/WARNING/SUCCESS/TASK_DUE), `title` (String), `body` (String?), `readAt`
> (DateTime?), `createdAt`. Index on `[userId, readAt]` and `[tenantId, createdAt]`.
>
> **calendar_events**: `id` (cuid PK), `tenantId` (FK→tenants), `programId` (FK→programs), `title`
> (String), `description` (String?), `startsAt` (DateTime), `endsAt` (DateTime?), `location` (String?),
> `createdAt`, `updatedAt`. Index on `[tenantId, programId, startsAt]`.
>
> **user_task_completions**: `id` (cuid PK), `taskId` (FK→program_tasks), `userId` (FK→users),
> `completedAt` (DateTime, default now()). Unique on `[taskId, userId]`. Index on `[userId]`.
>
> `v0.11.4` (UI polish) makes no data-model change — it is a UI-only iteration (apply page redesign,
> admin sidebar active-state indicator, review page back button).
>
> `v0.11.1` (reserved slugs) makes no schema change. Records the PR #13 addition: a partial unique index
> on `applications (applicantId, programId)` for active statuses (REJECTED excluded), backstopping the
> app-layer duplicate-application check.
>
> `v0.11.0` (org-admin auto-provisioning) makes no schema change — org creation additionally provisions
> the Keycloak user + `ORG_ADMIN` realm role via the Admin REST API.
>
> `v0.10.4` (identity linking & email normalization) makes no schema change: emails are normalized on
> write and `keycloakSubjectId` is backfilled on login (see the `User.keycloakSubjectId` row below);
> `email_verified` is exposed on the session only (not a DB column).
>
> `v0.10.3` (tenant isolation fix) makes no data-model change — authorization now consults the existing
> `TenantMembership` rows.
>
> `v0.10.2` (Keycloak SSO logout fix) is an auth/Keycloak configuration fix — no data-model change.
>
> `v0.10.1` (Keycloak OTP policy fix) is a Keycloak realm configuration fix — no data-model change.
>
> `v0.10.0` (Super Admin Organizations console) adds the audit action `organization.created`. No schema
> change — tenant creation reuses `Tenant`, `User`, `TenantMembership` and `AuditLog`.
>
> `v0.9.0` (Tenant settings / white-label) adds `Tenant.logoFileId` (unique FK → `StoredFile`,
> `onDelete: SetNull`, migration `20260701120000_tenant_logo_file_id`) and the audit action
> `tenant.branding_updated`.
>
> `v0.7.3` (Applicant CV & profile links) adds `cvFileId`, `githubUrl` and `linkedinUrl` to
> `Application` (migration `20260630120000_application_cv_links`).
>
> `v0.7.0` (Object storage) adds the `StoredFile` entity and the audit actions `file.created`,
> `file.deleted` (migration `20260629101218_object_storage`).
>
> `v0.8.0` adds `RegressionDataMarker` for explicit regression cleanup boundaries.
>
> `v0.6.0` (Programs management) adds admin CRUD over `Program` and the audit actions `program.created`,
> `program.updated`, `program.status_changed`.
>
> `v0.5.0` (Applications lifecycle) begins persisting `Application`, `ApplicationAnswer` and `AuditLog`
> rows. Audit actions in use: `seed.initialized`, `application.submitted`, `application.status_changed`.
>
> `v0.3.0` (Keycloak IAM) adds identity fields to `User` and changes the role enums (see below).

## Tenant

| Field | Purpose |
| --- | --- |
| `id` | Unique tenant identifier. |
| `name` | Organization or academy name. |
| `slug` | Subdomain-friendly tenant key. |
| `logoUrl` | Optional white-label logo. |
| `primaryColor` | Tenant brand color. |
| `secondaryColor` | Tenant brand accent color. |

## User

| Field | Purpose |
| --- | --- |
| `id` | Unique user identifier. |
| `email` | Unique login email (matches the Keycloak username/email). |
| `name` | Display name. |
| `keycloakSubjectId` | Unique link to the Keycloak subject (OIDC `sub`). Backfilled on login for admin users via `linkKeycloakIdentity` and set for applicants on first apply (`v0.10.4`); never creates a row. |
| `emailVerified` | Email verification timestamp. |
| `platformRole` | Platform role, `SUPER_ADMIN` or null. |
| `passwordHash` | Optional legacy local hash; Keycloak owns credentials as of `v0.3.0`. |
| `status` | `ACTIVE`, `INVITED` or `DISABLED`. |
| `totpSecretEncrypted` | Legacy TOTP secret; MFA is owned by Keycloak as of `v0.3.0`. |
| `totpEnabledAt` | Legacy 2FA enablement timestamp. |
| `preferredJournalLanguage` | Applicant's preferred default language for Engineering Journal entries, such as English, Roman Urdu, Roman Hindi or a custom value. |

## TenantMembership

| Field | Purpose |
| --- | --- |
| `tenantId` | Tenant (organization) scope for the membership. |
| `userId` | Member user. |
| `role` | Org-scoped role: `ORG_ADMIN`, `HR`, `TECH_LEAD` or `APPLICANT`. |

## Program

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant. |
| `name` | Program name. |
| `slug` | Tenant-unique program slug. |
| `description` | Public/admin program description. |
| `status` | `DRAFT`, `PUBLISHED` or `ARCHIVED`. Only `PUBLISHED` programs appear on the apply form. |
| `startsAt` | Optional cohort start date. |
| `endsAt` | Optional cohort end date. |

## Application

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant. |
| `programId` | Program receiving the application. |
| `applicantId` | User who submitted the application. |
| `status` | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `ACCEPTED`, `REJECTED` or `WAITLISTED`. |
| `submittedAt` | Submission timestamp. |
| `reviewedAt` | Review completion timestamp. |
| `reviewerNotes` | Internal admin review notes. |
| `cvFileId` | Optional unique FK to the applicant's CV in `StoredFile` (PDF in MinIO); `null` if no CV. `SetNull` on file delete. |
| `githubUrl` | Optional applicant GitHub profile URL (host-allowlisted to github.com). |
| `linkedinUrl` | Optional applicant LinkedIn profile URL (host-allowlisted to linkedin.com). |

## ApplicationAnswer

| Field | Purpose |
| --- | --- |
| `applicationId` | Parent application. |
| `questionKey` | Stable question identifier. |
| `questionLabel` | Human-readable question. |
| `answer` | Applicant response. |

## Mission

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant. |
| `programId` | Program the mission belongs to. |
| `title` | Mission title shown to admins and accepted applicants. |
| `difficulty` | `BEGINNER`, `INTERMEDIATE`, `ADVANCED` or `EXPERT`. |
| `status` | `DRAFT`, `PUBLISHED` or `ARCHIVED`; only published missions can be assigned to applicants. |
| `weekNumber` | Program week/sequence bucket. |
| `order` | Sort order within the week. |
| `brief` | Main mission brief and business context. |
| `objective` | Short learning/product objective. |
| `acceptanceCriteria` | Completion criteria. |
| `deliverables` | Required artifacts such as PRD, repository, deployment URL and Loom video. |
| `evaluationCriteria` | Completion level or grading rubric. |
| `competencyTags` | Competency mapping labels. |

## MissionAssignment

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant; keeps assignments isolated by organization. |
| `programId` | Program context for the assignment. |
| `applicantId` | Applicant/user receiving the mission. |
| `missionId` | Published mission assigned to the applicant. |
| `weekNumber` | Program week for the assignment. One assignment is allowed per tenant + program + applicant + week. |
| `assignedAt` | Timestamp for when the assignment was made. |
| `createdAt` | Row creation timestamp. |
| `updatedAt` | Row update timestamp. |

## Submission

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant (direct scoping, consistent with other tenant-owned tables). |
| `missionId` | Mission the evidence is for; unique together with `applicantId` (one row per applicant per mission; the revision loop reuses it). |
| `applicantId` | Participant who owns the submission. |
| `status` | `DRAFT`, `SUBMITTED`, `NEEDS_REVISION` or `ACCEPTED` (terminal; `REVIEWED` reserved/unused). |
| `repositoryUrl` | Git repository evidence link (host-allowlisted to github.com); PRD/README/user stories live in the repo. |
| `deploymentUrl` | Deployed-application evidence link (any http/https). |
| `loomUrl` | Loom walkthrough evidence link (host-allowlisted to loom.com). |
| `journalMarkdown` | Inline Engineering Journal (Markdown). |
| `submittedAt` | Last submitted-for-review timestamp. |
| `reviewerFeedback` | Written staff feedback shown to the applicant. |
| `reviewedAt` | Last review timestamp. |
| `reviewerUserId` | Staff reviewer (ORG_ADMIN / TECH_LEAD / SUPER_ADMIN); `SetNull` on user delete. |

## EngineeringJournalEntry

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant. |
| `applicantId` | Applicant/user who wrote the entry. |
| `programId` | Accepted program context for the entry. |
| `missionId` | Published mission the entry is linked to. |
| `weekNumber` | Mission week number, derived from the selected mission instead of user input. |
| `entryDate` | Day the applicant is reflecting on. Stored as a normalized calendar date; one entry is allowed per applicant/date within a tenant. |
| `language` | Language used for this entry, defaulting from the user's preferred journal language. |
| `workedOn` | Answer to "What did you work on today?" |
| `challenge` | Answer to "What challenge did you face?" |
| `solution` | Answer to "How did you solve it?" |
| `learned` | Answer to "What did you learn?" |
| `aiUsage` | Applicant's statement of whether and how AI was used. |
| `confidenceRating` | Self-rating from 1 to 5. |
| `timeSpentHours` | Time spent, in hours. |
| `evidenceLinks` | URL list for GitHub, PRs, deployed apps, videos or other evidence. |
| `reflectionDepthScore` | Nullable AI/manual scoring placeholder, 0-10 target. |
| `problemSolvingScore` | Nullable AI/manual scoring placeholder, 0-10 target. |
| `learningQualityScore` | Nullable AI/manual scoring placeholder, 0-10 target. |
| `communicationClarityScore` | Nullable AI/manual scoring placeholder, 0-10 target. |
| `consistencyScore` | Nullable AI/manual scoring placeholder, 0-10 target. |
| `totalScore` | Nullable total scoring placeholder, 0-50 target. |
| `aiReviewFeedback` | Nullable future AI mentor/reviewer feedback. |
| `aiReviewedAt` | Nullable timestamp for future AI review. |
| `aiReviewMetadata` | Nullable metadata for future AI review implementation details. |

## AuditLog

| Field | Purpose |
| --- | --- |
| `tenantId` | Tenant context, when applicable. |
| `actorUserId` | User who performed the action. |
| `action` | Machine-readable event name. |
| `entityType` | Entity affected by the event. |
| `entityId` | Identifier of affected entity. |
| `metadata` | JSON metadata for audit context. |
| `ipAddress` | Optional source IP. |
| `userAgent` | Optional client user agent. |

## StoredFile

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant. |
| `ownerUserId` | User who uploaded the file (nullable). |
| `bucket` | Object-storage bucket name. |
| `storageKey` | Unique object key (`tenant/{tenantId}/{category}/{uuid}-{name}`). |
| `originalName` | Original filename supplied by the uploader. |
| `contentType` | MIME type. |
| `size` | Size in bytes. |
| `category` | Logical grouping (e.g. `cv`, `program-material`). |
| `status` | `PENDING` until the upload is confirmed, then `READY`. |

## RegressionDataMarker

| Field | Purpose |
| --- | --- |
| `id` | Unique marker ID. |
| `runId` | Regression run identifier. |
| `entityType` | Marked entity type, such as `Application`, `ApplicationAnswer`, `Mission`, `Program`, `User`, `TenantMembership` or `StoredFile`. |
| `entityId` | ID of the marked entity. |
| `createdAt` | Marker creation timestamp. |

Cleanup must delete only marked records. Seeded and user-created unmarked records must remain untouched.

## Tenant Isolation

Tenant-owned reads and writes must include the active `tenantId`. Org admins can only act inside tenants where they have `ORG_ADMIN` membership; platform `SUPER_ADMIN` acts across organizations.
