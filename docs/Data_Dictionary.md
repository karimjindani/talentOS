# Data Dictionary

Code version: `v0.19.5`

Schema evidence commit: `2b3afce`

> `v0.19.5` weekly-task/submission-readiness work adds `LearningResourceType` (`MARKDOWN`, `YOUTUBE`),
> extends `program_tasks` with `required`/`published`, extends the legacy-named `video_resources` table
> with task association and reusable resource content fields, and makes `user_task_completions`
> tenant-scoped. Migration: `20260716090000_weekly_tasks_submission_readiness`.
>
> `v0.19.2` (Logout Regression Fix & Confirmation Gates, D-083) makes no schema change.
>
> `v0.19.1` (Dashboard Wiring & Same-Week Repeat, D-082) makes no schema change — a function rename
> (`createRepeatFromWeekOneTx` → `createRepeatMissionForSameWeekTx`) and dashboard/program/tasks/
> missions pages reading already-shipped `MissionAssignment` fields.
>
> `v0.19.0` (Mission-Driven Tasks & Submissions Admin Tab, D-081) adds `missions.tutorialUrl`
> (String?) and `mission_task_completion`: `id` (cuid PK), `tenantId` (FK→tenants), `missionAssignmentId`
> (FK→mission_assignments, Cascade), `taskIndex` (Int, 1 or 2), `completedAt` (DateTime, default
> now()). Unique on `[missionAssignmentId, taskIndex]` (constraint name
> `mission_task_completion_key`). Task 3 has no row of its own — see `MissionAssignment` notes.
> The later weekly-task/readiness slice reactivates `program_tasks`, `video_resources`, and
> `user_task_completions` as a separate program-week learning track. `mission_task_completion`
> remains the assignment-attempt workflow-step model.
> Migration: `20260714110000_mission_tasks`.
>
> `v0.18.5` (Mission Deadline & Lifecycle, D-080) adds `missions.deadlineHours` (Int, default 168),
> `missions.gracePeriodHours` (Int, default 24), `mission_assignments.acceptedAt`/`deadlineAt`/
> `graceEndsAt` (all nullable DateTime); changes the `mission_assignments` default status to
> `NOT_STARTED` and rebuilds the `MissionAssignmentStatus` enum to `NOT_STARTED, ACCEPTED,
> IN_PROGRESS, PENDING_EVALUATION, LATE_SUBMITTED, OVERDUE, FAILED, PASSED, REPEAT`; extends
> `ApplicationStatus` with `DISQUALIFIED` and `AWAITING_MISSION_ASSIGNMENT` (both terminal — no
> outgoing transition in `packages/auth/src/workflow.ts`). Migration:
> `20260714090000_mission_deadlines_and_lifecycle`.
>
> `v0.15.0` (AI Mentor MVP, D-066) adds `mentor_conversation`: `id`, `tenantId` (FK→tenants),
> `userId` (FK→users), `title`, `createdAt`, `updatedAt`, index on `[tenantId, userId, updatedAt]`;
> and `mentor_message`: `id`, `conversationId` (FK→mentor_conversation), `role` (`"user"` |
> `"mentor"`), `content`, `cardsJson` (optional JSON-serialised `MentorCard[]`), `createdAt`, index on
> `[conversationId, createdAt]`.
>
> Assignment-linked journal attempts add assignment attempt/status fields, assignment foreign keys on
> submissions and journal entries, persisted journal lock timestamps, and the terminal `REPEAT`
> submission outcome. Migration: `20260710170000_assignment_linked_journal_attempts`.
>
> `v0.18.0` (Mission Assignment MVP, D-075) adds `mission_assignments`: `id`, `tenantId` (FK→tenants),
> `programId` (FK→programs), `applicantId` (FK→users), `missionId` (FK→missions), `weekNumber`,
> `assignedAt`, `createdAt`, `updatedAt`; unique `[tenantId, programId, applicantId, weekNumber]`,
> indexes on `[tenantId, programId, weekNumber]`, `applicantId`, `missionId`. The later assignment-attempt
> migration extends this model with attempt number/status and supersedes the original uniqueness rule.
> Migration:
> `20260708120000_v0_18_0_mission_assignment_mvp`.
>
> `v0.17.1` (journal entry date uniqueness, D-074) replaces the non-unique
> `engineering_journal_entries_tenantId_applicantId_entryDate_idx` index with a unique index of the
> same columns, after normalizing existing `entryDate` values to a calendar day. Migration:
> `20260708100000_v0_17_1_journal_entry_date_unique`.
>
> `v0.17.0` (Engineering Journal MVP, D-073) adds `engineering_journal_entries` (see the
> `EngineeringJournalEntry` table below) and `users.preferredJournalLanguage`. Audit actions in use:
> `journal.created`, `journal.updated`. Migration:
> `20260707190000_v0_17_0_engineering_journal_mvp`.
>
> `v0.16.3` (SSDLC docs refresh, D-071) is a documentation-only baseline — no schema change. It
> adds the previously missing field tables for the five `v0.12.0` dashboard models (`ProgramTask`,
> `VideoResource`, `Notification`, `CalendarEvent`, `UserTaskCompletion`), the `Tenant.logoFileId`
> and `User.lastLoginAt` rows, and a section for the four migrated-but-unused schema stubs. The
> schema has been frozen since the `v0.15.0` migration — `v0.16.0` was code-only and
> `v0.16.1`/`v0.16.2` were docs/tooling patches.
>
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
> `v0.8.0` adds `RegressionDataMarker` for explicit regression cleanup boundaries (migration
> `20260630080000_regression_data_markers`).
>
> `v0.6.0` (Programs management) adds admin CRUD over `Program` and the audit actions `program.created`,
> `program.updated`, `program.status_changed`.
>
> `v0.5.0` (Applications lifecycle) begins persisting `Application`, `ApplicationAnswer` and `AuditLog`
> rows. Audit actions in use: `seed.initialized`, `application.submitted`, `application.status_changed`.
>
> `v0.3.0` (Keycloak IAM) adds identity fields to `User` and changes the role enums (see below).
>
> All base tables (including the four schema stubs at the end of this document) were created by the
> initial migration `20260627084605_init`.

