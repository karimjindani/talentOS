# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TalentOS is a Dockerized, multi-tenant, white-label SaaS platform for talent discovery, mission-based
learning and recruitment (the "Spiral Engineering Method" — participants build real software through
repeated discover→analyze→specify→design→build→test→deploy→present→reflect→review cycles). It is an
npm workspaces monorepo: two independently deployable Next.js portals, a host-run ops console, and
shared `packages/*` libraries.

## Commands

```bash
# Install (Node 24, npm 11)
npm install

# Prisma client must be regenerated before typecheck/test/build after any schema change
npm run db:generate

# Typecheck (root + all three app tsconfigs)
npm run typecheck

# Lint (applicant + admin, --max-warnings=0)
npm run lint

# Unit/integration tests (Vitest, mocked Prisma — no DB needed)
npm run test
npm run test:watch
npx vitest run path/to/file.test.ts      # single file
npx vitest run -t "test name"            # single test by name

# Production build (applicant + admin)
npm run build

# Run one app's dev server
npm run dev:applicant   # http://lvh.me:3100
npm run dev:admin       # http://lvh.me:3200
npm run dev:ops         # http://127.0.0.1:3300 (host-run, not containerized)

# Full local Docker stack (Postgres, Keycloak, MinIO, both portals)
npm run local:bootstrap   # one-command bootstrap/repair + demo seed
npm run local:doctor      # validate the stack
npm run local:smoke-login

# Scenario/E2E regression suite (needs the Docker stack running)
npm run regression:all
npm run regression:<area>   # auth | applicant | admin | programs | missions | journal
                             # | tenant | dashboard | storage | public-portal | ops | unit
```

Before every commit/push, run the same sequence CI runs: `db:generate → typecheck → lint → test → build`.
This is spelled out in `LOCAL_CI_PREFLIGHT.md` (a local-only, untracked file — do not commit it).

## Architecture

### Three applications, shared libraries only

- `apps/applicant` — public/applicant Next.js app, container `talentos-applicant`, port 3100. Owns
  landing pages, apply flow, applicant dashboard, missions, journal, AI mentor.
- `apps/admin` — admin/back-office Next.js app, container `talentos-admin`, port 3200. Owns
  application review, programs, missions, tasks, submissions review, tenant settings, organizations.
  Exposes **no** route the applicant portal can reach and vice versa (each container 404s the other's
  routes); only the admin portal links back to the applicant portal.
- `apps/ops` — Local Ops Console, **host-run, not containerized**, port 3300 (loopback only). Runs
  regression/cleanup/reset jobs against the local stack, gated by Keycloak `SUPER_ADMIN`/`ORG_ADMIN` +
  optional TOTP. It replaced a former admin "Operations" page so health checks stay reachable when the
  portals themselves are down.
- `packages/auth` — RBAC/capability matrix (`permissions.ts`), tenant/workflow utilities. Framework-agnostic.
- `packages/auth-web` — NextAuth v5 + Keycloak OIDC wiring (`createTalentosAuth`), edge-safe realm-role
  decoding, RP-initiated logout, and the pure middleware helpers both portals share (tenant-redirect,
  request logging).
- `packages/db` — Prisma schema/migrations and **all** database access. Every module (`applications.ts`,
  `programs.ts`, `missions.ts`, `submissions.ts`, `submission-readiness.ts`, `journal.ts`,
  `mission-assignments.ts`, `mission-deadlines.ts`, `dashboard.ts`, `mentor.ts`, `url-safety.ts`, …) is
  tenant-scoped and paired with a `*.test.ts` using mocked Prisma (`vi.hoisted()` + `vi.mock("./client")`
  — no live DB needed for `npm test`).
- `packages/storage` — S3/MinIO wrapper: presigned upload/download, tenant-namespaced object keys.
- `packages/ui` — shared presentational components + Tailwind brand preset; brand colors are CSS
  variables injected per-tenant so white-label theming needs no component changes.

Path aliases (`@talentos/auth`, `@talentos/db`, `@talentos/storage`, `@talentos/ui`, and their `/*`
subpaths) are declared in the root `tsconfig.json` and mirrored in `vitest.config.ts`'s `resolve.alias`
— keep both in sync if a package's public surface changes.

### Multi-tenancy

