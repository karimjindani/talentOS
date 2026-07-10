# Engineering Journal and Assignment Integration

**Date:** 2026-07-10  
**Branch:** `engineering-journal-mvp`  
**Baseline commit:** `c7413eb` (`Implement Engineering Journal and mission assignment MVP`)

## 1. Overview

The Engineering Journal already existed as a dedicated Applicant Portal module. This implementation connects each journal entry to the exact weekly assignment attempt that the applicant is working on and connects each submission to that same attempt.

The reason for this link is review accuracy. A mission can be repeated, so mission ID alone is not enough to identify which body of work and reflection belongs to a particular submission. The agreed design keeps one continuous journal experience for the applicant while associating each individual entry with the relevant `MissionAssignment` attempt. Submitting an attempt freezes only the entries attached to that attempt; later attempts retain separate history.

The legacy `Submission.journalMarkdown` field remains available for backward compatibility, but it is not displayed in applicant or admin interfaces. Admin review uses dedicated Engineering Journal entries.

## 2. Work Completed

### Schema and Prisma changes

- Added `MissionAssignmentStatus` with `ACTIVE`, `SUBMITTED`, `PASSED`, and `REPEAT` values.
- Added `REPEAT` to `SubmissionStatus`.
- Added `attemptNumber` and `status` to `MissionAssignment`.
- Added nullable `missionAssignmentId` relationships to `Submission` and `EngineeringJournalEntry`.
- Added nullable `EngineeringJournalEntry.lockedAt` as the persisted read-only marker.
- Changed assignment uniqueness to tenant + program + applicant + week + attempt number.
- Added a unique index for one submission per non-null assignment attempt.
- Added an assignment/date index for journal review queries.
- Kept assignment links nullable so ambiguous legacy data is not assigned to the wrong attempt.

### Journal-to-assignment linking

New journal entries resolve and store the applicant's active assignment for the selected published mission. Creation still validates tenant, applicant, accepted program, published mission, assignment ownership, confidence rating, entry date uniqueness, and the existing journal content rules.

The application continues to present one journal history. The assignment ID is internal context that allows submissions, repeat attempts, and admin review to select the correct subset of entries.

### Active assignment determination

`getActiveMissionAssignmentForMissionTx` filters by tenant, applicant, mission, `ACTIVE` status, and published mission status, then selects the highest `attemptNumber`. Journal creation, journal updates, and submission draft creation use this assignment-aware lookup.

The Week 1 assignment-selection algorithm was not rebuilt. Existing accepted-applicant assignment logic still selects from published missions; this slice adds attempt awareness to that existing model.

### Locking after submission

Submitting a submission now performs the following work in one database transaction:

1. Confirms that the submission belongs to the tenant and applicant.
2. Changes the submission to `SUBMITTED`.
3. Sets `lockedAt` only on journal entries with the same tenant, applicant, and `missionAssignmentId`.
4. Changes the linked assignment from `ACTIVE` to `SUBMITTED`.

Revision, resubmission, acceptance, and repeat review do not clear `lockedAt`.

### Preventing changes to locked entries

The Applicant Portal hides edit mode when `lockedAt` is present. The database update helper also rejects updates to locked entries, so direct requests cannot bypass the UI guard. There is no applicant journal delete action or delete UI; delete functionality was not added by this implementation.

Legacy journal rows without an assignment link retain a compatibility check against the associated submission status.

### Admin submission review visibility

The admin submission review page shows an **Engineering Journal** section containing dedicated entries matching the submission's tenant, applicant, mission, and assignment attempt. The legacy inline Submission Journal section has been removed.

`listEngineeringJournalEntriesForSubmissionReview` returns only the fields needed for review and sorts entries by entry date and creation time. Reviewers cannot edit or delete journal entries from the admin page.

### Review scoring

No numeric reviewer scoring feature was implemented. The existing nullable Engineering Journal AI scoring columns remain placeholders. Admins can complete the existing submission review action and provide reviewer feedback, but there is no reviewer score schema, score form, or score submission action in the verified code.

### Repeat-week and multiple-attempt handling

A reviewer may mark a submitted attempt as `REPEAT` with required feedback. That action:

- marks the current submission and assignment attempt as `REPEAT`;
- leaves the old submission and locked journals unchanged;
- creates exactly one next `ACTIVE` attempt for the same tenant, program, applicant, week, and mission;
- allows new draft evidence and journal entries to attach to the new attempt.

`REPEAT` is terminal for the old submission. Re-reviewing it cannot create another attempt, preventing duplicate or infinite repeat loops. A normal `NEEDS_REVISION` review continues to reuse the same assignment attempt.

### Existing-entry migration and backfill

Migration `20260710170000_assignment_linked_journal_attempts` performs a conservative backfill:

- Existing assignments become Attempt 1 and default to `ACTIVE` before status reconciliation.
- A legacy submission receives `missionAssignmentId` only when tenant + applicant + mission identifies exactly one assignment.
- A legacy journal receives `missionAssignmentId` only when tenant + applicant + mission + week identifies exactly one assignment.
- Ambiguous or unmatched rows remain nullable instead of being guessed.
- Linked journals for already-submitted submissions receive `lockedAt` from `submittedAt`, falling back to `updatedAt`.
- Assignment status is reconciled to `PASSED`, `SUBMITTED`, or `ACTIVE` from linked submission state.