## Tenant

| Field | Purpose |
| --- | --- |
| `id` | Unique tenant identifier. |
| `name` | Organization or academy name. |
| `slug` | Subdomain-friendly tenant key. |
| `logoUrl` | Optional white-label logo URL (legacy; superseded by `logoFileId`). |
| `logoFileId` | Optional unique FK to the tenant's uploaded logo in `StoredFile` (MinIO, `v0.9.0`); `SetNull` on file delete. |
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
| `lastLoginAt` | Timestamp of the user's most recent login, when recorded. |
| `preferredJournalLanguage` | Applicant's preferred Engineering Journal entry language; defaults to `"English"` (`v0.17.0`). |

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
| `status` | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `ACCEPTED`, `REJECTED`, `WAITLISTED`, `DISQUALIFIED` (`v0.18.5`, grace period expired with no submission — terminal) or `AWAITING_MISSION_ASSIGNMENT` (`v0.18.5`, a `REPEAT` decision had no alternate mission to reassign — terminal until an admin manually assigns one). |
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
| `deadlineHours` | Hours from acceptance until the submission deadline; default `168` (7 days) (`v0.18.5`). |
| `gracePeriodHours` | Hours after the deadline during which a late submission is still accepted; default `24` (`v0.18.5`). |
| `tutorialUrl` | Optional YouTube tutorial link for the fixed Task 2 "Study the Tutorial" step; when set, the task requires watching to the end before it can be marked complete (`v0.19.0`). |

## MissionAssignment

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant; keeps assignments isolated by organization. |
| `programId` | Program context for the assignment. |
| `applicantId` | Applicant/user receiving the mission. |
| `missionId` | Published mission assigned to the applicant. |
| `weekNumber` | Program week for the assignment. |
| `attemptNumber` | Attempt sequence within the applicant's program week, starting at 1. |
| `status` | `NOT_STARTED`, `ACCEPTED`, `IN_PROGRESS`, `PENDING_EVALUATION`, `LATE_SUBMITTED`, `OVERDUE`, `FAILED`, `PASSED` or `REPEAT` (`v0.18.5`; replaces the earlier `ACTIVE`/`SUBMITTED` model). |
| `assignedAt` | Timestamp for when the assignment was made. |
| `acceptedAt` | Timestamp of the applicant's explicit Accept Mission action; null until accepted. Deadline/grace are computed from this, not `assignedAt` (`v0.18.5`). |
| `deadlineAt` | `acceptedAt` + the mission's `deadlineHours`; null until accepted (`v0.18.5`). |
| `graceEndsAt` | `deadlineAt` + the mission's `gracePeriodHours`; null until accepted (`v0.18.5`). |
| `createdAt` | Row creation timestamp. |
| `updatedAt` | Row update timestamp. |

## MissionTaskCompletion

Per-assignment-attempt completion row for the fixed Task 1 (Review the Mission Brief) and Task 2
(Study the Tutorial) template (`v0.19.0`). Task 3 (Build & Submit Evidence) has no row of its own —
it is derived from the linked `Submission.status` moving beyond `DRAFT`/`NEEDS_REVISION`. Unique on
`[missionAssignmentId, taskIndex]`; cascades on `MissionAssignment` delete, so regression cleanup
needs no separate marker for this table.

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant; keeps task completions isolated by organization. |
| `missionAssignmentId` | The assignment attempt this task completion belongs to. |
| `taskIndex` | `1` (Review the Mission Brief) or `2` (Study the Tutorial). |
| `completedAt` | Completion timestamp (default now). |

