# Decision Log

Code version: `v0.19.5`

Architecture evidence commit: `2b3afce`

Current documentation update: `v0.19.5`

Allocation note: `D-085` is reserved by active remote branch
`origin/fix/v0.19.4-mission-task-checklist`; this branch therefore continues at `D-086`.

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

`v0.15.0` — LLM provider selection: **ZhipuAI GLM-4.5-air** via the `api.z.ai` coding endpoint. Chosen
for its fast air-tier latency (~3–5 s), low cost, and strong code/instruction following. The integration
(`apps/applicant/lib/ai.ts` → `callGLM`) uses 1024 max tokens, 0.7 temperature, 60 s timeout, and 1
retry. A LiteLLM proxy path is planned for multi-model routing but not yet integrated. When the API key
is absent or the call fails, a stub response preserves UX continuity.

Status: Approved

## D-067

`v0.15.0` — Rule-Based System Engine (RBSE) as the first-line input classifier. The RBSE
(`apps/applicant/lib/ai-rbse.ts`) classifies user input into `blocked`, `direct_answer`, or `allow_llm`
actions against an `ALLOWED_TOPICS` list before any LLM call. This avoids unnecessary LLM costs for
off-topic questions, provides deterministic safety guardrails, and keeps the mentor on-topic for
software engineering and program guidance. The RBSE is intentionally simple (keyword matching) so it can
be audited and extended without model retraining.

Status: Approved

## D-068

`v0.15.0` — Knowledge base design: keyword-based retrieval from platform documentation. The knowledge
base (`apps/applicant/lib/knowledge-base.ts`) scores snippets from SDLC, SEM, Mission Framework, and
other docs by keyword overlap, returning the top 2 snippets. This keeps the context window small and
response times fast. A future `KnowledgeBaseDocument` model will support tenant-owned content.

Status: Approved

## D-069

`v0.15.0` — Token limit and prompt strategy: 1024 max tokens (up from an initial 256 that caused
response truncation), system prompt trimmed to essential persona + context + knowledge to keep latency
under ~40 s. Per-conversation loading state and a "Still working..." timer (5 s threshold) provide UX
feedback during LLM calls. Conversations persist to both `localStorage` (instant UI restore) and the
database (`MentorConversation` / `MentorMessage`) for cross-device access.

Status: Approved

## D-070

`v0.15.0` — Smart in-memory LLM response cache with context-signature-aware keys. The cache
(`LLM_RESPONSE_CACHE` in `apps/applicant/lib/ai.ts`) is a `Map<string, { content, timestamp }>` with a
5-minute TTL (`LLM_CACHE_TTL_MS = 300_000`) and a 200-entry cap (`LLM_CACHE_MAX_SIZE = 200`) with LRU
eviction. Cache keys are built by `buildLLMCacheKey`, which distinguishes **dynamic** prompts (containing
user-specific keywords like "my task", "my progress", "my timeline") from **static** knowledge prompts:

- **Dynamic key** — `dynamic:{tenantId}:{userId}:{contextSignature}:{prompt}` — scoped per user + context
  so a context change (task completed, progress updated) invalidates the entry and forces a fresh LLM
  call. The context signature (`buildContextSignature` in `ai-context.ts`) is a stable pipe-separated
  hash of program id, progress counts, task ids/status/dueDates, mission ids, submission ids/status, and
  days remaining.
- **Static key** — `static:{prompt}` — shared across all users/tenants for general knowledge questions
  (e.g., "Explain SDLC"), maximising cache hit rate for non-personal content.

Errors are **never cached** — a failed LLM call (500, 429, timeout, network error) returns a stub
response but does not populate the cache, so the next identical request retries the LLM. RBSE
`direct_answer` and `blocked` actions bypass the cache entirely (no LLM call, no cache read/write).
Verified by 6 dedicated cache tests (`ai-cache.test.ts`): cache hit, cache miss on context change,
static cache sharing across users, error non-caching, user isolation, and RBSE bypass.

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

## D-072

`v0.16.4` creates an audit-only SSDLC compliance baseline against current `main` at commit
`2b07e4ae9364fd981e7d5f4da859e21f3c74032e`. Decision: TalentOS is **substantially aligned but not
100% compliant** with `docs/sdlc.md`. Principles 2, 4, 5 and 6 are assessed as compliant because the
architecture, Docker runtime, deployment documentation and data-model/data-dictionary documents are
current. Principles 0, 1, 3 and 7 are assessed as partially compliant because governance and
automation controls still need hardening: the latest `CODEOWNERS` update appears unversioned, the
current `CODEOWNERS` pattern likely does not express Karim + Waseem as joint owners, GitHub branch
protection enforcement must be verified in the GitHub UI, scenario regression is local/Ops-based
rather than enforced in CI, security scanning is documented but not implemented, and three scenario
regression checks remain skipped.

