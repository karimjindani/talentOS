# Version Baseline

## Current Baseline

Version: `v0.10.2`

Baseline name: `Keycloak SSO Logout Fix`

Baseline code commit: `3381f155698cf4f565b5aeb8d14c061fa6bd169f`

Baseline date: `2026-07-01`

Previous baseline: `v0.10.1`

Previous baseline commit: `604c7bbe0979424641ce130c4e61decaf8012eaf`

## Baseline Summary

`v0.10.2` is a patch fixing ineffective logout: after signing out, refreshing a portal silently
re-authenticated the user because only the app's NextAuth cookie was cleared while the Keycloak SSO
session stayed alive. The fix implements OIDC RP-initiated logout — the `id_token` is persisted on the
session and both portals now redirect to Keycloak's `end_session_endpoint`
(`id_token_hint` + `post_logout_redirect_uri`) after clearing the app cookie, terminating the SSO
session. A shared `buildEndSessionUrl` helper (`packages/auth-web/src/logout.ts`) builds the URL; both
Keycloak clients register `post.logout.redirect.uris` (live-patched via `kcadm.sh`, and added to the
realm import). Verified: valid post-logout redirect → 302, arbitrary URL → 400 (no open redirect). No
schema change; the regression suite grew from 47 to 50 tests. See `D-050`.

`v0.10.1` is a patch fixing an internal server error on first-login authenticator-app (TOTP) setup. The
realm import (`keycloak/import/talentos-realm.json`) declared `otpPolicyType: "totp"` but omitted the
period, so Keycloak used `otpPolicyPeriod = 0` and threw `ArithmeticException: / by zero` in
`TimeBasedOTP.getCurrentInterval` when validating the enrollment code. The fix adds the full OTP policy
(period 30, digits 6, HmacSHA1, look-ahead 1) to the realm import and applies the same policy live to
the running realm via `kcadm.sh`. A new regression test (`packages/auth-web/src/realm-otp.test.ts`)
asserts a non-zero OTP period so the misconfiguration cannot silently return. No application code,
schema, or data-model change. The regression suite grew from 46 to 47 tests. See `D-049`.

`v0.10.0` adds a SUPER_ADMIN-only Organizations console to the Admin Portal, filling the gap where new
tenants could previously be created only by the DB seed script. A new `/organizations` page lists all
tenants (with member/program counts and brand swatches) and a form creates a tenant (name, DNS-safe
slug, brand colors) and assigns its first ORG_ADMIN by email in one audited transaction
(`organization.created`). The page and `createOrganizationAction` are gated on the pre-existing
`createOrganization` capability (SUPER_ADMIN only); the slug is validated with `isValidTenantSlug`
because it becomes the tenant subdomain (`{slug}.localhost:3200`). The assigned org admin's DB
membership scopes them to the tenant; the matching `ORG_ADMIN` Keycloak realm role is still granted
separately (documented limitation, D-048). No schema change; the regression suite grew from 45 to 46
tests. See `D-048`.

`v0.9.0` makes white-labelling real: an admin-gated Settings page (ORG_ADMIN + SUPER_ADMIN only) lets each tenant configure their organisation name, primary/secondary brand colors, and logo. Brand colors are applied live across both portals using CSS custom properties (`--brand-blue`, `--brand-navy`, `--brand-mist`) injected as a per-tenant `<style>` block in each root layout; Tailwind classes reference `var()` with hex fallbacks so all existing brand-class usages become dynamically themable with zero component changes. Logos are stored in MinIO as `StoredFile` records (`Tenant.logoFileId` FK, migration `20260701120000_tenant_logo_file_id`). The applicant portal header shows the tenant name and logo, served via a new public unauthenticated route `/api/branding/logo` (IDOR-safe, 302 presigned redirect). A new `manageTenantSettings` capability gates the settings page and server action, backed by audit log (`tenant.branding_updated`). The regression suite grew from 44 to 45 tests. See `D-047`.

`v0.8.0` adds a local-development Operations page to the Admin Portal. The page provides live
app-visible health checks, copyable regression/reset commands, and a safe regression data cleanup
foundation using explicit `RegressionDataMarker` rows. The Admin app does not run Docker or npm commands
on the host.

