# Regression Test Plan — TalentOS

**Version:** v0.19.6+
**Last Updated:** 2026-08-10
**Owner:** QA Automation

---

## 1. Test Environment

| Component | Value |
|---|---|
| OS | Windows / Linux / macOS |
| Runtime | Node.js 24 |
| Test Framework | Vitest 3.2 |
| E2E Framework | Custom (tsx + Prisma, live Docker) |
| Container Runtime | Docker Compose |
| Database | PostgreSQL 16 (Docker) |
| Auth | Keycloak 26.0 (Docker) |
| Object Storage | MinIO (Docker) |
| AI Provider | GLM-Z.ai / ZhipuAI (optional) |

## 2. Test Setup

### Prerequisites
1. Docker Desktop running
2. `docker-compose up -d --build` (all services healthy)
3. `npm install` (root workspace)
4. `npm run db:generate` (Prisma client)
5. `npm run db:migrate` (schema deploy)
6. `npm run db:seed` (demo data)

### Running Tests

| Command | What It Runs | Duration |
|---|---|---|
| `npm test` | All 65 unit test files (809 tests) | ~41s |
| `npm run test:watch` | Unit tests in watch mode | — |
| `npm run regression:all` | All 45 E2E regression scenarios | ~5-10 min |
| `npm run regression:auth` | Auth/login E2E scenarios | ~1 min |
| `npm run regression:applicant` | Applicant portal E2E scenarios | ~2 min |
| `npm run regression:admin` | Admin portal E2E scenarios | ~2 min |
| `npm run regression:missions` | Mission lifecycle E2E scenarios | ~3 min |
| `npm run regression:journal` | Journal E2E scenarios | ~1 min |
| `npm run regression:tenant` | Tenant isolation E2E scenarios | ~2 min |
| `npm run regression:dashboard` | Dashboard E2E scenarios | ~1 min |
| `npm run regression:storage` | Storage upload/download E2E | ~30s |
| `npm run regression:ops` | Ops console E2E scenarios | ~30s |
| `npm run typecheck` | TypeScript type checking | ~10s |
| `npm run lint` | ESLint | ~10s |

---

## 3. Application Modules

| Module | Description |
|---|---|
| **Applicant Portal** (`apps/applicant`) | Application submission, dashboard, missions, tasks, journal, AI mentor, resources, calendar, notifications, profile |
| **Admin Portal** (`apps/admin`) | Overview, applications, programs, missions, tasks, submissions, settings, organizations |
| **Ops Console** (`apps/ops`) | Health checks, regression runner, local reset, 2FA/MFA |
| **Auth** (`packages/auth`) | Tenant resolution, slug validation, RBAC, password hashing, TOTP, workflow transitions |
| **Auth-Web** (`packages/auth-web`) | NextAuth integration, role mapping, middleware redirect, logout, realm config |
| **Database** (`packages/db`) | All Prisma data access: tenants, programs, missions, assignments, submissions, journal, applications, dashboard, content, URL safety |
| **Storage** (`packages/storage`) | S3/MinIO object key generation |
| **UI** (`packages/ui`) | Tenant context, branding |

---

## 4. Coverage Matrix

### 4.1 Unit Tests (Vitest) — 65 files, 809 tests

