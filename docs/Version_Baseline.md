# Version Baseline

## Current Baseline

Version: 0.2.2

Baseline name: README and Documentation Landing Update

Baseline code commit: $previousCommit

Baseline date: 2026-06-27

Previous baseline: 0.2.1

Previous baseline commit: $previousCommit

## Baseline Summary

0.2.2 is a documentation-only update that refreshes the root README and documentation overview after the separated-portal implementation.

This documentation update records:

- Current implementation status in the root README.
- Current documentation overview in docs/README.md.
- Local validation URLs for the applicant portal on 3100 and admin portal on 3200.
- Keycloak and shared-platform-service direction for upcoming engineering work.

0.2.1 removed all administrator navigation from the applicant application: the applicant portal no longer renders an Admin link, and the applicant container drops the now-unused NEXT_PUBLIC_ADMIN_URL configuration. This completes the module isolation so the public applicant surface exposes nothing about the administrator module. No schema change.

0.2.0 isolated the applicant and administrator modules into two separate Next.js applications, each running in its own Docker container, sharing only the packages/* libraries. There was no Prisma schema change in that baseline. It realized the portal-separation direction recorded in 0.1.2.

0.1.2 was a documentation-only update that established the architecture engineering backlog direction: Keycloak as the target IAM system, separate Applicant and Admin portals, and architecture-level Engineering To-Do tracking mapped from the Product Backlog.

0.1.1 established local Docker deployment support with configurable host ports.

0.1.0 remains the first platform architecture baseline.

This baseline includes:

- separate applicant (pps/applicant) and administrator (pps/admin) applications,
- two isolated containers (	alentos-applicant on 3100, 	alentos-admin on 3200) built from one parameterized root Dockerfile,
- a shared front-end package packages/ui (StatusCard, tenant header helper, Tailwind brand preset),
- administrator routes served at the container root (no /admin prefix),
- verified runtime isolation (each container returns 404 for the other module's routes),
- Docker Compose services for pplicant, dmin and postgres,
- the unchanged packages/auth regression suite (9 tests) still passing.

Carried forward from earlier baselines: the shared PostgreSQL data model using Prisma; auth/security utilities for password hashing, TOTP 2FA, role checks, tenant resolution, tenant isolation and application workflow transitions; the AI mentor service boundary stub; and SSDLC documentation for architecture, data model, data dictionary, deployment and testing.

## Portal Scope

Public Applicant Portal routes (pps/applicant, container 	alentos-applicant):

- /
- /apply
- /signup
- /login
- /2fa/setup
- /application

Program Admin Portal routes (pps/admin, container 	alentos-admin, served at root):

- /
- /applications
- /applications/[id]
- /programs
- /settings

## Package Scope

Packages and apps included in 0.2.0 and carried through 0.2.2:

- pps/applicant
- pps/admin
- packages/auth
- packages/db
- packages/ui

## Documentation Rule

All future documentation updates must reference the relevant code version.

All future implementation plans must be stored in docs/plans/.

All future testing details and results must be stored in docs/testing/.

## Versioning Convention

TalentOS uses semantic versioning:

- Patch versions, such as 0.2.2, are used for documentation fixes or small non-breaking implementation updates.
- Minor versions, such as 0.3.0, are used for new product capabilities.
- Major version 1.0.0 is reserved for the first production-ready release.