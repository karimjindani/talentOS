# Decision Log

Code version: `v0.20.2`

Architecture evidence commit: `5560ccf`

Current documentation update: `v0.20.1`

Allocation note: `v0.20.0` was released to `origin/main` via PR #56; `v0.20.1` is the next
available patch after `v0.20.0`.

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

## D-091

**Decision:** Rebuild the applicant mission page as a tabbed Mission Workspace whose presentation is
driven by a pure `view-model.ts`, unit-tested through `view-model.test.ts`, rather than embedding step,
progress, countdown and submission-mode logic in the React components. Client-only behavior (the ≥90%
YouTube gate, sequential learning-task unlock, tab switching) is verified through extracted logic and
manual container checks, with DOM assertions recorded as Known Gaps.

**Rationale:** The prior page mixed business rules into markup, making the LMS redesign risky to test.
Concentrating all derivable state in one pure module keeps every existing mission/assignment/submission
rule intact and unit-testable in the node/Vitest environment, which renders no DOM.

**Alternatives considered:** Add a jsdom/browser harness this iteration to assert the client components
directly; keep the logic inline and rely only on regression scenarios. The first expands scope beyond
the redesign; the second leaves the new gating logic uncovered.

**Impact:** The workspace reuses all `@talentos/db` reads/actions and gating; a future jsdom/browser
harness is the tracked follow-up for the deferred client-only scenarios.

Date: 2026-07-23

Status: Implemented; pending baseline review

## D-092

**Decision:** Extend program curriculum with a `DOCUMENT` `LearningResourceType` and an
`isPrerequisite` `ProgramTask` flag rather than new tables. A `DOCUMENT` resource links a `StoredFile`
via `VideoResource.fileId` validated to belong to the tenant (missing or foreign files rejected) through
the existing presign→storage→confirm flow; prerequisite tasks lock the mission's own steps until
complete. Admin curriculum management moves to a top-level **Tasks** page reusing the existing
`manageProgramContent`-guarded content actions.

**Rationale:** The `VideoResource`/`ProgramTask` ownership and audit paths already fit program content
and tenant scoping, so extending them is smaller and lower-risk than new resource/file relations. No new
write authority is introduced.

**Alternatives considered:** A dedicated document/resource table and a separate prerequisite-relation
model; a bespoke upload path outside the presign/confirm flow. Both add schema/runtime complexity
without a business need at current volumes.

**Impact:** Admins manage Markdown/YouTube/Document resources and prerequisites through the existing
permission boundary; the applicant download route and step-lock UI are recorded Known Gaps for a
follow-up iteration.

Date: 2026-07-23

Status: Implemented; pending baseline review

## D-093

**Decision:** Change mission deadlines to a Thursday cadence with at least four Mon–Thu working days
(computed in UTC via `computeMissionDeadline`) instead of raw `deadlineHours`, and make a `REPEAT`
exclude every mission the applicant already had that week (`id: { notIn: [...all prior] }`), not only
the failed one; when none remain the application moves to `AWAITING_MISSION_ASSIGNMENT` and reviewers
are notified.

**Rationale:** A predictable weekly deadline and a repeat that never re-serves a previously-seen mission
match the intended program rhythm and fairness, without touching the mission engine, assignment
selection or submission state machine.

**Alternatives considered:** Keep raw `deadlineHours`; exclude only the failed mission on repeat; add a
per-tenant timezone for the cadence now. The first two reproduce the current behavior; per-tenant
timezone is deferred as future work (the cadence is UTC for now).

**Impact:** Every acceptance lands on a Thursday with grace after it; repeats draw only from unseen
week-N missions and escalate cleanly when exhausted.

Date: 2026-07-23

Status: Implemented; pending baseline review

## D-094

**Decision:** Refresh `docs/Product_Backlog.md` to reflect delivery through `v0.19.6`. Advance the
backlog's declared code version from `v0.18.2` to `v0.19.6`; record the `v0.18.5`–`v0.19.6` mission
lifecycle, mission-driven tasks, dashboard wiring, weekly learning tasks + submission readiness, and
the mission-workspace / LMS curriculum tooling / Thursday-scheduling arc under the Missions module;
and reclassify **AI Mentor** from an open "boundary" slice to delivered (`v0.19.3`, D-084). This is a
documentation-only sync folded into the `v0.19.6` iteration, mirroring the earlier backlog refreshes
recorded as D-070 (`v0.16.2`) and D-077 (`v0.18.2`); no plan/test-results pair is created because no
code, schema, or test scenario changes.

**Rationale:** The backlog had drifted four iterations behind the shipped code and still listed
already-delivered capabilities (most visibly AI Mentor) as remaining, which misrepresents the true
remaining MVP scope. Every reconciled line is traceable to an existing Decision_Log entry
(D-080..D-093), so the refresh records only what was actually delivered.

**Alternatives considered:** Allocate a new patch version (`v0.19.7`) for the doc-only change; leave
the backlog stale until the next feature iteration. The first over-weights a routine documentation
sync that has precedent for folding into the current iteration; the second perpetuates a backlog that
contradicts the delivered code.

**Impact:** The backlog now declares `v0.19.6` and accurately separates delivered work from the
genuinely remaining slices (IAM Admin Users/Roles UI, standalone Knowledge Base, GitHub Integration,
Portfolio, Certificates, Leaderboard, Hiring Recommendations, and the V2/V3 items).

Date: 2026-07-24

Status: Implemented; pending baseline review

---

## D-095: Applicant Onboarding E2E QA Bug Fixes (v0.19.6)

**Context:** End-to-end QA analysis of the new applicant onboarding flow on
`http://paysyslabs.lvh.me:3100` found four bugs spanning the middleware redirect,
logout, hydration, and admin filter surfaces.

