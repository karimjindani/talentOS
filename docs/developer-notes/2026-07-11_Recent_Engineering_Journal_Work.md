# Recent Engineering Journal Work

**Date:** 2026-07-11  
**Branch:** `engineering-journal-mvp`  
**Documented range:** `a4284c4..7bdb803`  
**Remote branch:** `origin/engineering-journal-mvp`

## Overview

This note records the work completed after the previous Engineering Journal documentation checkpoint.
The range contains two separate streams:

1. Engineering Journal previous-attempt review work completed on the feature branch.
2. Upstream `v0.18.3` Ops Regression Run visibility work merged from `origin/main`.

The upstream Ops work is identified separately below and is not claimed as original Engineering
Journal implementation work.

## Engineering Journal Work Completed

### Previous-attempt review helper

Added `listPreviousMissionAttemptHistoryForSubmissionReview` in `packages/db/src/journal.ts`.

The helper:

- resolves the current assignment using a tenant-scoped `missionAssignmentId`;
- finds lower attempt numbers for the same tenant, program, applicant, and week;
- intentionally does not require the same mission ID, because a repeated week may use a different
  mission variant;
- returns attempts in descending attempt-number order;
- loads journals in ascending entry-date order;
- keeps journal rows attached to their exact prior `missionAssignmentId`;
- excludes current attempts, future attempts, unrelated scopes, and unlinked legacy journals;
- returns only fields needed for read-only Admin review.

The existing current-attempt helper, `listEngineeringJournalEntriesForSubmissionReview`, remains the
primary and exact-attempt journal query.

### Admin submission review UI

The Admin submission review page now keeps the current attempt's **Engineering Journal** as the
primary evidence and conditionally adds **Previous Attempt History** for Attempt 2 or later.

Previous history:

- is collapsed by default using native `<details>` and `<summary>` elements;
- is omitted when no reliable previous assignment exists;
- groups records by assignment attempt;
- shows mission, week, assignment/submission status, dates, reviewer feedback, and structured journal
  fields;
- contains no journal edit/delete controls or old-attempt review forms.

Legacy submissions without `missionAssignmentId` continue to use existing compatibility behavior and
do not attempt to infer previous history.

### Unit and regression coverage

Journal helper tests now cover:

- Attempt 1, Attempt 2, and Attempt 3 behavior;
- descending previous-attempt ordering;
- current and future attempt exclusion;
- tenant, applicant, program, and week isolation;
- previous attempts using a different mission;
- exact assignment-level journal grouping;
- exclusion of cross-attempt and unlinked legacy journals;
- read-only result selection;
- preservation of the existing current-attempt lookup.

The existing regression runner gained these scenarios:

| Dashboard category | Scenario |
| --- | --- |
| Admin | `Reviewer opens read-only previous-attempt context while reviewing a later attempt` |
| Missions | `Repeated-week history stays separate across mission variants and attempt boundaries` |
| Tenant | `Previous-attempt history stays tenant, applicant, program, and week scoped` |
| Unit | Existing Vitest regression scenario includes the expanded journal tests. |

No separate regression framework or dashboard was created.

## Repository Guidance

Created root `AGENTS.md` with the repository-wide **Version Allocation** procedure. It requires agents
to fetch and inspect `origin/main` and active unmerged remote branches before allocating a version,
choose the next patch after the highest active allocation, recheck before pushing, and follow the
repository's merge/rebase and no-force-push rules.

No project version was allocated by the Engineering Journal change.

## Upstream Main Integration

The latest `origin/main` was fetched and merged into `engineering-journal-mvp`.

Upstream commits integrated:

- `4c0e2e6` - `feat(v0.18.3): show regression scenario results in Ops`
- `56db141` - merge of the upstream v0.18.3 pull request

The upstream change adds scenario-level regression visibility to the Ops Console and updates its
operations types, tests, UI, plans, testing results, and version documentation.

One merge conflict occurred in `apps/ops/src/jobs.test.ts`. The resolution preserved both:

- the feature branch test proving Engineering Journal scenarios group into existing dashboard areas;
- the upstream test for scenario-level detail and error parsing.

The resolved merge was committed as `7bdb803`.

## Commits and Push

| Commit | Purpose |
| --- | --- |
| `99e796e` | Added previous assignment journal history to Admin review, tests, regressions, docs, and `AGENTS.md`. |
| `7bdb803` | Merged the latest `origin/main` and resolved the Ops jobs test conflict. |

The branch was pushed from `a4284c4` to `7bdb803` at
`origin/engineering-journal-mvp`. Remote `main` was not modified by the push.

## Validation Results

### Before the upstream merge

| Command | Result |
| --- | --- |
| `npm test` | Passed: 34 files, 265 tests. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `npm run build` | Applicant and Admin production builds passed. |
| `npm run regression:admin` | Passed: 3/3. |
| `npm run regression:missions` | Passed: 9/9. |
| `npm run regression:tenant` | Passed: 5/5. |
| `npm run regression:unit` | Passed: 1/1. |
| `npm run regression:all` | 35 passed, 0 failed, 1 existing documented storage skip. |

### After merging `origin/main`

| Command | Result |
| --- | --- |
| `npx vitest run apps/ops/src/jobs.test.ts packages/db/src/journal.test.ts` | Passed: 2 files, 48 tests. |
| `npm test` | Passed: 34 files, 267 tests. |
| `npm run typecheck` | Passed across root, Applicant, Admin, and Ops projects. |
| `npm run lint` | Passed for Applicant and Admin with zero warnings. |
| `npm run build` | Applicant and Admin production builds passed. |

Both Next.js builds emitted the existing warning that the Next.js ESLint plugin is not detected. The
warning did not fail either build.

## Files Changed in the Documented Range

### Engineering Journal and repository guidance

- `AGENTS.md`
- `apps/admin/app/missions/[id]/submissions/[submissionId]/page.tsx`
- `packages/db/src/journal.ts`
- `packages/db/src/journal.test.ts`
- `scripts/regression/run.ts`
- `docs/developer-notes/2026-07-10_Engineering_Journal.md`
- `docs/developer-notes/Engineering_Journal_Assignment_Integration.md`
- `docs/developer-notes/Engineering_Journal_Notes.md`
- `docs/user-guides/Back_Office_User_Guide.md`

### Upstream v0.18.3 integration

- `apps/ops/src/jobs.test.ts`
- `apps/ops/src/jobs.ts`
- `apps/ops/src/server.test.ts`
- `apps/ops/src/ui.ts`
- `packages/auth/src/operations.ts`
- `docs/Decision_Log.md`
- `docs/Regression_Scenarios.md`
- `docs/Testing_Strategy.md`
- `docs/Version_Baseline.md`
- `docs/plans/v0.18.3_Ops_Regression_Scenario_Visibility.md`
- `docs/testing/v0.18.3_Ops_Regression_Scenario_Visibility_Test_Results.md`

## Database and Scope Notes

- No Prisma schema change or migration was required for previous-attempt history.
- No Auth, Keycloak, permission-matrix, mission-selection, submission-transition, AI-scoring, badge,
  journal-delete, or legacy-data migration behavior was changed.
- `Submission.journalMarkdown` remains in the schema for backward compatibility.
- Previous-attempt history remains supplementary read-only reviewer context; it does not merge the
  Engineering Journal into the Mission Engine.

## Current Repository State at Documentation Time

- Current branch: `engineering-journal-mvp`
- Current commit before adding this note: `7bdb803`
- `origin/main` is integrated into the feature branch.
- `origin/engineering-journal-mvp` points to `7bdb803`.
- The working tree was clean before this documentation file was added.