No product code, schema, Docker configuration or package file is changed in this audit baseline.
Validation passed after repairing local generated Prisma Client drift with `npm.cmd run db:generate`:
unit suite 202/202, typecheck, lint, build, Docker Compose config, local doctor and
`regression:all` with 19 passed, 0 failed and 3 skipped. Follow-up remediation should be split into
separate versioned work: governance/CODEOWNERS and branch-protection verification, CI/security gates,
and regression fixture hardening for skipped cross-tenant/storage scenarios.

Status: Approved

## D-073

`v0.17.0` adds the first dedicated Engineering Journal module to the Applicant Portal: a daily
structured-reflection system (`EngineeringJournalEntry`, migration
`20260707190000_v0_17_0_engineering_journal_mvp`), separate from the older inline
`Submission.journalMarkdown` field used during mission submission review. Decision: keep the two
journal concepts separate rather than migrating `Submission.journalMarkdown` into the new model —
`Submission.journalMarkdown` remains as legacy submission evidence (removal is deferred future work),
while the new module is the applicant-owned, mission-linked daily-reflection surface with placeholder
(non-functional) AI review/scoring fields. New pages `/dashboard/journal`, `/dashboard/journal/new`,
`/dashboard/journal/[id]`; a new `User.preferredJournalLanguage` profile setting; writes are
tenant-scoped, applicant-owned, validated against the applicant's published mission in their accepted
program, and audited (`journal.created`/`journal.updated`). No auth, Keycloak, workflow or
permission-matrix change.

**Process exception:** this baseline, `D-074` (`v0.17.1`) and `D-075` (`v0.18.0`) all shipped from a
single implementation commit (`c7413eb`, "Implement Engineering Journal and mission assignment MVP")
on branch `engineering-journal-mvp`, instead of one commit per version with a Conventional-Commits
message and `(vX.Y.Z, D-0NN)` trailer per `docs/Source_Control_Policy.md`. The branch name also does
not follow the required `<type>/vX.Y.Z-<slug>` pattern. Both commits were already pushed to
`origin/engineering-journal-mvp` before this compliance pass; rewriting that history would require a
force-push to a branch that may already have review activity, so — by explicit decision during this
pass — the existing commits and branch name are kept as-is and recorded here as a one-time accepted
exception, closed out going forward by adding new, correctly-formatted commits (docs remediation +
baseline-record) on top rather than rewriting what is already public.

Plan: `docs/plans/v0.17.0_Engineering_Journal_MVP.md`; results:
`docs/testing/v0.17.0_Engineering_Journal_MVP_Test_Results.md`.

Status: Approved

## D-074

`v0.17.1` is a patch that adds a database-layer unique constraint
(`[tenantId, applicantId, entryDate]`, migration `20260708100000_v0_17_1_journal_entry_date_unique`)
enforcing the Engineering Journal's "one entry per applicant per calendar date" rule, which `v0.17.0`
(`D-073`) had only enforced in application code (`JournalEntryDateConflictError` in
`packages/db/src/journal.ts`). Decision: normalize existing `entryDate` values to a calendar day
(`date_trunc('day', ...)`) before adding the constraint, and treat this as defense-in-depth rather than
a behavior change, since the application-level check already prevented the conflict for every caller
going through the documented helpers. No product code change. This migration and its plan/test-results
docs were originally shipped undocumented as part of the same commit as `D-073`; the docs were added
retroactively during this pre-push SSDLC compliance pass — see the process-exception note under
`D-073`.

Plan: `docs/plans/v0.17.1_Journal_Entry_Date_Unique.md`; results:
`docs/testing/v0.17.1_Journal_Entry_Date_Unique_Test_Results.md`.

Status: Approved

## D-075