**Decision:** Fix all four bugs within the `v0.19.6` iteration (no new version
allocation — these are bug fixes, not new features):

- **BUG-1 (HIGH):** Tenant subdomain lost on middleware redirect. Both applicant
  and admin middleware used `nextUrl.origin` to build redirect URLs, which inside
  Docker resolved to the canonical `AUTH_URL` host instead of the tenant
  subdomain, causing cross-origin RSC fetch failures. Fix: `requestOrigin()`
  helper using the request `Host` header.

- **BUG-2 (MEDIUM):** Logout "Invalid redirect uri". Verified the code
  (`buildTenantLogoutUrl` uses canonical `AUTH_URL` origin) and Keycloak
  `post.logout.redirect.uris` config are correct. No code change needed.

- **BUG-3 (LOW):** React hydration error #418 on Missions page.
  `DeadlineCountdown` used `useState(() => Date.now())` causing server/client
  time mismatch. Fix: `useState<number | null>(null)` with `Date.now()` only in
  `useEffect`.

- **BUG-4 (LOW):** Duplicate "Regression Program" entries in admin Missions
  filter. 197 duplicate DB rows cleaned + deduplication by name in
  `missions/page.tsx`.

**Rationale:** All four bugs are quality regressions or data issues within
shipped v0.19.6 surfaces, not new capabilities. Folding them into v0.19.6
follows the precedent set by D-094 for iteration-scoped fixes.

**Alternatives considered:** Allocate `v0.19.7` for the QA fixes. Rejected —
these are bug fixes on already-shipped surfaces, not new features or schema
changes requiring a versioned plan/test-results pair.

**Impact:** 17 regression tests added (40 total in `middleware-redirect.test.ts`).
All CI steps pass: typecheck, lint (0 warnings), 671 tests, build (both apps).
Full QA report at `docs/audits/v0.19.6_Applicant_Onboarding_QA_Report.md`.

Date: 2026-08-07

## D-096: Tasks Are Authored Per Mission, Not Per Program Week (v0.20.0)

**Context:** `ProgramTask` was scoped to a program week, so every mission in a week shared one task
list. An applicant assigned Week 2's *TaskPilot* mission saw tasks written for a different Week 2
mission, and a repeated week served the same tasks again on the replacement mission.

**Decision:** Add a required `missionId` to `ProgramTask` and author tasks per mission. `weekNumber`
stays as a denormalized copy of the mission's week for existing week-ordered queries and is always
written from `ProgramTask.mission`, never independently. The admin picks program → mission before any
editor appears; the Program Content page links to the Tasks page instead of carrying a second editor.
Submission readiness and completion listing key on `missionId`.

**Consequences:** Migration `20260808090000_program_task_mission_scope` backfills each task to the
first mission of its tenant/program/week and deletes rows with no match (one orphaned Week 2 row
locally). A repeat now brings the new mission's own tasks; completions on the earlier mission are
preserved, not carried forward. `Architecture.md` and `Data_Model.md` statements that a task "is not
attached to a mission" and that week-level completions survive a repeat are reversed.

## D-097: Publishing A Mission Resumes Dangling Repeat Attempts (v0.20.0)

**Context:** A `REPEAT` decision with no unused mission for that week parked the application in
`AWAITING_MISSION_ASSIGNMENT`. Recovery keyed on that status alone, so an application left `ACCEPTED`
with a dangling `REPEAT` — reachable when the assignment's mission is removed, and produced locally by
a verification script — could never be served again by any code path.

**Decision:** `resumeAwaitingMissionAssignmentsTx` selects both `AWAITING_MISSION_ASSIGNMENT` and
`ACCEPTED` applications. The existing per-applicant guard (latest attempt must be `REPEAT` for that
exact week) is what keeps it safe: an `ACCEPTED` applicant with an open attempt is skipped.

**Consequences:** `AWAITING_MISSION_ASSIGNMENT` is no longer terminal (`Data_Dictionary.md` corrected).
Recovery is idempotent and cannot double-serve, because a served applicant's latest attempt is no
longer `REPEAT`.

## D-098: Review Decisions Are Kept As Immutable History (v0.20.0)

**Context:** One `Submission` row is reused through the SEM revision loop, so each review overwrote
`reviewerFeedback`/`reviewedAt`. "Accepted first time" and "accepted after two rounds of changes" were
indistinguishable in the data — the exact distinction AI evaluation of an applicant needs.

**Decision:** Add an append-only `SubmissionReview` table (round, decision, feedback, reviewer,
timestamp) written on every review, plus denormalized `reviewOutcome` and `revisionCount` on
`MissionAssignment` for rollups. Feedback text is stored per round deliberately: the reason changes
were requested is stronger evaluation signal than the decision label. `getApplicantEvaluationSummary`
exposes the per-week journey and `formatEvaluationSummaryForPrompt` renders it for a model.

**Consequences:** Migration `20260810120000_submission_review_history` reconstructs history from
`audit_logs`, which recorded every decision. Feedback text was never audited, so backfilled rounds
other than the last carry `NULL` feedback rather than a guess. `@@unique([missionAssignmentId, round])`
doubles as the concurrency guard against two simultaneous reviews.

## D-099: Journal Entries Cannot Pre-Date The Mission Start (v0.20.0)

**Context:** `normalizeJournalEntryDate` guarded only the upper bound (no future dates). Applicants
were dating entries before they had even accepted the mission — 8 of 12 local entries did — and a
reviewer rejected a submission over it.

**Decision:** Reject entry dates earlier than the calendar day of the assignment's `acceptedAt`,
resolved in the applicant's time zone, on both create and update. `acceptedAt` is the boundary rather
than `assignedAt` because the workspace is unusable until acceptance and the deadline timers start
from the same instant, which also gives a repeat attempt its own later boundary.

