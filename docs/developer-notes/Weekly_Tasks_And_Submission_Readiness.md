# Weekly Tasks And Submission Readiness

## Purpose

This feature joins existing program-week tasks, task learning resources, assignment-linked Engineering
Journal entries, and mission submissions into one server-authoritative readiness flow. It reuses
`ProgramTask`, `VideoResource`, `UserTaskCompletion`, `MissionAssignment`,
`EngineeringJournalEntry`, and `Submission`; no duplicate task/resource/assignment models were added.

## Scope Boundaries

- Tasks belong to a tenant, program, and week. They do not belong to a mission.
- Task completion belongs to tenant + applicant + task. It does not belong to an assignment attempt.
- Journal readiness belongs to the exact current `MissionAssignment` attempt.
- Submission URLs belong to the current `Submission` and are checked when Submit for Review is used.

This distinction is important for repeat weeks: learning tasks remain complete, while the new attempt
must collect at least four newly linked journals and submit fresh evidence.

## Tasks And Completion

`ProgramTask.required` decides whether an incomplete task blocks submission.
`ProgramTask.published` decides whether the task is visible/completable by applicants. Queries use
tenant + program + week and stable `order`/creation ordering.

`UserTaskCompletion` now includes `tenantId` and is unique on
`[tenantId, userId, taskId]`. `markApplicantTaskCompleted` validates:

- the supplied assignment is active, tenant-scoped, and owned by the applicant;
- the applicant has an accepted application for the assignment's program;
- the task is published and belongs to that same tenant/program/week.

The write is an idempotent upsert and records a `task.completed` audit event. Uncomplete is out of
scope.

## Learning Resources

The existing `VideoResource` name is kept for database compatibility, but the model now represents an
ordered `MARKDOWN` or `YOUTUBE` learning resource. A resource may point to a `ProgramTask`; when it
does, the task supplies the authoritative week.

- Markdown resources require `markdownContent` and clear `url`.
- YouTube resources accept only credential-free HTTPS `youtube.com` or `youtu.be` URLs.
- A YouTube URL may be null to represent a documented pending-video state.
- Applicant Markdown is converted to React text elements; raw HTML is not injected.
- External links use safe new-tab attributes.

The Week 1 seed creates **Environment Setup**, **Git and GitHub Basics**, and **Introduction to
AI-Assisted Coding**, each required/published and paired with Markdown and YouTube resource records.
The introductory **Introduction to TalentOS** YouTube URL is pending. A roughly three-minute script
outline is stored under the task seed-data directory for production through NotebookLM outside the
application. No fake video URL is seeded.

## Journal Rules Used By Readiness

`entryDate` is normalized to a UTC date-only storage value. Today and past dates are accepted; future
dates are rejected server-side using the applicant browser's IANA time zone. The browser also sets the
date input maximum to its local today. The existing one-entry-per-applicant/date rule remains, and there
is no 24-hour cooldown.

The readiness count includes only rows matching tenant + applicant + exact `missionAssignmentId` and
uses the latest legitimate global calendar date as its upper bound so a locally valid entry east of UTC
is not lost around midnight. At least four are required. Previous-attempt, unrelated, clearly
future-dated, and unlinked legacy journals do not count.

## Central Readiness And Submission

`packages/db/src/submission-readiness.ts` exports `getMissionSubmissionReadiness`. It resolves the
program, week, and mission from the validated assignment and reports required/completed tasks,
eligible journals, URL format state, and actionable blockers. The Applicant mission page and final
submit helper both use this result.

`submitSubmission` follows this order:

1. Validate tenant, applicant ownership, assignment linkage, and draft/revision state.
2. Evaluate database readiness.
3. Check public URL reachability outside a transaction.
4. Open a short transaction and re-evaluate readiness/evidence.
5. Atomically mark the submission and assignment submitted, set `submittedAt`, lock only exact-attempt
   journals, and write the audit record.

Status-scoped `updateMany` calls make concurrent submit attempts fail safely. Any readiness or network
failure leaves submission/assignment state and journal locks unchanged.

## Public URL Safety

All three URLs are mandatory for final submission:

- GitHub repository in exact `github.com/owner/repository` form;
- deployed public HTTP/HTTPS page;
- Loom `/share/` or `/watch/` URL.

`packages/db/src/url-safety.ts` rejects credentials, malformed/non-HTTP URLs, localhost/internal
hostnames, private/loopback/link-local/documentation IP ranges, and metadata destinations. DNS answers
are checked and the HTTP connection is pinned to the validated address. Every redirect repeats the
same validation. Checks use a short timeout, limited redirects, HEAD with bounded GET fallback, and do
not download response bodies. Unit tests inject mock DNS/HTTP functions and never call live services.

## Migration And Seed Commands

Migration: `20260716090000_weekly_tasks_submission_readiness`

```powershell
npm run db:migrate
npm run db:generate
npm run db:seed
npx tsx scripts/seed-dashboard.ts
```

The migration is additive. It backfills existing task-completion `tenantId` values from their related
tasks before making the column required. Legacy resource rows remain valid as `YOUTUBE` resources and
may remain unattached to a task.

## Out Of Scope

Badges, AI/numeric scoring, uploads, journal deletion, a completed YouTube upload, mission selection,
authentication/permission changes, and a new regression framework are not part of this work.