`v0.18.0` gives each accepted applicant one assigned Week 1 mission instead of visibility into every
published mission in their accepted program. Decision: introduce a `MissionAssignment` model (migration
`20260708120000_v0_18_0_mission_assignment_mvp`; unique on
`[tenantId, programId, applicantId, weekNumber]`) and assign one Week 1 published mission
idempotently when an application becomes `ACCEPTED`, choosing from the least-assigned published
Week 1 missions with a random tie-break so applicants don't all land on the same brief. Applicant
mission listing, mission detail access, submission drafting and Engineering Journal (`D-073`) mission
selection are all scoped to assigned missions; a journal entry locks once its mission's assignment has
been submitted. Four Week 1 TaskPilot mission variants are authored as Markdown source under
`packages/db/prisma/seed-data/missions/ai-native-engineering/week-1/` and imported into normal
`Mission` fields by the seed script — the app never depends on the Markdown file paths at runtime, only
on the imported database content. No auth, Keycloak or permission-matrix change. Verified after
applying this baseline's migrations to a clean local database: unit suite 243/243, typecheck, lint,
build, and `regression:all` 21/22 passed (1 pre-existing documented skip, 0 failed) — including the
`missions` and `dashboard` regression areas, which an earlier local run had reported failing due to a
stale local database state unrelated to this migration (see
`docs/testing/v0.18.0_Mission_Assignment_MVP_Test_Results.md`).

Plan: `docs/plans/v0.18.0_Mission_Assignment_MVP.md`; results:
`docs/testing/v0.18.0_Mission_Assignment_MVP_Test_Results.md`.

Status: Approved

## D-076

`v0.18.1` is a governance-only patch (no code/schema change) closing a process gap found while
auditing `v0.17.0`–`v0.18.0`: `D-073`'s Engineering Journal plan
(`docs/plans/v0.17.0_Engineering_Journal_MVP.md`) specified scope and security rules but never named
scenario-level test cases, so the feature shipped with strong unit coverage
(`journal.test.ts`, 23 tests) and **zero scenario-level regression coverage** — a gap only surfaced
later by manual audit, not by any process check. Decision: require every implementation plan to use a
new required template, [`docs/plans/TEMPLATE.md`](plans/TEMPLATE.md), whose **Test Scenarios**
section forces end-to-end/behavioral scenarios to be named before or during implementation — actor,
preconditions, steps, expected result, and an explicit automation call (added this iteration, or
deferred with a stated reason). Every scenario named there must be reflected in
`docs/Regression_Scenarios.md` in the same iteration — automated or as an explicit Known Gap — and
every test-results doc must use the new [`docs/testing/TEMPLATE.md`](testing/TEMPLATE.md), which
requires one Scenario Results row per plan scenario so a plan can no longer ship without its scenarios
being either verified or explicitly and visibly deferred. `docs/sdlc.md` (Version and Documentation
Control, rule 7), `CONTRIBUTING.md` and `.github/pull_request_template.md` are updated to point at the
template and make it a PR-review checklist item, not just prose in `sdlc.md` that's easy to miss (as
this very gap demonstrated). No product code, schema, Docker configuration or package file is
changed.

Plan: `docs/plans/v0.18.1_Plan_Test_Scenarios_Requirement.md`; results:
`docs/testing/v0.18.1_Plan_Test_Scenarios_Requirement_Test_Results.md`.

Status: Approved

## D-077

`v0.18.2` closes the specific regression and documentation gaps found in the manual PR review of the
`engineering-journal-mvp` branch (D-073–D-075): production-quality scenario coverage was missing for
Engineering Journal and Mission Assignment, and several docs had drifted from shipped behavior.

**Regression scenarios (Task 1):** a new `journal` regression area (`scripts/regression/run.ts`,
`packages/auth/src/operations.ts` `RegressionArea`, `apps/ops` command list/UI,
`npm run regression:journal`) adds four scenarios — create/edit against the assigned mission with
list/audit assertions, rejection of a published-but-unassigned mission, the one-entry-per-calendar-day
conflict, and lock-after-submission. Two new `missions`-area scenarios add: assigned-mission-only
visibility/detail/submission-drafting scoping, and a scenario that deliberately documents a real gap
raised in PR review — an applicant `ACCEPTED` before any `MissionAssignment` existed gets **no
automatic backfill** and sees zero missions; this is now a locked-in regression assertion rather than
a silent gap, pending a product decision (backfill script, lazy on-read assignment, or accepted
limitation). `EngineeringJournalEntry` joins the `RegressionDataMarker` cleanup entity types
(`packages/db/src/regression.ts`, ordered before `Mission`/`User`). The suite grows from 22 to **28
scenarios across 12 areas**; `regression:all` verified 27/28 passed, 1 pre-existing documented skip
(storage), 0 failed.

