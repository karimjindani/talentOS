# Decision Log

Code version: `v0.16.0`

Architecture baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

Current documentation update: `v0.16.0`

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

Root `README.md` is the single maintained project landing page and documentation overview.
`docs/README.md` is removed to avoid two competing README versions.

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

## D-049

`v0.10.1` fixes an internal server error on first-login authenticator-app (TOTP) enrollment. The realm import declared `otpPolicyType: "totp"` but omitted the period, so Keycloak used `otpPolicyPeriod = 0` and threw `ArithmeticException: / by zero` in `TimeBasedOTP.getCurrentInterval`. Decision: pin the full OTP policy in `keycloak/import/talentos-realm.json` (period 30, digits 6, HmacSHA1, initial counter 0, look-ahead 1) so fresh imports are correct, and apply the same policy live to the already-running realm via `kcadm.sh` (non-destructive — no volume recreation, no user data loss). A regression test (`packages/auth-web/src/realm-otp.test.ts`) guards a non-zero OTP period. No application code, schema, or data-model change.

Status: Approved

## D-050

`v0.10.2` fixes ineffective logout (SSO session survived logout; a page refresh re-authenticated the user). Root cause: NextAuth `signOut()` cleared only the app cookie, never Keycloak's SSO session, and the `id_token` was not persisted. Decision: implement OIDC RP-initiated logout — persist `account.id_token` on the JWT/session and, after `signOut({ redirect: false })`, redirect the browser to Keycloak's `end_session_endpoint` with `id_token_hint` (fallback `client_id`) and `post_logout_redirect_uri` via a shared pure helper `buildEndSessionUrl` (`packages/auth-web/src/logout.ts`). Both clients register `post.logout.redirect.uris` (explicit per-origin `http://localhost:3200/*` / `http://localhost:3100/*`) in the realm import, applied live via `kcadm.sh`. Accepted trade-off: the `id_token` is exposed via the user's own `/api/auth/session` endpoint — standard practice for RP-initiated logout and not a cross-user leak. Open-redirect is prevented by Keycloak's per-client redirect allowlist (valid → 302, arbitrary host → 400). No schema or data-model change.

Status: Approved

## D-051

`v0.10.3` closes the tenant-isolation gap that was accepted as a known limitation in **D-048**. Root cause: admin authorization was decided from two unlinked inputs — the role came from the *realm-wide* Keycloak access token (`orgRole`/`platformRole`), while the tenant came from the *Host header* — and `can()` never checked the two together, so an `ORG_ADMIN`/`HR`/`TECH_LEAD` of tenant A could operate on tenant B simply by visiting B's subdomain (program CRUD, application decisions, branding, and candidate-CV download were all reachable; `assertTenantScopedAccess` compared resource-vs-host, both B, and passed). Decision: make the DB `TenantMembership` the authoritative per-tenant authority, keeping the Keycloak realm role only as the coarse portal-entry gate (two-layer model). New primitives: `getActorTenantRoles(email, tenantId)` (`packages/db`, case-insensitive email match) and `tenantRolesGrant(capability, roles)` (`packages/auth`); a shared admin guard `resolveTenantAccess`/`requireTenantAccess` (`apps/admin/lib/tenant-guard.ts`) that binds session → host tenant → membership, with SUPER_ADMIN bypass. Wired into the admin layout (gates all page reads), every mutating action (`requireProgramManager`, `reviewApplication`, `saveTenantBranding`), and the sensitive route handlers (CV download — previously only checked for *any* authenticated session — and operations health). Defense-in-depth: the DB mutators `updateProgram`/`setProgramStatus`/`applyStatusTransition` now write via `updateMany({ where: { id, tenantId } })` so a raw id can never cross tenants. The membership data already existed (seed + `createOrganization`); it was simply never consulted. No schema or data-model change; the regression suite grew to 62 tests (new `packages/auth/src/permissions.test.ts`). Supersedes the D-048 known limitation.

Status: Approved

## D-052

