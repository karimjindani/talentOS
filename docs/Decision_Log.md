# Decision Log

Code version: `v0.11.4`

Architecture baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

Current documentation update: `v0.11.2`

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

`v0.11.3` fixes a crash-looping Keycloak that broke authentication for the whole platform on any fresh deployment. Root cause: the `talentos-provisioner` service-account client added in `v0.11.0` (D-053) was written into the realm import `keycloak/import/talentos-realm.json` with an **invalid `serviceAccountClientRoles` field** on its `ClientRepresentation`. Keycloak's import parser rejects unknown fields and aborts at the JSON-parse step — before the realm-exists check — so `start-dev --import-realm` fails on **every** startup (fresh or existing) and Keycloak crash-loops; OIDC discovery is unreachable and no portal can authenticate. The defect escaped v0.11.0 testing because that iteration validated the provisioner only via a **live `kcadm.sh` patch** on a running realm, never the baked-in import against a clean volume. Decision: remove the invalid field and express the service account's realm-management roles the **canonical import way** — a `service-account-talentos-provisioner` user in the realm `users` array with `serviceAccountClientId: "talentos-provisioner"` and `clientRoles: { "realm-management": ["manage-users", "view-realm", "query-users"] }`. The client itself (confidential, `serviceAccountsEnabled`, secret) is unchanged. Verified with a destructive fresh-import test (wiped the `keycloak-postgres` volume): Keycloak boots, the realm imports with no error, the provisioner authenticates via `client_credentials`, and the Admin `/users` API returns 200. No application code, schema, or data-model change. The v0.11.0 unit test `apps/admin/lib/keycloak-admin.test.ts` was updated because it had asserted the presence of the invalid `serviceAccountClientRoles` field (locking in the broken config); it now checks the canonical service-account user + `clientRoles`. The Vitest regression suite stays at 78 tests (assertion updated, not added), and the fix is validated end-to-end via the deployment/fresh-import test. Recommended follow-up (not in this patch): a CI realm-import boot/lint check so a malformed import cannot silently reach `main` again.

Status: Approved

## D-058

`v0.11.4` is a UI-only polish iteration addressing three UX gaps. (1) **Applicant Apply page redesign** (`apps/applicant/app/apply/page.tsx`): the plain form was replaced with a professional, branded, card-based layout — header banner with 📝 icon, sectioned form (Program & Motivation / Documents / Profile Links), styled inputs with focus rings, dashed-border upload zone, full-width submit button with hover state. Decision: use existing brand tokens (`brand-navy`/`brand-blue`/`brand-mist`) — no new colors or dependencies. Server action `submitApplication` is unchanged; only the JSX render section was replaced. (2) **Admin sidebar active-state indicator** (`apps/admin/components/SidebarNav.tsx`, NEW): the inline `<nav>` in `layout.tsx` was extracted into a client component using `usePathname()` to apply `bg-brand-blue text-white font-semibold` to the active link. Decision: exact match for `/` (Overview), `startsWith` for all others so nested routes (`/applications/123`) highlight the parent ("Applications"). Active style is high-contrast to be clearly distinguishable from the hover state. Works for all admin roles; "Organizations" remains SUPER_ADMIN-only. (3) **Review page back button** (`apps/admin/app/applications/[id]/page.tsx`): added "← Back to Applications" link at the top. Decision: inline link with arrow (not a full button) to keep the page header clean. No schema, data-model, or security change. The regression suite grew to 101 tests (12 new `SidebarNav.test.ts` covering route-matching logic: exact match, startsWith match, cross-route isolation, NAV_ITEMS integrity).

Status: Approved
