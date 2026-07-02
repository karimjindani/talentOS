# Testing Strategy

Code version: `v0.10.3`

Baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

## Goals

Testing must preserve previously committed and tested work on every iteration.

The regression suite starts with security, tenant isolation and application workflow utilities, then expands as the applicant/admin portals become persistent.

## Test Levels

### Unit Tests

- Tenant resolution from host/subdomain.
- Role authorization (admin-portal access for SUPER_ADMIN / ORG_ADMIN / HR / TECH_LEAD; APPLICANT denied).
- Capability matrix (`can(capability, { platformRole, orgRole })`).
- Keycloak realm-role mapping and access-token decoding (`packages/auth-web`).
- Cross-tenant access rejection.
- Password hashing and verification.
- TOTP generation and verification.
- Application status transitions.

### Auth / RBAC Tests (v0.3.0)

- Keycloak realm OIDC discovery is reachable.
- Unauthenticated admin routes redirect to Keycloak sign-in; the applicant `/application` redirects to `/login`.
- Authenticated APPLICANT is sent to `/forbidden` on the admin portal; admin-capable roles reach admin routes.
- Super Admin first login forces password change and TOTP setup (Keycloak required actions).
- Applicant self-signup (`v0.7.1`): Keycloak registration is enabled, a new account defaults to APPLICANT,
  and the new applicant can sign in and reach `/apply`.

### Application Lifecycle Tests (v0.5.0)

- `nextStatusesFor` exposes only valid reviewer transitions per status (unit, `workflow.test.ts`).
- Authenticated apply creates a `SUBMITTED` application with answers and an `application.submitted`
  audit row; duplicate active applications per program are blocked.
- Admin review enforces `reviewApplications` (TECH_LEAD denied), valid status transitions only, and
  writes `application.status_changed`; the applicant sees the updated status.

### Programs Management Tests (v0.6.0)

- Program state machine (`canTransitionProgramStatus`/`nextProgramStatuses`) offers only valid
  `DRAFT ⇄ PUBLISHED ⇄ ARCHIVED` transitions (unit, `workflow.test.ts`).
- Admin program CRUD enforces `managePrograms` (HR/TECH_LEAD read-only), is tenant-scoped, and writes
  `program.created`/`program.updated`/`program.status_changed` audit rows.
- Only `PUBLISHED` programs appear on the applicant apply form; archiving removes them.

### Tenant Settings & Organizations Tests (v0.9.0 / v0.10.0)

- `manageTenantSettings` is granted only to ORG_ADMIN/SUPER_ADMIN; branding writes are hex-validated
  and audited (`tenant.branding_updated`).
- `createOrganization` is SUPER_ADMIN-only; `isValidTenantSlug` rejects non-DNS-safe slugs
  (unit, `auth.test.ts`); tenant creation writes `organization.created` and an ORG_ADMIN membership.

### Keycloak OTP Policy Guard (v0.10.1)

- The realm import declares `otpPolicyType: "totp"` with a non-zero `otpPolicyPeriod` and
  `otpPolicyDigits` (unit, `realm-otp.test.ts`) — guards against the divide-by-zero that broke
  first-login TOTP enrollment.

### SSO Logout Tests (v0.10.2)

- `buildEndSessionUrl` emits `id_token_hint` when available and falls back to `client_id`, always sets
  `post_logout_redirect_uri`, and normalizes the issuer (unit, `logout.test.ts`).
- Manual/endpoint check: a registered `post_logout_redirect_uri` returns 302 from the Keycloak
  `end_session_endpoint`; an unregistered host returns 400 (no open redirect).

### Object Storage Tests (v0.7.0)

- `sanitizeFilename`/`buildObjectKey` produce safe, tenant-namespaced keys (unit, `keys.test.ts`).
- Presigned upload then download round-trips the bytes; `StoredFile` rows + `file.created`/`file.deleted`
  audit entries are written.
- The bucket is private: unsigned direct object access is denied (403).
- File access is tenant-scoped: a file id from another tenant is not resolvable.

### Integration Tests

Planned integration tests:

- applicant Keycloak login to application submission (signup/2FA are owned by Keycloak),
- admin login to application review to status update,
- tenant A admin cannot access tenant B application data.

### Security Tests

- Unauthenticated admin access is blocked.
- Applicant role cannot access admin-only actions.
- Secrets are not logged.
- Cross-tenant reads and writes are rejected.

### Deployment Tests

- Docker Compose starts PostgreSQL and the isolated applicant and admin web containers.
- Prisma migrations complete.
- Smoke tests confirm the applicant portal (`http://localhost:3100`) and admin portal (`http://localhost:3200`, routes served at root) load.
- Module isolation: each web container returns 404 for the other module's routes (admin routes on the applicant container and applicant routes on the admin container).

## Regression Rule

Every implementation iteration must add or update tests for newly committed behavior and keep the existing suite passing.

From `v0.2.0`, the regression baseline also covers deployment-level module isolation: the applicant and administrator containers must continue to start independently and reject each other's routes.

From `v0.3.0`, the regression baseline also covers IAM/RBAC: Keycloak must start and import the realm, both portals must authenticate via OIDC, and the admin portal must reject non-admin roles.

From `v0.5.0`, the regression baseline also covers the application lifecycle: authenticated apply must
persist a submitted application, admin review must enforce `reviewApplications` and valid status
transitions, and every submit/decision must write an `AuditLog` entry.

From `v0.6.0`, the regression baseline also covers programs management: admin program CRUD must enforce
`managePrograms` and valid status transitions, only published programs may appear on the apply form, and
every program write must record an `AuditLog` entry.

From `v0.7.0`, the regression baseline also covers object storage: MinIO must start with a private
bucket, presigned upload/download must round-trip, file metadata must be tenant-scoped, and file
create/delete must record an `AuditLog` entry.

From `v0.8.0`, the regression baseline also covers local operations safety: the Admin Operations page
must not execute host Docker/npm commands, health checks must use app-visible dependencies, and
regression cleanup must delete only explicitly marked `RegressionDataMarker` records.

From `v0.10.3`, the regression baseline also covers per-tenant authorization: `tenantRolesGrant` must
grant a capability only when the actor's tenant-scoped roles include it (unit,
`packages/auth/src/permissions.test.ts`), and an actor must never authorize an admin action in a tenant
they hold no `TenantMembership` in (a realm-wide role no longer suffices). The current regression suite
is **62 tests**.