**Documentation review (Task 2):** `docs/Deployment.md` had never been updated for `v0.17.0`/`v0.17.1`/
`v0.18.0` — added their migration procedures, including an operational note that the `v0.17.1` unique
index will fail migration (not silently corrupt data) against any environment with pre-existing
same-day duplicate journal entries; corrected a stale smoke-test claim that accepted applicants see
"the four seeded published TaskPilot missions" (true before `v0.18.0`, false after — they now see only
their one assigned mission); added the `/dashboard/journal` validation URL and a journal smoke test.
`docs/vision.md`'s Gap Analysis and Phase 4 roadmap still described the Engineering Journal as
undelivered/partial ("today the journal is a single Markdown field per submission", "Status: Partial")
when `v0.17.0`/`v0.17.1` had already shipped the dedicated module — corrected, and Phase 2 now records
the `v0.18.0` mission-assignment change. `docs/Product_Backlog.md` listed "Engineering Journal module"
as a **future** next-slice item after it had already shipped — corrected. `docs/user-guides/
Back_Office_User_Guide.md` is clarified to disambiguate the legacy inline "Engineering journal" text
field shown during submission review (`Submission.journalMarkdown`, `v0.15.0`) from the unrelated
dedicated Engineering Journal dashboard module (`v0.17.0`) — the two share a name in the product UI but
are different features. `docs/CI_CD_Pipeline.md`'s unit-test count was stale (202 → 243).
`docs/Architecture.md`, `docs/Testing_Strategy.md`, `docs/Regression_Scenarios.md` and the root
`README.md` version history are brought current.

No schema change. Unit suite unchanged at 243/243 (only test fixtures/assertions added, matching
existing behavior); full local gate (typecheck, lint, test, build) re-verified clean.

Plan: `docs/plans/v0.18.2_Regression_And_Documentation_Completeness.md`; results:
`docs/testing/v0.18.2_Regression_And_Documentation_Completeness_Test_Results.md`.

Status: Approved

## D-078

`v0.18.3` improves the local Ops Console regression result view. Decision: preserve the existing
`REGRESSION_RESULT_JSON.results` scenario payload in the Ops job contract instead of adding another
runner format. A new `RegressionScenarioResult` type records area, scenario name, status, duration and
optional detail/error text; `apps/ops/src/jobs.ts` stores these results on the step and top-level job.
The Ops UI now renders scenario rows grouped by area beneath the existing pass/fail/skipped counts, so
operators can see exactly which scenario passed, failed or skipped without searching raw logs. Existing
summary-only payloads still fall back to the previous area-card display.

No database migration or regression-runner rewrite is required. This is an Ops/testing usability
enhancement only.

Plan: `docs/plans/v0.18.3_Ops_Regression_Scenario_Visibility.md`; results:
`docs/testing/v0.18.3_Ops_Regression_Scenario_Visibility_Test_Results.md`.

Status: Approved

## D-079

`v0.18.4` enables SSE streaming for AI Mentor LLM calls and fixes the send button for fresh users.
Decisions: (1) **Streaming enabled** — `callGLM` now sends `stream: true` to the GLM-4.5-air endpoint
so the first token reaches the browser sooner, reducing perceived latency from ~30 s (full response
wait) to <2 s (first token). The `GLMChatRequest` type was widened from `stream: false` to
`stream: boolean` for type safety. (2) **SSE stream parser** — `parseSSEStream()` added to handle
`text/event-stream` responses. Reads the response body as a stream, splits `data: {...}` lines,
extracts `delta.content` fragments, and concatenates them into the full response. Handles `[DONE]`
sentinel and malformed lines gracefully. Replaces the previous `response.json()` call which failed
with `Unexpected token 'd', "data: {"id"... is not valid JSON`. (3) **Send button fix for fresh
users** — `loadHistory()` now auto-creates a conversation when `activeConversationId` is null (fresh
user with no DB history), and `handleSend()` has a safety net that creates a conversation on the fly
if the ID is still null. This fixes the silent failure where the send button did nothing for users
with no existing conversations. (4) **Test coverage** — 4 new SSE-specific tests (UT-SSE-01 through
UT-SSE-04) covering multi-fragment concatenation, empty fragments, malformed lines, and `[DONE]`
sentinel. Mock updated to simulate SSE stream. All 19 tests passing. (5) **Documentation** —
`docs/AI_MENTOR_END_TO_END_DEMO_GUIDE.md` added as a comprehensive demo guide;
`docs/Testing_Strategy.md` and `docs/plans/v0.15.0_AI_Mentor_Roadmap.md` updated. No schema change.
The regression suite is unchanged.

Status: Approved

## D-080