**Consequences:** The date picker gains a `min` bound; the server remains authoritative. Entries
created before this rule keep their dates until edited, at which point the date must be corrected.
Regression fixtures now set an explicit acceptance date, since journals otherwise had no valid window.

## D-100: Missions Can Be Imported From A Markdown Spec (v0.20.0)

**Context:** Creating a mission meant filling 13 fields, five of them long-form textareas, even though
the seed corpus already authored missions as Markdown against a fixed section convention with a parser
private to `prisma/seed.ts`.

**Decision:** Promote that parser to `packages/db/src/mission-spec.ts` and reuse it for both seeding
and a Back Office import. The file carries the title and the seven content fields; program, week,
order and difficulty stay form inputs, so existing seed specs import unchanged. Imports always create
a `DRAFT`. Parse failures redirect back with every problem listed rather than throwing, because a
thrown server action renders as a digest-only error page in production.

**Consequences:** One parser instead of two. Frontmatter for week/difficulty was considered and
rejected to avoid a second source of truth for metadata.

---

## D-101: Comprehensive Test Coverage Audit And Server-Action Regression Hardening (v0.19.7)

**Context:** A full test-coverage audit of the TalentOS codebase identified that
while the `packages/db` data-access layer and `packages/auth` pure logic were
well-tested (55 files, 671 tests), the **server-action layer** — the boundary
between UI forms and business logic — had no automated tests. Tenant CRUD,
program CRUD, tenant resolution edge cases, and the RBAC capability matrix
also lacked dedicated test coverage.

**Decision:** Add 10 new test files (138 test cases) covering:

1. **Tenant CRUD** (`packages/db/src/tenants.test.ts`, 12 tests) —
   `getTenantBySlug`, `listTenants`, `createOrganization` (happy path, P2002
   duplicate slug, email normalization, audit log, null actor), `updateTenantBranding`
   (with/without/clear logo).

2. **Program CRUD** (`packages/db/src/programs.test.ts`, 12 tests) —
   `listPublishedPrograms`, `listTenantPrograms`, `getTenantProgram`, `slugify`
   (4 cases), `createProgram` (happy, P2002), `updateProgram` (happy, not-found).

3. **Tenant resolution edge cases** (`packages/auth/src/tenant.test.ts`, 25 tests) —
   null/undefined/empty host, port stripping, protocol stripping, case
   normalization, multi-level subdomains, localhost subdomains, apex fallback,
   foreign domains, look-alike domains, slug validation (DNS-safe, reserved,
   length boundaries).

4. **RBAC capability matrix** (`packages/auth/src/capabilities.test.ts`, 17 tests) —
   `canEnterAdminPortal` for all 5 roles + null/undefined, `can()` for all 8
   capabilities × 5 roles, `assertTenantScopedAccess` (match, mismatch, null).

5. **Journal validation helpers** (`packages/db/src/journal-validation.test.ts`, 33 tests) —
   `normalizeJournalLanguage`, `parseJournalEvidenceLinks`, `validateConfidenceRating`,
   `validateTimeSpentHours`, `normalizeJournalEntryDate` with timezone.

6. **Applicant mission actions** (`apps/applicant/app/dashboard/missions/[id]/actions.test.ts`, 9 tests) —
   `acceptMissionAction` (happy, not-assigned, not-linked, error),
   `saveSubmissionAction` (save, submit, no-accepted-app, not-assigned, readiness error).

7. **Applicant journal actions** (`apps/applicant/app/dashboard/journal/actions.test.ts`, 8 tests) —
   `saveJournalEntryAction` (create, update, no-accepted-app, not-linked, missing
   mission/date, `JournalEntryDateConflictError`, generic error).

8. **Admin program actions** (`apps/admin/app/programs/actions.test.ts`, 7 tests) —
   `createProgramAction` (happy, slug derivation, invalid status),
   `updateProgramAction` (happy, not-found), `setProgramStatusAction` (happy, not-found).

9. **Admin submission review** (`apps/admin/app/missions/submission-actions.test.ts`, 8 tests) —
   `reviewSubmissionAction` (accept, needs-revision with/without feedback, repeat
   without feedback, invalid decision, not-found, SUPER_ADMIN backfill, no DB user).

10. **Admin organization actions** (`apps/admin/app/organizations/actions.test.ts`, 7 tests) —
    `createOrganizationAction` (happy, existing user, missing name, invalid color,
    invalid email, duplicate slug, Keycloak failure retryable).

**Rationale:** Server actions are the primary attack surface for authorization
and data-integrity bugs. Testing them at the unit level (with mocked dependencies)
is fast, deterministic, and catches regressions before they reach the regression
E2E suite or manual QA. No production code was modified — all 138 tests pass
against the existing implementation, confirming the code is correct.

**Alternatives considered:** Add Playwright browser E2E tests instead. Rejected —
the existing custom regression runner already covers E2E flows; the gap was at
the unit/server-action layer, which is better served by fast Vitest tests.

**Impact:** 809 total tests (65 files), all passing. New
`docs/REGRESSION_TEST_PLAN.md` documents the complete coverage matrix. No
schema migrations, no production code changes, no user-facing changes.

Date: 2026-08-10

Status: Implemented; committed on `fix/applicant-journal-tenant-redirect`

**Renumbered (v0.20.2):** This decision was originally recorded as `D-096` on the `feature/comprehensive-test-coverage` branch while `v0.20.0` independently allocated `D-096`–`D-100` on another branch. Both merged into `main`, leaving two different decisions sharing one identifier. This entry took the next free number because `D-096`–`D-100` are cited as a contiguous range from `Deployment.md` and `Product_Backlog.md`; it is listed after `D-100` so the log stays in numeric order, which is why its version is out of sequence with its neighbours. Decision identifiers are unique and permanent once merged — see `D-102`.

