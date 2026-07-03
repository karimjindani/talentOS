# TalentOS Architecture

Code version: `v0.11.2`

Architecture baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

Current documentation update: `v0.11.2`

## Overview

TalentOS is a Dockerized, multi-tenant, white-label SaaS platform for talent discovery, mission-based learning and recruitment.

The platform exposes two portals, and as of `v0.2.0` each portal is an isolated application running in its own container:

- Public Applicant Portal (`apps/applicant`, container `talentos-applicant`) for landing pages, applications and applicant workflows.
- Program Admin Portal (`apps/admin`, container `talentos-admin`) for organization admins, HR, tech leads and platform super admins.

The two modules share only the `packages/*` libraries (`auth`, `auth-web`, `db`, `ui`). They no longer share a process or attack surface, so they can be deployed, scaled and secured independently.

`v0.2.0` realized this separation at the container level. As of `v0.3.0`, **Keycloak is the live IAM**: both portals authenticate via OIDC (Auth.js / NextAuth v5), and the Admin Portal enforces role-based access. Signup, password policy and authenticator-app 2FA are owned by Keycloak. The full Admin user/org/role management UI (Keycloak Admin REST API) follows in `v0.3.1`.

The architecture follows the SSDLC principle that every iteration updates architecture, data model, deployment and testing documentation.

## Container Topology

| Module | App | Container | Host port | Internal port |
| --- | --- | --- | --- | --- |
| Applicant | `apps/applicant` | `talentos-applicant` | `3100` (`APPLICANT_PORT`) | `3000` |
| Administrator | `apps/admin` | `talentos-admin` | `3200` (`ADMIN_PORT`) | `3000` |
| Identity (IAM) | `keycloak/` | `talentos-keycloak` | `8080` (`KEYCLOAK_PORT`) | `8080` |
| App database | `packages/db` | `talentos-postgres` | `55432`/`5432` (`POSTGRES_PORT`) | `5432` |
| Keycloak database | — | `talentos-keycloak-postgres` | — (internal) | `5432` |
| Object storage | `minio/minio` | `talentos-minio` | `9000`/`9001` (`S3_PORT`/`S3_CONSOLE_PORT`) | `9000`/`9001` |

## Technology Stack

- Next.js with TypeScript for the web application and server routes.
- PostgreSQL for primary data storage.
- Prisma for database schema, migrations and typed data access.
- Tailwind CSS for maintainable UI foundations.
- Docker Compose for local and VPS deployment.
- TOTP-compatible 2FA for applicant/admin authentication.

## Runtime Components

```mermaid
flowchart LR
    Applicant["Applicant Browser"] --> AppWeb["talentos-applicant (Next.js)"]
    Admin["Admin Browser"] --> AdminWeb["talentos-admin (Next.js)"]
    AppWeb -->|OIDC| KC["Keycloak IAM"]
    AdminWeb -->|OIDC + RBAC| KC
    KC --> KCDB["keycloak-postgres"]
    AppWeb --> DB["PostgreSQL"]
    AdminWeb --> DB
    AdminWeb -->|presigned URLs| MinIO["MinIO (object storage)"]
    AppWeb -->|"CV upload (server-action proxy)"| MinIO
    AppWeb --> AI["AI Service Boundary (Stub)"]
    DB --> Audit["Audit Logs"]
```

## Target Runtime Components

The future target architecture separates applicant and admin portal concerns while sharing platform services.

```mermaid
flowchart LR
    Applicant["Applicant Browser"] --> ApplicantPortal["Applicant Portal"]
    Admin["Admin Browser"] --> AdminPortal["Admin Portal"]
    ApplicantPortal --> Keycloak["Keycloak IAM"]
    AdminPortal --> Keycloak
    ApplicantPortal --> API["Platform API"]
    AdminPortal --> API
    API --> DB["PostgreSQL"]
    API --> AI["AI Mentor Boundary"]
    API --> GitHub["GitHub Integration"]
    API --> Audit["Audit Logs"]
```

