# Version Baseline

## Current Baseline

Version: `v0.2.1`

Baseline name: `Applicant Admin-Link Removal`

Baseline code commit: `pending`

Baseline date: `2026-06-27`

Previous baseline: `v0.2.0`

Previous baseline commit: `fc0a690b71ef01cc07a3e5711d163040296f6a96`

## Baseline Summary

`v0.2.1` removes all administrator navigation from the applicant application: the applicant portal no
longer renders an `Admin` link, and the applicant container drops the now-unused `NEXT_PUBLIC_ADMIN_URL`
configuration. This completes the module isolation so the public applicant surface exposes nothing about
the administrator module. No schema change.

`v0.2.0` isolated the applicant and administrator modules into two separate Next.js applications, each
running in its own Docker container, sharing only the `packages/*` libraries. There was no Prisma
schema change in that baseline. It realized the portal-separation direction recorded in `v0.1.2`.

`v0.1.2` was a documentation-only update that established the architecture engineering backlog
direction: Keycloak as the target IAM system, separate Applicant and Admin portals, and
architecture-level Engineering To-Do tracking mapped from the Product Backlog.

`v0.1.1` established local Docker deployment support with configurable host ports.

`v0.1.0` remains the first platform architecture baseline.

This baseline includes:

- separate applicant (`apps/applicant`) and administrator (`apps/admin`) applications,
- two isolated containers (`talentos-applicant` on `3100`, `talentos-admin` on `3200`) built from one parameterized root `Dockerfile`,
- a shared front-end package `packages/ui` (StatusCard, tenant header helper, Tailwind brand preset),
- administrator routes served at the container root (no `/admin` prefix),
- verified runtime isolation (each container returns 404 for the other module's routes),
- Docker Compose services for `applicant`, `admin` and `postgres`,
- the unchanged `packages/auth` regression suite (9 tests) still passing.

Carried forward from earlier baselines: the shared PostgreSQL data model using Prisma; auth/security
utilities for password hashing, TOTP 2FA, role checks, tenant resolution, tenant isolation and
application workflow transitions; the AI mentor service boundary stub; and SSDLC documentation for
architecture, data model, data dictionary, deployment and testing.

## Portal Scope

Public Applicant Portal routes (`apps/applicant`, container `talentos-applicant`):

- `/`
- `/apply`
- `/signup`
- `/login`
- `/2fa/setup`
- `/application`

Program Admin Portal routes (`apps/admin`, container `talentos-admin`, served at root):

- `/`
- `/applications`
- `/applications/[id]`
- `/programs`
- `/settings`

## Package Scope

Packages and apps included in `v0.2.0`:

- `apps/applicant`
- `apps/admin`
- `packages/auth`
- `packages/db`
- `packages/ui`

## Documentation Rule

All future documentation updates must reference the relevant code version.

All future implementation plans must be stored in `docs/plans/`.

All future testing details and results must be stored in `docs/testing/`.

## Versioning Convention

TalentOS uses semantic versioning:

- Patch versions, such as `v0.1.1`, are used for documentation fixes or small non-breaking implementation updates.
- Minor versions, such as `v0.2.0`, are used for new product capabilities.
- Major version `v1.0.0` is reserved for the first production-ready release.
