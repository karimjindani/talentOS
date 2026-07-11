# Engineering Journal Daily Work Log

**Date:** 2026-07-10
**Repository:** `talentOS`
**Working branch:** `engineering-journal-mvp`

## Overview

Today's work completed the assignment-attempt integration for the dedicated Engineering Journal, added read-only journal context to Admin submission review, strengthened repeat-week behavior and regression coverage, integrated the latest `main` branch safely into the feature branch, removed the obsolete Submission Journal UI, and verified the Applicant/Admin Docker deployment.

The resulting design keeps one continuous Engineering Journal for each applicant while linking every individual entry to the exact `MissionAssignment` attempt it belongs to. This prevents journal history from being mixed when a week is repeated or a mission has multiple attempts.

## Feature Work Completed

### Assignment-attempt data model

- Added `MissionAssignmentStatus` values: `ACTIVE`, `SUBMITTED`, `PASSED`, and `REPEAT`.
- Added terminal `REPEAT` to `SubmissionStatus`.
- Added `MissionAssignment.attemptNumber` and `MissionAssignment.status`.
- Added nullable `missionAssignmentId` relationships to both `Submission` and `EngineeringJournalEntry`.
- Added `EngineeringJournalEntry.lockedAt` as the persisted read-only marker.
- Changed assignment uniqueness to tenant + program + applicant + week + attempt number.
- Added one-submission-per-assignment-attempt uniqueness when `missionAssignmentId` is present.
- Added an assignment/date index for journal-entry lookup.

### Journal-to-assignment linking

- New journal entries resolve the applicant's latest active assignment for the selected published mission.
- The server validates tenant, applicant ownership, accepted program, published mission, active assignment, confidence rating, entry-date uniqueness, and journal content.
- `weekNumber` continues to be derived from the mission rather than trusted from the browser.
- Journal updates cannot move an entry into a different assignment attempt.
- Admin review retrieves entries using tenant ID, applicant ID, mission ID, and assignment ID together.

### Journal creation rules

- One journal entry is allowed per applicant per entry date within a tenant.
- Back-dated entries remain supported.
- The previous 24-hour create wait is disabled.
- Applicants can create entries only for assigned missions with an active assignment attempt.
- Delete functionality remains intentionally unavailable.

### Submission locking

Submitting an assignment now performs the following work in one transaction:

1. Confirms submission tenant and applicant ownership.
2. Changes the submission to `SUBMITTED`.
3. Sets `lockedAt` only on journals linked to that exact assignment attempt.
4. Changes the linked assignment status from `ACTIVE` to `SUBMITTED`.

Locked entries are read-only in the Applicant Portal, and the database helper independently rejects update attempts. Editing does not reset or bypass a lock. Revision, resubmission, acceptance, and repeat review do not clear `lockedAt`.

### Saved-entry Applicant UX

- Saved journal entries open in read-only mode.
- An explicit **Edit** action is required before fields become editable.
- Locked entries do not expose edit mode.
- Mission context is read-only for saved entries.
- New entries use assigned missions only.
- The mission submission form no longer includes the old inline **Engineering journal (Markdown)** textarea.
- Applicants are directed to the dedicated Engineering Journal for daily reflection.

### Repeat-week attempts

- Admin review supports `REPEAT` as a terminal outcome for one assignment attempt.
- Written feedback is required for **Repeat week** and **Request changes**.
- A repeat closes the old submission and assignment attempt without changing their history.
- Exactly one new active attempt is created for the same mission and week.
- New submissions and journal entries attach to the new attempt.
- Re-reviewing a closed attempt cannot create duplicate attempts or an infinite repeat loop.
- A normal revision continues to reuse the same attempt.

### Admin Engineering Journal review

- The Admin submission review page displays dedicated Engineering Journal entries read-only.
- Entries are scoped to the submission's exact tenant, applicant, mission, and assignment attempt.
- The page shows entry date, week, mission, attempt, language, all structured reflection fields, confidence, time spent, and evidence links.
- Admins and reviewers receive no journal edit or delete capability.
- Existing submission review permissions and status transitions were preserved.
- No numeric reviewer-scoring feature was added; nullable AI score fields remain placeholders.

