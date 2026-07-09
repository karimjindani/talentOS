# Engineering Journal Notes

## Overview

The Engineering Journal is a dedicated Applicant Portal module for structured intern reflection. It lives separately from the older `Submission.journalMarkdown` field that was part of mission submissions.

Journal entries are linked to assigned missions. An applicant should write reflections against the mission they were assigned, not against any published mission in the program.

## Current Journal Rules

- Applicants can create journal entries only for missions assigned to them.
- Saved journal entries open in read-only mode by default.
- Existing entries can only be changed through the explicit Edit button.
- Each applicant can have only one journal entry per entry date.
- The previous 24-hour create wait is currently disabled.
- Back-dated entries are allowed.
- Once the related assignment is submitted, journal entries for that assignment are locked.
- Locked journal entries stay readable but cannot be edited.
- Delete functionality is not implemented.

## Mission Assignment Relationship

Mission variants are seeded from Markdown spec files. The seed script reads those files and imports the Markdown content into `Mission` database records, so runtime code depends on the database record rather than the source file path.

When an applicant is accepted into a program, the system assigns them one Week 1 mission. That assignment controls which mission the applicant can see, submit work for, and journal against.

Journal creation validates mission assignment before saving an entry. This prevents applicants from creating journal entries for missions they have not been assigned.

If the applicant has already submitted the assignment for a mission, journal entries for that mission are treated as locked. The UI hides the edit flow for locked entries, and the database helper also rejects create/update attempts as a server-side guard.

## Implementation Notes

- `EngineeringJournalEntry` is the dedicated Prisma model for journal entries.
- `MissionAssignment` controls applicant mission visibility, mission submission access, and journal mission eligibility.
- `Submission.journalMarkdown` is legacy submission data. Keep it for backward compatibility unless a future migration intentionally removes it.
- AI scoring fields on journal entries are placeholders only. Real AI review and scoring are future work.

## Future Work

- Intentionally remove legacy `Submission.journalMarkdown` from the schema after old data is migrated or confirmed unnecessary.
- Add AI review and scoring.
- Add admin or reviewer visibility into applicant journal entries.
- Add recruiter and portfolio views.
- Add reminders or notifications for journal habits.
- Add export or weekly summary features.
