# Engineering Journal Notes

## Overview

The Engineering Journal is a dedicated Applicant Portal module for structured intern reflection. It lives separately from the older `Submission.journalMarkdown` field that was part of mission submissions.

Journal entries are linked to the applicant's active `MissionAssignment` attempt as well as its mission. This keeps one continuous journal while preventing repeat-week attempts from sharing review history.

## Current Journal Rules

- Applicants can create journal entries only for missions assigned to them.
- Saved journal entries open in read-only mode by default.
- Existing entries can only be changed through the explicit Edit button.
- Each applicant can have only one journal entry per entry date.
- There is no 24-hour creation cooldown.
- Today and back-dated entries are allowed; future `entryDate` values are rejected in the browser and
  again by `packages/db/src/journal.ts`. The form uses the applicant browser's IANA time zone so local
  today does not lag behind UTC around midnight.
- Once the related assignment is submitted, journal entries for that assignment are locked.
- Locked journal entries stay readable but cannot be edited.
- The persisted `lockedAt` timestamp is not cleared by revision, resubmission, acceptance or repeat.
- Delete functionality is not implemented.

`entryDate` is the applicant-selected calendar date. It does not replace `createdAt`, `updatedAt`,
`lockedAt`, or `Submission.submittedAt`; each timestamp retains its separate meaning.

## Mission Assignment Relationship

Mission variants are seeded from Markdown spec files. The seed script reads those files and imports the Markdown content into `Mission` database records, so runtime code depends on the database record rather than the source file path.

When an applicant is accepted into a program, the system assigns them one Week 1 mission. That assignment controls which mission the applicant can see, submit work for, and journal against.

Journal creation validates the active assignment attempt and stores its ID. This prevents applicants from creating entries for unassigned missions or closed attempts.

Submitting an assignment sets `lockedAt` only on journal entries with the same tenant, applicant and assignment ID. The UI hides the edit flow for locked entries, and the database helper rejects updates as a server-side guard.

A **Repeat week** review marks the old submission and assignment attempt as `REPEAT`, then creates one new active attempt for the same week. The old submission and locked journals remain unchanged. Double review is rejected, preventing duplicate attempts or repeat loops.

## Submission Readiness

The central `getMissionSubmissionReadiness` helper requires at least four eligible entries before an
assignment can be submitted. Its journal query always filters by tenant, applicant, and the exact
current `missionAssignmentId`, and excludes future-dated rows. Previous attempts, another mission,
another applicant/tenant, and unlinked legacy records do not count.

Week-level task completion is intentionally different: required tasks are derived from the
assignment's program and week and remain complete across repeat attempts. A `NEEDS_REVISION` review
reuses the same attempt and keeps already submitted entries locked; applicants may add new entries to
the reopened attempt. A `REPEAT` review creates a new attempt whose journal count starts at zero.

## Admin Review Behavior

The current submission attempt's Engineering Journal is the primary review evidence. On Attempt 2 or
later, reviewers may expand **Previous Attempt History** for optional read-only context. The progression
lookup matches tenant, program, applicant, and week while intentionally allowing a prior attempt to use
a different mission. Each prior attempt remains a separate group, and its journal entries are selected
only through that exact `missionAssignmentId`. Current attempts, future attempts, unrelated records,
and unlinked legacy journal entries are excluded. Admin review does not expose journal edit or delete
controls.

## Implementation Notes

- `EngineeringJournalEntry` is the dedicated Prisma model for journal entries.
- `MissionAssignment` controls applicant mission visibility, mission submission access, and journal mission eligibility.
- `Submission.missionAssignmentId` and `EngineeringJournalEntry.missionAssignmentId` preserve attempt-level review context.
- `Submission.journalMarkdown` is legacy submission data. Keep it for backward compatibility unless a future migration intentionally removes it.
- AI scoring fields on journal entries are placeholders only. Real AI review and scoring are future work.

## Future Work

- Intentionally remove legacy `Submission.journalMarkdown` from the schema after old data is migrated or confirmed unnecessary.
- Add AI review and scoring.
- Add review scoring for repository, deployment, video and journal quality.
- Add recruiter and portfolio views.
- Add reminders or notifications for journal habits.
- Add export or weekly summary features.
