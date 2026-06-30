# Data Dictionary

Code version: `v0.8.0`

Baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

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
| `keycloakSubjectId` | Unique link to the Keycloak subject (OIDC `sub`); set on first login (v0.3.1). |
| `emailVerified` | Email verification timestamp. |
| `platformRole` | Platform role, `SUPER_ADMIN` or null. |
| `passwordHash` | Optional legacy local hash; Keycloak owns credentials as of `v0.3.0`. |
| `status` | `ACTIVE`, `INVITED` or `DISABLED`. |
| `totpSecretEncrypted` | Legacy TOTP secret; MFA is owned by Keycloak as of `v0.3.0`. |
| `totpEnabledAt` | Legacy 2FA enablement timestamp. |

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
| `entityType` | Marked entity type, such as `Application`, `ApplicationAnswer`, `Program`, `User`, `TenantMembership` or `StoredFile`. |
| `entityId` | ID of the marked entity. |
| `createdAt` | Marker creation timestamp. |

Cleanup must delete only marked records. Seeded and user-created unmarked records must remain untouched.

## Tenant Isolation

Tenant-owned reads and writes must include the active `tenantId`. Org admins can only act inside tenants where they have `ORG_ADMIN` membership; platform `SUPER_ADMIN` acts across organizations.
