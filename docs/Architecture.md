# TalentOS Architecture

Code version: `v0.2.0`

Architecture baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

Current documentation update: `v0.2.0`

## Overview

TalentOS is a Dockerized, multi-tenant, white-label SaaS platform for talent discovery, mission-based learning and recruitment.

The platform exposes two portals, and as of `v0.2.0` each portal is an isolated application running in its own container:

- Public Applicant Portal (`apps/applicant`, container `talentos-applicant`) for landing pages, signup, 2FA setup and applications.
- Program Admin Portal (`apps/admin`, container `talentos-admin`) for tenant owners/admins to review applications, manage programs and inspect audit activity.

The two modules share only the `packages/*` libraries (`auth`, `db`, `ui`). They no longer share a process or attack surface, so they can be deployed, scaled and secured independently.

`v0.2.0` realizes this separation at the container level: the applicant and admin modules are built and deployed as independent Next.js containers. A shared platform API and Keycloak IAM remain the forward-looking target described below.

The architecture follows the SSDLC principle that every iteration updates architecture, data model, deployment and testing documentation.

## Container Topology

| Module | App | Container | Host port | Internal port |
| --- | --- | --- | --- | --- |
| Applicant | `apps/applicant` | `talentos-applicant` | `3100` (`APPLICANT_PORT`) | `3000` |
| Administrator | `apps/admin` | `talentos-admin` | `3200` (`ADMIN_PORT`) | `3000` |
| Database | `packages/db` | `talentos-postgres` | `55432`/`5432` (`POSTGRES_PORT`) | `5432` |

## Technology Stack

- Next.js with TypeScript for the web application and server routes.
- PostgreSQL for primary data storage.
- Prisma for database schema, migrations and typed data access.
- Tailwind CSS for maintainable UI foundations.
- Docker Compose for local and VPS deployment.
- TOTP-compatible 2FA for applicant/admin authentication.

## Runtime Components

```mermaid
flowchart LR
    Applicant["Applicant Browser"] --> AppWeb["talentos-applicant (Next.js)"]
    Admin["Admin Browser"] --> AdminWeb["talentos-admin (Next.js)"]
    AppWeb --> Auth["Auth + 2FA Utilities"]
    AdminWeb --> Auth
    AppWeb --> DB["PostgreSQL"]
    AdminWeb --> DB
    AppWeb --> AI["AI Service Boundary (Stub)"]
    DB --> Audit["Audit Logs"]
```

## Target Runtime Components

The future target architecture separates applicant and admin portal concerns while sharing platform services.

```mermaid
flowchart LR
    Applicant["Applicant Browser"] --> ApplicantPortal["Applicant Portal"]
    Admin["Admin Browser"] --> AdminPortal["Admin Portal"]
    ApplicantPortal --> Keycloak["Keycloak IAM"]
    AdminPortal --> Keycloak
    ApplicantPortal --> API["Platform API"]
    AdminPortal --> API
    API --> DB["PostgreSQL"]
    API --> AI["AI Mentor Boundary"]
    API --> GitHub["GitHub Integration"]
    API --> Audit["Audit Logs"]
```

## Portal Layout

The applicant and admin routes live in separate containers. Cross-module navigation crosses host
boundaries (`NEXT_PUBLIC_ADMIN_URL` / `NEXT_PUBLIC_APPLICANT_URL`), and each container returns 404 for
the other module's routes.

```mermaid
flowchart TD
    subgraph Applicant["talentos-applicant :3100"]
      Landing["/"] --> Apply["/apply"]
      Landing --> Signup["/signup"]
      Signup --> TwoFA["/2fa/setup"]
      Signup --> Application["/application"]
      Login["/login"] --> Application
    end
    subgraph AdminC["talentos-admin :3200"]
      AdminHome["/"] --> Applications["/applications"]
      Applications --> Detail["/applications/[id]"]
      AdminHome --> Programs["/programs"]
      AdminHome --> Settings["/settings"]
    end
    Landing -. NEXT_PUBLIC_ADMIN_URL .-> AdminHome
    AdminHome -. NEXT_PUBLIC_APPLICANT_URL .-> Landing
```