## EngineeringJournalEntry

Applicant-owned daily structured-reflection entry, distinct from the older `Submission.journalMarkdown`
field. Unique on `[tenantId, applicantId, entryDate]` — one entry per applicant per calendar date
(`v0.17.1`, D-074, database-enforced; `v0.17.0` already enforced it in application code).

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant; keeps journal entries isolated by organization. |
| `applicantId` | Applicant who owns the entry; entries are visible/editable only by their owner. |
| `programId` | Program context for the entry. |
| `missionId` | Mission the reflection is written against; must be assigned to the applicant (`v0.18.0`). |
| `missionAssignmentId` | Nullable legacy-safe link to the exact assignment attempt. New entries always set it. |
| `weekNumber` | Program week, derived from the selected mission — not trusted from the client. |
| `entryDate` | Applicant-selected calendar date of the reflection; unique per applicant per tenant. Today/past are allowed and future dates are rejected. It is separate from system timestamps. |
| `language` | Entry language, seeded from `User.preferredJournalLanguage`. |
| `workedOn` | What the applicant worked on that day. |
| `challenge` | The main challenge encountered. |
| `solution` | How the challenge was addressed. |
| `learned` | Key takeaway/learning. |
| `aiUsage` | How AI tools were used during the work. |
| `confidenceRating` | Applicant's self-rated confidence for the day's work. |
| `timeSpentHours` | Hours spent, self-reported. |
| `evidenceLinks` | Optional list of supporting evidence URLs. |
| `reflectionDepthScore` | Nullable AI-review score placeholder; no scoring logic is active yet. |
| `problemSolvingScore` | Nullable AI-review score placeholder; no scoring logic is active yet. |
| `learningQualityScore` | Nullable AI-review score placeholder; no scoring logic is active yet. |
| `communicationClarityScore` | Nullable AI-review score placeholder; no scoring logic is active yet. |
| `consistencyScore` | Nullable AI-review score placeholder; no scoring logic is active yet. |
| `totalScore` | Nullable AI-review score placeholder; no scoring logic is active yet. |
| `aiReviewFeedback` | Nullable AI-review feedback placeholder; no AI review is active yet. |
| `aiReviewedAt` | Nullable AI-review timestamp placeholder; no AI review is active yet. |
| `aiReviewMetadata` | Nullable AI-review metadata (JSON) placeholder; no AI review is active yet. |
| `lockedAt` | Timestamp set when the linked assignment attempt is submitted; locked entries are read-only. |
| `createdAt` | Row creation timestamp. |
| `updatedAt` | Row update timestamp. |

## Submission

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant (direct scoping, consistent with other tenant-owned tables). |
| `missionId` | Mission the evidence is for. |
| `missionAssignmentId` | Nullable legacy-safe link to the exact assignment attempt; unique when present. |
| `applicantId` | Participant who owns the submission. |
| `status` | `DRAFT`, `SUBMITTED`, `NEEDS_REVISION`, `ACCEPTED` or `REPEAT` (`REVIEWED` reserved/unused). |
| `repositoryUrl` | Git repository evidence link (host-allowlisted to github.com); PRD/README/user stories live in the repo. |
| `deploymentUrl` | One or more public HTTP(S) deployed-application links stored as a normalized semicolon-separated string (maximum ten); historical single values remain compatible. |
| `loomUrl` | Loom walkthrough evidence link (host-allowlisted to loom.com). |
| `journalMarkdown` | Inline Engineering Journal (Markdown). |
| `submittedAt` | Last submitted-for-review timestamp, set only after readiness and public URL checks pass; separate from journal `entryDate`. |
| `reviewerFeedback` | Written staff feedback shown to the applicant. |
| `reviewedAt` | Last review timestamp. |
| `reviewerUserId` | Staff reviewer (ORG_ADMIN / TECH_LEAD / SUPER_ADMIN); `SetNull` on user delete. |

## ProgramTask

Program-week learning task used by the Applicant Tasks page and submission-readiness service.
This is separate from assignment-attempt workflow steps stored in `MissionTaskCompletion`.

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant. |
| `programId` | Program the task belongs to. |
| `weekNumber` | Program week (1-4) the task is assigned to. |
| `title` | Task title shown on the applicant dashboard. |
| `description` | Optional task details. |
| `dueAt` | Optional due date. |
| `order` | Sort order within the week (default 0). |
| `required` | Whether completion blocks submission for missions assigned in this program week (default `true`). |
| `published` | Whether applicants may see and complete the task (default `true`). |

## VideoResource