`v0.10.4` fixes two identity defects from the user-management audit. (1) The DB `User`↔Keycloak link was dead for admin/reviewer/super-admin users: `keycloakSubjectId` was only ever persisted by `provisionApplicantUser` (applicant first-apply), never on login, so the "linked on first login" claim was false. Decision: add a server-side, edge-safe `linkKeycloakIdentity({ email, keycloakSubjectId, name })` (`packages/db`) that backfills the subject on an existing row (case-insensitive, only when missing/changed) and **never creates** a row; call it best-effort from the admin guard `resolveTenantAccess` so every admin logs in linked. Crucially it is NOT added to the jwt/session callbacks, which must stay edge-safe (imported by middleware) — DB writes live only in server components. (2) Email casing was inconsistent (`createOrganization` lowercased; `provisionApplicantUser`/`getUserByEmail` did not) against the case-sensitive `User.email @unique`, risking duplicate identities and orphaned lookups (e.g. the applicant status page). Decision: a shared `normalizeEmail` (`trim().toLowerCase()`) on every write path and a case-insensitive `getUserByEmail`. Additionally, the Keycloak `email_verified` claim is now captured through the jwt/session callbacks and exposed as `session.user.isEmailVerified` (named to avoid NextAuth's built-in `User.emailVerified: Date`), but **not enforced** — a hard gate is deferred until SMTP-backed verification exists, since self-registered applicants are currently unverified. No schema or data-model change; the regression suite grew to 65 tests (new `packages/db/src/users.test.ts`).

Status: Approved

## D-053

`v0.11.0` delivers org-admin auto-provisioning via the Keycloak Admin REST API — the deferred D-035 / backlog-"v0.3.1" slice — so a SUPER_ADMIN creating an organization no longer needs a manual `kcadm` step for the new admin to sign in. Decisions: (1) **Authenticate with a dedicated service-account client** `talentos-provisioner` (confidential, `serviceAccountsEnabled`, realm-management client roles `manage-users`/`view-realm`/`query-users`) via `client_credentials`, rather than embedding master-admin credentials in the app — least-privilege / shift-left. (2) **Credential delivery: a generated one-time temporary password shown once** in the UI (no SMTP in the stack), with required actions `UPDATE_PASSWORD` + `CONFIGURE_TOTP` forcing a reset + 2FA on first login; an already-existing Keycloak user keeps their password and is only granted the role (idempotent). (3) The provisioning client is **server-only** (`apps/admin/lib/keycloak-admin.ts`), never imported by edge middleware or an edge barrel. (4) The org create form became the admin app's first `useActionState` client component so the action can return a typed result and render the one-time password; Keycloak failure does not roll back the DB org (they cannot share a transaction) — the message is retryable and provisioning is idempotent. New realm client added to `keycloak/import/talentos-realm.json` (fresh envs) and applied live to the running realm via `kcadm.sh`. No DB schema change; the regression suite grew to 71 tests (new `apps/admin/lib/keycloak-admin.test.ts`). This closes the D-048/D-051 loop: realm role (now auto-granted) gates portal entry, `TenantMembership` gates authority, `keycloakSubjectId` links on login.

Status: Approved

## D-055

`v0.11.2` documents the **source-control & branching policy** that the repository already followed but had never written down (SSDLC principle 0). Decision: adopt a **trunk-based** model — `main` always releasable and protected, short-lived `<type>/vX.Y.Z-<slug>` branches cut from and merged back to `main` via reviewed Pull Requests. Standards codified in `docs/Source_Control_Policy.md`: **Conventional Commits** (`type(scope): subject`) with a `(vX.Y.Z, D-0NN)` version/decision trailer on baseline-changing commits; **PR policy** of >=1 approving review + green CI (no direct pushes, no self-merge of unreviewed PRs); **merge policy** of rebase-before-merge, integrate via merge commit, never force-push `main`; and **protected-branch / merge-freeze rules** for `main`. Operationalized with repo artifacts: `CONTRIBUTING.md`, `.github/pull_request_template.md`, and `.github/CODEOWNERS` (review routing to `@karimjindani`). GitHub branch-protection settings must be enabled in the repo UI (checklist in the policy) — they cannot be committed. Documentation-only; no app code or schema change; the regression suite is unchanged at 78 tests.

Status: Approved

## D-056

`v0.11.2` documents the **CI/CD & delivery policy** (`docs/CI_CD_Pipeline.md`), separating what exists from what is a target. Existing: the CI gate (`.github/workflows/ci.yml`) runs `db:generate -> typecheck -> lint -> test -> build` on every push/PR and is the mandatory pre-merge gate. Decisions recorded as **design targets, not implemented this iteration** (per the approved scope, docs-only — `ci.yml` unchanged): (1) a **security-scan stage** (dependency/`npm audit`+Dependabot, SAST/CodeQL, secret/gitleaks, container/Trivy) with block-vs-warn severity rules to satisfy principle 7 (shift-left); (2) **CD** that builds from the single root `Dockerfile` and pushes to a registry (`ghcr.io` or Alibaba ACR); (3) **image versioning** — every image tagged with both the baseline `vX.Y.Z` and the immutable git SHA, `main` never deployed untagged; (4) an **environment-promotion ladder** dev (local Compose) -> staging (auto-deploy on `main`, the existing ECS validation box) -> prod (deploy a `vX.Y.Z` tag behind a manual approval), with per-environment secrets never committed; (5) a **rollback** procedure — redeploy the previous known-good tag, and reverse a bad migration only via a new forward migration (never hand-reverse a live schema change). Documentation-only; no app code, pipeline, or schema change; the regression suite is unchanged at 78 tests. The scan stage and CD implementation are deferred to a later baseline.

Status: Approved

## D-057

`v0.11.3` fixes a crash-looping Keycloak that broke authentication for the whole platform on any fresh deployment. Root cause: the `talentos-provisioner` service-account client added in `v0.11.0` (D-053) was written into the realm import `keycloak/import/talentos-realm.json` with an **invalid `serviceAccountClientRoles` field** on its `ClientRepresentation`. Keycloak's import parser rejects unknown fields and aborts at the JSON-parse step — before the realm-exists check — so `start-dev --import-realm` fails on **every** startup (fresh or existing) and Keycloak crash-loops; OIDC discovery is unreachable and no portal can authenticate. The defect escaped v0.11.0 testing because that iteration validated the provisioner only via a **live `kcadm.sh` patch** on a running realm, never the baked-in import against a clean volume. Decision: remove the invalid field and express the service account's realm-management roles the **canonical import way** — a `service-account-talentos-provisioner` user in the realm `users` array with `serviceAccountClientId: "talentos-provisioner"` and `clientRoles: { "realm-management": ["manage-users", "view-realm", "query-users"] }`. The client itself (confidential, `serviceAccountsEnabled`, secret) is unchanged. Verified with a destructive fresh-import test (wiped the `keycloak-postgres` volume): Keycloak boots, the realm imports with no error, the provisioner authenticates via `client_credentials`, and the Admin `/users` API returns 200. No application code, schema, or data-model change. The v0.11.0 unit test `apps/admin/lib/keycloak-admin.test.ts` was updated because it had asserted the presence of the invalid `serviceAccountClientRoles` field (locking in the broken config); it now checks the canonical service-account user + `clientRoles`. The Vitest regression suite stays at 78 tests (assertion updated, not added), and the fix is validated end-to-end via the deployment/fresh-import test. This patch also adds a **CI guard** (a `realm-import` job in `.github/workflows/ci.yml`) that boots Keycloak the same way production does (`start-dev --import-realm`, in-memory H2) and fails the build if the realm does not import cleanly — so a malformed import (unknown field, bad JSON) can no longer silently reach `main`. This is the shift-left, boot-level check that the unit test alone could not provide (the unit test had in fact ossified the broken config).

Status: Approved

## D-058

`v0.11.4` is a UI-only polish iteration addressing three UX gaps. (1) **Applicant Apply page redesign** (`apps/applicant/app/apply/page.tsx`): the plain form was replaced with a professional, branded, card-based layout — header banner with 📝 icon, sectioned form (Program & Motivation / Documents / Profile Links), styled inputs with focus rings, dashed-border upload zone, full-width submit button with hover state. Decision: use existing brand tokens (`brand-navy`/`brand-blue`/`brand-mist`) — no new colors or dependencies. Server action `submitApplication` is unchanged; only the JSX render section was replaced. (2) **Admin sidebar active-state indicator** (`apps/admin/components/SidebarNav.tsx`, NEW): the inline `<nav>` in `layout.tsx` was extracted into a client component using `usePathname()` to apply `bg-brand-blue text-white font-semibold` to the active link. Decision: exact match for `/` (Overview), `startsWith` for all others so nested routes (`/applications/123`) highlight the parent ("Applications"). Active style is high-contrast to be clearly distinguishable from the hover state. Works for all admin roles; "Organizations" remains SUPER_ADMIN-only. (3) **Review page back button** (`apps/admin/app/applications/[id]/page.tsx`): added "← Back to Applications" link at the top. Decision: inline link with arrow (not a full button) to keep the page header clean. No schema, data-model, or security change. The regression suite grew to 101 tests (12 new `SidebarNav.test.ts` covering route-matching logic: exact match, startsWith match, cross-route isolation, NAV_ITEMS integrity).

Status: Approved

## D-059

`v0.12.0` delivers the Applicant Dashboard. When an applicant's application reaches ACCEPTED status, the portal header replaces "Apply" with "Dashboard", and the landing page + `/application` page redirect to `/dashboard`. The dashboard uses a fixed left sidebar (`ApplicantShell.tsx`, mirroring the admin `SidebarNav` pattern) with 7 nav items: Dashboard (overview), My Program, Tasks, Resources, Calendar, Notifications, Profile. The overview shows quick stats (overall progress %, tasks completed/pending, days remaining), 4-week progress bars, current tasks, recent notifications, and upcoming events. Schema additions: `ProgramTask` (task scoped to program + week 1-4 with dueAt and order), `VideoResource` (external YouTube/Loom URL scoped to program + optional week), `Notification` (in-app notification with type INFO/WARNING/SUCCESS/TASK_DUE, readAt), `CalendarEvent` (scheduled event with startsAt/endsAt/location), `UserTaskCompletion` (join table tracking task completion per applicant), and `NotificationType` enum. Decisions: (1) Full schema changes with migration rather than mock data — the dashboard needs real persistence. (2) External video URLs (YouTube/Loom) rather than MinIO upload — simpler, no file management, HR/leads just paste links. (3) Pre-defined tasks per program rather than per-applicant assignment — tasks are program-level; admin editing is deferred. (4) Applicant dashboard only — admin-side task/video management UI is a future iteration. DB helpers in `packages/db/src/dashboard.ts` (11 functions including `getApplicantProgramProgress` which computes per-week completion). Seed script `scripts/seed-dashboard.ts` creates 9 tasks, 5 videos, 5 events, 3 notifications. The regression suite grew to 125 tests (24 new: 14 `dashboard.test.ts` + 10 `ApplicantShell.test.ts`).

Status: Approved

## D-060

`v0.12.1` fixes org admins (and any non-SUPER_ADMIN) being denied their own tenant with "not a member of this organization" after signing in on their tenant subdomain. Root cause was a **deployment/auth-topology gap**, not a code defect: `AUTH_URL` was pinned to `http://localhost:3200`, so next-auth built the OIDC `redirect_uri` as `localhost:3200/...` and the Keycloak callback returned the browser to the default (`demo`) tenant — where the org admin has no `TenantMembership` — while `linkKeycloakIdentity` (email-only) still linked the subject, producing the exact observed state (subject linked, access denied). Confirmed in Keycloak events: every flow used `redirect_uri="http://localhost:3200/..."`. Two "obvious" fixes were built and **empirically disproved**: (a) unpinning `AUTH_URL` with `trustHost` makes next-auth v5 beta.25 derive the `redirect_uri` from the container's internal origin (`<container-id>:3000`); (b) an nginx reverse proxy forwarding `X-Forwarded-Host` still produced the container-host `redirect_uri` even with the header set directly on the container — next-auth honors a pinned `AUTH_URL`, not the forwarded host, for the callback. Decision: adopt the **canonical-host + base-domain shared-cookie** pattern. (1) Login always runs through one canonical host per app (`AUTH_URL` = `lvh.me:3200`/`lvh.me:3100`; the apex resolves to the default tenant and yields a stable, registerable `redirect_uri`). (2) Auth cookies (session/csrf/callback-url/pkce/state/nonce) are scoped to the parent base domain (`Domain=.lvh.me`) in `packages/auth-web`, so the session established during the canonical-host callback is valid on every tenant subdomain; this is gated on `APP_BASE_DOMAIN` being a real multi-label domain (`localhost` cannot carry a `Domain` cookie, so single-host deployments keep next-auth's host-only defaults). (3) After the callback the app returns the user to their tenant subdomain: `resolveTenantRedirect` allows only the canonical origin and subdomains of `APP_BASE_DOMAIN` (an allow-list, not an open redirect — look-alike suffixes like `lvh.me.evil.com` are rejected), and the admin/applicant middlewares pass the absolute tenant URL as `callbackUrl` (composed with the `/dashboard` protection added in v0.12.0). (4) The tenant guard (`resolveTenantAccess`, D-051) is unchanged and still binds the shared session to the `Host`-resolved tenant via DB membership. `APP_BASE_DOMAIN` moves to `lvh.me` for local dev (`lvh.me`/`*.lvh.me` resolve to `127.0.0.1` with no host-file setup); production sets it to the real base domain. The Keycloak `talentos-admin`/`talentos-applicant` clients gain `lvh.me` + `*.lvh.me` redirect URIs, web origins and post-logout URIs. Logout post-redirect now uses the request Host (not the pinned `AUTH_URL`) so it returns to the tenant subdomain. This patch also fixes a **latent Next.js-standalone boot crash** — the image did not set `HOSTNAME`, so the server inherited Docker's `HOSTNAME=<container-id>` and non-deterministically failed to bind (`getaddrinfo EAI_AGAIN`); `HOSTNAME=0.0.0.0`/`PORT=3000` are now set in compose. Verified end-to-end by scripting a full Keycloak Authorization-Code login for a no-2FA test `ORG_ADMIN` on the real `sbp` tenant: `redirect_uri` is the canonical host, the session cookie is `Domain=.lvh.me`, the post-login redirect returns to `sbp.lvh.me:3200`, and the tenant admin page renders HTTP 200 (not "Access denied"). No schema, data-model or RBAC change. The Vitest regression suite gains 8 new tests (`tenant-redirect.test.ts`) covering the open-redirect boundary. Builds on `D-059` (v0.12.0 applicant dashboard), which merged to `main` during this work — hence the `v0.12.1`/`D-060` numbering.

