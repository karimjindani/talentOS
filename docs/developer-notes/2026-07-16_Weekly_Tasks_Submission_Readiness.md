# 2026-07-16 Weekly Tasks And Submission Readiness Work Log

## Summary

Implemented the current working slice that connects required program-week tasks, task learning
resources, assignment-attempt journals, and final mission-submission readiness. Existing models and
workflow boundaries were preserved; no auth, permission, mission-selection, badge, or scoring changes
were made.

## Work Completed

- Extended existing Prisma task/resource/completion models and added an additive migration.
- Added tenant-safe, applicant-owned, idempotent task completion.
- Added ordered Markdown/YouTube task resources and safe Applicant rendering.
- Seeded three required Week 1 tasks, Markdown guides, pending YouTube records, and a TalentOS video
  script outline.
- Added current-week Applicant task/resource views and Admin task/resource configuration fields.
- Rejected future journal dates and improved placeholders and accessible confidence controls.
- Made the Journal date maximum and server validation honor the applicant browser's local time zone.
- Added a central readiness helper requiring all required tasks, four current-attempt journals, and
  three valid evidence URLs.
- Added an SSRF-resistant public URL reachability helper.
- Made final submit recheck and update state/locks atomically after network checks.
- Integrated scenarios into the existing Applicant, Missions, Programs, Admin, Tenant, and Unit
  regression dashboard categories.
- Updated model, architecture, user-guide, journal, regression, and developer documentation.

## Validation Record

| Command | Result |
| --- | --- |
| `npx prisma validate --schema packages/db/prisma/schema.prisma` | Passed |
| `npm run db:generate` | Passed |
| Focused Vitest suites | Passed: 8 files / 114 tests, then final Journal/readiness check at 2 files / 52 tests |
| `npm run typecheck` | Passed |
| `npm run db:migrate` | Passed; applied `20260716090000_weekly_tasks_submission_readiness` |
| `npm test` | Passed: 38 files, 300 tests |
| `npm run lint` | Passed with zero lint warnings |
| `npm run build` | Passed for Applicant and Admin; Docker images also rebuilt successfully |
| `npm run regression:applicant` | Passed: 3/3 |
| `npm run regression:missions` | Passed: 10/10 |
| `npm run regression:programs` | Passed: 2/2 |
| `npm run regression:tenant` | Passed: 6/6 |
| `npm run regression:admin` | Passed: 4/4 |
| `npm run regression:unit` | Passed: 1/1 |
| `npm run regression:all` | Passed: 39/40, 0 failed, 1 pre-existing documented storage skip |
| `npm run local:doctor` | Passed: Applicant, Admin, tenant routes, Keycloak, MinIO and Ops reachable |
| Applicant manual check | Passed for task/resource display and completion, local-date handling, 4/4 journal progress, readiness checklist, failed URL feedback and no lock on failure |
| Admin manual check | Passed; six Week 1 resources and three ordered required tasks are visible with pending-video warnings |
| Ops manual check | Passed; the full run and new Applicant, Admin, Missions, Tenant and Unit scenarios render in the existing dashboard |

## Notes

- The real TalentOS introduction video and final YouTube URL were not supplied. The resource remains
  visibly pending; the script outline is source material only.
- A live successful Applicant submission was not performed because no real public deployment and Loom
  evidence were supplied. The deterministic submission regression covers success, exact-attempt journal
  locking, repeat behavior and no partial state on failure.
- The confidence control exposes a radiogroup and five individually named native radio inputs. The local
  browser inspection confirmed those semantics, although its synthetic keypress did not change selection;
  a final physical-keyboard check remains useful before release.
- `VideoResource` remains the model/table name for compatibility even though it now supports Markdown.
- `Submission.journalMarkdown` remains a legacy schema field and was not removed.
- No commit, push, merge, rebase, or force-push was performed as part of this implementation task.