`v0.7.3` lets applicants attach a CV (required, PDF, ≤ 5 MB) and provide optional GitHub and LinkedIn
profile URLs when they apply. It wires the v0.7.0 object-storage foundation into the applicant portal:
the apply server action validates the CV server-side, streams it to MinIO via the new
`putObject` helper, records it as a `StoredFile` (status `READY`), and links it to the application
through new `Application.cvFileId` / `githubUrl` / `linkedinUrl` columns. The admin application-detail
page surfaces the CV download (reusing the existing tenant-scoped `/api/files/[id]/download` route) and
the profile links. Profile URLs are host-allowlisted to github.com / linkedin.com. A new migration
(`20260630120000_application_cv_links`) adds the columns; the regression suite is unchanged at 33 tests.
Recorded as a patch by explicit choice (it is functionally a new capability). See `D-045`.
`v0.7.2` is a documentation/test-results baseline that validates latest GitHub `main` locally through
Docker Compose. It confirms the v0.7.1 runtime runs locally with Applicant Portal, Admin Portal,
PostgreSQL, Keycloak, Keycloak PostgreSQL, MinIO, and MinIO setup. Alibaba Cloud deployment was skipped
for this iteration.

`v0.7.1` is a patch that enables applicant self-signup via Keycloak self-registration
(`registrationAllowed`, `registrationEmailAsUsername`, default role `APPLICANT`) and adds a
"Create account" entry to the applicant portal (OIDC `prompt=create`). Keycloak owns the signup form,
password policy and TOTP. No schema change; the regression suite is unchanged at 33 tests. Applying the
realm change to an existing environment requires re-importing the realm (recreate the Keycloak DB
volume) or toggling it in the Keycloak admin console.

`v0.7.0` adds the object-storage foundation using **MinIO** (S3-compatible), self-hosted as a Docker
Compose service in every environment. Files transfer directly between the browser and MinIO via
short-lived presigned URLs; the bucket is private; object keys are tenant-namespaced; file metadata is
stored in PostgreSQL (`StoredFile`) so access is tenant-scoped and audited (`file.created`,
`file.deleted`). A new `@talentos/storage` package wraps the S3 API; the admin app exposes reference
presign-upload/confirm/download endpoints (reusable later for CV-on-apply and program materials). This is
the first schema change since `v0.3.0` (migration `20260629101218_object_storage`). The regression suite
grew from 28 to 33 tests. Earlier baselines are carried forward unchanged.

`v0.6.0` delivers the Programs MVP module: tenant-scoped, capability-gated, audited admin CRUD for
programs (create / edit / publish / archive). Admins with `managePrograms` (ORG_ADMIN/SUPER_ADMIN)
manage programs through a light `DRAFT ⇄ PUBLISHED ⇄ ARCHIVED` state machine; HR/TECH_LEAD may view but
not mutate. Published programs feed the applicant apply form, closing the apply→review loop from
`v0.5.0`. Apply/review/program writes are Next.js server actions over `packages/db` helpers; new audit
actions `program.created`, `program.updated`, `program.status_changed`. No schema change was required.
The regression suite grew from 24 to 28 tests. Earlier baselines are carried forward unchanged.

`v0.5.0` delivers the Applications-first MVP vertical slice: an authenticated apply → submit → admin
review lifecycle. Applicants sign in via Keycloak and submit an application (motivation answer) to a
published program; their DB `User` is provisioned/linked by email with an `APPLICANT` membership.
Admins (ORG_ADMIN/HR/SUPER_ADMIN) review applications and move them through
`UNDER_REVIEW`/`ACCEPTED`/`REJECTED`/`WAITLISTED` via guarded status transitions; TECH_LEAD may enter
the portal but cannot decide. All writes are tenant-scoped and audited
(`application.submitted`, `application.status_changed`). Apply and review are Next.js server actions
backed by new `packages/db/src` data-access helpers. No schema change was required. The regression
suite grew from 19 to 24 tests. Earlier baselines are carried forward unchanged.

`v0.4.0` establishes the first Alibaba Cloud deployment baseline for TalentOS. It targets a single
Alibaba Cloud ECS instance in Singapore (`ap-southeast-1`) running the existing Docker Compose topology:
Applicant Portal, Admin Portal, TalentOS PostgreSQL, Keycloak, and Keycloak PostgreSQL. This baseline is
for public-IP validation and is not the final production topology. Follow-up hardening includes
HTTPS/domain routing, Keycloak production mode, backups, monitoring, and managed database evaluation.