### Legacy Submission Journal UI removal

- Removed the visible **Submission Journal** section from Admin submission review.
- The old applicant mission-submission textarea was already removed.
- Kept `Submission.journalMarkdown` in the Prisma schema and submission backend for backward data compatibility.
- No destructive migration or historical-data deletion was performed.
- Updated architecture, developer notes, and Applicant/Back Office user guides to state that legacy inline journal data is no longer displayed.

## Database Migration

**Migration:** `20260710170000_assignment_linked_journal_attempts`

The migration:

- adds assignment status and attempt fields;
- adds submission and journal assignment foreign keys;
- adds `lockedAt`;
- replaces original assignment uniqueness with attempt-aware uniqueness;
- adds submission and journal indexes;
- backfills only unambiguous legacy relationships;
- leaves unmatched or ambiguous legacy rows nullable rather than guessing;
- locks linked historical journals for submissions already under review or completed;
- reconciles assignment status from linked submission state.

The migration was confirmed as applied in the local Docker PostgreSQL database. Prisma Client was regenerated for the new fields and enum values.

Future local setup commands:

```powershell
npm run db:migrate
npm run db:generate
```

## Regression and Automated Testing

### Unit coverage added or expanded

- active assignment resolution;
- assignment-attempt ordering;
- journal create/update assignment linkage;
- applicant ownership and tenant scoping;
- assignment-specific locking;
- locked-entry update rejection;
- per-attempt submission creation and reuse;
- repeat-attempt creation;
- repeat idempotency and loop prevention;
- status transition rules including terminal `REPEAT`;
- exact-attempt Admin journal review lookup;
- regression-fixture cleanup ordering;
- Ops regression result grouping.

### Existing Regression Run dashboard integration

The existing runner and `REGRESSION_RESULT_JSON` format were reused. No separate dashboard or test framework was created.

| Dashboard category | Coverage added or confirmed |
| --- | --- |
| Missions | Journal assignment linking, selective locking, submission workflow, repeat separation, no duplicate/review loop. |
| Applicant | Submitted-attempt journals reject edits and remain preserved. |
| Admin | Submission review loads exact-attempt Engineering Journal context and completes the existing review action. |
| Tenant | Cross-tenant, cross-applicant, cross-mission, and cross-attempt journal records are excluded. |
| Unit | Journal, assignment, submission, workflow, cleanup, and Ops parser tests. |
| Journal | Existing dedicated Journal regression scenarios from updated `main` remain available in the shared runner. |

### Verified results

| Command | Result |
| --- | --- |
| `npm test` | Passed: 34 test files, 250 tests. Reconfirmed after removing the Submission Journal UI. |
| `npm run typecheck` | Passed across root, Applicant, Admin, and Ops TypeScript projects. Reconfirmed after the UI removal. |
| `npm run lint` | Passed with zero warnings for Applicant and Admin workspaces during the implementation verification. |
| `npm run regression:missions` | Passed: 6/6. |
| `npm run regression:applicant` | Passed: 2/2. |
| `npm run regression:admin` | Passed: 2/2. |
| `npm run regression:tenant` | Passed: 4/4. |
| `npm run regression:unit` | Passed. |
| `npm run regression:all` | Earlier run: 24 passed, 2 Ops connectivity failures, 1 documented storage skip. All new journal/assignment scenarios passed. The Ops failures occurred before the local Ops Console was started. |
| `npm run build` | Host build encountered a Windows/OneDrive `.next` readlink error; Docker builds for Admin and Applicant later completed successfully. |

## Source Control and Upstream Integration

- Committed assignment-attempt work as `db8d087` (`Link Engineering Journal to assignment attempts`).
- Created backup branch `backup/engineering-journal-mvp-2026-07-10` at the same commit.
- Pushed the feature commit to `origin/engineering-journal-mvp`.
- Fetched the latest `origin/main` without modifying remote `main`.
- Merged updated `main` into the local feature branch as `baf7463`.
- Resolved conflicts in Data Dictionary, Data Model, Back Office guide, and regression cleanup tests.
- Preserved both the newer upstream documentation/regression work and the assignment-attempt implementation.
- Removed an automatically duplicated `EngineeringJournalEntry` cleanup entry introduced by the merge.
- Verified the merged branch with 250 passing tests and successful TypeScript checks.