Status: Approved

## D-061

`v0.12.2` hardens the local deployment path after repeated local login failures exposed a systemic developer-experience gap. Decision: local OIDC uses one issuer that is reachable from both browser and containers and exactly matches Keycloak's token `iss`: `http://keycloak.lvh.me:8080/realms/talentos`. App containers map `keycloak.lvh.me` to the host gateway, while browsers resolve it through `lvh.me` loopback DNS. This replaces browser-facing `host.docker.internal` URLs, which are not reliable from the host browser and caused failed login-action redirects; it also removes the `localhost`/`host.docker.internal` issuer split that caused Ops Console `unexpected "iss" claim value`. MinIO follows the same local pattern via `http://minio.lvh.me:9000`. The new `local:bootstrap` command repairs ignored `.env`, rebuilds Compose, runs DB setup, seeds demo/dashboard data, and non-destructively patches stale Keycloak realms so existing local volumes gain current clients/redirect URIs (`talentos-admin`, `talentos-applicant`, `talentos-provisioner`, `talentos-ops`, `talentos-ops-mfa`). The new `local:doctor` and `local:smoke-login` commands validate HTTP reachability and full browser-style login callbacks, including Ops Console. An accepted demo applicant (`accepted@demo.talentos.local`) is seeded so the applicant dashboard works without manually accepting an application first. No production deployment decision is changed.

