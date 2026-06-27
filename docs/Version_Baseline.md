# Version Baseline

## Current Baseline

Version: `v0.1.1`

Baseline name: `Local Docker Deployment Enablement`

Baseline code commit: `3cb7dcf78e56a9c916a02216763e0c0f2cd27c32`

Baseline date: `2026-06-27`

Previous baseline: `v0.1.0`

Previous baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

## Baseline Summary

`v0.1.1` establishes local Docker deployment support with configurable host ports.

`v0.1.0` remains the first platform architecture baseline.

This baseline includes:

- configurable Docker Compose host ports through `WEB_PORT` and `POSTGRES_PORT`,
- local deployment validation on `http://localhost:3100`,
- Next.js TypeScript application scaffold in `apps/web`.
- Public Applicant Portal route shell.
- Program Admin Portal route shell.
- Shared PostgreSQL data model using Prisma.
- Docker Compose services for `web` and `postgres`.
- Auth/security utilities for password hashing, TOTP 2FA, role checks, tenant resolution, tenant isolation, and application workflow transitions.
- AI mentor service boundary stub.
- SSDLC-required documentation for architecture, data model, data dictionary, deployment, and testing.

## Portal Scope

Public Applicant Portal routes included in `v0.1.0`:

- `/`
- `/apply`
- `/signup`
- `/login`
- `/2fa/setup`
- `/application`

Program Admin Portal routes included in `v0.1.0`:

- `/admin`
- `/admin/applications`
- `/admin/applications/[id]`
- `/admin/programs`
- `/admin/settings`

## Package Scope

Packages included in `v0.1.0`:

- `apps/web`
- `packages/auth`
- `packages/db`

## Documentation Rule

All future documentation updates must reference the relevant code version.

All future implementation plans must be stored in `docs/plans/`.

All future testing details and results must be stored in `docs/testing/`.

## Versioning Convention

TalentOS uses semantic versioning:

- Patch versions, such as `v0.1.1`, are used for documentation fixes or small non-breaking implementation updates.
- Minor versions, such as `v0.2.0`, are used for new product capabilities.
- Major version `v1.0.0` is reserved for the first production-ready release.