`v0.3.0` established Keycloak as the live IAM and wires OIDC authentication + role-based authorization
into both portals (Auth.js / NextAuth v5). It introduces the 5-role model (`SUPER_ADMIN` platform;
`ORG_ADMIN`/`HR`/`TECH_LEAD`/`APPLICANT` org-scoped) with a capability matrix, a seeded Super Admin,
Keycloak password policy and first-login password/TOTP, and admin-portal RBAC gating. Org/role mapping
uses Keycloak realm roles for identity and the TalentOS DB for org scoping. Schema change: `User` gains
`keycloakSubjectId`, `emailVerified`, `platformRole`, optional `passwordHash`; new `PlatformRole` enum;
`TenantRole` becomes the org roles. This is staged — the Admin user/org/role management UI (Keycloak
Admin REST API) follows in `v0.3.1`.

`v0.2.2` was a documentation-only update that refreshed the root README and documentation overview after
the separated-portal implementation. No schema change.

`v0.2.1` removed all administrator navigation from the applicant application (no `Admin` link, dropped
`NEXT_PUBLIC_ADMIN_URL`), completing module isolation. No schema change.

`v0.2.0` isolated the applicant and administrator modules into two separate Next.js applications, each
running in its own Docker container, sharing only the `packages/*` libraries. There was no Prisma
schema change in that baseline. It realized the portal-separation direction recorded in `v0.1.2`.

`v0.1.2` was a documentation-only update that established the architecture engineering backlog
direction: Keycloak as the target IAM system, separate Applicant and Admin portals, and
architecture-level Engineering To-Do tracking mapped from the Product Backlog.

`v0.1.1` established local Docker deployment support with configurable host ports.

`v0.1.0` remains the first platform architecture baseline.

This baseline includes:

- Keycloak IAM (`talentos-keycloak`) + dedicated `talentos-keycloak-postgres`, realm `talentos`
  auto-imported with the 5 roles, password policy, first-login password/TOTP and demo users,
- OIDC authentication on both portals via `packages/auth-web` (Auth.js / NextAuth v5, JWT sessions),
- the 5-role model and capability matrix in `packages/auth` (`SUPER_ADMIN`; `ORG_ADMIN`/`HR`/`TECH_LEAD`/`APPLICANT`),
- admin-portal RBAC gating (non-admin roles redirected to `/forbidden`) and applicant `/application` gating,
- `User` identity fields (`keycloakSubjectId`, `emailVerified`, `platformRole`, optional `passwordHash`) and migration `20260628000000_keycloak_iam_rbac`,
- the regression suite expanded to 19 tests (RBAC capability matrix + Keycloak role mapping), all passing.

Carried forward from earlier baselines: the two isolated applicant/admin containers (v0.2.0) with the
applicant exposing no admin navigation (v0.2.1); the shared `packages/ui`; the PostgreSQL data model via
Prisma; tenant resolution/isolation utilities; the AI mentor service boundary stub; and SSDLC
documentation for architecture, data model, data dictionary, deployment and testing.

## Portal Scope

Public Applicant Portal routes (`apps/applicant`, container `talentos-applicant`):

- `/`
- `/apply`
- `/login` (Keycloak sign-in)
- `/application` (authenticated)
- `/api/auth/[...nextauth]`

(Signup and 2FA setup are owned by Keycloak as of `v0.3.0`.)

Program Admin Portal routes (`apps/admin`, container `talentos-admin`, served at root, RBAC-gated):

- `/`
- `/applications`
- `/applications/[id]`
- `/programs`
- `/settings`
- `/organizations` (SUPER_ADMIN only)
- `/forbidden`
- `/api/auth/[...nextauth]`

## Package Scope

Packages, apps and infrastructure included as of `v0.3.0`:

- `apps/applicant`
- `apps/admin`
- `packages/auth`
- `packages/auth-web`
- `packages/db`
- `packages/ui`
- `keycloak/import` (realm definition)

## Documentation Rule

All future documentation updates must reference the relevant code version.

All future implementation plans must be stored in `docs/plans/`.

All future testing details and results must be stored in `docs/testing/`.

## Versioning Convention

TalentOS uses semantic versioning:

- Patch versions, such as `v0.1.1`, are used for documentation fixes or small non-breaking implementation updates.
- Minor versions, such as `v0.2.0`, are used for new product capabilities.
- Major version `v1.0.0` is reserved for the first production-ready release.