The feature branch is ahead of its remote after the local merge and final UI/doc changes. Remote `main` was not changed by this work.

## Local Docker and Demo Verification

- Rebuilt and restarted the `admin` and `applicant` Docker services from the updated branch.
- Confirmed Admin on `http://demo.lvh.me:3200` and Applicant on `http://demo.lvh.me:3100`.
- Confirmed the assignment-attempt migration and required indexes exist in PostgreSQL.
- Confirmed the Admin review route loads the dedicated Engineering Journal section.
- Confirmed the legacy Submission Journal section is removed in the current working tree.
- Diagnosed a review-page server error using Admin container logs: **Repeat week** was submitted without required feedback.
- Confirmed that failed review did not change the submission or assignment state.
- Confirmed that entering reviewer feedback is required before choosing **Repeat week** or **Request changes**.

The Admin container also emits a Prisma OpenSSL-detection warning. It did not prevent the container from starting or the application from connecting to the database, but installing OpenSSL in the runtime image is a future container-hardening improvement.

## Demo Data Finding

The accepted demo applicant had:

- a submitted **Build a Public Incident Status Page** assignment linked to Attempt 1; and
- an older unlinked Engineering Journal entry for **Build a Public Product Landing Page**.

The Admin review correctly did not show the unrelated legacy journal. This confirmed that mission and assignment-attempt scoping prevents unrelated reflection history from appearing during review.

## Files Changed for the Assignment-Attempt Implementation

### Admin and Applicant applications

- `apps/admin/app/missions/[id]/submissions/[submissionId]/page.tsx`
- `apps/admin/app/missions/submission-actions.ts`
- `apps/applicant/app/dashboard/journal/[id]/page.tsx`
- `apps/applicant/app/dashboard/missions/[id]/page.tsx`
- `apps/applicant/app/dashboard/missions/page.tsx`
- `apps/applicant/app/dashboard/page.tsx`
- `apps/ops/src/jobs.test.ts`

### Auth and database code

