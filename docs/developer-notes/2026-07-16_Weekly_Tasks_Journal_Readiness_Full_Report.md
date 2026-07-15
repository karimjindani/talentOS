# Weekly Tasks, Resources, Journal, and Submission Readiness Implementation Report

**Date:** 2026-07-16

**Branch:** `engineering-journal-mvp`

**Status:** Implemented and validated locally; not committed or pushed

## 1. Overview

This implementation connects four existing TalentOS areas into one submission-readiness workflow:

1. Required learning tasks for each program week
2. Markdown and YouTube learning resources attached to those tasks
3. Engineering Journal entries linked to the current mission-assignment attempt
4. Mission submission checks covering tasks, journals, and public evidence URLs

The implementation preserves the existing Mission Engine, mission-assignment selection, submission
review workflow, journal attempt isolation, authentication, and permissions. It does not add badges,
AI scoring, numeric reviewer scoring, journal deletion, or a separate regression framework.

## 2. Existing Architecture Reused

The work extends existing models and helpers instead of creating parallel concepts:

- `ProgramTask` remains the weekly task model.
- `VideoResource` remains the resource model/table for backward compatibility and now represents both
  Markdown and YouTube resources.
- `UserTaskCompletion` remains the applicant task-completion record.
- `MissionAssignment` remains the source of the applicant's active program, mission, week, and attempt.
- `EngineeringJournalEntry` remains the dedicated journal model and keeps assignment-attempt linkage.
- `Submission` and the existing submission status workflow remain authoritative.
- Existing tenant-scoping, audit, notification, repeat-week, and journal-locking patterns were reused.

No auth, Keycloak, permission-matrix, mission-randomization, or mission-selection code was redesigned.

## 3. Schema and Migration Work

Migration: `20260716090000_weekly_tasks_submission_readiness`

The Prisma schema and additive migration now provide:

- `LearningResourceType` with `MARKDOWN` and `YOUTUBE` values.
- `required` and `published` controls on `ProgramTask`.
- Ordered task-resource relationships.
- Markdown content, optional URL, ordering, and optional duration on `VideoResource`.
- `tenantId` on `UserTaskCompletion`.
- Unique completion records for `tenantId + userId + taskId`.
- Lookup indexes for program-week tasks, task resources, and applicant completions.
- A safe completion-tenant backfill before the new field becomes required.

The migration does not destructively remove legacy fields or data. It was applied successfully to the
local development database, Prisma Client was regenerated, and all 15 migrations report as current.

## 4. Weekly Tasks and Completion

Tasks are program-week content. They are loaded by `tenantId + programId + weekNumber`, not by mission
ID. The applicant's validated `MissionAssignment` supplies the program and week.

Task completion is week-level and stored in `UserTaskCompletion`. The completion helper:

- Validates tenant and applicant ownership.
- Requires an accepted application and active assignment.
- Confirms the task belongs to the applicant's exact program and week.
- Requires the task to be published.
- Prevents cross-tenant, cross-program, and cross-week completion.
- Uses an idempotent upsert, so repeated requests do not create duplicate records.
- Writes audit data.

Task completion is intentionally not attached to a mission-assignment attempt. If an applicant repeats
a week, completed learning/setup tasks remain complete.

## 5. Learning Resources

Each task can have multiple ordered resources. The MVP supports:

- `MARKDOWN`: content stored in the database and rendered read-only with a safe Markdown component.
- `YOUTUBE`: an optional public YouTube URL, title, ordering, and duration metadata.

Applicant resource queries are tenant-scoped. Raw HTML is not enabled in Markdown rendering. Valid
YouTube links open safely in a new tab. Resources without a final video URL display a clear pending state
instead of using a fake link.

The Admin program-content screen now supports task assignment, resource type, Markdown content,
YouTube URL, ordering, duration, required state, and published state. It also warns when required
resources or final YouTube URLs are missing.

## 6. Week 1 Seed Content

Three ordered, required, published Week 1 tasks were seeded:

1. Environment Setup
2. Git and GitHub Basics
3. Introduction to AI-Assisted Coding

Each task receives Markdown and YouTube resource metadata, producing six task resources. The final
TalentOS YouTube video was not supplied, so YouTube URLs remain explicitly pending.

Markdown source material was added for:

- Introduction to TalentOS
- Git and GitHub basics
- AI-assisted coding
- A roughly three-minute Introduction to TalentOS video script outline

The script explains TalentOS, the four-week journey, tasks, resources, missions, the Engineering
Journal, submissions, reviews, and the purpose of evidence and reflection. It is source material for
future NotebookLM/video production and is not presented as a completed video.

## 7. Applicant Portal Changes

The Applicant Portal now shows the current assigned week, ordered required tasks, completion state,
overall progress, remaining submission blockers, Markdown resources, and YouTube resources.

Applicants can mark a task complete through a server action. Uncompleting tasks was not added because it
is outside the approved MVP scope.

The mission submission area now uses the central readiness result to show:

- Required weekly-task progress
- Current-attempt Engineering Journal progress toward four entries
- Presence and format state for GitHub, deployment, and Loom evidence
- Public-access checks that run when the applicant submits for review

The UI can disable submission for known incomplete requirements, but the backend remains authoritative.

## 8. Engineering Journal Changes

The dedicated Engineering Journal keeps the existing assignment-attempt relationship and locking rules.
The following behavior was added or confirmed:

- No 24-hour creation cooldown.
- Multiple entries across a week are allowed.
- The existing one-entry-per-applicant-per-calendar-date rule remains.
- Browser and server validation reject future `entryDate` values.
- Past dates and the applicant's current local calendar date are accepted.
- The form sends the browser's IANA timezone so server validation does not incorrectly treat a local
  current date as a future UTC date.
- `entryDate`, `createdAt`, `updatedAt`, `lockedAt`, and submission `submittedAt` remain separate values.
- Time spent accepts explicit values from 0.25 through 24 hours.
- Evidence URLs containing credentials are rejected.
- Assignment linkage cannot be moved through journal editing.
- Locked entries remain read-only and deletion remains out of scope.

The form includes practical examples for work completed, challenges, AI usage, and evidence. Confidence
uses five labelled native radio inputs with radiogroup semantics and accessible scale guidance:

1. I need significant help
2. I understand a small part
3. I can continue with some guidance
4. I can work mostly independently
5. I could explain this to someone else

## 9. Four-Entry Journal Requirement

Submission readiness requires at least four eligible Engineering Journal entries. An eligible entry must:

- Belong to the validated tenant and applicant.
- Belong to the exact current `MissionAssignment` attempt.
- Not be an unlinked legacy entry.
- Not belong to a previous or different attempt.
- Not have a future journal date.

The rule is a minimum count of four entries. It does not require entries on specifically named weekdays.

## 10. Central Submission Readiness

`getMissionSubmissionReadiness` is the shared server-side source of truth used by the Applicant checklist,
final submission action, tests, and regression scenarios.

It loads the tenant-scoped assignment and resolves the applicant, program, mission, and week from that
assignment rather than trusting browser-supplied identifiers. It then returns:

- Required, completed, and incomplete weekly tasks
- Required and completed current-attempt journal counts
- GitHub, deployment, and Loom presence/format results
- Actionable readiness blockers
- An overall `ready` result

This avoids maintaining different submission rules in the page and backend.

## 11. URL Validation and Public Reachability

Final submission requires:

- A GitHub repository URL in `github.com/<owner>/<repository>` form
- A public deployment HTTP(S) URL
- A supported Loom share/watch URL

The server validates syntax and immediately checks public reachability. The checker uses:

- Credential-free HTTP(S) URLs only
- A four-second timeout
- At most three redirects
- `HEAD` first, with a bounded `GET` fallback
- No large response-body downloads
- Clear applicant-facing failures without internal stack traces
- Explicit GitHub rate-limit feedback

Automated URL tests use mocked DNS and HTTP behavior and do not depend on live external services.

## 12. SSRF Protections

The public URL checker rejects:

- Localhost and loopback destinations
- Internal-only hostnames
- Private, reserved, link-local, and metadata IPv4 destinations
- Private, reserved, and link-local IPv6 destinations
- URLs containing credentials
- Redirects into blocked networks
- Any hostname for which a DNS answer resolves to a blocked address

Every redirect target is revalidated. Connections are pinned to the checked DNS address to reduce DNS
rebinding risk.

## 13. Transaction and Failure Safety

Submission follows this order:

1. Validate database readiness and ownership.
2. Perform external URL checks outside a database transaction.
3. Start a short transaction.
4. Recheck critical readiness and status conditions.
5. Update the submission with a status-guarded operation.
6. Set `submittedAt` and assignment status.
7. Lock only journals belonging to the exact current attempt.
8. Write existing audit and notification records.

If any task, journal, URL, reachability, ownership, or concurrency check fails, TalentOS does not partially
submit. The submission remains in its prior state, the assignment is not marked submitted, and journals
are not locked.

## 14. Repeat and Revision Behavior

Existing behavior remains intact:

- `NEEDS_REVISION` continues on the existing attempt and reruns readiness and URL checks.
- Previously submitted journal entries remain locked.
- `REPEAT` closes the old attempt and creates a fresh assignment attempt.
- The new attempt requires four new attempt-linked journal entries.
- Previous-attempt journals remain excluded and preserved as history.
- Week-level task completions remain complete after a repeat.
- New submission evidence must be supplied and checked again.

## 15. Regression Dashboard Integration

Scenarios were integrated into `scripts/regression/run.ts` and the existing
`REGRESSION_RESULT_JSON`/Ops dashboard. No new dashboard or test framework was introduced.

Relevant categories and scenarios include:

- **Applicant:** `Applicant completes an assigned-week task and future journal dates are rejected`
- **Admin:** `Admin content path exposes ordered Markdown and YouTube resources for a weekly task`
- **Programs:** program-week content management and role restrictions
- **Missions:** `Submission readiness requires weekly tasks, four current-attempt journals, and all evidence URLs`
- **Missions:** repeat-attempt separation, journal locking, and no repeat/advance loop
- **Tenant:** `Submission readiness ignores task completions from another tenant, applicant, or week`
- **Unit:** readiness, URL safety, journal dates, task completion, seed content, and safe Markdown tests

The Ops Regression Run dashboard displays these scenarios under the existing categories.

## 16. Validation Results

| Command or check | Actual result |
| --- | --- |
| `npx prisma validate --schema packages/db/prisma/schema.prisma` | Passed |
| `npm run db:migrate` | Passed; migration applied |
| `npm run db:generate` | Passed |
| `npm test` | Passed: 38 files, 300 tests |
| `npm run typecheck` | Passed for root, Applicant, Admin, and Ops |
| `npm run lint` | Passed with zero warnings |
| `npm run build` | Applicant and Admin passed |
| `npm run regression:applicant` | Passed: 3/3 |
| `npm run regression:missions` | Passed: 10/10 |
| `npm run regression:programs` | Passed: 2/2 |
| `npm run regression:tenant` | Passed: 6/6 |
| `npm run regression:admin` | Passed: 4/4 |
| `npm run regression:unit` | Passed: 1/1 |
| `npm run regression:all` | Passed: 39/40, 0 failed, 1 skipped |
| `npm run local:doctor` | Passed for Applicant, Admin, tenant routes, Keycloak, MinIO, and Ops |
| `git diff --check` | Passed; only expected Windows LF/CRLF notices |

The only skipped regression is the repository's pre-existing documented storage browser
upload/download scenario. It is unrelated to this implementation.

## 17. Manual Verification

### Applicant Portal

- Confirmed all three ordered Week 1 tasks display.
- Confirmed six Markdown/YouTube resource records display.
- Marked all three required tasks complete and observed `3 of 3` progress.
- Confirmed safe Markdown display and explicit pending-video states.
- Confirmed journal placeholders, labels, radio semantics, and confidence guidance.
- Confirmed date default/max use the applicant's local `Asia/Karachi` calendar date.
- Created four current-attempt demo journal entries and observed `4 of 4` progress.
- Confirmed the readiness checklist reports current blockers.
- Confirmed unreachable evidence URLs produce useful field-specific errors.
- Confirmed a failed URL check does not submit or lock the journals.

### Admin Portal

- Confirmed three required/published tasks and six resources are visible in program content.
- Confirmed resource ordering and task relationships.
- Confirmed pending YouTube and missing-resource warnings display.
- Confirmed existing permissions and submission review behavior remain unchanged.

### Ops Console

