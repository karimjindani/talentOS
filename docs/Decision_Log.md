# Decision Log

Code version: `v0.7.2`

Architecture baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

Current documentation update: `v0.7.2`

## D-001

Multi-company SaaS

Status: Approved

## D-002

Open Source + Hosted Model

Status: Approved

## D-003

Software Engineering Focus

Status: Approved

## D-004

AI as Primary Mentor

Status: Approved

## D-005

Hands-on Work from Week 1

Status: Approved

## D-006

Deployment Required Every Week

Status: Approved

## D-007

Public Portfolio

Status: Approved

## D-008

Production Readiness Review Required

Status: Approved

## D-009

White Label Support

Status: Approved

## D-010

Spiral Engineering Method

Status: Approved

## D-011

Next.js TypeScript full-stack architecture

Status: Approved

## D-012

PostgreSQL with Prisma ORM

Status: Approved

## D-013

Docker Compose as first deployment target

Status: Approved

## D-014

Shared database multi-tenancy with tenant-scoped records

Status: Approved

## D-015

Subdomain-based tenant routing

Status: Approved

## D-016

Email/password authentication with authenticator-app 2FA

Status: Approved

## D-017

Applications-first MVP vertical slice

Status: Approved

## D-018

AI mentor service boundary created before AI workflow implementation

Status: Approved

## D-019

`v0.1.0` approved as the first TalentOS code baseline

Status: Approved

## D-020

All future implementation plans and test results must be stored in version-linked Markdown files

Status: Approved

## D-021

`v0.1.1` approved for configurable local Docker ports and local deployment validation

Status: Approved

## D-022

Keycloak approved as the target IAM system

Status: Approved

## D-023

Admin Portal and Applicant Portal must become separate portal surfaces

Status: Approved

## D-024

Architecture document must track an Engineering To-Do List mapped from the Product Backlog

Status: Approved

## D-025

`v0.2.0` approved for isolating the applicant and administrator modules into two separate Next.js applications and containers (realizing D-023)

Status: Approved

## D-026

Administrator module is served at the container root with no `/admin` prefix on its dedicated host

Status: Approved

## D-027

Shared front-end code is extracted into a `packages/ui` workspace consumed by both applications rather than duplicated

Status: Approved

## D-028

The applicant application must expose no administrator navigation; cross-linking is one-directional (admin may link to the applicant portal, not the reverse)

Status: Approved

## D-029

Repository root must contain a current README for GitHub landing page visibility

Status: Approved

## D-030

`docs/README.md` must remain aligned with the root README and current version baseline

Status: Approved

## D-031

`v0.3.0` implements Keycloak as the live IAM (realizing D-022); both portals authenticate via OIDC and Keycloak owns credentials, password policy and MFA

Status: Approved

## D-032

Role model: `SUPER_ADMIN` is platform-scoped; `ORG_ADMIN`, `HR`, `TECH_LEAD` and `APPLICANT` are organization-scoped; authorization is a capability matrix

Status: Approved

## D-033

Organizations map to TalentOS tenants; Keycloak realm roles carry identity/role and the TalentOS DB (`TenantMembership`) carries org scoping (not Keycloak Organizations)

Status: Approved

## D-034

Authentication uses Auth.js (NextAuth v5) with JWT sessions and the Keycloak OIDC provider, via a shared `packages/auth-web` factory

Status: Approved

## D-035

The IAM slice is staged: `v0.3.0` delivers the IAM + RBAC foundation; the Admin Portal user/org/role management UI (Keycloak Admin REST API) is `v0.3.1`

Status: Approved

## D-036

Local Docker uses a single issuer URL `http://host.docker.internal:8080/realms/talentos` for both browser and app containers to avoid the OIDC `iss` mismatch

Status: Approved

## D-037

`v0.4.0` approved for the first Alibaba Cloud deployment baseline using a single ECS instance in Singapore and Docker Compose

Status: Approved

## D-038

The first Alibaba Cloud deployment is a public-IP validation environment, not the final production topology

Status: Approved

## D-039

RAM credentials must be stored outside the repository, loaded only into the active shell/session, and never committed or printed in logs

Status: Approved

## D-040

`v0.5.0` implements the Applications-first vertical slice (realizing D-017): authenticated apply, applicant-driven submission, and admin review with accept/reject/under-review/waitlist transitions. Apply is authenticated via Keycloak with the DB `User` provisioned/linked by email; reviewing requires the `reviewApplications` capability (ORG_ADMIN/HR/SUPER_ADMIN, not TECH_LEAD); apply and review are implemented as Next.js server actions; all writes are tenant-scoped and recorded in `AuditLog` (`application.submitted`, `application.status_changed`). No schema change was required.

Status: Approved

## D-041

`v0.6.0` implements the Programs MVP module: admin CRUD (create/edit/publish/archive) for programs. Mutations require the `managePrograms` capability (ORG_ADMIN/SUPER_ADMIN; HR/TECH_LEAD are read-only); program status uses a `DRAFT ⇄ PUBLISHED ⇄ ARCHIVED` state machine; only PUBLISHED programs appear on the applicant apply form. Programs are managed via Next.js server actions; writes are tenant-scoped and audited (`program.created`, `program.updated`, `program.status_changed`). No schema change was required.

Status: Approved

## D-042

`v0.7.0` adopts **MinIO** (S3-compatible) as the object-storage foundation, self-hosted as a Docker Compose service in every environment (local and the Alibaba ECS box) rather than a managed cloud bucket; the S3 API keeps the code provider-neutral. Files are uploaded/downloaded directly between the browser and MinIO via short-lived presigned URLs (Next never proxies bytes); the bucket is private; object keys are tenant-namespaced (`tenant/{tenantId}/{category}/{uuid}-{name}`); file metadata lives in PostgreSQL (`StoredFile`) so access is tenant-scoped and audited (`file.created`, `file.deleted`). First schema change since `v0.3.0` (migration `20260629101218_object_storage`).

Status: Approved

## D-043

`v0.7.1` enables applicant self-signup through Keycloak (realizing the signup half of `D-031`): the realm sets `registrationAllowed: true`, `registrationEmailAsUsername: true` and `defaultRoles: ["APPLICANT"]`; the applicant portal adds a "Create account" entry that starts Keycloak registration via OIDC `prompt=create`. Signup is owned by Keycloak (hosted form, password policy, TOTP); a custom branded signup form and admin-driven user management remain deferred to `v0.3.1` (`D-035`). Patch only — no schema change.

Status: Approved

## D-044

`v0.7.2` validates latest TalentOS locally only; Alibaba Cloud deployment is intentionally skipped for this iteration.

Status: Approved