- `packages/auth/src/workflow.ts`
- `packages/auth/src/workflow.test.ts`
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260710170000_assignment_linked_journal_attempts/migration.sql`
- `packages/db/src/journal.ts`
- `packages/db/src/journal.test.ts`
- `packages/db/src/mission-assignments.ts`
- `packages/db/src/mission-assignments.test.ts`
- `packages/db/src/submissions.ts`
- `packages/db/src/submissions.test.ts`
- `packages/db/src/regression.ts`
- `packages/db/src/regression.test.ts`
- `scripts/regression/run.ts`

### Documentation

- `docs/Architecture.md`
- `docs/Data_Dictionary.md`
- `docs/Data_Model.md`
- `docs/developer-notes/Engineering_Journal_Notes.md`
- `docs/developer-notes/Engineering_Journal_Assignment_Integration.md`
- `docs/user-guides/Applicant_Portal_User_Guide.md`
- `docs/user-guides/Back_Office_User_Guide.md`
- `docs/developer-notes/2026-07-10_Engineering_Journal_Daily_Work_Log.md`

## Scope Deliberately Not Implemented

- Real AI review or scoring.
- Reviewer numeric score submission.
- Voice-to-journal entry.
- Mobile journal logging.
- AI-generated weekly reflection.
- Competency mapping changes.
- Recruiter or portfolio journal views.
- Journal delete functionality.
- Screenshot/file uploads.
- Badges.
- A rebuilt Mission Engine or new assignment-selection algorithm.
- Auth, Keycloak, or permission-matrix changes.
- Removal of `Submission.journalMarkdown` from the database.

## Remaining Follow-Up

- Commit and push the final legacy Submission Journal UI/documentation removal.
- Rerun the complete regression suite with the Ops Console running to clear the previous connectivity-only failures.
- Improve Admin review validation so missing feedback displays an inline message instead of a generic Next.js server-error page.
- Consider adding OpenSSL explicitly to the Docker runtime image to remove Prisma's detection warning.
- Decide later whether historical `Submission.journalMarkdown` data should be migrated or formally deleted before removing the schema field.

## 2026-07-11 Follow-Up: Previous Attempt Review Context

### Work completed

- Added `listPreviousMissionAttemptHistoryForSubmissionReview` in `packages/db/src/journal.ts`.
- The helper resolves the current assignment by tenant + assignment ID, then finds lower attempt
  numbers for the same tenant, program, applicant, and week.
- Mission ID is intentionally not part of the attempt-progression filter, allowing a repeated week to
  use a different mission variant.
- Each prior attempt's journals are loaded through its `journalEntries` relation and defensively kept
  only when `journal.missionAssignmentId` equals that prior assignment ID.
- Current, future, unrelated, and unlinked legacy journal records remain excluded.
- Preserved the existing current-attempt Engineering Journal query and Admin section unchanged in
  meaning.
- Added a collapsed native **Previous Attempt History** disclosure to Admin submission review. It
  contains assignment/submission results, dates, prior feedback, and structured read-only journal
  fields, with no mutation or old-attempt review controls.
- Added the repository-wide version-allocation procedure to root `AGENTS.md`. No project version was
  allocated or changed in this slice.
- No Prisma model, schema, migration, auth, Keycloak, permission, scoring, or mission-selection change
  was required.

### Tests and Regression Run dashboard

Unit coverage now verifies Attempt 1/2/3 behavior, descending attempt order, strict current/future
exclusion, tenant/applicant/program/week scoping, different-mission history, exact assignment journal
isolation, legacy-unlinked exclusion, read-only result fields, and preservation of the current-attempt
lookup.

The existing `REGRESSION_RESULT_JSON` runner gained these dashboard scenarios:

| Category | Scenario |
| --- | --- |
| Admin | `Reviewer opens read-only previous-attempt context while reviewing a later attempt` |
| Missions | `Repeated-week history stays separate across mission variants and attempt boundaries` |
| Tenant | `Previous-attempt history stays tenant, applicant, program, and week scoped` |
| Unit | Existing `Vitest unit regression suite passes` scenario includes the expanded journal helper tests. |

### Validation results

Results observed on 2026-07-11:

| Command | Result |
| --- | --- |
| `npx vitest run packages/db/src/journal.test.ts` | Passed: 1 file, 42 tests. |
| `npm test` | Passed: 34 files, 265 tests. The initial sandboxed attempt could not start esbuild (`spawn EPERM`); the approved unrestricted run passed. |
| `npm run typecheck` | Passed for root, Applicant, Admin, and Ops TypeScript projects. |
| `npm run lint` | Passed with zero warnings for the Applicant and Admin ESLint commands. |
| `npm run regression:admin` | Passed: 3/3. |
| `npm run regression:missions` | Passed: 9/9. |
| `npm run regression:tenant` | Passed: 5/5. |
| `npm run regression:unit` | Passed: 1/1 dashboard scenario. |
| `npm run regression:all` | Passed: 35; failed: 0; skipped: 1. The existing storage upload/download scenario remained its documented skip. Ops was running and both Ops connectivity scenarios passed. |
| `npm run build` | Passed for Applicant and Admin production builds. Both emitted the existing Next.js ESLint-plugin warning. |

### Files changed in this follow-up

- `AGENTS.md`
- `apps/admin/app/missions/[id]/submissions/[submissionId]/page.tsx`
- `packages/db/src/journal.ts`
- `packages/db/src/journal.test.ts`
- `scripts/regression/run.ts`
- `docs/developer-notes/Engineering_Journal_Assignment_Integration.md`
- `docs/developer-notes/Engineering_Journal_Notes.md`
- `docs/user-guides/Back_Office_User_Guide.md`
- `docs/developer-notes/2026-07-10_Engineering_Journal.md`

The changes were intentionally left uncommitted and unpushed for review.
