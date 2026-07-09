# Version Baseline

## Current Baseline

Version: `v0.15.0`

Baseline name: `Applicant AI Mentor (D-066–D-069)`

Baseline code commit: `10dce46`

Baseline date: `2026-07-06`

Previous baseline: `v0.14.2`

Previous baseline commit: `41c99f0a58ae81646c6b4c2b101402888042d2b4`

## Baseline Summary

`v0.15.0` delivers the Applicant AI Mentor — a full conversational AI assistant for accepted applicants
at `/dashboard/mentor`. The chat UI supports multi-conversation management with per-conversation loading
state, auto-scroll, suggested questions, and a "Still working..." timer. Messages render Markdown
(`react-markdown` + `remark-gfm` + Prism syntax highlighting) and rich cards (task, progress, timeline,
tips, badge, warning). Conversations persist to `localStorage` and to the database via two new Prisma
models: `MentorConversation` and `MentorMessage`. The API route (`/api/ai/mentor`) validates input,
guards auth, builds tenant-scoped applicant context, retrieves knowledge-base snippets, and calls the
LLM (ZhipuAI GLM-4.5-air, 1024 max tokens, 60 s timeout, 1 retry). A rule-based system engine (RBSE)
classifies user input into `blocked` / `direct_answer` / `allow_llm` actions against an allowed-topics
list. On LLM failure, a stub response keeps the UI functional. Key files: `apps/applicant/lib/ai.ts`,
`apps/applicant/lib/ai-rbse.ts`, `apps/applicant/lib/knowledge-base.ts`,
`apps/applicant/lib/ai-context.ts`, `packages/db/src/mentor.ts`. See D-066 through D-069.

`v0.14.2` is a security patch that closes the tenant-isolation gap in the **applicant** portal — the
D-051 fix had only ever covered the admin portal. Sessions are shared across subdomains
(`Domain=.lvh.me`, D-060), so an authenticated user of one tenant could open another tenant's applicant
subdomain and reach `/dashboard` / `/application`, and `/apply`'s `provisionApplicantUser` would silently
enroll them into that tenant. A new `apps/applicant/lib/tenant-guard.ts`
(`resolveTenantAccess`/`requireTenantAccess`, mirroring the admin guard) binds session → Host-resolved
tenant → DB `TenantMembership` (SUPER_ADMIN bypass); `/dashboard` and `/application` require
`accessApplicantPortal` in the resolved tenant and non-members are redirected to a new `/access-denied`
page. `/apply` stays open (public recruitment funnel; applying is what creates membership) but existing
members are redirected to `/application`. The same baseline removes `CONFIGURE_TOTP` from org-admin
provisioning, grants the provisioner `manage-realm`/`view-users`, and pins
`registrationAllowed`/`registrationEmailAsUsername` in the realm import (a drifted live realm had
disabled self-registration). No schema or data-model change; the regression suite grew to 152 tests
(6 new `tenant-guard.test.ts`), and the fix was verified end-to-end in a real browser. See `D-065`.

`v0.14.1` establishes role-facing user guides as living documentation under `docs/user-guides/`
(Applicant Portal + Back Office), and requires every future user-facing route/workflow/role/permission/
status/form/dashboard/navigation change to update the relevant guide in the same PR. Documentation-only;
no application code, schema, package or Docker change. See `D-064`.

`v0.14.0` delivers the Mission Engine MVP. Admins manage missions through the Admin Portal; accepted
applicants see published missions for their accepted program in the dashboard. The `Mission` model now
has status, week/order sequencing, SEM-oriented structured content and competency tags. The demo seed
includes the Week 1 "Build a Public Product Landing Page" mission. See `D-063`.

