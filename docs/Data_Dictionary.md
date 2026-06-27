# Data Dictionary

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
| `email` | Unique login email. |
| `name` | Display name. |
| `passwordHash` | Hashed password; raw passwords are never stored. |
| `status` | `ACTIVE`, `INVITED` or `DISABLED`. |
| `totpSecretEncrypted` | Encrypted TOTP secret for 2FA. |
| `totpEnabledAt` | Timestamp when authenticator-app 2FA was enabled. |

## TenantMembership

| Field | Purpose |
| --- | --- |
| `tenantId` | Tenant scope for the membership. |
| `userId` | Member user. |
| `role` | `OWNER`, `ADMIN` or `APPLICANT`. |

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

Tenant-owned reads and writes must include the active `tenantId`. Admins can only act inside tenants where they have `OWNER` or `ADMIN` membership.
