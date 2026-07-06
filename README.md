# TalentOS

TalentOS is a platform for developing AI-native software engineers through real, production-oriented work rather than passive coursework. Its core learning model is the Spiral Engineering Method (SEM): participants repeatedly complete the full engineering lifecycle — discover, analyze, specify, design, build, test, deploy, present, reflect, and review production readiness — from the very first week, with each cycle increasing in complexity. The platform treats AI as a mentor and accelerator, not a substitute for thinking, and is designed to help learners build secure, maintainable, deployable software while producing a public portfolio that organizations can use for talent discovery and recruitment.

Current documentation version: `v0.15.0`

TalentOS is an AI-powered Talent Discovery, Learning and Recruitment Platform designed to bridge the gap between AI-assisted coding and production-grade software engineering.

Participants learn by building real software products from Day 1 using the Spiral Engineering Method (SEM). Every mission is intended to move through discovery, analysis, specification, design, build, test, deployment, presentation, reflection and production readiness review.

## Current Status

TalentOS has moved beyond product discovery into an initial platform scaffold with separated applicant and administrator modules.

- `v0.1.0`: Initial platform architecture scaffold.
- `v0.1.1`: Local Docker deployment baseline.
- `v0.1.2`: Architecture engineering backlog direction.
- `v0.2.0`: Applicant and administrator modules isolated into separate Next.js applications and containers.
- `v0.2.1`: Applicant portal no longer exposes administrator navigation.
- `v0.2.2`: README and documentation landing update.
- `v0.3.0`: Keycloak as the live IAM with OIDC authentication and admin-portal RBAC.
- `v0.4.0`: First Alibaba Cloud ECS deployment baseline (public-IP validation).
- `v0.5.0`: Applications lifecycle — authenticated apply → submit → admin review (accept/reject/waitlist).
- `v0.6.0`: Programs management — admin CRUD (create/edit/publish/archive); published programs feed the apply form.
- `v0.7.0`: Object storage foundation — self-hosted MinIO (S3-compatible) with presigned upload/download and tenant-scoped file metadata.
- `v0.7.1`: Applicant self-signup via Keycloak self-registration (default role APPLICANT) with a portal "Create account" entry.
- `v0.8.0`: Admin Operations dashboard for local development health, regression cleanup guidance and reset guidance.
- `v0.9.0`: Tenant settings / white-label configuration — admin-gated branding (name, brand colors, logo) applied live to both portals via CSS variables; logos stored in MinIO.
- `v0.10.0`: Super Admin Organizations console — create tenants and assign the first Org Admin by email from the Admin Portal.
- `v0.10.1`: Keycloak OTP policy fix — pins a valid TOTP period so first-login authenticator-app enrollment no longer errors.
- `v0.10.2`: RP-initiated Keycloak logout — sign-out now terminates the Keycloak SSO session (no silent re-login on refresh).
- `v0.10.3`: Tenant isolation fix — admin authority is bound to `TenantMembership` for the host-resolved tenant.
- `v0.10.4`: Identity linking and email normalization on admin login.
- `v0.11.0`: Org-admin auto-provisioning through the Keycloak Admin REST API.
- `v0.11.1`: Reserved tenant slug blocklist for infra/routing names.
- `v0.11.2`: Engineering governance documentation for source control and CI/CD.
- `v0.11.3`: Keycloak realm-import validation/fix for the provisioner service account.
- `v0.11.4`: UI polish — apply page redesign, admin sidebar active state and review back button.
- `v0.12.0`: Applicant dashboard for accepted applicants.
- `v0.12.1`: Cross-subdomain tenant login with canonical `lvh.me` auth hosts and shared cookies.
- `v0.12.2`: Local deployment hardening — one-command bootstrap, repaired local Keycloak clients, stable `keycloak.lvh.me` issuer and smoke-login validation.

