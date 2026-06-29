# Testing Strategy

Code version: `v0.5.0`

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

### Application Lifecycle Tests (v0.5.0)

- `nextStatusesFor` exposes only valid reviewer transitions per status (unit, `workflow.test.ts`).
- Authenticated apply creates a `SUBMITTED` application with answers and an `application.submitted`
  audit row; duplicate active applications per program are blocked.
- Admin review enforces `reviewApplications` (TECH_LEAD denied), valid status transitions only, and
  writes `application.status_changed`; the applicant sees the updated status.

### Integration Tests

Planned integration tests:

- applicant signup to 2FA setup to application submission,
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