- Confirmed the full regression run renders in the existing dashboard.
- Final dashboard result: 39 of 40 passed, 0 failed, 1 skipped.
- Confirmed Applicant, Admin, Programs, Missions, Tenant, and Unit category details render.

## 18. Files Modified

- `apps/admin/app/programs/[id]/content/actions.ts`
- `apps/admin/app/programs/[id]/content/page.tsx`
- `apps/applicant/app/dashboard/journal/JournalEntryForm.tsx`
- `apps/applicant/app/dashboard/journal/actions.ts`
- `apps/applicant/app/dashboard/missions/[id]/SubmissionForm.tsx`
- `apps/applicant/app/dashboard/missions/[id]/page.tsx`
- `apps/applicant/app/dashboard/page.tsx`
- `apps/applicant/app/dashboard/program/page.tsx`
- `apps/applicant/app/dashboard/resources/page.tsx`
- `apps/applicant/app/dashboard/tasks/page.tsx`
- `docs/Architecture.md`
- `docs/Data_Dictionary.md`
- `docs/Data_Model.md`
- `docs/Regression_Scenarios.md`
- `docs/developer-notes/Engineering_Journal_Notes.md`
- `docs/user-guides/Applicant_Portal_User_Guide.md`
- `docs/user-guides/Back_Office_User_Guide.md`
- `packages/db/prisma/schema.prisma`
- `packages/db/src/dashboard.test.ts`
- `packages/db/src/dashboard.ts`
- `packages/db/src/index.ts`
- `packages/db/src/journal.test.ts`
- `packages/db/src/journal.ts`
- `packages/db/src/mission-assignments.ts`
- `packages/db/src/program-content.test.ts`
- `packages/db/src/program-content.ts`
- `packages/db/src/submissions.test.ts`
- `packages/db/src/submissions.ts`
- `scripts/regression/run.ts`
- `scripts/seed-dashboard.ts`

## 19. Files Created

- `apps/applicant/app/dashboard/tasks/TaskCompletionButton.tsx`
- `apps/applicant/app/dashboard/tasks/actions.ts`
- `apps/applicant/components/SafeMarkdown.tsx`
- `apps/applicant/components/SafeMarkdown.test.ts`
- `docs/developer-notes/Weekly_Tasks_And_Submission_Readiness.md`
- `docs/developer-notes/2026-07-16_Weekly_Tasks_Submission_Readiness.md`
- `docs/developer-notes/2026-07-16_Weekly_Tasks_Journal_Readiness_Full_Report.md` (this report)
- `packages/db/prisma/migrations/20260716090000_weekly_tasks_submission_readiness/migration.sql`
- `packages/db/prisma/seed-data/tasks/ai-native-engineering/week-1/introduction-to-talentos.md`
- `packages/db/prisma/seed-data/tasks/ai-native-engineering/week-1/introduction-to-talentos-video-script.md`
- `packages/db/prisma/seed-data/tasks/ai-native-engineering/week-1/git-and-github-basics.md`
- `packages/db/prisma/seed-data/tasks/ai-native-engineering/week-1/ai-assisted-coding.md`
- `packages/db/src/submission-readiness.ts`
- `packages/db/src/submission-readiness.test.ts`
- `packages/db/src/task-seed.test.ts`
- `packages/db/src/url-safety.ts`
- `packages/db/src/url-safety.test.ts`

## 20. Assumptions and Remaining Work

- The real TalentOS introduction video and final YouTube URL still need to be supplied.
- A live successful submission was not manually completed because real public GitHub, deployment, and
  Loom URLs were unavailable. Deterministic tests cover success, locking, repeat, and concurrency paths.
- The confidence control has correct native radio/radiogroup semantics. A final test using a physical
  keyboard remains useful because the browser automation's synthetic arrow key did not change selection.
- Docker emits an existing Prisma/OpenSSL detection warning, but both applications build and run.
- Manual verification changed local demo data by completing three tasks and adding four journal entries.
- Badges, AI scoring, numeric reviewer scoring, recruiter journal views, journal deletion, file uploads,
  NotebookLM automation, and completed video upload remain out of scope.

## 21. Git State at Report Creation

- Branch: `engineering-journal-mvp`
- 30 modified files
- 17 untracked/created files, including this report
- Nothing staged
- Nothing committed
- Nothing pushed

The implementation remains in the local working tree for review.