## Portal Layout

The applicant and admin routes live in separate containers, and each container returns 404 for the
other module's routes. As of `v0.2.1` the applicant portal exposes **no** admin navigation; only the
admin portal links back to the applicant portal (`NEXT_PUBLIC_APPLICANT_URL`).

As of `v0.11.2` the admin portal sidebar is rendered by a client component
(`apps/admin/components/SidebarNav.tsx`) that uses `usePathname()` to highlight the active nav item
(`bg-brand-blue text-white`), and the application review page (`/applications/[id]`) includes a
"← Back to Applications" link. The applicant `/apply` page uses a professional card-based layout with
branded header, sectioned form, and styled inputs.

```mermaid
flowchart TD
    subgraph Applicant["talentos-applicant :3100"]
      Landing["/"] --> Login["/login (Keycloak)"]
      Login --> Apply["/apply (authenticated)"]
      Login --> Application["/application (authenticated)"]
      Apply --> Application
    end
    Login -. OIDC .-> KC["Keycloak :8080"]
    subgraph AdminC["talentos-admin :3200 (RBAC-gated)"]
      AdminHome["/"] --> Applications["/applications"]
      Applications --> Detail["/applications/[id]"]
      AdminHome --> Programs["/programs"]
      AdminHome --> Operations["/operations"]
      AdminHome --> Settings["/settings"]
      AdminHome --> Organizations["/organizations (SUPER_ADMIN)"]
      AdminHome --> Forbidden["/forbidden"]
    end
    AdminHome -. OIDC .-> KC
    AdminHome -. NEXT_PUBLIC_APPLICANT_URL .-> Landing
```

## Portal Separation Direction

`v0.2.0` separated the applicant and admin routes into two independently deployable containers (`talentos-applicant` and `talentos-admin`). The remaining engineering target is:

- Separate Applicant Portal for public landing, signup, application, learning missions and portfolio experience.
- Separate Admin Portal for tenant owner/admin operations, program management, application review, mission configuration, knowledge base management and hiring recommendations.
- Shared platform services for IAM, database access, audit logging, AI, GitHub integration and certificates.
- Independent deployment path for each portal so scaling, security policy and release cadence can diverge when needed.

## Multi-Tenancy

TalentOS uses a shared PostgreSQL database with tenant-scoped records.

- Tenants are resolved from subdomains such as `demo.talentos.app` (`resolveTenantFromHost`).
- Local development supports tenant simulation with hosts such as `demo.localhost`.
- Tenant-owned entities include `tenantId`.
- Application code must enforce tenant isolation before reading or mutating tenant-owned data.
- Tenants are created by the platform SUPER_ADMIN through the Admin Portal Organizations console
  (`v0.10.0`); each tenant carries white-label branding — name, brand colors and logo — applied to both
  portals by host resolution (`v0.9.0`).

## Security Model

- **Keycloak is the live IAM** (as of `v0.3.0`) for authentication, password policy, first-login
  password change, authenticator-app (TOTP) setup and role/session management. TalentOS does not store
  raw passwords; `User.passwordHash` is legacy/optional.
- Both portals authenticate via OIDC (Auth.js / NextAuth v5, JWT sessions); the access token's realm
  roles are mapped to the application roles.
- Roles: `SUPER_ADMIN` (platform) and the org-scoped `ORG_ADMIN` / `HR` / `TECH_LEAD` / `APPLICANT`.
  Admin-portal access requires SUPER_ADMIN or ORG_ADMIN/HR/TECH_LEAD; APPLICANT is denied (redirected to
  `/forbidden`). Authorization is a capability matrix in `packages/auth/src/permissions.ts`.
- Cross-tenant access is rejected by shared authorization utilities; sensitive actions are recorded in
  `AuditLog`.
- AI workflow boundaries are explicit so future AI mentor activity can be audited.
- **Object storage** (`v0.7.0`, MinIO) keeps the bucket private; files transfer directly between the
  browser and MinIO via short-lived presigned URLs; object keys are tenant-namespaced
  (`tenant/{tenantId}/{category}/…`) and `StoredFile` metadata is tenant-scoped and audited.