---

## D-102: Request Logging Is Opt-In, And Decision Identifiers Are Unique (v0.20.2)

**Context:** Two defects surfaced when `v0.20.0` (PR #56), `v0.20.1` (PR #59) and the E2E-evidence CI
job (PR #57) all merged into `main` within a day of each other.

`v0.20.1` added request logging as an unconditional `console.log` at the top of both app middlewares.
It had no way to be switched off, and the middleware matcher only excludes `_next/static`,
`_next/image` and `favicon.ico` — so `/_next/data` payloads and every file served from `public/` each
produced a line, burying real navigations in a page-load's worth of asset noise.

Separately, `v0.19.7` and `v0.20.0` each allocated `D-096` on their own branch. Neither was visible to
the other, and the merge kept both, so a citation of `D-096` resolved to two different decisions.

**Decision:**

1. Move the log behind `logRequest` in `packages/auth-web/src/request-log.ts`, gated on
   `REQUEST_LOG === "1"` and filtered to paths that represent real activity. Unset means off, so a
   deployed environment is quiet unless it asks. `docker-compose.yml` sets the flag for the local
   stack, preserving the `docker compose logs` visibility the log was added for.
2. Treat decision identifiers as unique and permanent once merged. The duplicate was resolved by
   renumbering the `v0.19.7` entry to `D-101` — see the note there for why that one moved.

**Rationale:** An explicit flag rather than `NODE_ENV !== "production"`, because the local Docker
stack runs the apps with `NODE_ENV: production`; inferring the default from the environment would
silence the log in the one place it is actually read. `logRequest` swallows console failures, since an
observability concern must not be able to break the auth middleware hosting it.

**Alternatives considered:** Duplicating a small helper in each app, rejected because the two copies
would drift and each would need its own tests. Filtering `/api/auth/session` — next-auth polls it, so
it is the single noisiest real path — rejected because it is a genuine request and hiding it would
misrepresent traffic.

**Consequences:** Request logging is off by default outside the local stack and must be enabled
deliberately. Decision numbers can no longer be allocated from a branch's own view of the log alone;
`AGENTS.md` already requires versions to be computed across all active branches, and the same applies
to `D-0NN`.

---

## D-103: Journey E2E Evidence Pipeline, And Consent Decisions Must Persist Even Without A Prior Profile (v0.20.3)

**Context:** Two independent gaps surfaced while hardening the public-portal graduate/recruiter feature
that shipped in PR #62 (`feat/public-graduate-portal-local`) without any SSDLC documentation or a
dedicated end-to-end evidence mechanism.

First, the existing scenario runner (`scripts/regression/run.ts`) proves logical product areas through
HTTP/DB-level assertions, but nothing in the suite drives a real multi-step user session through an
actual browser and captures what a reviewer would see. A live, shareable evidence trail — "this is
what the applicant portal actually looked like on this PR" — did not exist.

Second, manual testing of the public-portal consent flow (decline/skip) found that
`declineGraduateProfilePublishing` and `skipGraduateConsent` (`packages/db/src/graduates.ts`) both
threw `"No graduate profile exists to decline/skip"` when the applicant had never acknowledged consent
before. The API routes calling them caught that error and returned `{success: true}` anyway — the UI
showed a success message, but nothing was written. The decision was silently lost on the next page
load. This is exactly the class of defect `docs/sdlc.md` principle 0 ("document what you do") exists
to catch, and it had zero test coverage in either direction: `packages/db/src/graduates.ts` — the
module holding all consent, eligibility, and recruiter approve/verify/revoke logic — had no unit tests
at all, and the `public-portal` regression area had exactly one scenario.

A related, unrelated-in-cause but relevant-in-time finding: a teammate (hitesh-munwani) had an
independently-developed branch, `feature/e2e-evidence-pipeline` (PR #67), building a *different*
architecture for E2E evidence — screenshot-capture-driven rather than Playwright-journey-driven, with
explicit PII masking — and had already written SSDLC docs for it under the same `v0.20.3`/`D-103`
identifiers this baseline uses. That PR was closed unmerged (2026-08-19, before this baseline was
allocated) so the identifiers are free, but the two approaches were never reconciled; see
`Regression_Scenarios.md` Known Gaps.

**Decision:**

1. **Journey E2E evidence pipeline**: a Playwright-driven `tests/journeys/` suite
   (`applicant-arc.spec.ts`, `docs-only.spec.ts`) drives real browser sessions through the applicant
   and admin portals, capturing a screenshot per step. CI (`e2e-evidence` job) runs it after the
   scenario suite and renders the result three ways: a Markdown step summary
   (`scripts/ci/journey-report.ts`), and a single combined PDF with every journey's step table and
   embedded screenshots (`scripts/ci/journey-pdf-report.ts`, via Playwright's own already-installed
   Chromium — deliberately not the hand-rolled dependency-free PDF writer
   `apps/applicant/lib/candidate-report.ts` uses, because that one exists specifically for a live
   Next.js API route with no browser available, a constraint that does not apply to a CI step). Both
   report scripts follow the existing non-throwing `if: always()` contract: a crash here must not
   replace a real stack-boot failure with a confusing one.
2. **`declineGraduateProfilePublishing`/`skipGraduateConsent` now create a placeholder `GraduateProfile`
   row when none exists**, mirroring the placeholder-creation path `createOrUpdateGraduateProfile`
   (acknowledge) already had, instead of throwing and having the caller paper over the failure.
3. **`RecruiterAccount` joins the tracked `RegressionDataMarker` entity types** in
   `packages/db/src/regression.ts`. It has no relation back to `User`/`Tenant`, so nothing in the
   existing cleanup chain could reach it — every regression run touching the recruiter flow would have
   leaked one row forever.
4. **5 new `public-portal` scenarios** cover the fix directly (decline/skip persistence with no prior
   profile) and the surrounding lifecycle the module had never been tested against at all (decline
   unpublishing an already-public profile; the full recruiter approve→verify→access→revoke chain;
   pending/rejected-token refusal with the rejection reason surfaced) — see
   `docs/Regression_Scenarios.md`.

**Rationale:** The consent fix mirrors an existing, already-correct sibling function
(`createOrUpdateGraduateProfile`) rather than inventing a new pattern — the placeholder-profile shape
was already established and tested. The PDF report reuses Playwright rather than adding a new
dependency or hand-rolling PDF generation a second time in this codebase, because the CI runner
already pays the cost of installing Chromium for the journeys themselves.

**Alternatives considered:** Reconciling this baseline with `feature/e2e-evidence-pipeline`'s
screenshot-capture-driven approach before proceeding, rejected for this iteration — that PR was closed
before this work reached a decision point, and merging two independently-built E2E evidence
mechanisms is a larger cross-team scoping conversation than a single baseline should absorb
unilaterally. Recorded as a known gap rather than resolved.

**Consequences:** The `public-portal` regression area grows from 1 scenario to 6; `graduates.ts` gains
its first 48 unit tests. The graduate-portal/recruiter feature itself (PR #62) remains otherwise
undocumented in `Data_Model.md`, `Data_Dictionary.md`, `Architecture.md` and the user guides — this
baseline fixes and tests a specific defect in that feature without taking on documenting all of it,
which is recorded as an explicit gap rather than silently expanded scope.

**Addendum — a real journey-suite hang found and fixed while gathering this baseline's own
verification evidence:** running the full journey suite for the test-results doc found
`applicant-arc` and two of `docs-only`'s admin-portal blocks hanging for the full 300s test timeout
and failing, reproducible 3/3. Root-caused live rather than assumed: a standalone reproduction using
the real tenant/identity-provisioning code converged correctly in an isolated browser context, which
ruled out the login mechanism itself; the failure only appeared inside the real multi-actor fixture.
Direct network-event instrumentation on the reviewer's page found the actual cause — landing on an
admin page after the Keycloak redirect restores window focus, and next-auth's `SessionProvider` fires
its mount-time `/api/auth/session` fetch and its refetch-on-focus fetch in the same tick. One of the
two duplicate GETs never receives a completion event in Playwright's own request ledger (a
Chromium/CDP dedup quirk on identical concurrent GETs — confirmed not an application-side hang, since
Postgres and every container were idle throughout, per `pg_stat_activity` and `docker stats`). With
that ledger permanently off by one, `networkidle` — "zero pending connections for 500ms" — never
fires again for that page's remaining lifetime, and in this environment `waitForLoadState("networkidle")`
has no effective default timeout of its own, so each of the three call sites that used it unbounded
(`fixtures/actors.ts`'s login loop, `applicant-arc.spec.ts`'s `settledClick`, `docs-only.spec.ts`'s
own duplicate `settle`) simply waited until the whole test's budget ran out. Fixed by bounding all
three to a 5s timeout with the rejection swallowed, mirroring the one call site that already had this
protection. Verified: the full suite went from a 16.6-minute run with 3 failures to 3.3 minutes with
8 passed and 1 documented skip, 0 failed, run twice for reproducibility of the fix itself.

## D-104: Recruiter Access Browser Journey, And Injected Tokens Where None Can Be Observed (v0.20.4)

**Context:** `v0.20.3` (D-103) proved the recruiter access-request lifecycle correct at the
regression/integration level (`packages/db/src/graduates.test.ts`, `regression:public-portal`
scenarios 6–7), but the `tests/journeys/` browser suite it built covered only the applicant/reviewer
arc. The original design doc (`docs/designs/2026-08-13-journey-e2e-evidence-design.md`) scoped exactly
three journeys, none of them recruiter-facing — the graduate-portal/recruiter feature (PR #62) shipped
through a separate, undocumented path entirely. A user question ("is the recruiter journey covered
like the others?") surfaced this as a real gap rather than deferred scope: recruiter coverage existed,
but never through a real browser.

A genuine technical obstacle stood in the way of a naive implementation: `RecruiterAccessRequest.token`
is stored as `hashToken(rawToken)` only (`packages/db/src/graduates.ts`) and the raw value is never
returned by any API response, at creation or at approval — the real email route embeds it directly
inside `approveAccessRequest`'s own request/response cycle. A browser-only journey clicking the real
"Approve & Send Email" button has no way to discover what token the recruiter would have received,
and this repo has no mailbox-capture harness (e.g. MailHog) to intercept the actual email.

**Decision:**

1. **`tests/journeys/recruiter-access.spec.ts`** adds a fourth journey: `recruiter` submits the
   directory's "Access Full Profiles" modal (`RecruiterAccessModal.tsx`, posting to
   `/api/graduates/request-access` — a single global request, not per-graduate; the older
   slug-specific `RecruiterAccessForm.tsx` component is dead code, unused by any page), the
   still-PENDING request is refused, `ORG_ADMIN` approves via a real `/recruiter-requests/[id]`
   browser session, the recruiter verifies and reaches the full portfolio (`/graduates/verify`'s own
   client-side redirect, not a followed link), saves the candidate, the admin revokes access, and the
   same token is refused again. A second test proves the pending/rejected refusal UI states render
   correctly, including the admin's stated rejection reason.
2. **Known-token injection, not email capture.** Immediately after each real state transition
   (PENDING creation, APPROVED via the real browser click), a `system`-labeled step generates its own
   raw token and overwrites `RecruiterAccessRequest.token` with its hash directly via Prisma — the
   same "bypass the UI for what a browser genuinely cannot observe" pattern `applicant-arc.spec.ts`
   already established for its own `system` steps (Keycloak user creation, the final submission
   transition). This proves the verification endpoint and its UI, not email delivery; documented
   explicitly in the plan and inline so it isn't mistaken for a weaker guarantee than it is.
3. **`recruiter` joins the journey harness's `Actor` union** (`tests/journeys/fixtures/types.ts`) as
   the one actor that never authenticates via Keycloak SSO; `portalUrl()` (`fixtures/actors.ts`)
   routes it to the applicant app's port, since the public graduate directory and `/recruiter`
   dashboard are both served from there, not the admin app every other non-applicant actor uses.
4. **`tests/journeys/fixtures/graduate.ts`** seeds the one published, consented graduate every step
   needs, built directly against the same `@talentos/db` business-logic functions the applicant
   portal itself calls (a dedicated program, four missions, four accepted+rated submissions,
   `createOrUpdateGraduateProfile`) rather than by driving a second full browser arc through mission
   completion — `applicant-arc.spec.ts` already proves that end-to-end, and re-proving it here would
   only slow this journey down without adding coverage.

**Rationale:** Injecting a known token is the only approach that lets a real browser session drive
`/graduates/verify` at all, given the token is a one-way hash by design (correctly — the alternative,
returning the raw token from an API response so a test could read it, would be a real security
regression for a test-only convenience). Building a mailbox-capture harness to intercept the actual
email was rejected as disproportionate: it would prove email delivery, not the recruiter-facing UI
this journey exists to cover, and no other part of this repo has that infrastructure yet.

**Alternatives considered:** Bypassing the admin's browser click entirely and calling
`approveAccessRequest` directly (as a `system` step) was considered and rejected — unlike the token
problem, nothing prevents the real "Approve & Send Email" button from being clicked and observed, and
doing so proves the button's own state transition, not just the underlying function. The token
injection is scoped as narrowly as the actual constraint requires: only the unobservable value is
harness-supplied, not the transition itself.

**Consequences:** Two real fixture bugs were found and fixed by running this journey against the live
local stack rather than trusting `scripts/regression/run.ts`'s analogous fixture read alone:
`assignWeekMissionToAcceptedApplicant` requires an `ACCEPTED` `Application` row, not just a
`TenantMembership`; and `submitSubmission`'s readiness gate requires 4 journal entries per assignment
attempt server-side (`getMissionSubmissionReadiness`), not only enforced by the applicant portal's own
date-picker UI. `docs/designs/2026-08-13-journey-e2e-evidence-design.md`'s journey list grows from
three to four. The graduate-portal/recruiter feature (PR #62) remains otherwise undocumented in
`Data_Model.md`, `Data_Dictionary.md`, `Architecture.md` (beyond the journey/regression pointers) and
the user guides — unchanged from the gap `v0.20.3` (D-103) already recorded, not newly introduced or
newly closed by this iteration.

## D-105: Full Apprenticeship Arc Through Publishing, And Per-Process Evidence Reports (v0.20.5)

**Context:** `applicant-arc.spec.ts` (`v0.20.3`) proved only the Week 1 slice of the apprenticeship
arc through a real browser — sign up, apply, accept, journal, submit, and the revision loop — then
stopped. Nothing ever drove an applicant through all four missions to graduation, and nothing ever
proved the consent-and-publish flow (the mechanism that actually puts a graduate on the public
portal) through a browser at all; that flow existed only as DB-level regression coverage
(`v0.20.3`, D-103). Separately, the combined evidence PDF (one file, one section per journey/spec
file) didn't map onto how the business actually thinks about this product: five distinct
processes — signup/approval, mission acceptance, submission/acceptance, the final mission plus
publishing, and the recruiter journey — that a reviewer would want to hand someone as five separate
documents, not one file to page through.

**Decision:**

1. **`applicant-arc.spec.ts` now drives all four missions to graduation.** Weeks 2-4 accept on the
   first submission; week 1 alone keeps the `NEEDS_REVISION` → feedback → resubmit → accepted
   sequence, so that existing proof isn't lost, and its acceptance still auto-advances week 2 the
   same way every other week's acceptance auto-advances the next
   (`reviewSubmission`'s existing `weekNumber < FINAL_PROGRAM_WEEK` branch — no new assignment
   logic was added; this journey proves existing behavior end-to-end for the first time). After
   week 4's acceptance, the applicant reaches `/dashboard`, the consent gate now shows
   (`isGraduateConsentRequired`), agreeing auto-publishes because training is complete
   (`/api/graduates/profile/acknowledge`), and a final step confirms the graduate is now
   findable in the public, unauthenticated `/graduates` directory.
2. **`tests/journeys/fixtures/tenant.ts` publishes all four weekly missions up front** instead of
   one; `JourneyTenant.missionId` becomes `missionIds: string[]`.
3. **Every journey step now carries a `process` tag** (`tests/journeys/fixtures/types.ts`'s new
   `PROCESSES` list — the 5 names above, in report order) instead of being grouped only by which
   spec file produced it.
4. **`scripts/ci/journey-pdf-report.ts` renders one PDF per process** (5 files) instead of one
   combined report with a page-break per journey, redesigned to match a reference test-report's
   structural language — eyebrow header, stat tiles, a note callout, numbered/badged step
   cards — using talentOS's own brand blue/navy rather than the reference's own unrelated color
   scheme (a layout guide, not a brand asset to copy literally).

**Rationale:** Reusing the single continuous `applicant-arc` Playwright test (rather than splitting
it into 4 independent specs, one per process) avoids each later process needing to fast-forward
through everything before it via direct database calls just to reach its own starting state — which
would mean the "submission & acceptance" process, say, never actually proves signup or mission
acceptance through a browser at all, undermining the entire point of a browser journey for that
slice. Tagging steps with a `process` field and grouping in the *report* layer gets both: one
continuous, realistic browser session, and reporting organized the way the business actually
thinks about the product.

**Alternatives considered:** Matching the reference report's exact section types (a tabular
test-case sheet, a separate screenshot gallery distinct from the request/response detail view) was
rejected — that reference mixes genuinely different content types per section (API pairs, UI
screens, a test-case table); this report has exactly one content type (an E2E step), so forcing an
artificial detail/gallery split of the same screenshots would be visual complexity without a
matching difference in the underlying data.

**Consequences:** Six real issues were found and fixed by running both journeys against the live
stack rather than trusting the code read alone — none of them application bugs (see the
test-results doc for the full list): the submission-review page's actual accept-button text and
required rating field; `DashboardConsentGate`'s transient success text being replaced by an
immediate redirect; the public directory's pagination/sort making a bare visibility assertion
fragile once more than one graduate exists in the database; `/api/graduates/request-access`
attaching every request to "the first public graduate profile" rather than the requesting run's
own, making `recruiter-access.spec.ts`'s redirect-target assertion fragile the same way; and the
applicant's Prisma `User` row never having been marked for regression cleanup at all (harmless
before this iteration, since no journey ever published a profile from it — 28 orphaned applicant
`User` rows, several already carrying a published `GraduateProfile`, had accumulated in the local
database from this session's own testing before the fix landed). `RecruiterAccessRequest` joins
`RegressionDataMarker`'s tracked entity types (`packages/db/src/regression.ts`) for the same
reason `RecruiterAccount` did in `v0.20.3` (D-103) — a resource this run creates but does not
reliably own the cleanup cascade for. `/api/graduates/profile/acknowledge`'s placeholder profile
sets `overallRating: 0` unconditionally (unlike `createOrUpdateGraduateProfile`, which computes the
real average) — now visible in this journey's own PDF evidence for the first time; recorded in
`Regression_Scenarios.md` Known Gaps as observed, not fixed, since changing it is an app-behavior
decision outside this iteration's scope.

## D-106: AI Mentor UI, RAG, Context Fix, And RBSE Unblock (v0.20.6)

**Context:** The AI Mentor was giving materially wrong answers — it told an applicant who had
never submitted Mission 1 that the mission was "Completed (100%)" and "Accepted", because the
applicant context fed the LLM `assigned=ACCEPTED` (meaning the applicant *accepted the
assignment*, i.e. started it) which the LLM misread as *mission accepted/passed*, and
`overallPercentage: 100` (task completion) which the LLM conflated with mission completion.
Separately, `"tell me about "` was in `BLOCKED_TOPICS` (intended to block "tell me about
yourself") but as a substring match it blocked every "tell me about mission 1", "tell me about
SDLC" etc. — so legitimate questions never reached the LLM and got a canned stub refusal. The
mentor also appended "Next step:" follow-up questions (instructed by the system prompt) and said
"I'm not sure" for any topic not in the hand-curated 11-entry knowledge base.

**Decision:**

1. **Per-mission readiness summary in applicant context** (`ai-context.ts`): add a `missionStatus`
   field with unambiguous per-mission status — assignment status rendered as "you accepted the
   assignment (started; NOT yet completed)" (not bare "ACCEPTED"), explicit "NOT YET SUBMITTED"
   when no submission exists, journal entry count with "(4 required before submission)", required
   task completion (X/Y), and a derived status label ("IN PROGRESS — not yet submitted" vs
   "COMPLETE"). The progress line is renamed "Task Completion" with an explicit note: "this is
   TASK completion, NOT mission completion. A mission is only complete when it has a PASSED
   submission." The context signature includes `missionStatus` so the LLM cache invalidates when
   the applicant submits, writes a journal entry, or completes a task.
2. **Remove broad RBSE blocked topics** (`ai-rbse.ts`): remove `"tell me about "` and
   `"explain about"` from `BLOCKED_TOPICS`. The precise `PERSONAL_NAME_PATTERNS` regexes +
   `NAME_PATTERN_ALLOWLIST` (which already includes "mission", "task", "SDLC", etc.) handle
   personal-name blocking correctly — "tell me about John" is blocked, "tell me about mission 1"
   is allowed.
3. **Remove follow-up question instructions** (`ai.ts`): the system prompt no longer instructs
   the LLM to "End with at most one short, purposeful follow-up question" or "Give exactly one
   small, concrete next action". Instead: "Do NOT end with a follow-up question, a 'Next step'
   prompt, or a 'What to do now' nudge. Answer the question fully and stop."
4. **Two-layer RAG** (`knowledge-base.ts` + `scripts/build-docs-index.mjs`): Layer 1 is the
   curated knowledge base (now 17 entries — 6 new: journal rules, mission lifecycle, tasks,
   submission workflow, applications, recruiter portal, calendar). Layer 2 is an auto-generated
   docs index — a build-time script reads all `docs/*.md` files, splits into 347 sections by
   markdown headers, extracts keywords, and writes `apps/applicant/data/docs-index.ts`. At query
   time, `retrieveKnowledge` searches both layers: curated entries get a +10 score boost, docs
   sections are skipped if their source file is already covered by a curated match (dedup). The
   Dockerfile runs the indexer before `next build` so the index is bundled into the standalone
   output. New features documented in `docs/` are auto-discovered on the next build — no manual
   KB update needed.
5. **Chat UI overhaul** (`page.tsx`, `MessageBubble.tsx`, `CardRenderer.tsx`): streaming-safe
   markdown (plain text + cursor while streaming, full markdown after); per-message hover actions
   (copy, regenerate, edit-and-resend, thumbs up/down); suggested questions send immediately;
   personalized welcome from applicant context + "What I know about you" disclosure panel; mobile
   hamburger drawer; live clock; real `maxLength=2000`; "Thinking…/Online" status badge; streaming
   perf fix (token updates skip sort + localStorage); conversation search/rename/pin; `MentorCard`
   type extended with `code` + `resource` kinds; all card CTAs wired (Start Task navigates, Save
   Tips persists, Share uses Web Share API).

**Rationale:** The wrong mission-status answer was the most damaging — an applicant told their
mission is "completed" when they haven't submitted it would stop working. The root cause was
ambiguous context labels, not an LLM bug; fixing the context (not patching the prompt) ensures
every future question gets correct status. The RBSE broad-filter removal is safe because the
precise regex + allowlist already handle the intended case. The RAG docs index eliminates the
entire class of "I'm not sure" answers for documented features — the knowledge base can no longer
go stale as the codebase grows, because it auto-indexes the docs on every build.

**Alternatives considered:** A CI gate that fails PRs when a dashboard page has no knowledge-base
entry was considered but rejected by the user in favor of the RAG approach — the RAG layer is
self-maintaining (developers just document in `docs/` as they already do) rather than requiring
an extra manual step per feature. Full pgvector + embeddings for semantic retrieval was deferred
— the keyword-based RAG is the MVP stepping stone, consistent with the knowledge-base module's
own "Phase 5+" comments.

**Consequences:** 6 test fixtures updated to add `missionStatus: []` (the new required
`ApplicantContext` field). One stub-response test assertion changed from `tips` card to `badge`
card (the stub no longer creates an empty tips card for a single knowledge snippet). One
knowledge-base test prompt changed from "xyz random unrelated query zzz" to pure nonsense
("zzzqqqxxxyyy asdfqwerty") because "query" now matches docs-index sections. The
`AI_Mentor_Architecture_and_Concepts.md` document was created as a comprehensive reference for
the mentor's architecture and concepts.

## D-107: Applicant Profile Photo, Apply Page Redesign, And Graduate-Profile Defaults Carry-Through (v0.20.7)

**Context:** Applicants could not add a profile photo until graduation — `GraduateProfile.profilePhotoFileId`
only exists once a `GraduateProfile` row is created, which happens at consent time, months after
apply. Separately, a `GraduateProfile` created at consent time (decline, skip, or acknowledge) was
always a blank placeholder: `bio`, `linkedinUrl`, `githubUrl`, and the photo all started empty even
though the applicant had already given GitHub/LinkedIn URLs (and, as of this iteration, a photo)
at apply time — forcing every graduate to re-enter the same information from scratch via
`GraduateProfileForm` before publishing.

**Decision:**

1. **`User.avatarFileId`** (new, unique, nullable `StoredFile` relation): an applicant-level
   profile photo, uploaded optionally during `/apply`'s `submitApplication`, validated identically
   to the existing graduate-photo route (JPEG/PNG/WebP, 2 MB cap, magic-byte signature check via
   the existing `hasValidImageSignature`). Kept as its own field rather than reusing
   `GraduateProfile.profilePhotoFileId` directly, since a `GraduateProfile` row may not exist yet
   for an in-program applicant.
2. **`getGraduateProfileDefaults(userId)`** (`packages/db/src/graduates.ts`): reads the
   applicant's most recent `ACCEPTED` application's `githubUrl`/`linkedinUrl` and their
   `User.avatarFileId`, returning nulls (never fabricated values) when nothing exists to carry
   over. Wired into all three `GraduateProfile`-creation call sites —
   `declineGraduateProfilePublishing`, `skipGraduateConsent`, and the `acknowledge` route — but
   only on the **create** branch of each, never on update, so a graduate's own later edits via
   `GraduateProfileForm` are never silently overwritten by apply-time data.
3. **Apply page redesign** (`apps/applicant/app/apply/page.tsx`,
   `apps/applicant/app/apply/ApplyUploadFields.tsx`): emoji glyphs replaced with `lucide-react`
   icons; the plain CV file input replaced with a real drag-and-drop dropzone (drag-over state,
   selected-file confirmation, client-side type/size feedback); the identity chip gained a
   circular avatar-upload control with live preview. Deliberately stayed within the existing
   tenant-brand token system (`brand-blue`/`brand-navy`/`brand-mist` are per-tenant CSS variables
   set via `brandStyleBlock`) rather than introducing a new fixed palette or font, since a
   bespoke one-off look on this page would break every tenant's white-labeling.

**Consequences:** Migration `20260821190000_v0_20_7_user_avatar` adds `users.avatarFileId`. Three
new `public-portal` regression scenarios cover the defaults-present, defaults-absent, and
no-overwrite-on-update cases. The apply-time photo upload and its validation are verified manually
(Playwright end-to-end + code review against the existing graduate-photo route's identical
validation order) rather than added to `scripts/regression/run.ts`, consistent with the
pre-existing CV upload validation in the same file, which has never had regression-suite coverage
either — see `docs/plans/v0.20.7_Applicant_Profile_Photo_And_Graduate_Defaults.md` Out of Scope.
`GraduateConsentModal.tsx` still renders `GraduateProfileForm` with no `initialData`, so a
graduate opening the edit form after this iteration sees blank fields despite their carried-over
values already being saved and live on their public profile — a pre-existing gap this iteration
does not close, noted explicitly so it isn't mistaken for newly introduced.

**Version note:** this work was informally tracked as `v0.20.6` mid-session, but
`origin/main` gained an unrelated `v0.20.6` (`AI Mentor UI, RAG, Context Fix, And RBSE Unblock`,
D-106, PR #70) while this iteration was in progress. Re-running the version-allocation check
caught the collision before any doc was committed; this iteration is `v0.20.7`, and its one
migration folder/DB record were renamed from the `v0.20.6` placeholder to match before deploying.
