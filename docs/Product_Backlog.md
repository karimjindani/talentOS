# Product Backlog

Code version: `v0.11.1`

Documentation update: `Tenant settings / white-label, Organizations console, Keycloak OTP/SSO-logout fixes, per-tenant authorization (D-051), identity linking + email normalization (D-052), org-admin auto-provisioning (D-053), and reserved-slug blocklist + duplicate-application index (D-054) delivered (through v0.11.1)`

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
  - Applicant self-signup delivered in `v0.7.1` (Keycloak self-registration, default role APPLICANT).
  - Tenant/org creation delivered in `v0.10.0`: SUPER_ADMIN Organizations console creates tenants and
    assigns the first ORG_ADMIN by email (DB membership).
  - Per-tenant authorization enforced in `v0.10.3` (D-051): admin authority is now bound to the DB
    `TenantMembership`, closing the cross-tenant access gap; the realm role only gates portal entry.
  - Org-admin auto-provisioning delivered in `v0.11.0` (D-053): org creation provisions the Keycloak user
    + `ORG_ADMIN` realm role via the Admin REST API (service-account client, one-time temp password) — no
    manual `kcadm` step.
  - Next: a full Admin Portal Users/Roles management UI (list/edit/deactivate, role changes) on top of the
    `v0.11.0` Keycloak Admin REST integration.

- Separate Admin and Applicant Portals — delivered in `v0.2.0`
  - The Admin Portal and Applicant Portal are two separate Next.js applications, each in its own Docker
    container, sharing only the `packages/*` libraries. As of `v0.2.1` the applicant portal exposes no
    administrator navigation.

- Object storage foundation — delivered in `v0.7.0`
  - MinIO (S3-compatible) self-hosted object storage with presigned upload/download and tenant-scoped
    `StoredFile` metadata. Enables future CV uploads, program materials, certificates and portfolio assets.
  - Applied in `v0.7.3` (CV-on-apply) and `v0.9.0` (tenant logo upload).

- Tenant settings / white-label configuration — delivered in `v0.9.0`
  - Admin-gated (`manageTenantSettings`) branding: organization name, brand colors and logo, persisted,
    audited (`tenant.branding_updated`) and applied live to both portals via CSS variables. Logos are
    stored in MinIO (`Tenant.logoFileId`).

- Super Admin Organizations console — delivered in `v0.10.0`
  - SUPER_ADMIN can create tenants and assign the first ORG_ADMIN by email (DB `User` +
    `TenantMembership`), audited as `organization.created`; the matching Keycloak realm-role grant is
    still manual pending the Keycloak Admin REST API (`v0.3.1`).

- Admin Operations dashboard — delivered in `v0.8.0`
  - Local-development health checks, copyable regression commands and marker-based cleanup guidance;
    does not execute Docker/npm host commands.

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