## 3. Regression Testing

### Unit tests

Unit coverage was added or updated for:

- active assignment resolution and attempt ordering;
- journal creation/update assignment linkage;
- assignment-scoped locking;
- locked-entry update rejection;
- submission linkage and per-attempt draft behavior;
- repeat-attempt creation and idempotency protections;
- submission status transitions including terminal `REPEAT`;
- regression cleanup for journal, assignment, submission, and tenant fixtures;
- Ops parsing of categorized regression results.

### Regression Run dashboard integration

The existing runner and `REGRESSION_RESULT_JSON` format were reused. No separate dashboard or regression framework was created.

| Dashboard category | Integrated coverage |
| --- | --- |
| Missions | Submission lifecycle remains operational; journals link to the active assignment; submitting locks only that assignment's journals; repeat attempts preserve separate journal/submission history; repeat/re-review does not duplicate rows or loop. |
| Applicant | A journal linked to a submitted assignment rejects edits and remains preserved; no applicant delete flow exists. |
| Admin | Review loads exact-attempt Engineering Journal context, then completes the existing review action. Numeric score submission is not represented because it is not implemented. |
| Tenant | Journal review queries exclude rows from another tenant even when applicant, mission, and assignment IDs match. |
| Unit | Journal, assignment, submission, workflow, cleanup, and Ops result-parser tests run through the existing Vitest unit regression scenario. |

### Commands and results

Results observed on 2026-07-10:

| Command | Result |
| --- | --- |
| `npm test` | Passed: 34 test files, 250 tests. |
| `npm run typecheck` | Passed for the root, Applicant Portal, Admin Portal, and Ops Console TypeScript projects. |
| `npm run lint` | Passed with zero warnings for Applicant and Admin workspaces. |
| `npm run build` | Not completed in the final fresh run: Next.js hit Windows/OneDrive `EINVAL` while reading `apps/applicant/.next/diagnostics/framework.json`. This was an existing generated-output/environment issue, not a reported TypeScript compilation error. |
| `npm run regression:missions` | Passed: 6/6. |
| `npm run regression:applicant` | Passed: 2/2. |
| `npm run regression:admin` | Passed: 2/2. |
| `npm run regression:tenant` | Passed: 4/4. |
| `npm run regression:unit` | Passed: 1/1 runner scenario; the underlying Vitest suite passed. |
| `npm run regression:all` | Partial environment result: 24 passed, 2 failed, 1 skipped. Both failures were Ops Console connectivity checks because the local service on port 3300 was not running. The storage scenario remained the suite's documented skip. All new journal/assignment scenarios passed. |

Run the complete existing dashboard suite with:

```powershell
npm run regression:all
```

## 4. Files Changed

This table reflects the working-tree diff against baseline commit `c7413eb` at documentation time.

| File path | Purpose | Change |
| --- | --- | --- |
| `apps/admin/app/missions/[id]/submissions/[submissionId]/page.tsx` | Shows dedicated Engineering Journal entries read-only, assignment attempt context, and the Repeat week review option; the legacy Submission Journal UI is removed. | Modified |
| `apps/admin/app/missions/submission-actions.ts` | Accepts `REPEAT` as a review decision and requires feedback for repeat/revision outcomes. | Modified |
| `apps/applicant/app/dashboard/journal/[id]/page.tsx` | Uses persisted `lockedAt` for read-only behavior and retains legacy lock compatibility. | Modified |
| `apps/applicant/app/dashboard/missions/[id]/page.tsx` | Displays the `REPEAT` submission state. | Modified |
| `apps/applicant/app/dashboard/missions/page.tsx` | Displays the `REPEAT` state in mission list status chips. | Modified |
| `apps/applicant/app/dashboard/page.tsx` | Displays the `REPEAT` state in dashboard submission status UI. | Modified |
| `apps/ops/src/jobs.test.ts` | Verifies journal regressions appear in existing Missions, Admin, Applicant, Tenant, and Unit dashboard categories. | Modified |
| `docs/Data_Dictionary.md` | Documents assignment attempts, assignment links, lock timestamp, repeat status, and regression fixture types. | Modified |
| `docs/Data_Model.md` | Documents attempt relationships, history isolation, journal locks, and repeat behavior. | Modified |
| `docs/developer-notes/Engineering_Journal_Notes.md` | Updates journal notes for assignment-attempt linking, locking, repeat behavior, and the disabled 24-hour wait. | Modified |
| `docs/user-guides/Back_Office_User_Guide.md` | Explains read-only journal review context and repeat-week review behavior. | Modified |
| `packages/auth/src/workflow.test.ts` | Tests `REPEAT` transitions, terminal behavior, and submission editability. | Modified |
| `packages/auth/src/workflow.ts` | Adds `REPEAT` to the submission workflow as a terminal attempt outcome. | Modified |
| `packages/db/prisma/schema.prisma` | Adds assignment attempt/status fields, submission/journal relationships, lock timestamp, indexes, and repeat status. | Modified |
| `packages/db/prisma/migrations/20260710170000_assignment_linked_journal_attempts/migration.sql` | Applies additive attempt links and conservative legacy backfills. | Created |
| `packages/db/src/journal.test.ts` | Tests assignment linkage, exact review scope, lock behavior, ownership, and current no-wait back-dating behavior. | Modified |
| `packages/db/src/journal.ts` | Resolves active assignments, stores attempt links, enforces locks, and provides scoped admin review reads. | Modified |
| `packages/db/src/mission-assignments.test.ts` | Tests attempt-aware assignment listing and ordering. | Modified |
| `packages/db/src/mission-assignments.ts` | Adds active-assignment lookup and safe creation of the next repeat attempt. | Modified |
| `packages/db/src/regression.test.ts` | Tests cleanup ordering for assignment-linked journal fixtures. | Modified |
| `packages/db/src/regression.ts` | Supports cleanup of Engineering Journal and tenant regression records. | Modified |
| `packages/db/src/submissions.test.ts` | Tests per-attempt draft/submit/review behavior, selective locks, repeat attempts, and progress. | Modified |
| `packages/db/src/submissions.ts` | Links submissions to attempts, locks exact journals, updates assignment status, and handles repeat reviews. | Modified |
| `scripts/regression/run.ts` | Adds assignment/journal scenarios to the existing Missions, Applicant, Admin, and Tenant categories. | Modified |
| `docs/developer-notes/Engineering_Journal_Assignment_Integration.md` | Records this verified implementation, migration, file inventory, scope, and validation evidence. | Created |

