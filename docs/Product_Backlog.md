# Product Backlog

Code version: `v0.7.0`

Documentation update: `Object storage foundation (MinIO) delivered`

## MVP

- Applications
- Programs
- Missions
- AI Mentor
- Knowledge Base
- GitHub Integration
- Portfolio
- Certificates
- Leaderboard
- Hiring Recommendations

## V2

- AI Assignment Review
- Slack Community
- AI Interview

## V3

- AI Video Analysis
- AI Customer
- AI Stakeholder Personas

## Engineering Backlog

### Major Platform Items

- IAM with Keycloak — foundation delivered in `v0.3.0`
  - Keycloak is the live IAM for authentication, MFA, password policy, roles and session management; both portals authenticate via OIDC and the admin portal enforces RBAC.
  - Next (`v0.3.1`): Admin Portal user/org/role management UI via the Keycloak Admin REST API.

- Separate Admin and Applicant Portals
  - The Admin Portal and Applicant Portal should become two separate portal surfaces.
  - The current `v0.1.1` scaffold serves both portal shells from one Next.js app, but this is not the long-term architecture.

- Object storage foundation — delivered in `v0.7.0`
  - MinIO (S3-compatible) self-hosted object storage with presigned upload/download and tenant-scoped
    `StoredFile` metadata. Enables future CV uploads, program materials, certificates and portfolio assets.

### MVP Engineering Deliverables

- Applications module — delivered in `v0.5.0` (authenticated apply → submit → admin review with accept/reject/under-review/waitlist, tenant-scoped and audited).
- Programs module — delivered in `v0.6.0` (admin CRUD: create/edit/publish/archive, `managePrograms`-gated, tenant-scoped and audited; published programs feed the apply form).
- Missions module
- AI Mentor boundary
- Knowledge Base
- GitHub Integration
- Portfolio
- Certificates
- Leaderboard
- Hiring Recommendations
