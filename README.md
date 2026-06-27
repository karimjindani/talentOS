# TalentOS

Current documentation version: `v0.2.2`

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

## Current Implementation

The current scaffold includes:

- Separate Applicant Portal application in `apps/applicant`.
- Separate Admin Portal application in `apps/admin`.
- PostgreSQL database with Prisma schema.
- Docker Compose local deployment.
- Shared UI package in `packages/ui`.
- Shared auth/security utilities in `packages/auth`.
- Shared Prisma/database package in `packages/db`.
- AI mentor service boundary stub.
- SSDLC documentation for architecture, data model, data dictionary, deployment and testing.

## Local Validation URLs

When the local Docker deployment is running:

- Applicant portal: http://localhost:3100
- Applicant apply page: http://localhost:3100/apply
- Applicant signup page: http://localhost:3100/signup
- Applicant login page: http://localhost:3100/login
- Applicant 2FA setup page: http://localhost:3100/2fa/setup
- Applicant application page: http://localhost:3100/application
- Admin portal: http://localhost:3200
- Admin applications: http://localhost:3200/applications
- Admin programs: http://localhost:3200/programs
- Admin settings: http://localhost:3200/settings

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