Status: Approved

## D-062

`v0.13.0` establishes scenario-based regression as a first-class local development capability. Unit tests
remain the fast inner loop, but TalentOS now also has an area-based scenario runner
(`scripts/regression/run.ts`) with npm commands for `unit`, `auth`, `applicant`, `admin`, `programs`,
`tenant`, `dashboard`, `storage`, `ops` and `all`. The Ops Console can create regression jobs for a
selected area or the full suite, parses the runner's `REGRESSION_RESULT_JSON` payload, and displays
total/passed/failed/skipped/duration counts with raw logs. Scenario-generated records must be tagged via
`RegressionDataMarker`; cleanup remains marker-based and must not delete seeded or user-created data.
The initial suite automates 15 logical scenarios: 13 pass locally, 0 fail, and 2 are explicit documented
skips (second-tenant cross-tenant fixture and full storage upload/download automation). Playwright is
accepted as the browser-scenario dependency for expanding route-level automation in future slices.

Status: Approved

## D-063

`v0.14.0` delivers the Mission Engine MVP, the first slice of the core TalentOS learning experience from
the vision roadmap. Decision: keep mission management inside the existing Admin Portal and expose
published missions inside the accepted applicant dashboard rather than introducing a separate LMS app.
The existing placeholder `Mission` table is extended with `MissionStatus` (`DRAFT`, `PUBLISHED`,
`ARCHIVED`), sequencing (`weekNumber`, `order`) and SEM-oriented structured content (`objective`,
`acceptanceCriteria`, `deliverables`, `evaluationCriteria`, `competencyTags`). Mission writes are
tenant-scoped, program-scoped and audited (`mission.created`, `mission.updated`,
`mission.status_changed`). A new `manageMissions` capability is granted to `SUPER_ADMIN` and `ORG_ADMIN`;
HR and Tech Lead can view but not mutate missions. Accepted applicants see only published missions for
their accepted program. The demo seed includes the Week 1 "Build a Public Product Landing Page" mission
to make the learning experience visible immediately after local bootstrap. Submission workflow,
engineering journal and portfolio generation are deferred to later slices.