| Feature | Test File | Tests | What Is Covered | Missing Coverage |
|---|---|---|---|---|
| **Tenant resolution** | `packages/auth/src/tenant.test.ts` | 25 | Host parsing, subdomain extraction, localhost, lvh.me, multi-level, port stripping, protocol stripping, case normalization, foreign domains, look-alikes, slug validation (DNS-safe, reserved, length) | — |
| **RBAC / Capabilities** | `packages/auth/src/capabilities.test.ts` | 17 | All 5 roles × 8 capabilities, canEnterAdminPortal, assertTenantScopedAccess | — |
| **Role mapping** | `packages/auth-web/src/roles.test.ts` | 6 | JWT role extraction, known/unknown roles, super admin detection, admin portal access | — |
| **Auth workflow** | `packages/auth/src/workflow.test.ts` | 21 | Application, program, mission, submission status transitions + assertions | — |
| **Permissions** | `packages/auth/src/permissions.test.ts` | 12 | tenantRolesGrant, reviewSubmissions, manageProgramContent per role | — |
| **Middleware redirect** | `packages/auth-web/src/middleware-redirect.test.ts` | 44 | Protected route detection, tenant callback URL, post-login redirect validation, tenant resolution, BUG-1/BUG-3/BUG-4 regressions | — |
| **Config validation** | `packages/auth-web/src/config.test.ts` | 23 | Applicant/admin .env, cross-portal consistency, cookie config | — |
| **Realm config** | `packages/auth-web/src/realm-config.test.ts` | 24 | Realm, client redirect URIs, roles, seed users, provisioner, redirect safety | — |
| **Logout** | `packages/auth-web/src/logout.test.ts` | 13 | End session URL, tenant logout, post_logout_redirect_uri validation | — |
| **Tenant redirect** | `packages/auth-web/src/tenant-redirect.test.ts` | 8 | isSameBaseDomain, resolveTenantRedirect | — |
| **Tenant CRUD** | `packages/db/src/tenants.test.ts` | 12 | getTenantBySlug, listTenants, createOrganization (happy, P2002, email normalize, audit), updateTenantBranding (with/without/clear logo) | — |
| **Program CRUD** | `packages/db/src/programs.test.ts` | 12 | listPublished, listAll, getTenantProgram, slugify, create (happy, P2002), update (happy, not-found) | — |
| **Mission CRUD** | `packages/db/src/missions.test.ts` | 12 | List, get, create, update, status change, backfill on publish (all transitions) | — |
| **Mission assignments** | `packages/db/src/mission-assignments.test.ts` | 18 | Deadline computation (7 weekdays), assignment, dedup, accept, repeat, no-alternate | — |
| **Mission tasks** | `packages/db/src/mission-tasks.test.ts` | 12 | 3-step template, task completion, required gate, per-assignment scoping | — |
| **Mission deadlines** | `packages/db/src/mission-deadlines.test.ts` | 4 | Overdue sweep, failed+disqualify, concurrent skip, idempotent | — |
| **Submissions** | `packages/db/src/submissions.test.ts` | 30 | Evidence URL parsing, draft create/edit, submit (readiness, URL checks, lock, concurrent guard), review (accept, changes, repeat, auto-advance) | — |
| **Submission readiness** | `packages/db/src/submission-readiness.test.ts` | 12 | Task completion, journal count, URL validation, deployment URL reachability, cross-tenant rejection | — |
| **URL safety** | `packages/db/src/url-safety.test.ts` | 25 | Evidence URL syntax, deployment URL lists, SSRF address blocking, pinned DNS, bounded reachability | — |
| **Journal** | `packages/db/src/journal.test.ts` | 35 | List, review lookup, previous-attempt history, create (happy, duplicate, locked, cross-tenant), update (happy, locked, conflict), validation, date normalization | — |
| **Journal validation** | `packages/db/src/journal-validation.test.ts` | 33 | Language normalization, evidence link parsing, confidence rating, time spent, date normalization with timezone | — |
| **Applications** | `packages/db/src/applications.test.ts` | 6 | Duplicate policy, blocking statuses, P2002 handling, accept → mission assignment | — |
| **Program content** | `packages/db/src/program-content.test.ts` | 10 | Video/task/event CRUD, tenant scoping, prerequisite flag, document file validation | — |
| **Dashboard** | `packages/db/src/dashboard.test.ts` | 8 | Task listing, resource listing, task completion, progress computation, notification/calendar helpers | — |
| **Mentor DB** | `packages/db/src/mentor.test.ts` | 10 | Conversation getOrCreate/create, appendMessage, loadHistory, tenant scoping | — |
| **Users** | `packages/db/src/users.test.ts` | 3 | Email normalization | — |
| **Storage keys** | `packages/storage/src/keys.test.ts` | 5 | Filename sanitization, object key namespacing, tenant isolation | — |
| **AI Integration** | `apps/applicant/lib/ai.test.ts` | 19 | Stub (no key), error handling (401/429/500), system prompt, request body, SSE parsing | — |
| **AI RBSE** | `apps/applicant/lib/ai-rbse.test.ts` | 48 | Blocking (7 topics), direct answers (13 patterns), allowing LLM (5), allowed/blocked topic loops | — |
| **AI Context** | `apps/applicant/lib/ai-context.test.ts` | 12 | Context building, safe fallback, tenant scoping, DB error fallback, prompt section formatting | — |
| **AI Cache** | `apps/applicant/lib/ai-cache.test.ts` | 6 | Cache hit/miss, static vs dynamic, error non-caching, per-user isolation, RBSE bypass | — |
| **Knowledge base** | `apps/applicant/lib/knowledge-base.test.ts` | 21 | Retrieval (11 queries), prompt formatting, question detection | — |
| **YouTube parser** | `apps/applicant/lib/youtube.test.ts` | 9 | All URL formats, non-YouTube rejection | — |
| **Login callback** | `apps/applicant/lib/login-callback.test.ts` | 13 | Relative/absolute URLs, subdomain preservation, SSR safety | — |
| **Logout action** | `apps/applicant/lib/logout-action.test.ts` | 4 | URL building, origin derivation, cookie clearing order, no-id_token path | — |
| **Tenant guard** | `apps/applicant/lib/tenant-guard.test.ts` | 6 | Unauthenticated, unknown-tenant, forbidden (no membership, wrong role), APPLICANT, SUPER_ADMIN bypass | — |
| **Mission actions** | `apps/applicant/app/dashboard/missions/[id]/actions.test.ts` | 9 | Accept mission (happy, not-assigned, not-linked, error), save/submit (happy, no-accepted-app, not-assigned, readiness error) | — |
| **Journal actions** | `apps/applicant/app/dashboard/journal/actions.test.ts` | 8 | Create (happy, redirect), update (happy), no-accepted-app, not-linked, missing mission, missing date, date conflict | — |
| **Program actions** | `apps/admin/app/programs/actions.test.ts` | 7 | Create (happy, slug derivation, invalid status), update (happy, not-found), status transition (happy, not-found) | — |
| **Submission review** | `apps/admin/app/missions/submission-actions.test.ts` | 8 | Accept, needs-revision (no feedback, with feedback), repeat (no feedback), invalid decision, not-found, SUPER_ADMIN backfill, no DB user | — |
| **Organization actions** | `apps/admin/app/organizations/actions.test.ts` | 7 | Create (happy, existing user, missing name, invalid color, invalid email, duplicate slug, Keycloak failure) | — |
| **Keycloak admin** | `apps/admin/lib/keycloak-admin.test.ts` | 5 | Issuer parsing, temp password generation, provision org admin (new/existing), realm import | — |
| **Pagination** | `apps/admin/lib/pagination.test.ts` | 10 | Page params, paginate, page window | — |
| **SidebarNav** | `apps/admin/components/SidebarNav.test.ts` | 15 | Route matching, cross-route isolation, nav items integrity | — |
| **SafeMarkdown** | `apps/applicant/components/SafeMarkdown.test.ts` | 2 | Markdown parsing, XSS prevention | — |
| **ApplicantShell** | `apps/applicant/components/ApplicantShell.test.ts` | 13 | Route matching, nav items completeness | — |
| **Journal view-model** | `apps/applicant/app/dashboard/journal/view-model.test.ts` | 5 | Edit mode, locked mission, date formatting | — |
| **Mission workspace view-model** | `apps/applicant/app/dashboard/missions/[id]/view-model.test.ts` | 13 | Progress, steps, countdown, submission mode, canSubmit, reviewer feedback | — |
| **Ops auth** | `apps/ops/src/auth.test.ts` | 2 | Normal client, MFA client | — |
| **Ops commands** | `apps/ops/src/commands.test.ts` | 2 | Allowlist, regression area commands | — |
| **Ops config** | `apps/ops/src/config.test.ts` | 2 | Env override, fallback | — |
| **Ops health** | `apps/ops/src/health.test.ts` | 5 | Docker state mapping, health status, no-health, exited, JSON array | — |
| **Ops jobs** | `apps/ops/src/jobs.test.ts` | 6 | Step status, summary parsing, area grouping, scenario results | — |
| **Ops process** | `apps/ops/src/process.test.ts` | 6 | Stdout, stderr, exit code, failure, timeout, JSON parse | — |
| **Ops security** | `apps/ops/src/security.test.ts` | 2 | Role extraction, access check | — |
| **Ops server** | `apps/ops/src/server.test.ts` | 3 | Unauthenticated redirect, session page, static assets | — |
| **Ops settings** | `apps/ops/src/settings.test.ts` | 2 | Default 2FA, persist toggle | — |
| **Deployment** | `packages/db/src/deployment.test.ts` | 29 | docker-compose, Dockerfile, CI, port consistency, realm JSON | — |
| **Schema sync** | `packages/db/src/schema-sync.test.ts` | 13 | Schema file, generated client, migrations | — |
| **Regression cleanup** | `packages/db/src/regression.test.ts` | 2 | Cleanup ordering | — |
| **Mission seed** | `packages/db/src/mission-seed.test.ts` | 1 | Seed Markdown specs | — |
| **Task seed** | `packages/db/src/task-seed.test.ts` | 2 | Seed task material | — |