`v0.13.0` establishes scenario-based regression as a first-class local development capability. The Ops
Console can run the full regression suite or a selected logical area and displays total/passed/failed/
skipped/duration counts. The new runner (`scripts/regression/run.ts`) supports `unit`, `auth`,
`applicant`, `admin`, `programs`, `tenant`, `dashboard`, `storage`, `ops` and `all`. Scenario-generated
records are tagged with `RegressionDataMarker`, and cleanup remains marker-only. The initial local suite
contains 15 scenarios: 13 pass, 0 fail and 2 are documented skips. See `D-062`.

`v0.12.2` hardens the local deployment path. Local OIDC now uses a single browser-and-container reachable
issuer, `http://keycloak.lvh.me:8080/realms/talentos`, eliminating browser-facing
`host.docker.internal` redirects and Ops Console issuer mismatches. MinIO uses the same local pattern via
`http://minio.lvh.me:9000`. New commands `local:bootstrap`, `local:doctor` and `local:smoke-login`
repair local runtime state, validate services and run full login callbacks. Existing local Keycloak
volumes are patched non-destructively for current clients and redirect URIs. Demo data now includes
`accepted@demo.talentos.local` so the applicant dashboard has seed data out of the box. See `D-061`.

`v0.12.1` fixes org admins (and any non-SUPER_ADMIN) being denied their own tenant with "Access denied — not a member of this organization" after signing in on their tenant subdomain. Root cause was a deployment/auth-topology gap: `AUTH_URL` pinned to `localhost:3200` made next-auth build the OIDC `redirect_uri` for `localhost`, so the Keycloak callback returned the browser to the default (`demo`) tenant where the org admin has no membership. Two alternatives were built and empirically disproved (unpinning `AUTH_URL`+`trustHost`, and an nginx `X-Forwarded-Host` proxy) — next-auth v5 beta derives the callback URL from a pinned `AUTH_URL`, not the request host. Fix: canonical-host + base-domain shared-cookie. Login runs through one canonical host per app (`AUTH_URL`=`lvh.me:3200`/`lvh.me:3100`); auth cookies are scoped to `.lvh.me` (`packages/auth-web`) so the session is valid on every tenant subdomain; after login the user is returned to their tenant subdomain via `resolveTenantRedirect` (an allow-list of base-domain subdomains, not an open redirect). `APP_BASE_DOMAIN` moves to `lvh.me` for local dev; the Keycloak clients gain `lvh.me`/`*.lvh.me` redirect URIs, web origins and post-logout URIs; logout post-redirect follows the request Host. Also fixes a latent Next-standalone boot crash (`HOSTNAME=0.0.0.0`). Verified end-to-end with a scripted no-2FA `ORG_ADMIN` login on the real `sbp` tenant (HTTP 200 admin page, no denial). No schema, data-model or RBAC change. Adds 8 `tenant-redirect.test.ts` tests. Builds on the `v0.12.0`/`D-059` dashboard that merged during this work. See `D-060`.

`v0.12.0` delivers the Applicant Dashboard — a professional, sidebar-based dashboard that appears when an
applicant's application is ACCEPTED. When accepted, the "Apply" link in the portal header is replaced with
a "Dashboard" link, the landing page and `/application` page redirect to `/dashboard`, and a full
navigation shell provides access to: overview (quick stats + 4-week progress + current tasks + recent
notifications + upcoming events), My Program (4-week breakdown with per-week tasks/resources/progress),
Tasks (grouped by week with due dates and status), Resources (embedded YouTube/Loom videos by week),
Calendar (upcoming and past events), Notifications (with mark-as-read), and Profile (read-only). Schema
changes: 4 new Prisma models (`ProgramTask`, `VideoResource`, `Notification`, `CalendarEvent`), 1 new
enum (`NotificationType`), 1 join table (`UserTaskCompletion`), migration
`20260703150655_v0_12_0_applicant_dashboard`. DB helpers in `packages/db/src/dashboard.ts`. Seed script
`scripts/seed-dashboard.ts`. The regression suite grew to 125 tests (24 new: 14 dashboard DB helper
tests + 10 ApplicantShell nav tests). See `D-059`.

