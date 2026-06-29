# TalentOS

TalentOS is a platform for developing AI-native software engineers through real, production-oriented work rather than passive coursework. Its core learning model is the Spiral Engineering Method (SEM): participants repeatedly complete the full engineering lifecycle — discover, analyze, specify, design, build, test, deploy, present, reflect, and review production readiness — from the very first week, with each cycle increasing in complexity. The platform treats AI as a mentor and accelerator, not a substitute for thinking, and is designed to help learners build secure, maintainable, deployable software while producing a public portfolio that organizations can use for talent discovery and recruitment.

Current documentation version: `v0.7.0`

TalentOS is an AI-powered Talent Discovery, Learning and Recruitment Platform designed to bridge the gap between AI-assisted coding and production-grade software engineering.

Participants learn by building real software products from Day 1 using the Spiral Engineering Method (SEM). Every mission is intended to move through discovery, analysis, specification, design, build, test, deployment, presentation, reflection and production readiness review.

## Current Status

TalentOS has moved beyond product discovery into an initial platform scaffold with separated applicant and administrator modules.

- `v0.1.0`: Initial platform architecture scaffold.
- `v0.1.1`: Local Docker deployment baseline.
- `v0.1.2`: Architecture engineering backlog direction.
- `v0.2.0`: Applicant and administrator modules isolated into separate Next.js applications and containers.
- `v0.2.1`: Applicant portal no longer exposes administrator navigation.
- `v0.2.2`: README and documentation landing update.
- `v0.3.0`: Keycloak as the live IAM with OIDC authentication and admin-portal RBAC.
- `v0.4.0`: First Alibaba Cloud ECS deployment baseline (public-IP validation).
- `v0.5.0`: Applications lifecycle — authenticated apply → submit → admin review (accept/reject/waitlist).
- `v0.6.0`: Programs management — admin CRUD (create/edit/publish/archive); published programs feed the apply form.
- `v0.7.0`: Object storage foundation — self-hosted MinIO (S3-compatible) with presigned upload/download and tenant-scoped file metadata.

## Current Implementation

The current scaffold includes:

- Separate Applicant Portal application in `apps/applicant`.
- Separate Admin Portal application in `apps/admin`.
- PostgreSQL database with Prisma schema.
- Docker Compose local deployment.
- Shared UI package in `packages/ui`.
- Shared auth/security utilities in `packages/auth`.
- Shared Prisma/database package in `packages/db` with application-lifecycle data-access helpers.
- Applications lifecycle: authenticated apply → submit and admin review (accept/reject/under-review/waitlist), tenant-scoped and audited.
- Programs management: admin CRUD (create/edit/publish/archive) gated by `managePrograms`; published programs feed the apply form.
- Object storage: self-hosted MinIO (S3-compatible) with presigned upload/download and tenant-scoped `StoredFile` metadata.
- AI mentor service boundary stub.
- SSDLC documentation for architecture, data model, data dictionary, deployment and testing.

## Local Validation URLs

When the local Docker deployment is running:

- Applicant portal: http://localhost:3100
- Applicant login page (Keycloak sign-in): http://localhost:3100/login
- Applicant apply page (authenticated): http://localhost:3100/apply
- Applicant application page (authenticated): http://localhost:3100/application
- Admin portal: http://localhost:3200
- Admin applications: http://localhost:3200/applications
- Admin programs: http://localhost:3200/programs
- Admin settings: http://localhost:3200/settings
- Keycloak admin console: http://localhost:8080

Signup, password policy and authenticator-app 2FA are owned by Keycloak as of `v0.3.0` (there are no
`/signup` or `/2fa/setup` pages in the applicant portal).

The applicant portal must not expose administrator navigation.

## Architecture Direction

TalentOS is designed as a multi-tenant, white-label SaaS platform.

Current architecture:

- Applicant and admin portals are separate Next.js applications.
- Applicant and admin portals run in separate Docker containers.
- PostgreSQL is the primary database.
- Prisma is used for data modeling and migrations.
- Docker Compose is the first deployment target.

Target architecture:

- Keycloak is the target IAM system.
- Shared platform services should handle IAM, database access, audit logging, AI, GitHub integration and certificates.
- Applicant and admin portals should remain independently deployable, scalable and securable.

## Engineering Backlog Summary

Near-term engineering direction:

1. IAM with Keycloak.
2. Applications module persistence.
3. Programs module.
4. Missions module.
5. AI Mentor boundary.
6. Knowledge Base.
7. GitHub Integration.
8. Portfolio.
9. Certificates.
10. Leaderboard.
11. Hiring Recommendations.

## Important Documentation

- [Product overview](docs/README.md)
- [Architecture](docs/Architecture.md)
- [Product Backlog](docs/Product_Backlog.md)
- [Version Baseline](docs/Version_Baseline.md)
- [Deployment](docs/Deployment.md)
- [Testing Strategy](docs/Testing_Strategy.md)
- [Decision Log](docs/Decision_Log.md)
- [SSDLC principles](docs/sdlc.md)

## Repository Structure

- `apps/applicant`: public applicant portal.
- `apps/admin`: program administrator portal.
- `packages/ui`: shared UI components and Tailwind brand preset.
- `packages/auth`: authentication, authorization and tenant security utilities.
- `packages/db`: Prisma schema, migrations and database client.
- `docs`: product, architecture, planning, deployment and testing documentation.

## Development Standard

Per SSDLC rules:

- Every plan must be stored in Markdown under `docs/plans/`.
- Every version must include Markdown testing details under `docs/testing/`.
- Architecture, deployment, data model and data dictionary documentation must stay current with each iteration.
- Security must be designed from the first iteration.