Single shared PostgreSQL database; every tenant-owned row carries `tenantId`. Tenants are resolved from
the request host: `<slug>.lvh.me:<port>` locally (`lvh.me`/`*.lvh.me` resolve to loopback with no
hosts-file setup), `<slug>.talentos.app`-style subdomains in production. Because next-auth v5 pins one
`AUTH_URL` per app, login always runs through a single canonical host per portal and the session cookie
is scoped to `APP_BASE_DOMAIN` (e.g. `Domain=.lvh.me`) so it's valid across every tenant subdomain; after
the OIDC callback the user is redirected back to their tenant subdomain through an allow-listed
`resolveTenantRedirect` (never an open redirect). The Keycloak realm role is only the coarse
portal-entry gate — actual authorization is bound to the DB `TenantMembership` for the
**host-resolved** tenant (`resolveTenantAccess`/`requireTenantAccess`, mirrored in both
`apps/admin/lib/tenant-guard.ts` and `apps/applicant/lib/tenant-guard.ts`), so a valid shared session on
the wrong subdomain does not grant access to another tenant's data. `SUPER_ADMIN` bypasses tenant
scoping; every other role (`ORG_ADMIN`/`HR`/`TECH_LEAD`/`APPLICANT`) is evaluated per-tenant via the
capability matrix in `packages/auth/src/permissions.ts`. Defense-in-depth: mutations write via
`updateMany({ where: { id, tenantId } })` so a raw id can't cross tenants even if a guard is missed.

### Identity

Keycloak is the live IAM — signup, password policy, first-login flows, and TOTP are all owned by
Keycloak, not the app. `User.passwordHash` is legacy/unused. The DB `User` row is a local mirror of the
Keycloak identity joined by (normalized, lower-cased) email; `keycloakSubjectId` is backfilled on login.
Org-admin provisioning happens through the Keycloak Admin REST API via a confidential service-account
client (`talentos-provisioner`), not manual `kcadm`.

### Mission/submission lifecycle (the core learning-engine domain)

This is the most stateful part of the codebase — read `docs/Architecture.md` before touching it.
Rough shape: an accepted `Application` gets an idempotent `MissionAssignment` for its program week
(`packages/db/src/mission-assignments.ts`); the applicant must explicitly **accept** it before a
deadline/grace countdown starts (`deadlineHours`/`gracePeriodHours` → `deadlineAt`/`graceEndsAt`);
`packages/db/src/submission-readiness.ts` is the single source of truth for whether a submission can go
out (required week tasks complete, ≥4 current-attempt journal entries, evidence URLs pass
`url-safety.ts`'s SSRF-hardened reachability check); an external cron-style sweep
(`scripts/mission-deadlines/sweep.ts`, deliberately kept out of the request path) transitions overdue
assignments through `OVERDUE`→`FAILED`/`DISQUALIFIED` idempotently. A `REPEAT` review decision
reassigns a different mission for the *same* week that failed, not a reset to week 1.

### Scenario regression suite

Distinct from Vitest unit tests: `scripts/regression/run.ts`, run against the live local Docker stack
(via `npm run regression:<area>` or the Ops Console's area picker), emits a machine-readable
`REGRESSION_RESULT_JSON` summary. Scenario-generated data must be tagged via `RegressionDataMarker`
(`packages/db`) before the cleanup path (`npm run ops:cleanup-regression`) will touch it — cleanup never
touches seeded demo data or real user data.

## Conventions specific to this repo

- **SSDLC/governance is enforced, not optional** — see `docs/sdlc.md` and `CONTRIBUTING.md`. A
  versioned change is expected to also touch: a plan in `docs/plans/` (using the template, with a real
  **Test Scenarios** section), results in `docs/testing/`, every scenario added to
  `docs/Regression_Scenarios.md` (automated or an explicit Known Gap), `docs/Version_Baseline.md`,
  a `docs/Decision_Log.md` entry (`D-0NN`), and Data Model/Dictionary updates if the schema changed. A
  user-facing portal change must update the matching `docs/user-guides/` doc in the same iteration.
- **Version/branch/commit discipline** is spelled out in `AGENTS.md` — before allocating or changing a
  version number, fetch `origin`, inspect unmerged branches for already-claimed versions, and take the
  next patch after the highest one found anywhere. Branches are `<type>/vX.Y.Z-<slug>`
  (`feat|fix|docs|ci|chore|refactor`); commits are Conventional Commits, carrying a
  `(vX.Y.Z, D-0NN)` trailer when they establish/change a versioned baseline.
- **Confirmation gates (`AGENTS.md`):** stop and ask the user before (1) starting the
  documentation-update process for a versioned iteration, and (2) pushing commits to a remote branch
  (including fast-forwards).
- **Tests must be timezone-independent** — CI runs UTC, local dev may not. Use explicit UTC dates like
  `new Date("2026-08-10T00:00:00.000Z")`, never local-time-dependent assertions.
- **Vitest uses the `forks` pool, not `threads`** (`vitest.config.ts`) — the threads pool causes
  cross-file mock contamination with this codebase's heavy `vi.mock()`/`vi.resetModules()` usage. Don't
  change this without re-verifying full-suite isolation.
- **Windows is the local dev OS, CI is Ubuntu** — avoid hardcoded path separators; scripts under
  `scripts/local/` and the various `.ps1`/`.sh` pairs must keep working on both.
- **SVG uploads are rejected** wherever tenant logos/branding assets are accepted (XSS vector) — don't
  loosen that allowlist.
- **Object storage keys are always tenant-namespaced** (`tenant/{tenantId}/{category}/…`) and
  `StoredFile` metadata is tenant-scoped — never construct a raw MinIO key without going through
  `packages/storage`.