`v0.11.4` is a UI-only polish iteration with three changes. (1) **Applicant Apply page redesign**:
`apps/applicant/app/apply/page.tsx` render section replaced with a professional, branded, card-based
layout — header banner with icon, sectioned form (Program & Motivation / Documents / Profile Links),
styled inputs with focus rings, dashed-border upload zone, full-width submit button with hover state.
Server action logic unchanged. (2) **Admin sidebar active-state indicator**: extracted the inline `<nav>`
from `apps/admin/app/layout.tsx` into a new client component `apps/admin/components/SidebarNav.tsx` that
uses `usePathname()` to apply `bg-brand-blue text-white font-semibold` to the active link (exact match
for `/`, `startsWith` for others); works for all admin roles. (3) **Review page back button**: added
"← Back to Applications" link to `apps/admin/app/applications/[id]/page.tsx`. No schema, data-model, or
security change. The regression suite grew to 101 tests (12 new `SidebarNav.test.ts`). See `D-058`.

`v0.11.3` is a fix for a crash-looping Keycloak that broke authentication platform-wide on any fresh
deployment. The `talentos-provisioner` service-account client added in `v0.11.0` was written into
`keycloak/import/talentos-realm.json` with an **invalid `serviceAccountClientRoles` field**; Keycloak's
import parser rejects it and aborts at the parse step — before the realm-exists check — so
`start-dev --import-realm` fails on every startup and Keycloak crash-loops (OIDC discovery unreachable,
no portal can log in). The defect escaped `v0.11.0` because that iteration validated the provisioner only
via a live `kcadm.sh` patch, never the baked-in import on a clean volume. Fix: remove the invalid field
and express the service account's realm-management roles the canonical import way — a
`service-account-talentos-provisioner` user with `serviceAccountClientId` + `clientRoles`
(`realm-management`: `manage-users`/`view-realm`/`query-users`). Verified with a destructive fresh-import
test (wiped `keycloak-postgres` volume): Keycloak boots, the realm imports cleanly, the provisioner
authenticates and the Admin `/users` API returns 200. No application code, schema, or data-model change;
the regression suite is unchanged at **78 tests** (validated via the deployment/e2e test). See `D-057`.

`v0.11.2` is a **documentation-only** baseline that closes the engineering-governance gaps in the SSDLC
docs — source control and CI/CD were operated in practice but never written down (violating principle 0).
Two new canonical policies are added: **`docs/Source_Control_Policy.md`** (D-055) codifies the
trunk-based branching model, `<type>/vX.Y.Z-<slug>` naming, Conventional-Commits standard with the
`(vX.Y.Z, D-0NN)` trailer, the PR/review policy — >=1 review + green CI to merge `main`, no direct
pushes — the rebase-then-merge-commit / never-force-push rule, and protected-branch/merge-freeze rules;
and **`docs/CI_CD_Pipeline.md`** (D-056) documents the existing CI gate and **specifies as design
targets** (not built this iteration) a security-scan stage (principle 7), a CD build/push flow, an image
versioning + registry policy (`vX.Y.Z` + git-SHA tags), a dev -> staging -> prod promotion ladder, and a
rollback procedure. `docs/sdlc.md` gains two summary sections linking both policies; `docs/Deployment.md`
gains a Delivery-Pipeline section. Operationalized with repo artifacts `CONTRIBUTING.md`,
`.github/pull_request_template.md`, and `.github/CODEOWNERS`. No application code, pipeline, or schema
change (`.github/workflows/ci.yml` is unchanged); the regression suite is unchanged at **78 tests**.
See `D-055`, `D-056`.