`v0.18.5` gives every `MissionAssignment` an explicit time-boxed lifecycle instead of an open-ended
`ACTIVE` state. Decisions: (1) **Explicit accept, not assignment time, starts the clock** —
`acceptMissionAssignment` is a new applicant-initiated transition (`NOT_STARTED → ACCEPTED`) that
computes `deadlineAt`/`graceEndsAt` from the mission's own `deadlineHours`/`gracePeriodHours` at the
moment of acceptance; an assignment the applicant never accepts never expires, so an applicant is
never penalized for a mission sitting unopened. (2) **`MissionAssignmentStatus` is rebuilt** as
`NOT_STARTED → ACCEPTED → IN_PROGRESS → PENDING_EVALUATION | LATE_SUBMITTED`, with `OVERDUE`
(deadline passed, still inside grace) and terminal `FAILED` (grace expired) as deadline-driven side
states alongside the existing `PASSED`/`REPEAT` review outcomes — replacing the `v0.18.0`
`ACTIVE`/`SUBMITTED` two-state model. (3) **Deadline enforcement is an external, idempotent
scheduled job, not a request-time check** — per explicit product direction ("I prefer keeping
scheduled background tasks separate from the app process, especially for future scaling"),
`sweepMissionDeadlines` (`packages/db/src/mission-deadlines.ts`) runs via a standalone script
(`scripts/mission-deadlines/sweep.ts`, `npm run mission-deadlines:sweep`) intended for an external
cron, not a Next.js route or middleware. Idempotency is structural, not flag-based: each of the two
sweep phases (`ACCEPTED|IN_PROGRESS` past `deadlineAt` → `OVERDUE`; `OVERDUE` past `graceEndsAt` →
`FAILED` + `Application.status = DISQUALIFIED`) is a status-scoped `updateMany`, so re-running the
sweep any number of times can never double-transition or double-notify — a run that finds nothing
in the source status is a pure no-op. (4) **A late submission inside the grace period still
counts** — evidence submitted after `deadlineAt` but before `graceEndsAt` is accepted and recorded
as `LATE_SUBMITTED` rather than rejected, since the grace period's whole purpose is to tolerate
exactly this. (5) **Acceptance auto-advances the applicant, capped at the final week** — accepting
a submission creates the next week's assignment automatically (`FINAL_PROGRAM_WEEK = 4`); accepting
Week 4 creates no Week 5. (6) **Rejection reassigns, never resets to a stale mission** — a `REPEAT`
decision creates a new assignment for a different published mission (this version: back at Week 1);
if no alternate mission exists, no assignment is created, `Application.status` becomes
`AWAITING_MISSION_ASSIGNMENT`, and every `ORG_ADMIN`/`TECH_LEAD` in the tenant is notified to assign
one manually — the failed mission is never reassigned and the applicant is never removed. (7)
**A missed deadline is terminal for now, by explicit product decision** — grace-period expiry sets
`Application.status = DISQUALIFIED` with no rejoin path; "For now, we can leave it at that. Later we
will see what happens if person wants to apply again. Maybe Back Office admin allows them to rejoin
program from Week 1" is recorded as deferred future work, not a gap to silently fill. Migration:
`20260714090000_mission_deadlines_and_lifecycle`. All new end-to-end scenarios (accept, sweep
transitions, late-submission acceptance, auto-advance cap, reject-reassignment,
FAILED-blocks-resubmission) are unit-tested but deferred at the scenario-regression level — recorded
in `docs/Regression_Scenarios.md` Known Gaps rather than silently missing, per `D-076`.

**Process note:** this baseline, `D-081` (`v0.19.0`) and `D-082` (`v0.19.1`) all ship from a single
implementation commit instead of one commit per version — the same kind of accepted one-time
exception already recorded for `v0.17.0`–`v0.18.0` under `D-073`, since all three versions were
built in one continuous session before any of it was committed. See the process note in
`docs/Version_Baseline.md`.

Plan: `docs/plans/v0.18.5_Mission_Deadline_Lifecycle.md`; results:
`docs/testing/v0.18.5_Mission_Deadline_Lifecycle_Test_Results.md`.

Status: Approved

## D-081

`v0.19.0` replaces the applicant Tasks/Resources experience — previously driven by the legacy
program-level `ProgramTask`/`VideoResource` content unrelated to the mission actually being worked
— with a fixed, mission-derived 3-task template, and gives reviewers a cross-mission admin
Submissions tab. Decisions: (1) **Tasks are a fixed template per mission assignment, not
admin-authored** — every assignment gets exactly three tasks (Review the Mission Brief, Study the
Tutorial, Build & Submit Evidence); only `MissionTaskCompletion` (task 1/2) is a real row per
attempt, task 3 is derived implicitly from `Submission.status` moving beyond `DRAFT`/
`NEEDS_REVISION` rather than getting its own completion row, since "submitted" already is that
task's completion signal. (2) **Submission is gated on tasks 1 and 2** — `saveSubmissionDraft`/
`submitSubmission` reject a submit attempt until `areRequiredMissionTasksComplete` is true, matching
the product requirement that an applicant "can only submit mission for review after complete that
week/mission tasks." (3) **YouTube watch-gate uses the IFrame Player API's `onStateChange` event,
not a timer or a client-trusted flag** — Task 2's "Mark as complete" stays disabled until
`YT.PlayerState.ENDED` fires, so a mission author's tutorial video must actually play through; a
mission with no `tutorialUrl` has no gate at all — task 2 completes directly. (4) **Legacy tables
are kept, not migrated or deleted** — by explicit product decision ("Yes, keep the tables, just
leave them unused for now"), `ProgramTask`/`VideoResource`/`UserTaskCompletion` remain real tables
with no application code reading or writing them; only the applicant Tasks/Resources UI and the
admin Program Content authoring page (which now manages only Calendar Events) stop using them. (5)
**The Submissions admin tab introduces no new authorization surface** — `/submissions` reuses the
existing `reviewSubmissions` capability and the existing per-submission review page; it is purely a
cross-mission list/filter view (`listTenantSubmissions`) so reviewers no longer have to open each
mission individually to find what needs review. (6) **Security fix folded into this iteration**: an
automated review flagged `mission.tutorialUrl` rendered as a raw `<a href>` with no scheme
validation (a `javascript:` URI XSS vector); fixed on both the write side (`parseOptionalHttpUrl` in
the admin mission form action, rejecting non-http/https schemes) and the read side (a defensive
scheme re-check before rendering the link on the applicant task page). Migration:
`20260714110000_mission_tasks`. As with `D-080`, the new end-to-end scenarios (submission gating,
watch-gate, Submissions tab reachability) are unit- and manually-tested but deferred at the
scenario-regression level — see `docs/Regression_Scenarios.md` Known Gaps.

Plan: `docs/plans/v0.19.0_Mission_Driven_Tasks.md`; results:
`docs/testing/v0.19.0_Mission_Driven_Tasks_Test_Results.md`.

Status: Approved

## D-082

`v0.19.1` is a patch correcting two remaining gaps from `D-080`/`D-081` without any schema change.
(1) **Dashboard/Program/Tasks/Missions now read the real mission-lifecycle data** those two
versions introduced instead of program-level placeholders: the Dashboard "Days Remaining" stat and
every "current mission" card derive from the actual assignment's `deadlineAt` (not
`Program.endsAt`); My Program's Start/End dates derive from the Week 1 assignment's `acceptedAt` +
4 weeks; the live `DeadlineCountdown` is confirmed to appear only next to the current,
unsubmitted mission — never a not-yet-accepted or already-resolved one — matching the explicit
placement instruction ("add this on the mission page not in mission brief and my programm weeks,
this only shows in the current or unsubmitted missions"). (2) **Reject-reassignment is corrected
from "reset to Week 1" to "repeat the same week"** — per explicit product direction ("Reviewer
Rejects Work -> Repeat the same week with different mission"), `createRepeatFromWeekOneTx` is
renamed `createRepeatMissionForSameWeekTx` and now takes the failed assignment's own `weekNumber`
instead of assuming `1`; a Week 3 rejection now reassigns a different Week 3 mission, not a fresh
Week 1 attempt. The no-alternate-mission fallback (`AWAITING_MISSION_ASSIGNMENT` + reviewer
notification, `D-080`) is unchanged in behavior, only now correctly scoped to the failed week. This
pairs with the earlier `D-080` decision to leave a missed-deadline `DISQUALIFIED` applicant with no
rejoin path for now — that remains deferred; only the *reject* (reviewer-driven) path changes here,
not the *missed-deadline* (system-driven) path. No product code beyond the wiring/rename above; no
migration.

Plan: `docs/plans/v0.19.1_Dashboard_Wiring_And_Same_Week_Repeat.md`; results:
`docs/testing/v0.19.1_Dashboard_Wiring_And_Same_Week_Repeat_Test_Results.md`.

Status: Approved

## D-083

`v0.19.2` is a patch bundling two small, unrelated fixes that predate the `v0.18.5`–`v0.19.1`
mission-lifecycle work but were left uncommitted until now. (1) **Logout regression restored** —
the `v0.14.3`/D-066 applicant dashboard sidebar Logout button had gone missing: the
`feat/applicant-ai-mentor-skeleton` branch (merged via PR #45) reverted part of an earlier
main-branch merge that had added it, silently trapping accepted applicants in the dashboard with no
sign-out (the dashboard shell replaces `PortalHeader` entirely, so it must carry its own logout
affordance). The fix restores the `<form action={logoutAction}>` button in `ApplicantShell.tsx`,
reusing the existing OIDC RP-initiated logout action unchanged. A `vitest.config.ts` alias gap
surfaced in the process: `apps/applicant/tsconfig.json`'s `"@/*" -> "./*"` path was never mirrored
in the Vitest resolver, so `ApplicantShell.test.ts` (which now imports the logout action through
`@/lib/logout-action`) could not resolve the module; a scoped `@/(.+)` → `apps/applicant/$1` alias
fixes this, and the test mocks the logout action the same way
`apps/applicant/lib/logout-action.test.ts` already does (the real chain pulls in `next-auth` →
`next/server`, which needs the Next.js runtime and isn't resolvable under plain Vitest). (2) **A new
`AGENTS.md` "Confirmation Gates" section** requires any agent working in this repo to stop and ask
for explicit user confirmation before (a) starting the documentation-update process for a versioned
iteration, or (b) pushing commits to a remote branch — closing a gap where the repo's process docs
described *what* to do for versioning and pushing but never said to check in with the user first.
No schema change; no migration; unit suite unchanged at 427 tests across 43 files.

Plan: `docs/plans/v0.19.2_Logout_Regression_And_Confirmation_Gates.md`; results:
`docs/testing/v0.19.2_Logout_Regression_And_Confirmation_Gates_Test_Results.md`.

Status: Approved

## D-084

`v0.19.3` is a patch addressing three AI Mentor issues and a test infrastructure problem.
(1) **RBSE personal-name blocking** — the Rule-Based System Engine allowed questions like
"explain hitesh" to reach the GLM LLM because "explain" is an allowed topic. Regex patterns
(`PERSONAL_NAME_PATTERNS`) now catch "explain \<Name\>", "who is \<Name\>", "tell me about
\<Name\>", "describe \<Name\>", and "what do you know about \<Name\>" at the RBSE layer, with a
`NAME_PATTERN_ALLOWLIST` ensuring technical terms (SDLC, testing, deployment, etc.) still pass.
RBSE also now always runs regardless of conversation history — previously multi-turn conversations
bypassed RBSE entirely via a `conversationHistory.length > 0` check. (2) **Token usage tracking**
— the GLM streaming request was missing `stream_options.include_usage`, so the SSE stream never
included token counts (logs showed `tokens=?`). Adding `stream_options: { include_usage: true }`
fixes this. (3) **Test isolation** — the Vitest default `threads` pool caused cross-file mock
contamination and slow `vi.resetModules()` under the full 43-file suite, leading to 6 spurious
failures (timeouts + wrong mock state). Switching to `forks` pool with `testTimeout: 15_000`
gives each test file its own process, eliminating the issue. No schema change; no migration;
unit suite: 427 tests across 43 files, all pass.

Plan: `docs/plans/v0.19.3_AI_Mentor_RBSE_Name_Blocking_And_Token_Tracking.md`; results:
`docs/testing/v0.19.3_AI_Mentor_RBSE_Name_Blocking_And_Token_Tracking_Test_Results.md`.

Status: Approved

## D-085

`v0.19.4` is a patch making the mission task checklist follow the assignment lifecycle.
Previously the applicant task pages rendered an enabled "Mark as complete" toggle regardless of
assignment status, so clicking it on a `PASSED` (or not-yet-accepted `NOT_STARTED`) assignment
surfaced the raw server error "Mission assignment is not accepted/active for this applicant.";
and a `PASSED` assignment with missing completion rows (data seeded outside the normal flow)
displayed tasks 1-2 as incomplete - reading as lost progress on a finished mission. Changes:
(1) `buildTaskSummaries` is status-aware - a `PASSED` assignment derives a fully complete
checklist, since the normal flow cannot pass without tasks 1-2 (they gate "Submit for Review");
(2) new shared exports `MARKABLE_ASSIGNMENT_STATUSES` (`ACCEPTED`/`IN_PROGRESS`/`OVERDUE`) and
`missionChecklistLockReason(status)`; (3) `unmarkMissionTaskComplete` now enforces the same
markable-status guard as marking - a locked checklist is immutable in both directions; (4) the
task resource page renders the lock reason instead of the toggle for every non-markable status.
Carrying completion rows forward into repeat attempts was considered and rejected: the repeat
decision assigns a *different* mission for the same week (v0.19.1, D-082), so its brief/tutorial
tasks genuinely restart - the lock messaging now makes that visible instead of erroring. No
schema change; no migration. Unit suite: 431 tests across 43 files (was 427), all pass; new
`missions` regression scenario "Passed and unaccepted assignments lock the task checklist;
active ones stay editable".

Plan: `docs/plans/v0.19.4_Mission_Task_Checklist_Lifecycle_Guard.md`; results:
`docs/testing/v0.19.4_Mission_Task_Checklist_Lifecycle_Guard_Test_Results.md`.

Status: Approved

## D-086

**Decision:** Keep weekly learning tasks (`ProgramTask`/`UserTaskCompletion`) separate from the fixed
mission workflow checklist (`MissionTaskCompletion`). Weekly completion is scoped to
tenant/applicant/program/week and survives a same-week repeat; workflow steps remain scoped to one
assignment attempt.

**Rationale:** General learning/setup work does not become incomplete merely because a reviewer assigns
a different mission variant, while mission-specific brief/tutorial steps genuinely belong to an
attempt.

**Alternatives considered:** Replace the mission checklist with weekly tasks; attach every weekly task
to a mission; copy completion rows into each repeat attempt. These choices either erase the existing
workflow gate or duplicate/restart reusable learning work.

**Impact:** Final submission evaluates both gates. The migration reactivates and extends the existing
weekly models rather than adding parallel task tables.

Date: 2026-07-19

Status: Implemented; pending baseline review

## D-087

**Decision:** Journal readiness is assignment-attempt scoped. At least four eligible current-attempt
entries are required; previous-attempt and future-dated entries do not count. Existing one-entry-per-
applicant-per-calendar-date behavior remains.

**Rationale:** Review evidence must explain the work for the assignment being submitted, while allowing
more than one reflection across the week and preserving immutable history from earlier attempts.

**Alternatives considered:** Count every journal in the week; count exactly four; copy old journals to
the new attempt; remove the calendar-date uniqueness rule. Each weakens attempt traceability or creates
duplicate/ambiguous daily records.

**Impact:** A repeat requires new attempt-linked reflections but does not delete or mix old records.
`REQUIRED_JOURNAL_ENTRY_COUNT` is a minimum (`>= 4`).

Date: 2026-07-19

Status: Implemented; pending baseline review

## D-088

**Decision:** Parse and validate every evidence URL centrally, perform public reachability and SSRF
checks before database mutation, then use a short transaction to recheck readiness/evidence/status and
apply the final transition. Failed validation never locks journals or changes submission/assignment
status.

**Rationale:** Network requests are slow and untrusted and must not hold database locks. A second
transactional check plus status-scoped update closes the time-of-check/time-of-use and concurrent-submit
windows.

**Alternatives considered:** Check URLs only in the browser; accept syntactically valid URLs without
reachability; perform network requests inside the transaction; allow partial state and repair it later.
These alternatives permit bypasses, SSRF or long transactions and inconsistent records.

**Impact:** Public evidence can fail closed during remote outages/rate limits. DNS results are screened
and pinned, redirects are revalidated, requests are bounded, and the exact failed URL is reported.

Date: 2026-07-19

Status: Implemented; pending baseline review

## D-089

**Decision:** Reuse the legacy-named `VideoResource` model for ordered `MARKDOWN` and `YOUTUBE` task
resources. A pending video is stored as a YouTube resource with a null URL and shown explicitly as
pending. Markdown renders through a constrained component with raw HTML disabled.

**Rationale:** The existing resource ownership/audit paths already fit program content. Extending them
is smaller and more compatible than adding another resource table or introducing runtime file-path
dependencies.

**Alternatives considered:** New Markdown and Video models; arbitrary runtime Markdown file references;
placeholder video links. These add schema/runtime complexity or misrepresent unavailable content.

**Impact:** Admins manage both resource types through the existing program-content permission boundary;
the actual introduction video and final URL remain a content follow-up.

Date: 2026-07-19

Status: Implemented; pending baseline review

## D-090

**Decision:** Keep badges, real AI journal scoring, reviewer numeric scoring, recruiter/portfolio journal
views and a new deployment-link model out of `v0.19.5`. Preserve `Submission.deploymentUrl` as a
normalized semicolon-separated string and retain `Submission.journalMarkdown` only for compatibility.

**Rationale:** The iteration is a focused readiness and safety improvement. The current string field can
represent one or more deployments without a migration, and the dedicated Engineering Journal already
owns reflection behavior.

**Alternatives considered:** Expand into scoring/gamification/recruiter features; remove the legacy
journal field; create a deployment relation immediately. All increase scope or risk historical-data
compatibility without being required for the business outcome.

**Impact:** Single-URL records still work, up to ten deployment URLs are parsed centrally, and deferred
features need their own versioned plan and security/test review.

Date: 2026-07-19

Status: Implemented; pending baseline review
