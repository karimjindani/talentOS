# Regression Scenarios

Code version: `v0.16.0`

## Purpose

This document defines the scenario-based regression suite for TalentOS. Unit tests remain important, but
they are not enough to protect product behavior. Scenario regression validates the logical product areas
a real applicant, admin, operator or tenant would experience.

The suite can be run from the local Ops Console or from npm scripts.

## Execution Areas

| Area | Command | Current status |
| --- | --- | --- |
| Unit | `npm.cmd run regression:unit` | Automated |
| Auth | `npm.cmd run regression:auth` | Automated |
| Applicant | `npm.cmd run regression:applicant` | Automated |
| Admin | `npm.cmd run regression:admin` | Automated |
| Programs | `npm.cmd run regression:programs` | Automated |
| Missions | `npm.cmd run regression:missions` | Automated |
| Tenant isolation | `npm.cmd run regression:tenant` | Partially automated |
| Dashboard | `npm.cmd run regression:dashboard` | Automated |
| Storage | `npm.cmd run regression:storage` | Missing |
| Ops | `npm.cmd run regression:ops` | Automated |
| All | `npm.cmd run regression:all` | Automated orchestration |

## Scenario Matrix

| Logical area | Scenario | Status | Notes |
| --- | --- | --- | --- |
| Unit | Existing Vitest regression suite passes. | Automated | Run as the `unit` area. |
| Auth | Keycloak realm discovery returns HTTP 200. | Automated | Guards local issuer and realm availability. |
| Auth | Org Admin completes OIDC login and reaches the demo admin portal. | Automated | Validates admin callback, issuer and shared-cookie behavior. |
| Auth | Applicant completes OIDC login and reaches the application page. | Automated | Validates applicant callback and portal access. |
| Auth | Accepted applicant reaches the dashboard. | Automated | Validates accepted-applicant seed and dashboard gating. |
| Ops | Org Admin completes Ops Console login. | Automated | Catches issuer mismatch and Ops client issues. |
| Ops | Ops session endpoint returns the local session envelope. | Automated | Complements the full Ops login scenario. |
| Applicant | Applicant submits an application and sees submitted status. | Automated | Uses marked regression data. |
| Applicant | Duplicate active application is blocked. | Automated | Uses `DUPLICATE_APPLICATION_ERROR_MESSAGE`. |
| Admin | Org Admin reviews an application and changes status. | Automated | Current automated status path accepts an application. |
| Admin | Status change writes an audit log. | Automated | Validates `application.status_changed`. |
| Admin | Reviewer-specific rejected/waitlisted transitions. | Missing | Add browser/server-action coverage for all reviewer status paths. |
| Admin | Role-specific UI/route denial for HR, Tech Lead and Applicant. | Manual | Unit/RBAC coverage exists; scenario coverage should be expanded. |
| Programs | Org Admin creates a draft program. | Automated | Data-level scenario through DB helpers. |
| Programs | Published program appears in applicant-visible list. | Automated | Validates `listPublishedPrograms`. |
| Programs | Archived program is removed from applicant-visible list. | Automated | Validates lifecycle visibility. |
| Programs | Org Admin manages program content (resources/tasks/events); roles without `manageProgramContent` are denied. | Automated | v0.16.0 (D-069): CRUD round-trip, audit entries, capability matrix, cross-tenant delete rejection. |
| Missions | Org Admin creates a draft mission, publishes it, and accepted applicants can see it. | Automated | Validates mission lifecycle visibility. |
| Missions | Archived mission is removed from applicant-visible mission list. | Automated | Validates published-only visibility. |
| Missions | HR, Tech Lead and Applicant cannot manage missions. | Automated | Validates `manageMissions` capability. |
| Tenant isolation | Tenant-scoped program read rejects another tenant. | Partially automated | Skips when only one local tenant exists. Needs a second marked tenant fixture. |
| Tenant isolation | Realm role alone does not grant authority without `TenantMembership`. | Automated | Validates the D-051 authorization principle. |
| Tenant isolation | Applicant portal denies a non-member of the Host-resolved tenant (`/dashboard`, `/application` → `/access-denied`; SUPER_ADMIN bypass). | Automated | Unit-covered by `apps/applicant/lib/tenant-guard.test.ts`; also validated end-to-end via browser. Ports the D-051 guard to the applicant portal. |
| Tenant isolation | Cross-tenant file and settings denial through admin browser routes. | Missing | Add Playwright/browser route coverage. |
| Dashboard | Accepted applicant dashboard pages load. | Automated | Covers overview, program, tasks, resources, calendar, notifications and profile. |
| Dashboard | Task completion persists. | Automated | Uses dashboard DB helpers. |
| Dashboard | Accepted mission submission moves mission-driven dashboard progress. | Automated | v0.16.0 (D-069): full draft→submit→accept loop; only ACCEPTED moves the bar; current mission clears at 100%. |
| Dashboard | Notification read state persists. | Automated | Uses dashboard DB helpers. |
| Storage | CV upload/download round-trip. | Missing | `storage` area currently reports a documented skip. |
| Storage | Cross-tenant file denial. | Missing | Should cover both metadata lookup and download URL path. |
| Ops | Run full regression from Ops UI and show counts. | Automated/API + manual UI check | Unit/server coverage plus local manual validation. |
| Ops | Run one selected area from Ops UI. | Automated/API + manual UI check | Ops API accepts `area`; UI includes selector. |
| Ops | Cleanup is a safe no-op when no markers exist. | Automated via existing cleanup command behavior | Should gain a direct scenario assertion in a later hardening pass. |
| Ops | Cleanup removes marked data only. | Automated by runner + cleanup validation | Scenario data uses `RegressionDataMarker`. |

## Data Ownership and Cleanup

Regression-generated records must be explicitly marked with `RegressionDataMarker`.

Current marker-tagged entity types:

- `User`
- `TenantMembership`
- `Program`
- `Mission`
- `Application`
- `ApplicationAnswer`

The cleanup command is:

```powershell
npm.cmd run ops:cleanup-regression
```

Cleanup rules:

1. Delete only records referenced by `RegressionDataMarker`.
2. Delete in dependency order.
3. Do not delete seeded demo data.
4. Do not delete user-created data.
5. Prefer deterministic regression names such as `regression-<runId>` and
   `applicant+<runId>@regression.talentos.local`.

## Known Gaps After `v0.14.0`

- Full browser-level Playwright coverage is not yet complete for every scenario. The runner currently
  combines OIDC HTTP login flows with DB/service-level scenario checks.
- Storage upload/download is documented but not automated.
- Cross-tenant route-level denial needs a second regression tenant fixture and browser route checks.
- Admin review should expand from one accepted-path status transition to all reviewer transitions and
  role-specific denial paths.