- `v0.13.0`: Scenario-based regression suite with Ops-controlled area selection and pass/fail/skip counts.
- `v0.14.0`: Mission Engine MVP — admin mission management and applicant mission visibility.
- `v0.14.1`: User guides for Applicant Portal and Back Office/Admin Portal.
- `v0.14.2`: Applicant portal tenant-membership isolation (parity with the D-051 admin fix).
- `v0.14.3`: Dashboard logout button and tenant-subdomain Keycloak logout fix (canonical `/logged-out` bounce).
- `v0.15.0`: Mission Submission Workflow MVP-1 — applicant evidence submission (repo/deployment/Loom + Engineering Journal) with staff review loop (accept / request changes) and notifications.

## Current Implementation

The current scaffold includes:

- Separate Applicant Portal application in `apps/applicant`.
- Separate Admin Portal application in `apps/admin`.
- PostgreSQL database with Prisma schema.
- Docker Compose local deployment.
- Shared UI package in `packages/ui`.
- Shared auth/security utilities in `packages/auth`.
- Shared Prisma/database package in `packages/db` with application-lifecycle data-access helpers.
- Applications lifecycle: authenticated apply → submit and admin review (accept/reject/under-review/waitlist), tenant-scoped and audited.
- Programs management: admin CRUD (create/edit/publish/archive) gated by `managePrograms`; published programs feed the apply form.
- Object storage: self-hosted MinIO (S3-compatible) with presigned upload/download and tenant-scoped `StoredFile` metadata.
- Tenant settings / white-label branding (name, brand colors, logo) applied live across both portals; branding writes are capability-gated and audited.
- Super Admin Organizations console: create tenants and assign the first Org Admin by email, host-based multi-tenant subdomains (`{slug}.lvh.me` locally).
- Keycloak SSO logout (RP-initiated) that terminates the shared session on sign-out.
- AI mentor service boundary stub.
- SSDLC documentation for architecture, data model, data dictionary, deployment and testing.

## Local Startup URLs and Credentials

When the local Docker deployment is running:

Start or repair the full local stack with:

```powershell
npm.cmd run local:bootstrap
```

Validate it with:

```powershell
npm.cmd run local:doctor
npm.cmd run local:smoke-login
```

### Portal and service links

- Applicant Portal: http://lvh.me:3100
- Demo Applicant Portal: http://demo.lvh.me:3100
- Applicant Login: http://lvh.me:3100/login
- Applicant Apply: http://demo.lvh.me:3100/apply
- Applicant Application: http://demo.lvh.me:3100/application
- Applicant Dashboard: http://demo.lvh.me:3100/dashboard
- Admin Portal: http://lvh.me:3200
- Demo Admin Portal: http://demo.lvh.me:3200
- Admin Applications: http://demo.lvh.me:3200/applications
- Admin Programs: http://demo.lvh.me:3200/programs
- Admin Settings: http://demo.lvh.me:3200/settings
- Admin Operations: http://demo.lvh.me:3200/operations
- Admin Organizations (SUPER_ADMIN only): http://lvh.me:3200/organizations
- Keycloak Admin Console: http://keycloak.lvh.me:8080
- MinIO API: http://minio.lvh.me:9000
- MinIO Console: http://localhost:9001
- Local Ops Console: http://127.0.0.1:3300

### Seeded local credentials

These credentials are for local development only.

| User / Service | Username | Password | Notes |
| --- | --- | --- | --- |
| Super Admin | `superadmin@talentos.local` | `ChangeMeSuper#1` | May require password change and authenticator-app TOTP setup depending on current Keycloak state. |
| Org Admin | `orgadmin@demo.talentos.local` | `ChangeMe123!` | Can access admin portal and Operations. |
| HR | `hr@demo.talentos.local` | `ChangeMe123!` | Can access admin workflows allowed by role. |
| Tech Lead | `techlead@demo.talentos.local` | `ChangeMe123!` | Can access admin workflows allowed by role. |
| Applicant | `applicant@demo.talentos.local` | `ChangeMe123!` | Can access applicant portal workflows. |
| Accepted Applicant | `accepted@demo.talentos.local` | `ChangeMe123!` | Has an accepted application and dashboard demo data. |
| Keycloak local admin console | `admin` | `admin` | Local Keycloak administration. |
| MinIO local console | `talentos` | `talentos_dev_password` | Local object storage console. |