Status: Approved

## D-064

`v0.14.1` establishes Applicant Portal and Back Office/Admin Portal user guides as living documentation.
Decision: maintain role-facing Markdown guides under `docs/user-guides/` and require every future
user-facing route, workflow, role, permission, status, form, dashboard or navigation change to update the
relevant guide in the same pull request. The guides include version applicability, last verified date,
audience, required access, related URLs, step-by-step workflows, troubleshooting and known limitations.
Screenshots are deferred until workflows stabilize; Markdown remains the source of truth for this
baseline. Documentation-only; no application code, schema, package or Docker change.

Status: Approved

## D-065

`v0.14.2` closes the tenant-isolation gap in the **applicant** portal — the D-051 fix was applied only to
the admin portal. Because sessions are shared across subdomains (`Domain=.lvh.me`, D-060), an
authenticated user of one tenant could open another tenant's applicant subdomain and reach `/dashboard`
and `/application`, and (worse) `/apply`'s `provisionApplicantUser` would silently enroll them into that
tenant. Decision: port the admin guard verbatim. A new `apps/applicant/lib/tenant-guard.ts`
(`resolveTenantAccess`/`requireTenantAccess`) binds session → Host-resolved tenant → DB
`TenantMembership` (SUPER_ADMIN bypasses); `/dashboard` and `/application` require the
`accessApplicantPortal` capability *in the resolved tenant* and non-members are redirected to a new
`/access-denied` page. `/apply` stays open by design — it is the public recruitment funnel, and applying
is what legitimately creates membership — but existing members are redirected to `/application`. The
same baseline removes `CONFIGURE_TOTP` from org-admin provisioning (2FA setup withdrawn per operator
request; also avoids the Keycloak TOTP "/ by zero" error), grants the provisioner service account
`manage-realm`/`view-users`, and pins `registrationAllowed`/`registrationEmailAsUsername` in the realm
import (a drifted live realm had disabled self-registration). No schema or data-model change; the
regression suite grew to **152 tests** (6 new `tenant-guard.test.ts`), and the fix was verified
end-to-end in a real browser (cross-tenant denial, preserved same-tenant access, open apply funnel, and a
full register→apply→membership flow under a tenant subdomain).

