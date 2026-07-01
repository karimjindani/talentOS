# Decision Log

Code version: `v0.10.0`

Architecture baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

Current documentation update: `v0.10.0`

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

## D-045

`v0.7.3` requires a **CV (PDF, ≤ 5 MB)** on apply and accepts **optional** GitHub and LinkedIn profile URLs. The CV upload uses a **server-action proxy** (the apply server action receives the file via multipart `FormData` and streams it to MinIO with the new `putObject` helper) rather than v0.7.0's browser-direct presigned upload — chosen to keep the existing single-submit server-action form and avoid a client component, an acceptable trade-off for one small file. Profile URLs are host-allowlisted to `github.com` / `linkedin.com` to prevent storing phishing/redirect links. Schema change: `Application.cvFileId` (unique FK → `StoredFile`, `onDelete: SetNull`), `githubUrl`, `linkedinUrl` (migration `20260630120000_application_cv_links`). Versioned as a **patch** by explicit choice even though it adds a capability, because `v0.7.2` already consumed the prior patch slot and the work stays within the 0.7.x line. Known limitation: a failed application insert after upload leaves an orphan object in MinIO (no lifecycle cleanup yet).

Status: Approved

## D-046

`v0.8.0` adds an Admin Operations page as a guided local-development dashboard. It may run app-visible health checks and marker-based regression cleanup, but it must not expose Docker socket access or execute host reset/test commands from the web app.

Status: Approved

## D-047

`v0.9.0` implements Tenant Settings / White-label Configuration. Key decisions: (1) Brand colors are delivered to the browser via CSS custom properties (`--brand-blue`, `--brand-navy`, `--brand-mist`) injected as a per-tenant `<style>` block in each portal's root layout; Tailwind classes reference `var(--brand-blue, #2563eb)` etc. with hex fallbacks, so all ~40 existing `bg-brand-*`/`text-brand-*` usages become dynamically themable with zero component changes. (2) Logos are stored in MinIO as `StoredFile` records; `Tenant.logoFileId` (unique FK, `onDelete: SetNull`) replaces the unused `logoUrl` column for file-backed logos. Logo upload uses the server-action `putObject` pattern from v0.7.3 (no client-side presign flow) because the admin app has no `/api/files/confirm` route. (3) Tenant logos on the applicant portal's public pages are served by a new unauthenticated route `/api/branding/logo` that resolves the host tenant and 302-redirects to a fresh presigned URL — IDOR-safe because the lookup is scoped to the host-resolved tenant's own `StoredFile`. SVG is rejected (XSS vector); only PNG/JPEG/WebP are accepted. (4) The new `manageTenantSettings` capability is granted to `ORG_ADMIN` and `SUPER_ADMIN`; it gates both the settings page and the `saveTenantBranding` server action. Schema change: migration `20260701120000_tenant_logo_file_id`.

Status: Approved

## D-048

`v0.10.0` delivers the SUPER_ADMIN Organizations console (partially realizing the deferred `v0.3.1` tenant/org provisioning from D-035). Key decisions: (1) Tenant creation is a new `/organizations` admin page + `createOrganizationAction` server action, gated on the pre-existing `createOrganization` capability, which resolves to SUPER_ADMIN only (platform bypass in `can()`; no org role holds it). (2) The tenant slug is validated server-side by `isValidTenantSlug` (DNS-safe lowercase label, ≤40 chars) because the slug becomes the tenant's subdomain via host-based resolution. (3) The first ORG_ADMIN is **assigned by email**: `createOrganization` upserts the DB `User` by email and creates a `TenantMembership(ORG_ADMIN)` inside a transaction with the `organization.created` audit row — no Keycloak Admin REST API this slice. (4) Known limitation (accepted): the DB membership provides tenant scoping, but the admin-portal role identity (`session.user.orgRole`) still comes from Keycloak realm roles, so the assigned admin only gains ORG_ADMIN access to their tenant once the `ORG_ADMIN` realm role is granted in Keycloak (manual for now; full automation remains the future Keycloak-Admin-API slice per D-035). No schema change — reuses `Tenant`, `User`, `TenantMembership`, `AuditLog`.

Status: Approved
