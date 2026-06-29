# Data Dictionary

Code version: `v0.5.0`

Baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

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
| `status` | `DRAFT`, `PUBLISHED` or `ARCHIVED`. |

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

## Tenant Isolation

Tenant-owned reads and writes must include the active `tenantId`. Org admins can only act inside tenants where they have `ORG_ADMIN` membership; platform `SUPER_ADMIN` acts across organizations.