`v0.11.1` completes the user/tenant-management audit hardening. (1) **Reserved-slug blocklist**:
`isValidTenantSlug` (`packages/auth/src/tenant.ts`) now rejects routing/infra-sensitive labels
(`www`, `admin`, `api`, `auth`, `keycloak`, `minio`, `demo`, …) in addition to the DNS-safe check, so a
SUPER_ADMIN cannot mint a tenant on a subdomain that would collide with platform hosts. No schema change.
(2) This baseline also records the **duplicate-active-application** guard delivered via PR #13 (commit
`73c0a78`): a partial unique index `applications_applicantId_programId_active_key` on
`(applicantId, programId) WHERE status IN (DRAFT, SUBMITTED, UNDER_REVIEW, ACCEPTED, WAITLISTED)`
(migration `20260702090000_duplicate_application_active_index`) — REJECTED is excluded so a rejected
applicant may re-apply — plus P2002 handling in the apply flow. The regression suite is 78 tests. See
`D-054`.

`v0.11.0` delivers the deferred Keycloak-Admin-API provisioning (D-035 / the backlog "v0.3.1" slice):
creating an organization now auto-provisions the org admin in Keycloak instead of requiring a manual
`kcadm` step. `createOrganizationAction` calls a new server-only `provisionOrgAdmin`
(`apps/admin/lib/keycloak-admin.ts`) which authenticates with a confidential `talentos-provisioner`
service-account client (client_credentials; realm-management `manage-users`/`view-realm`/`query-users`),
creates the user (`emailVerified`, required actions `UPDATE_PASSWORD` + `CONFIGURE_TOTP`), sets a
generated one-time temporary password, and grants the `ORG_ADMIN` realm role — idempotent (an existing
user keeps their password and just gains the role). The org form became the admin app's first
`useActionState` client component and shows the one-time password once. This completes the two-layer
model (realm role gates portal entry, `TenantMembership` gates authority, `keycloakSubjectId` links on
login): a freshly created org admin can now sign in with no manual Keycloak step. No DB schema change;
the regression suite grew to 71 tests. See `D-053`.

`v0.10.4` fixes two identity defects from the user-management audit. (1) The DB `User`↔Keycloak link was
dead for admins: `keycloakSubjectId` was only ever written by `provisionApplicantUser` on an applicant's
first apply, so admin/reviewer/super-admin rows stayed `NULL` forever. A server-side, edge-safe
`linkKeycloakIdentity` (called best-effort from the admin guard `resolveTenantAccess`) now backfills the
subject on login for existing rows without creating new ones. (2) Email casing was inconsistent
(`createOrganization` lowercased; `provisionApplicantUser`/`getUserByEmail` did not) against a
case-sensitive unique index, risking duplicate users and broken applicant status lookups; a shared
`normalizeEmail` is applied on every write and `getUserByEmail` is now case-insensitive. The Keycloak
`email_verified` claim is exposed on the session (`session.user.isEmailVerified`) but **not** enforced
(no SMTP yet). No schema or data-model change; the regression suite grew to 65 tests. See `D-052`.

`v0.10.3` is a security patch closing the tenant-isolation gap accepted as a known limitation in
`v0.10.0` (D-048). Admin authorization derived the role from the realm-wide Keycloak token and the tenant
from the Host header without ever checking that the actor is a member of the tenant being acted on, so an
`ORG_ADMIN`/`HR`/`TECH_LEAD` of one tenant could read/modify another tenant's programs, application
decisions, branding and candidate CVs by switching subdomains. The fix makes the DB `TenantMembership`
the authoritative per-tenant authority (Keycloak realm role remains the coarse portal-entry gate): a
shared guard (`apps/admin/lib/tenant-guard.ts`, backed by `getActorTenantRoles` + `tenantRolesGrant`)
binds session → host tenant → membership across the admin layout, every mutating action, and the CV
download + operations-health routes, with SUPER_ADMIN bypass. The three DB mutators additionally scope
their writes by `{ id, tenantId }` for defense-in-depth. No schema or data-model change; the regression
suite grew to 62 tests. See `D-051`.

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