The Admin Operations page requires a `SUPER_ADMIN` or `ORG_ADMIN` user.

Signup, password policy and authenticator-app 2FA are owned by Keycloak. Applicant self-registration is
enabled (`v0.7.1`) via the portal "Create account" button (OIDC `prompt=create`) / Keycloak's hosted
form; there is no local `/signup` or `/2fa/setup` page in the applicant portal.

The applicant portal must not expose administrator navigation.

### Adding a new tenant (organization)

As of `v0.10.0`, the platform Super Admin can create tenants from the Admin Portal:

1. Log in to the Admin Portal (`http://lvh.me:3200`) as `superadmin@talentos.local`.
2. Open **Organizations** in the sidebar (visible to `SUPER_ADMIN` only), or go to
   `http://lvh.me:3200/organizations`.
3. Fill in the organization name, a DNS-safe **slug** (used as the subdomain), brand colors, and the
   first Org Admin's email, then **Create organization**.
4. The new tenant is immediately reachable at `http://{slug}.lvh.me:3200` (admin) and
   `http://{slug}.lvh.me:3100` (applicant). `lvh.me` and `*.lvh.me` resolve to loopback automatically,
   so no hosts-file change is needed locally.

Note: the assigned Org Admin's database membership scopes them to the new tenant, but the admin-portal
**role** comes from Keycloak. Until the Keycloak Admin API integration lands, grant that user the
`ORG_ADMIN` realm role in the Keycloak admin console so they can sign in with org-admin powers.

Tenant creation is host-independent: the Super Admin manages all organizations regardless of which
tenant subdomain they are currently on.

## Architecture Direction

TalentOS is designed as a multi-tenant, white-label SaaS platform.

Current architecture:

- Applicant and admin portals are separate Next.js applications.
- Applicant and admin portals run in separate Docker containers.
- PostgreSQL is the primary database.
- Prisma is used for data modeling and migrations.
- Docker Compose is the first deployment target.

Target architecture:

- Keycloak is the target IAM system.
- Shared platform services should handle IAM, database access, audit logging, AI, GitHub integration and certificates.
- Applicant and admin portals should remain independently deployable, scalable and securable.

## Engineering Backlog Summary

Near-term engineering direction:

1. IAM with Keycloak.
2. Applications module persistence.
3. Programs module.
4. Missions module.
5. AI Mentor boundary.
6. Knowledge Base.
7. GitHub Integration.
8. Portfolio.
9. Certificates.
10. Leaderboard.
11. Hiring Recommendations.

## Important Documentation

- [Vision guide](docs/vision.md)
- [User Guides](docs/user-guides/README.md)
- [Product Vision](docs/Product_Vision.md)
- [Architecture](docs/Architecture.md)
- [Product Backlog](docs/Product_Backlog.md)
- [Version Baseline](docs/Version_Baseline.md)
- [Deployment](docs/Deployment.md)
- [Testing Strategy](docs/Testing_Strategy.md)
- [Decision Log](docs/Decision_Log.md)
- [SSDLC principles](docs/sdlc.md)

## Repository Structure

- `apps/applicant`: public applicant portal.
- `apps/admin`: program administrator portal.
- `packages/ui`: shared UI components and Tailwind brand preset.
- `packages/auth`: authentication, authorization and tenant security utilities.
- `packages/db`: Prisma schema, migrations and database client.
- `docs`: product, architecture, planning, deployment and testing documentation.

## Development Standard

Per SSDLC rules:

- Every plan must be stored in Markdown under `docs/plans/`.
- Every version must include Markdown testing details under `docs/testing/`.
- Architecture, deployment, data model and data dictionary documentation must stay current with each iteration.
- Security must be designed from the first iteration.