Status: Approved

## D-066

`v0.14.3` fixes two related logout defects. (1) An accepted applicant had **no way to sign out**: the
dashboard layout replaces `PortalHeader` (which held the only Logout button) with `ApplicantShell`,
and since `v0.12.0` redirects accepted applicants from `/` and `/application` to `/dashboard`, they
could never reach a page with a logout affordance. (2) RP-initiated Keycloak logout was **broken on
every tenant subdomain** in both portals since `v0.12.1`: the logout forms derived
`post_logout_redirect_uri` from the request Host, but Keycloak only supports `*` wildcards at the end
of a redirect-URI pattern — the registered `http://*.lvh.me:{port}/*` hostname wildcards never match,
so Keycloak answered "Invalid redirect uri" (the `v0.10.2` validation had run on the canonical host
only). Decision: centralize logout in a shared `buildTenantLogoutUrl` (`packages/auth-web`) that
always returns through the canonical AUTH_URL origin's new `/logged-out` route — the only origin
Keycloak can validate — carrying the tenant origin in the OIDC `state` parameter; `/logged-out`
bounces the user back to their tenant via the existing allow-listed `resolveTenantRedirect` (D-060),
so this is not an open redirect (verified: foreign and look-alike hosts collapse to the canonical
origin). The three duplicated inline logout forms (PortalHeader, applicant access-denied page, admin
root layout) now call shared per-app `logoutAction` server actions, and `ApplicantShell` gains a
Logout button in the sidebar user block. `/logged-out` is exempted from the admin auth middleware.
No schema, data-model or capability change; the regression suite grew to **161 tests**, and the fix
was verified end-to-end in a real browser (dashboard logout, admin tenant-subdomain logout, SSO
termination on both, and the `/logged-out` allow-list).

Status: Approved

## D-067