- **CV on apply** (`v0.7.3`) — the applicant apply server action validates the CV server-side
  (PDF, ≤ 5 MB), streams it to MinIO via `putObject` (`category: "cv"`), records a `READY`
  `StoredFile`, and links it through `Application.cvFileId`; optional GitHub/LinkedIn URLs are
  host-allowlisted. Admin downloads the CV through the tenant-scoped `/api/files/[id]/download` route.
- **Tenant settings / white-label** (`v0.9.0`) — branding edits are gated by the `manageTenantSettings`
  capability (ORG_ADMIN/SUPER_ADMIN), scoped to the host-resolved tenant and audited
  (`tenant.branding_updated`). Colors are validated server-side against `^#[0-9a-fA-F]{6}$` before being
  persisted or injected into a `<style>` block (CSS-injection guard). Logo uploads are content-type
  allowlisted to PNG/JPEG/WebP (**SVG rejected** as an XSS vector) and size-capped. The logo is served
  on the applicant portal's public pages by the unauthenticated `/api/branding/logo` route, which is
  **IDOR-safe** — it resolves the tenant from the host and returns only that tenant's own logo
  (`Tenant.logoFileId` → `StoredFile`), never an arbitrary file id.
- **Organizations console** (`v0.10.0`) — tenant creation is gated by `createOrganization`
  (SUPER_ADMIN only). The slug is validated by `isValidTenantSlug` (DNS-safe, since it becomes the
  tenant subdomain; `v0.11.1` also rejects a `RESERVED_SLUGS` blocklist — `www`/`admin`/`api`/`demo`/…);
  the create writes the tenant, an ORG_ADMIN `TenantMembership`, and an `organization.created` audit row
  in one transaction.
- **Duplicate-application guard** (`v0.11.1`, index via PR #13) — a partial unique index
  `applications (applicantId, programId) WHERE status IN (DRAFT, SUBMITTED, UNDER_REVIEW, ACCEPTED,
  WAITLISTED)` backstops the app-layer check against races; REJECTED is excluded so a rejected applicant
  may re-apply.
- **Org-admin auto-provisioning** (`v0.11.0`) — creating an organization now provisions the org admin in
  Keycloak (no manual `kcadm`). `provisionOrgAdmin` (`apps/admin/lib/keycloak-admin.ts`, server-only)
  authenticates with the confidential `talentos-provisioner` service account (client_credentials;
  realm-management `manage-users`) and creates the user with `emailVerified`, required actions
  (`UPDATE_PASSWORD` + `CONFIGURE_TOTP`) and a one-time temp password (shown once in the UI), then grants
  the `ORG_ADMIN` realm role — idempotent (an existing user just gains the role). With v0.10.3/v0.10.4
  this closes the loop: realm role gates portal entry, `TenantMembership` gates authority, and
  `keycloakSubjectId` links on first login.
- **First-login TOTP** (`v0.10.1`) — the realm import pins a valid OTP policy
  (`otpPolicyType: totp`, period 30, digits 6, HmacSHA1) so authenticator-app enrollment cannot divide
  by zero; a unit test (`realm-otp.test.ts`) guards the non-zero period.
- **SSO logout** (`v0.10.2`) — logout is OIDC RP-initiated: after `signOut({ redirect: false })` the
  browser is redirected to Keycloak's `end_session_endpoint` (`id_token_hint` + a client-registered
  `post_logout_redirect_uri`, built by `buildEndSessionUrl` in `packages/auth-web`), which terminates
  the Keycloak SSO session instead of only clearing the app cookie. Post-logout redirects are restricted
  to each client's registered origin (`post.logout.redirect.uris`), preventing open redirects.
