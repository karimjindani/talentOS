# Testing Strategy

## Goals

Testing must preserve previously committed and tested work on every iteration.

The regression suite starts with security, tenant isolation and application workflow utilities, then expands as the applicant/admin portals become persistent.

## Test Levels

### Unit Tests

- Tenant resolution from host/subdomain.
- Role authorization.
- Cross-tenant access rejection.
- Password hashing and verification.
- TOTP generation and verification.
- Application status transitions.

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

- Docker Compose starts PostgreSQL and the web app.
- Prisma migrations complete.
- Smoke tests confirm the public portal, login, 2FA setup and admin shell load.

## Regression Rule

Every implementation iteration must add or update tests for newly committed behavior and keep the existing suite passing.