`v0.15.0` delivers Mission Submission MVP-1, activating the `Submission` scaffolding laid down in
`v0.14.0`. Decisions: (1) **Evidence is URLs + inline journal** — Git repository (host-allowlisted to
github.com), deployed application (any http/https), Loom walkthrough (loom.com) and an inline
Engineering Journal in Markdown, matching the Week 1 deliverables in `docs/curriculum.md`; PRD,
README, user stories and acceptance criteria live inside the repository. File attachments are
deferred. (2) **Staff-only review** — a new `reviewSubmissions` capability is granted to `ORG_ADMIN`
and `TECH_LEAD` (SUPER_ADMIN bypasses); HR is read-only and applicants never review each other,
per `docs/Graduate_Profile.md` ("graduates are not expected to review other engineers' code").
(3) **Full SEM revision loop** — `DRAFT→SUBMITTED→ACCEPTED|NEEDS_REVISION`,
`NEEDS_REVISION→SUBMITTED`; written feedback is mandatory when requesting changes (the coaching
mechanism for building independent engineers); `ACCEPTED` is terminal because an accepted submission
is portfolio/graduation evidence for the mission's `competencyTags` (kept queryable for a future
competency-rollup/portfolio view). (4) **One submission row per applicant per mission**
(unique `[missionId, applicantId]`) — the loop reuses the row. (5) **Schema hardening** — the model
gains `tenantId` for direct tenant scoping (consistent with every other tenant-owned table) plus
`reviewerFeedback`/`reviewedAt`/`reviewerUserId`. Applicants submit from the mission detail page in
the dashboard (with per-mission status chips in the list); admins review from a new
`/missions/[id]/submissions/[submissionId]` page; the applicant is notified (SUCCESS/WARNING with
feedback) in the same transaction as the review. Writes are tenant-scoped, ownership-checked,
status-machine-guarded and audited (`submission.created/updated/submitted/reviewed`). The regression
suite covers the full loop, the role matrix and cross-tenant isolation.

Status: Approved

## D-068

`v0.15.1` seeds the complete four-week mission arc so the demo tenant demonstrates the full
AI-Native Software Engineering Apprenticeship out of the box (previously only the Week 1 mission
existed). Decisions: (1) **One continuous product** — all four missions evolve TaskPilot, the
fictional AI-assisted task planner from the Week 1 brief, embodying the SEM principle that the
lifecycle stays constant while complexity increases (`docs/SEM.md`); every brief embeds the tailored
10-step lifecycle. (2) **Difficulty ladder mirrors the curriculum themes** — BEGINNER "Build
Something Real" → INTERMEDIATE "Build Like an Engineer" → ADVANCED "Build Like a Production Team" →
EXPERT "Build Like a Production Engineer", with deliverables and acceptance criteria lifted from the
weekly deliverable tables in `docs/curriculum.md`. (3) **Deployment progression follows the vision
roadmap** — static hosting → full-stack hosting → Docker + CI/CD → VPS behind a reverse proxy with
SSL (`docs/vision.md`). (4) **`competencyTags` use `docs/Competency_Framework.md` names verbatim**;
`Production Readiness` first appears in Week 4, matching the maturity matrix (PRR reaches Mastery
only in Week 4); no mission asks participants to review each other's code (`docs/Graduate_Profile.md`).
(5) **Data-driven idempotent seed** — `seed.ts` refactored to a `missionSeeds` array upserted on
stable ids; Week 1 content is unchanged. Also fixes the `v0.14.0` mojibake week/difficulty separator
(`Â€¢` → `•`) on the three mission pages via an encoding-proof JSX escape. No schema, capability,
route or workflow changes.

Status: Approved

## D-069

`v0.16.0` makes the mission loop the dashboard's source of truth and gives program content a real
owner. Decisions: (1) **Mission-driven progress** — the applicant dashboard's Overall Progress and
week bars are computed from published missions vs the applicant's ACCEPTED submissions
(`getApplicantMissionProgress`); drafts and pending reviews do not move the bar, because acceptance
is the SEM loop's terminal, portfolio-grade state. A **Current Mission** card surfaces the next
mission (first non-accepted, by week/order) with its submission status. Weekly tasks remain a
supplementary checklist with their own tile. (2) **`manageProgramContent` capability** — video
resources, weekly tasks and calendar events (models shipped in `v0.12.0` but writable only by a dev
seed script) become manageable from a new admin **Program Content** page
(`/programs/[id]/content`); the capability is granted to `ORG_ADMIN` only (SUPER_ADMIN bypasses;
HR/TECH_LEAD stay read-only), matching the ownership of programs and missions. (3) **Same
security conventions as missions (D-064)** — server actions re-resolve the actor through the
D-051 membership-backed tenant guard; db helpers are transactional, tenant-scoped
(`updateMany`/`deleteMany` on `{ id, tenantId }`, program-chain check on create) and audited
(`resource.created|updated|deleted`, `task.*`, `event.*`); admin-entered video URLs must be
well-formed http(s). No schema change. The regression suite gains a full draft→submit→accept
progress scenario and a content CRUD + role-denial scenario (unit suite: 202 tests).

Status: Approved

## D-070