- **Per-tenant RBAC (`v0.10.3`, closes the former D-048 limitation):** admin authorization is bound to
  the DB `TenantMembership`, not the realm-wide Keycloak role. A shared guard
  (`apps/admin/lib/tenant-guard.ts` → `resolveTenantAccess`/`requireTenantAccess`, backed by
  `getActorTenantRoles` in `packages/db` and `tenantRolesGrant` in `packages/auth`) resolves
  session → host tenant → membership and authorizes only when the actor holds a capable role **in the
  resolved tenant**; `SUPER_ADMIN` (platform role) bypasses. It gates the admin layout (all page reads),
  every mutating action (`managePrograms`/`reviewApplications`/`manageTenantSettings`), and the sensitive
  route handlers (candidate-CV download, operations health). The Keycloak realm role now serves only as
  the coarse *portal-entry* gate (middleware). Defense-in-depth: `updateProgram`/`setProgramStatus`/
  `applyStatusTransition` write via `updateMany({ where: { id, tenantId } })` so a raw id cannot cross
  tenants. Remaining `v0.3.1` work is Keycloak user/role *auto-provisioning*, not isolation.
- **Identity linking & email normalization (`v0.10.4`):** the DB `User` is the local mirror of the
  Keycloak identity, joined by email. Emails are normalized (`normalizeEmail`, lowercased/trimmed) on
  every write and `getUserByEmail` is case-insensitive, so the case-sensitive unique index cannot spawn
  duplicate identities or orphan lookups. `keycloakSubjectId` is backfilled on login for existing rows by
  `linkKeycloakIdentity`, called best-effort from the admin guard — kept out of the edge-safe auth
  callbacks (no DB at the edge) and never creating rows (applicant rows are still born on first apply).
  The Keycloak `email_verified` claim is surfaced as `session.user.isEmailVerified` for future gating but
  is **not** enforced (deferred until SMTP-backed verification exists).

## Scalability

The web application is stateless and can run multiple containers behind a reverse proxy.

For 1,000 simultaneous applicants, the first scaling path is:

- multiple web containers,
- PostgreSQL indexes and connection pooling,
- background workers for long-running AI, email and GitHub jobs,
- caching for public tenant/program content.

## Deployment

The deployment target is Docker Compose on a VPS with:

- `applicant` service running the applicant Next.js application,
- `admin` service running the administrator Next.js application,
- `postgres` service running PostgreSQL,
- future `worker` service for background processing.

Both web services build from one parameterized root `Dockerfile` (build args `APP_NAME` / `APP_DIR`).

## Software Design Notes

The architecture establishes clear seams between modules and shared libraries:

- `packages/auth` contains reusable security, RBAC (roles + capability matrix), tenant and workflow utilities.
- `packages/auth-web` wraps NextAuth v5 + the Keycloak OIDC provider (`createTalentosAuth`), with edge-safe realm-role decoding shared by both apps. As of `v0.10.2` it persists the Keycloak `id_token` and exposes `buildEndSessionUrl` for RP-initiated (SSO) logout.
- `packages/db` owns Prisma schema and database access.
- `packages/db` also owns `RegressionDataMarker`, which lets local regression cleanup target only data
  explicitly generated by regression workflows.
- `packages/storage` (`@talentos/storage`) wraps the S3 API (MinIO) — presigned upload/download,
  `deleteObject`, and tenant-namespaced key building.
- `packages/ui` owns shared front-end pieces (presentational components, tenant header helper, Tailwind brand preset) consumed by both apps. As of `v0.9.0` the Tailwind brand colors are CSS variables (`--brand-blue`/`--brand-navy`/`--brand-mist`) with hex fallbacks, and `brandStyleBlock(tenant)` emits a per-tenant `<style>` block injected in each portal's root layout so a tenant's saved colors theme both portals live with no component changes.
- `apps/applicant` owns the public/applicant routes, UI, middleware and API endpoints.
- `apps/admin` owns the administrator routes, UI and middleware, served at the container root, gated by RBAC.
- `apps/admin` includes `/operations`, a local-development dashboard for app-visible health checks,
  regression commands, marker-based cleanup guidance and local reset instructions. It does not execute
  Docker or npm host commands.