## Portal Separation Direction

`v0.2.0` separated the applicant and admin routes into two independently deployable containers (`talentos-applicant` and `talentos-admin`). The remaining engineering target is:

- Separate Applicant Portal for public landing, signup, application, learning missions and portfolio experience.
- Separate Admin Portal for tenant owner/admin operations, program management, application review, mission configuration, knowledge base management and hiring recommendations.
- Shared platform services for IAM, database access, audit logging, AI, GitHub integration and certificates.
- Independent deployment path for each portal so scaling, security policy and release cadence can diverge when needed.

## Multi-Tenancy

TalentOS uses a shared PostgreSQL database with tenant-scoped records.

- Tenants are resolved from subdomains such as `demo.talentos.app`.
- Local development supports tenant simulation with hosts such as `demo.localhost`.
- Tenant-owned entities include `tenantId`.
- Application code must enforce tenant isolation before reading or mutating tenant-owned data.

## Security Model

- Passwords are hashed before storage.
- Applicants and admins are guided toward authenticator-app TOTP setup.
- Keycloak is the target IAM system for authentication, identity federation, MFA policy and role/session management.
- Admin access is limited to `OWNER` and `ADMIN` tenant roles.
- Cross-tenant access is rejected by shared authorization utilities.
- Sensitive actions are recorded in `AuditLog`.
- AI workflow boundaries are explicit so future AI mentor activity can be audited.

## Scalability

The web application is stateless and can run multiple containers behind a reverse proxy.

For 1,000 simultaneous applicants, the first scaling path is:

- multiple web containers,
- PostgreSQL indexes and connection pooling,
- background workers for long-running AI, email and GitHub jobs,
- caching for public tenant/program content.

## Deployment

The deployment target is Docker Compose on a VPS with:

- `applicant` service running the applicant Next.js application,
- `admin` service running the administrator Next.js application,
- `postgres` service running PostgreSQL,
- future `worker` service for background processing.

Both web services build from one parameterized root `Dockerfile` (build args `APP_NAME` / `APP_DIR`).

## Software Design Notes

The architecture establishes clear seams between modules and shared libraries:

- `packages/auth` contains reusable security, tenant and workflow utilities.
- `packages/db` owns Prisma schema and database access.
- `packages/ui` owns shared front-end pieces (presentational components, tenant header helper, Tailwind brand preset) consumed by both apps.
- `apps/applicant` owns the public/applicant routes, UI, middleware and API endpoints.
- `apps/admin` owns the administrator routes, UI and middleware, served at the container root.
- AI mentor integration is represented by a stubbed service boundary in the applicant app.

## Engineering To-Do List

The engineering backlog below maps the Product Backlog into near-term deliverables.

### Platform Foundation

1. IAM with Keycloak
   - Replace scaffolded custom auth direction with Keycloak as the target IAM.
   - Support tenant-aware roles for `OWNER`, `ADMIN` and `APPLICANT`.
   - Preserve MFA/2FA learning objective through Keycloak-backed authenticator-app setup.

2. Separate Applicant Portal and Admin Portal — implemented in `v0.2.0`
   - Done: applicant and admin modules split into independent `apps/applicant` and `apps/admin` containers.
   - Applicant Portal owns public application and participant-facing workflows.
   - Admin Portal owns tenant operations, application review and program management.

### MVP Product Modules

3. Applications
   - Persist applicant signup, application draft, submission and review workflows.

4. Programs
   - Allow tenant admins to configure programs, cohorts and public application entry points.

5. Missions
   - Implement mission lifecycle aligned to the Spiral Engineering Method.

6. AI Mentor Boundary
   - Expand the current AI service boundary into tenant-aware, auditable mentor workflows.

7. Knowledge Base
   - Add tenant-owned knowledge documents for AI assistance and program support.

8. GitHub Integration
   - Connect participant repositories and collect project evidence.

9. Portfolio
   - Generate participant-facing public portfolio artifacts.

10. Certificates
    - Support tenant-branded certificate creation and issuance.

11. Leaderboard
    - Add transparent progress and achievement visibility.

12. Hiring Recommendations
    - Produce admin-facing candidate readiness and hiring signals.