`v0.16.2` (documentation-only patch) realigns the vision and framework docs with the shipped
`v0.14.0`–`v0.16.1` scope, following an audit of `docs/vision.md` against committed code.
Decisions: (1) **`docs/vision.md` reflects reality** — the Current State section now covers the
delivered Mission Engine (`v0.14.0`), Submission & Review loop (`v0.15.0`), four-week seeded
mission arc (`v0.15.1`) and mission-driven dashboard progress + program content management
(`v0.16.0`); the Gap Analysis no longer claims "the core learning experience still needs to be
built"; the 8-phase roadmap uses per-phase `Status:` lines with `[x] item — vX.Y.Z` version
references (Phases 2–3 delivered, Phase 1 largely delivered, Phase 4 partial, Phases 5–8 not
started). The audit confirmed `PortfolioArtifact`/`Certificate`/`KnowledgeBaseDocument`/
`AIInteraction` remain unreferenced schema stubs and the AI Mentor endpoint is a stub, so
Phases 5–8 stay open. (2) **Canonical 10-step SEM everywhere** — `docs/Mission_Framework.md`'s
SEM Authoring Guidance listed 8 steps (missing Analyze and Production Readiness Review),
conflicting with `docs/SEM.md`, `docs/curriculum.md`, `docs/vision.md` and the `v0.15.1` seeds;
it now lists the canonical 10 steps. (3) **Backlog currency** — `docs/Product_Backlog.md` moves
off its stale `v0.15.0` header and records the `v0.15.1` (D-068) and `v0.16.0` (D-069) slices as
delivered. (4) **Accuracy over aspiration** — vision.md now states that TOTP/MFA is enforced only
for the Ops Console (not the applicant/admin portals) and that competency tags / evaluation
criteria are free text pending a controlled catalog and rubrics. No application code, schema,
configuration or Docker change; the unit suite is unchanged at 202 tests.

Status: Approved

## D-071

`v0.16.3` (documentation-only patch) extends the D-070 audit to the eight SSDLC docs the user
flagged as release-stale (`Architecture.md`, `CI_CD_Pipeline.md`, `Data_Dictionary.md`,
`Data_Model.md`, `Deployment.md`, `Regression_Scenarios.md`, `Source_Control_Policy.md`,
`Testing_Strategy.md`) and refreshes all of them in one docs-only baseline. Decisions:
(1) **Operational accuracy first** — `Deployment.md` (stamped `v0.12.2`) was the most dangerous
drift: its migration changelog stopped at `v0.12.0`, omitting the required
`20260704160000_v0_14_0_mission_engine_mvp` and `20260706090000_v0_15_0_mission_submissions`
migrations; it now documents them plus current validation URLs and mission/submission/progress
smoke tests. (2) **The data docs document the whole schema** — the five `v0.12.0` dashboard models
existed only in changelog prose; they now have Core Entities entries and Data Dictionary field
tables, the ER diagram is regenerated to cover all 20 models and missing relations
(`Tenant→logoFile`, notifications, task completions, program content), and the four
migrated-but-unused models (`PortfolioArtifact`, `Certificate`, `KnowledgeBaseDocument`,
`AIInteraction`) are consistently framed as schema stubs in both docs rather than "future"
entities. (3) **Testing docs state current reality** — `Testing_Strategy.md` (stamped `v0.14.1`,
citing 146 tests) now states 202 unit tests / 22 scenarios, adds sections for `v0.15.0`
submissions, `v0.16.0` program content + mission-driven progress and the `v0.16.1` Playwright
capture, and notes CI runs the unit suite only; `Regression_Scenarios.md` gains the three
`v0.15.0` submission scenario rows, `Submission` in the marker entity list, and a note that the
matrix is finer-grained than the runner's 22 scenario objects. (4) **`apps/ops` is documented as
the third application** — `Architecture.md` now describes the host-run, Keycloak-gated Ops Console
(`127.0.0.1:3300`, not containerized), includes `packages/storage` in the shared-package list,
shows the missions/submission-review/program-content/`/logged-out` routes in its portal diagram,
and drops the obsolete `v0.3.1` label for the still-future Users/Roles UI. (5) **Merge gate names
both CI jobs** — `Source_Control_Policy.md` and `CI_CD_Pipeline.md` now state that the `ci` job
*and* the `realm-import` job must pass. (6) **`Version_Baseline.md` Portal/Package Scope
refreshed** from their `v0.3.0` snapshot to the current route/app/package inventory. No
application code, schema, configuration or Docker change; the unit suite is unchanged at 202
tests.

Status: Approved
