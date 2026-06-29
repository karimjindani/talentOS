# TalentOS Documentation Overview

Code/documentation version: `v0.5.0`

TalentOS is an AI-powered Talent Discovery, Learning and Recruitment Platform.

The platform is designed to bridge the gap between AI-assisted coding and production-grade software engineering. Participants learn by building real software products from Day 1 using the Spiral Engineering Method (SEM).

## Current Status

Status: Initial separated-portal platform scaffold / Local Docker baseline.

TalentOS is no longer only in product discovery. The repository now contains separated Applicant and Admin Next.js applications, Docker Compose deployment support, shared packages and versioned architecture documentation.

Version history:

- `v0.1.0`: Initial platform architecture scaffold.
- `v0.1.1`: Local Docker deployment baseline.
- `v0.1.2`: Architecture engineering backlog direction, including Keycloak IAM and separate portal direction.
- `v0.2.0`: Applicant and administrator modules isolated into separate applications and containers.
- `v0.2.1`: Applicant portal no longer exposes administrator navigation.
- `v0.2.2`: README and documentation landing update.
- `v0.3.0`: Keycloak as the live IAM with OIDC authentication and admin-portal RBAC.
- `v0.4.0`: First Alibaba Cloud ECS deployment baseline (public-IP validation).
- `v0.5.0`: Applications lifecycle — authenticated apply → submit → admin review (accept/reject/waitlist).

## Platform Capabilities

TalentOS supports or is designed to support:

- Multi-company SaaS.
- White-label deployments.
- AI mentoring.
- Mission-based learning.
- Production readiness evaluation.
- Public engineering portfolios.
- Recruitment pipelines.

## Current Scaffold

The current implementation includes:

- Public Applicant Portal application in `apps/applicant`.
- Program Admin Portal application in `apps/admin`.
- Docker Compose local deployment.
- PostgreSQL data model with Prisma.
- Tenant-aware data model foundations.
- Shared UI package in `packages/ui`.
- Security utilities for password hashing, TOTP, role checks and tenant isolation.
- Applications lifecycle: authenticated apply → submit and admin review (accept/reject/under-review/waitlist), tenant-scoped and audited.
- AI mentor boundary stub.

## Target Architecture Direction

The current scaffold has already separated applicant and admin surfaces into different applications and containers.

The target architecture continues toward:

- Keycloak as the IAM system.
- Separate Applicant Portal.
- Separate Admin Portal.
- Shared platform services for IAM, data access, audit logging, AI, GitHub integration, portfolio and certificates.

## Local Validation URLs

When local Docker deployment is running:

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

## Key Documents

- [Architecture](Architecture.md)
- [Product Backlog](Product_Backlog.md)
- [Version Baseline](Version_Baseline.md)
- [Deployment](Deployment.md)
- [Testing Strategy](Testing_Strategy.md)
- [Decision Log](Decision_Log.md)
- [Data Model](Data_Model.md)
- [Data Dictionary](Data_Dictionary.md)
- [SSDLC Principles](sdlc.md)
- [Spiral Engineering Method](SEM.md)