Legacy model/table name retained for compatibility. It now represents either Markdown or YouTube
learning content and may be attached to a `ProgramTask`.

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant. |
| `programId` | Program the resource belongs to. |
| `taskId` | Optional `ProgramTask` association. When present, the task supplies the authoritative week. |
| `type` | `LearningResourceType`: `MARKDOWN` or `YOUTUBE` (default `YOUTUBE` for legacy rows). |
| `weekNumber` | Optional program week; derived from the associated task when `taskId` is present. |
| `title` | Resource title. |
| `url` | Optional validated public YouTube URL for `YOUTUBE` resources. `null` means the final video is pending. |
| `markdownContent` | Markdown source for `MARKDOWN` resources; rendered as text/React elements without raw HTML. |
| `description` | Optional description. |
| `order` | Stable display order within a task/week. |
| `durationSeconds` | Optional video/resource duration. |

## Notification

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant. |
| `userId` | Recipient user. |
| `type` | `NotificationType`: `INFO`, `WARNING`, `SUCCESS` or `TASK_DUE` (default `INFO`). |
| `title` | Notification headline. |
| `body` | Optional notification detail text. |
| `readAt` | Read timestamp; `null` while unread (mark-as-read sets it). |

## CalendarEvent

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant. |
| `programId` | Program the event belongs to. |
| `title` | Event title. |
| `description` | Optional event details. |
| `startsAt` | Event start. |
| `endsAt` | Optional event end. |
| `location` | Optional location or meeting link. |

## UserTaskCompletion

Reactivated by `v0.19.5` for the separate program-week learning track. Mission workflow steps remain
in `MissionTaskCompletion` and are not replaced by this model.

| Field | Purpose |
| --- | --- |
| `tenantId` | Authoritative tenant scope for the completion. |
| `taskId` | Completed `ProgramTask`; unique together with `tenantId` and `userId`. |
| `userId` | Applicant who completed the task. |
| `completedAt` | Completion timestamp (default now). |

Completions are week-level through the related task's `programId` and `weekNumber`; they do not point
to `MissionAssignment`, so a repeat attempt in the same week retains learning-task completion.

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

## Schema Stubs (migrated, not yet used by application code)

The following four tables were created by the initial migration and exist in every database, but no
application code reads or writes them yet — they are groundwork for the portfolio, certificates,
knowledge-base and AI roadmap pillars (see `docs/vision.md` Phases 5-8).

### PortfolioArtifact

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant. |
| `title` | Portfolio item title. |
| `url` | Link to the artifact. |
| `description` | Optional description. |

### Certificate

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant. |
| `title` | Certificate title. |
| `issuedTo` | Recipient name. |
| `issuedAt` | Issue timestamp (default now). |

### KnowledgeBaseDocument

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant. |
| `title` | Document title. |
| `body` | Document content. |

### AIInteraction

| Field | Purpose |
| --- | --- |
| `tenantId` | Owning tenant. |
| `userId` | Optional initiating user; `SetNull` on user delete. |
| `purpose` | Interaction purpose label. |
| `promptHash` | Optional hash of the prompt (no raw prompt storage). |
| `responseRef` | Optional reference to the stored response. |
| `metadata` | Optional JSON metadata. |

## RegressionDataMarker

| Field | Purpose |
| --- | --- |
| `id` | Unique marker ID. |
| `runId` | Regression run identifier. |
| `entityType` | Marked entity type, such as `Application`, `ApplicationAnswer`, `EngineeringJournalEntry`, `MissionAssignment`, `Submission`, `Mission`, `Program`, `Tenant`, `User`, `TenantMembership` or `StoredFile`. |
| `entityId` | ID of the marked entity. |
| `createdAt` | Marker creation timestamp. |

Cleanup must delete only marked records. Seeded and user-created unmarked records must remain untouched.

## MentorConversation

| Field | Purpose |
| --- | --- |
| `id` | Unique conversation ID (cuid). |
| `tenantId` | Owning tenant — cascades on tenant delete. |
| `userId` | Owning user — cascades on user delete. |
| `title` | Conversation title; defaults to `"New Conversation"`. |
| `createdAt` | Creation timestamp. |
| `updatedAt` | Last-update timestamp (auto-updated). |

Index: `(tenantId, userId, updatedAt)` for efficient per-user conversation listing.

## MentorMessage

| Field | Purpose |
| --- | --- |
| `id` | Unique message ID (cuid). |
| `conversationId` | Parent conversation — cascades on conversation delete. |
| `role` | Message author role: `"user"` or `"mentor"`. |
| `content` | Message text content. |
| `cardsJson` | Optional JSON-serialised `MentorCard[]` for rich card rendering. |
| `createdAt` | Creation timestamp. |

Index: `(conversationId, createdAt)` for chronological message retrieval.

## Tenant Isolation

Tenant-owned reads and writes must include the active `tenantId`. Org admins can only act inside tenants where they have `ORG_ADMIN` membership; platform `SUPER_ADMIN` acts across organizations.
