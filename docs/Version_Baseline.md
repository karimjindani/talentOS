# Version Baseline

## Current Baseline

Version: `v0.3.0`

Baseline name: `Keycloak IAM + RBAC Foundation`

Baseline code commit: `34eac9c510bf60d9dfbb792ed9ba1ed7610d6d1e`

Baseline date: `2026-06-27`

Previous baseline: `v0.2.2`

Previous baseline commit: `c70b3d47665bff499a89533a036695a18a1448e9`

## Baseline Summary

`v0.3.0` establishes Keycloak as the live IAM and wires OIDC authentication + role-based authorization
into both portals (Auth.js / NextAuth v5). It introduces the 5-role model (`SUPER_ADMIN` platform;
`ORG_ADMIN`/`HR`/`TECH_LEAD`/`APPLICANT` org-scoped) with a capability matrix, a seeded Super Admin,
Keycloak password policy and first-login password/TOTP, and admin-portal RBAC gating. Org/role mapping
uses Keycloak realm roles for identity and the TalentOS DB for org scoping. Schema change: `User` gains
`keycloakSubjectId`, `emailVerified`, `platformRole`, optional `passwordHash`; new `PlatformRole` enum;
`TenantRole` becomes the org roles. This is staged — the Admin user/org/role management UI (Keycloak
Admin REST API) follows in `v0.3.1`.

`v0.2.2` was a documentation-only update that refreshed the root README and documentation overview after
the separated-portal implementation. No schema change.

`v0.2.1` removed all administrator navigation from the applicant application (no `Admin` link, dropped
`NEXT_PUBLIC_ADMIN_URL`), completing module isolation. No schema change.

`v0.2.0` isolated the applicant and administrator modules into two separate Next.js applications, each
running in its own Docker container, sharing only the `packages/*` libraries. There was no Prisma
schema change in that baseline. It realized the portal-separation direction recorded in `v0.1.2`.

`v0.1.2` was a documentation-only update that established the architecture engineering backlog
direction: Keycloak as the target IAM system, separate Applicant and Admin portals, and
architecture-level Engineering To-Do tracking mapped from the Product Backlog.

`v0.1.1` established local Docker deployment support with configurable host ports.

`v0.1.0` remains the first platform architecture baseline.

This baseline includes:

- Keycloak IAM (`talentos-keycloak`) + dedicated `talentos-keycloak-postgres`, realm `talentos`
  auto-imported with the 5 roles, password policy, first-login password/TOTP and demo users,
- OIDC authentication on both portals via `packages/auth-web` (Auth.js / NextAuth v5, JWT sessions),
- the 5-role model and capability matrix in `packages/auth` (`SUPER_ADMIN`; `ORG_ADMIN`/`HR`/`TECH_LEAD`/`APPLICANT`),
- admin-portal RBAC gating (non-admin roles redirected to `/forbidden`) and applicant `/application` gating,
- `User` identity fields (`keycloakSubjectId`, `emailVerified`, `platformRole`, optional `passwordHash`) and migration `20260628000000_keycloak_iam_rbac`,
- the regression suite expanded to 19 tests (RBAC capability matrix + Keycloak role mapping), all passing.

Carried forward from earlier baselines: the two isolated applicant/admin containers (v0.2.0) with the
applicant exposing no admin navigation (v0.2.1); the shared `packages/ui`; the PostgreSQL data model via
Prisma; tenant resolution/isolation utilities; the AI mentor service boundary stub; and SSDLC
documentation for architecture, data model, data dictionary, deployment and testing.

## Portal Scope

Public Applicant Portal routes (`apps/applicant`, container `talentos-applicant`):

- `/`
- `/apply`
- `/login` (Keycloak sign-in)
- `/application` (authenticated)
- `/api/auth/[...nextauth]`

(Signup and 2FA setup are owned by Keycloak as of `v0.3.0`.)

Program Admin Portal routes (`apps/admin`, container `talentos-admin`, served at root, RBAC-gated):

- `/`
- `/applications`
- `/applications/[id]`
- `/programs`
- `/settings`
- `/forbidden`
- `/api/auth/[...nextauth]`

## Package Scope

Packages, apps and infrastructure included as of `v0.3.0`:

- `apps/applicant`
- `apps/admin`
- `packages/auth`
- `packages/auth-web`
- `packages/db`
- `packages/ui`
- `keycloak/import` (realm definition)

## Documentation Rule

All future documentation updates must reference the relevant code version.

All future implementation plans must be stored in `docs/plans/`.

All future testing details and results must be stored in `docs/testing/`.

## Versioning Convention

TalentOS uses semantic versioning:

- Patch versions, such as `v0.1.1`, are used for documentation fixes or small non-breaking implementation updates.
- Minor versions, such as `v0.2.0`, are used for new product capabilities.
- Major version `v1.0.0` is reserved for the first production-ready release.