### 4.2 Regression/E2E Tests — 45 scenarios

| Area | Scenarios | Key Flows |
|---|---|---|
| **auth** | 4 | Realm discovery, admin login, applicant login, ops login |
| **applicant** | 3 | Application lifecycle + duplicate, task completion + journal dates, journal read-only after submit |
| **admin** | 4 | Review lifecycle + audit, content resources, reviewer journal loading, previous-attempt context |
| **programs** | 2 | Publish/archive lifecycle, content management |
| **missions** | 11 | Lifecycle, deadline, prerequisites, readiness, submission loop, journal locking, repeat, visibility, RBAC |
| **journal** | 4 | Create/edit, unassigned block, one-per-date, lock-on-submit |
| **tenant** | 5 | Cross-tenant reads, realm role without membership, journal review scoping, previous-attempt scoping |
| **dashboard** | 3 | Page loads, persistence, mission-driven progress |
| **storage** | 1 | Upload/download |
| **ops** | 2 | Login, session endpoint |
| **unit** | 1 | Vitest suite passthrough |

---

## 5. Known Bugs with Regression Tests

| Bug ID | Description | Regression Test Location |
|---|---|---|
| BUG-1 | Tenant subdomain lost during auth redirect (cross-origin RSC) | `middleware-redirect.test.ts` → "BUG-1 regression" (6 tests) |
| BUG-3 | DeadlineCountdown hydration mismatch | `middleware-redirect.test.ts` → "BUG-3 regression" (2 tests) |
| BUG-4 | Program deduplication by name in missions filter | `middleware-redirect.test.ts` → "BUG-4 regression" (5 tests) |
| D-051 | Tenant-scoped access enforcement | `tenant-guard.test.ts`, `capabilities.test.ts`, all DB tests |
| D-060 | Open redirect prevention in logout | `logout.test.ts` → "post_logout_redirect_uri" (5 tests) |
| D-066 | RP-initiated logout with tenant origin | `logout-action.test.ts` (4 tests) |
| D-067 | Evidence URL host allowlists | `url-safety.test.ts`, `submissions.test.ts` |