- `keycloak/import` owns the realm definition (roles, clients, password policy, demo users).
- AI mentor integration is represented by a stubbed service boundary in the applicant app.

## Engineering To-Do List

The engineering backlog below maps the Product Backlog into near-term deliverables.

### Platform Foundation

1. IAM with Keycloak — foundation implemented in `v0.3.0`
   - Done: Keycloak is the IAM; both portals authenticate via OIDC and the admin portal enforces RBAC.
   - Done: 5-role model (`SUPER_ADMIN` platform; `ORG_ADMIN`/`HR`/`TECH_LEAD`/`APPLICANT` org-scoped),
     password policy and first-login password/TOTP, seeded Super Admin.
   - Done (`v0.7.1`): applicant self-signup via Keycloak self-registration (default role APPLICANT;
     portal "Create account" using OIDC `prompt=create`).
   - Done (`v0.10.0`): SUPER_ADMIN Organizations console — create tenants and assign the first ORG_ADMIN
     by email (DB `User` + `TenantMembership`), audited as `organization.created`.
   - Done (`v0.11.0`): the matching Keycloak identity + `ORG_ADMIN` realm role are now **auto-provisioned**
     via the Admin REST API (service-account client, one-time temp password) — no manual `kcadm` step.
   - Done (`v0.9.0`): tenant settings / white-label configuration — admin-gated
     (`manageTenantSettings`) branding (name, colors, logo) persisted, audited and applied live to both
     portals via CSS variables; logos stored in MinIO (`Tenant.logoFileId`).
   - Done (`v0.10.1`): pinned the realm OTP policy so first-login authenticator-app enrollment works.
   - Done (`v0.10.2`): RP-initiated Keycloak logout so sign-out terminates the SSO session.
   - Next: a full Admin Portal Users/Roles management UI (list/edit/deactivate users, manage roles) on
     top of the `v0.11.0` Keycloak Admin REST integration. Per-tenant role enforcement already shipped in
     `v0.10.3`; org-admin auto-provisioning shipped in `v0.11.0`.

2. Separate Applicant Portal and Admin Portal — implemented in `v0.2.0`
   - Done: applicant and admin modules split into independent `apps/applicant` and `apps/admin` containers.
   - Applicant Portal owns public application and participant-facing workflows.
   - Admin Portal owns tenant operations, application review and program management.

### MVP Product Modules

3. Applications — delivered in `v0.5.0`
   - Done: authenticated apply → submit and admin review (accept/reject/under-review/waitlist) with
     tenant-scoped persistence, the `reviewApplications` capability gate, status-transition guards and
     `AuditLog` events (`application.submitted`, `application.status_changed`).
   - Data-access helpers live in `packages/db/src` (`applications.ts`, `users.ts`, `tenants.ts`,
     `programs.ts`); apply and review are Next.js server actions.

4. Programs — delivered in `v0.6.0`
   - Done: admin CRUD (create/edit/publish/archive) gated by the `managePrograms` capability, with a
     `DRAFT ⇄ PUBLISHED ⇄ ARCHIVED` state machine, tenant scoping and `AuditLog` events
     (`program.created`, `program.updated`, `program.status_changed`). Published programs feed the
     applicant apply form.
   - Next: cohorts and public per-program application entry points.

5. Missions
   - Implement mission lifecycle aligned to the Spiral Engineering Method.

6. AI Mentor Boundary
   - Expand the current AI service boundary into tenant-aware, auditable mentor workflows.

7. Knowledge Base
   - Add tenant-owned knowledge documents for AI assistance and program support.

8. GitHub Integration
   - Connect participant repositories and collect project evidence.

9. Portfolio
   - Generate participant-facing public portfolio artifacts.

10. Certificates
    - Support tenant-branded certificate creation and issuance.

11. Leaderboard
    - Add transparent progress and achievement visibility.

12. Hiring Recommendations
    - Produce admin-facing candidate readiness and hiring signals.