## 5. Database and Migration Notes

**Migration:** `20260710170000_assignment_linked_journal_attempts`

New database elements:

- `MissionAssignmentStatus` enum.
- `MissionAssignment.attemptNumber` and `MissionAssignment.status`.
- `Submission.missionAssignmentId` nullable foreign key and unique index.
- `EngineeringJournalEntry.missionAssignmentId` nullable foreign key.
- `EngineeringJournalEntry.lockedAt` nullable timestamp.
- Attempt uniqueness and journal assignment/date indexes.

Future developers should run:

```powershell
npm run db:migrate
npm run db:generate
```

Prisma Client must be regenerated after schema changes so generated model types include the new enum, fields, and relationships. Production deployment should use the repository's established migration deployment process rather than creating a second migration for the same change.

## 6. Permissions and Security

- Journal create/update/read helpers require tenant and applicant identifiers and validate applicant ownership.
- Journal creation and submission draft creation require the selected mission to be published, assigned to the applicant, and part of an accepted program.
- Admin review journal queries filter by tenant ID, applicant ID, mission ID, and assignment ID.
- The admin page uses the already authorized submission's identifiers; it does not expose a raw unscoped journal lookup.
- Existing reviewer permissions and tenant guards were preserved. No new journal write permission was granted to admins, HR, or reviewers.
- Submitted-attempt journals are read-only in the UI and protected by a server-side update rejection.
- There is no journal delete action in either the Applicant Portal or Admin Portal.

## 7. Decisions and Scope

### Included decisions

- Keep one continuous applicant journal, with each entry linked internally to an assignment attempt.
- Preserve legacy `Submission.journalMarkdown` only for data compatibility; do not display it in applicant or admin interfaces.
- Keep ambiguous legacy assignment links nullable rather than guessing.
- Use a fresh attempt for Repeat week while preserving old evidence and reflections.
- Keep the previous 24-hour journal creation wait disabled; one-entry-per-applicant-per-entry-date still applies.

### Intentionally excluded

- Badges were intentionally excluded.
- The Mission Engine and mission-selection balancing rules were not rebuilt.
- Numeric reviewer scoring was not implemented.
- AI review/scoring remains placeholder data only.
- No journal delete feature was added.
- No auth, Keycloak, permission-matrix, recruiter portfolio, or unrelated admin changes were made.

### Assumptions and unresolved TODOs

- The migration assumes ambiguous historical rows are safer left unlinked for manual follow-up.
- Reviewer scoring needs a separately agreed schema, validation rules, permissions, and UI before regression coverage can claim score submission.
- The final production build should be rerun after resolving or clearing the OneDrive-managed `.next` generated-output issue.
- The complete regression suite should be rerun with the Ops Console running on port 3300 to clear the two connectivity failures.
- Storage upload/download regression remains a pre-existing documented skip.

## 8. Validation Summary

The implementation is covered by passing unit, type, lint, Missions, Applicant, Admin, Tenant, and Unit regression checks. The new scenarios are emitted through the existing structured result format and therefore appear in the existing DevOps Regression Run dashboard category cards.

The only incomplete validations are environmental: the fresh build encountered the OneDrive `.next` readlink error, and the complete regression run could not reach the stopped Ops Console. These limitations do not change the passing results for the journal/assignment integration scenarios.