---

## 6. Known Limitations

1. **No Playwright E2E** — `@playwright/test` is installed but no browser-based E2E test files exist. All E2E is via the custom regression runner.
2. **No `packages/ui` tests** — `getTenantContext` is only mocked, never directly tested (requires `next/headers`).
3. **No API route handler tests** — route handlers (`/api/ai/mentor`, `/api/files/*`) are not directly tested; covered indirectly via server action tests and regression scenarios.
4. **AI Mentor streaming** — SSE streaming is tested at the function level but not end-to-end through the HTTP route.
5. **Component tests** — Only `SafeMarkdown`, `ApplicantShell`, `SidebarNav` have component tests; other components (DeadlineCountdown, SubmissionForm, JournalEntryForm, etc.) are tested via view-model unit tests and regression E2E.
6. **Cross-portal session** — No automated test for applicant/admin session isolation (different Keycloak clients, different ports).

---

## 7. Regression History

| Date | Version | Change | Tests Added |
|---|---|---|---|
| 2026-08-10 | v0.19.6+ | QA audit: tenants, programs, journal-validation, tenant edge cases, capabilities, server actions | +138 tests (10 files) |
| Prior | v0.19.6 | Applicant onboarding QA | 55 files, 671 tests |

---

## 8. Manual-Only Scenarios

| Scenario | Why Manual |
|---|---|
| YouTube video progress tracking (90% watch) | Requires real YouTube IFrame API in browser |
| AI Mentor streaming UX (typing indicator, auto-scroll) | Visual/UX validation |
| Logo upload + preview in Settings | File upload + image rendering |
| Calendar event display | Visual layout |
| Theme toggle (Ops Console) | Visual |
| Keycloak registration flow | Requires browser Keycloak form |
| 2FA/MFA enrollment in Ops | Requires TOTP app |
