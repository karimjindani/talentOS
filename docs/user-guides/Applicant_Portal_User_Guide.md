# Applicant Portal User Guide

Applies to version: `v0.18.0`

Last verified: 2026-07-08

Audience: applicants and accepted program participants.

Required access: Keycloak applicant account with the `APPLICANT` role. Dashboard and mission pages require
an accepted application for the tenant program.

## Purpose

The Applicant Portal is the participant-facing side of TalentOS. Applicants use it to discover a tenant
program, create an account, submit an application, track application status, and, after acceptance, access
their learning dashboard and missions.

## Related URLs

Local development URLs:

- Applicant Portal: `http://lvh.me:3100`
- Demo Applicant Portal: `http://demo.lvh.me:3100`
- Login: `http://lvh.me:3100/login`
- Apply: `http://demo.lvh.me:3100/apply`
- Application Status: `http://demo.lvh.me:3100/application`
- Accepted Applicant Dashboard: `http://demo.lvh.me:3100/dashboard`
- Missions: `http://demo.lvh.me:3100/dashboard/missions`
- Engineering Journal: `http://demo.lvh.me:3100/dashboard/journal`

Production URL: to be provided by the tenant or platform operator.

## Local Demo Credentials

These credentials are for local development only.

| User | Username | Password | Access |
| --- | --- | --- | --- |
| Applicant | `applicant@demo.talentos.local` | `ChangeMe123!` | Apply and view application status. |
| Accepted Applicant | `accepted@demo.talentos.local` | `ChangeMe123!` | Dashboard, program content, and missions. |

## Account Signup and Login

TalentOS uses Keycloak for identity and access management.

1. Open the Applicant Portal.
2. Select the login action.
3. To create a new applicant account, use the Keycloak registration flow exposed from the portal.
4. Sign in with email and password.
5. If prompted, complete the required password change.

Password policy, password reset and first-login password change are owned by Keycloak. Authenticator-app
2FA is currently **disabled** platform-wide (`v0.14.2`); no OTP setup is requested at sign-in.

Signing in on a tenant subdomain (`http://<tenant>.lvh.me:3100`) determines which organization you are
acting in. You may hold an account under more than one tenant; each subdomain shows only that tenant's
programs and application.

## Apply to a Program

1. Open `http://demo.lvh.me:3100/apply`.
2. Sign in if redirected to login.
3. Select a published program.
4. Enter the motivation/application answer.
5. Upload a CV if requested by the form.
6. Add GitHub and LinkedIn profile URLs when available.
7. Submit the application.

After submission, TalentOS records the application as `SUBMITTED`. Duplicate active applications for the
same program are blocked.

## View Application Status

1. Open `http://demo.lvh.me:3100/application`.
2. Review the current application status.
3. If the status changes after admin review, the page reflects the updated decision.

Common statuses are:

- `SUBMITTED`
- `UNDER_REVIEW`
- `ACCEPTED`
- `REJECTED`
- `WAITLISTED`

## Accepted Applicant Dashboard

Accepted applicants can open `http://demo.lvh.me:3100/dashboard`.

The dashboard contains:

- Dashboard overview
- My Program
- Tasks
- Missions
- Journal
- Resources
- Calendar
- Notifications
- Profile

Applicants without an accepted application are redirected back to their application/status flow.

### Your progress is mission-driven (`v0.16.0`)

The overview page's **Overall Progress**, **Missions Accepted** tile and per-week **Program
Progress** bars track your missions: a mission counts toward progress only when a reviewer has
**accepted** your submission. Draft or submitted work does not move the bar yet. The **Current
Mission** card shows the next mission in your program (with your submission status) and links
straight to it; when every mission is accepted, your portfolio evidence is complete. Weekly tasks
remain a separate checklist with their own tile — completing tasks does not change Overall
Progress, but every required task for your assigned week must be complete before you can submit that
week's mission.

To sign out from the dashboard, use the **Logout** button at the bottom of the sidebar (below your
name and email). Signing out ends both the portal session and the Keycloak single sign-on session and
returns you to your tenant's portal home page (`v0.14.3`).

### Access to an organization you have not joined

The Dashboard and Application pages are restricted to members of the tenant whose subdomain you are on. If
you open another tenant's `/dashboard` or `/application` without a membership there, you are redirected to
an **Access denied** page ("You are not a member of this organization") with two options: **Apply to
join** (opens that tenant's apply form) or **Sign out**. Applying is open to anyone signed in — submitting
an application is what enrolls you as an `APPLICANT` in that tenant.

## Weekly Tasks And Resources

Open **Tasks** to see the week from your current assignment, required/optional labels, overall required
task progress, and the items still blocking submission. Select **Mark complete** after finishing a
task. Completion is saved for your account and program week; it remains complete if a reviewer asks
you to repeat that week. Tasks cannot be unchecked in the current MVP.

Each Week 1 task has ordered learning material:

- a Markdown guide displayed safely in the portal;
- a YouTube resource, which opens in a new tab when its final URL is available.

The seeded Week 1 tasks are **Environment Setup**, **Git and GitHub Basics**, and **Introduction to
AI-Assisted Coding**. The first guide is **Introduction to TalentOS**. The introductory video is still
pending, so the portal shows that state instead of linking to a fake video. The **Resources** page also
collects the current program's task-linked material in one read-only view.

## Missions

Missions are the learning-by-building assignments in TalentOS. As of `v0.18.0`, accepted applicants can
view assigned published missions for their accepted program.

To view missions:

1. Sign in as an accepted applicant.
2. Open the dashboard.
3. Select **Missions** in the sidebar.
4. Open a mission to review the objective, acceptance criteria, deliverables, evaluation criteria, and
   competency tags.

The demo program seeds the full four-week mission arc (`v0.15.1`), evolving one product — TaskPilot —
from idea to production:

In `v0.18.0`, Week 1 has multiple seeded variants so interns do not all start with the exact same
assignment. The assigned mission is the one that appears in your dashboard.

| Week | Mission | Difficulty |
| --- | --- | --- |
| 1 | One seeded Week 1 variant assigned to you | Beginner |
| 2 | Design and Build the TaskPilot Application | Intermediate |
| 3 | Containerize, Automate and Load-Test TaskPilot | Advanced |
| 4 | Take TaskPilot to Production | Expert |

### Submitting mission work (`v0.15.0`)

Each mission detail page has a **My Submission** section where you provide your evidence:

- **Git repository URL** — must be on `github.com`; your PRD, README, user stories and acceptance
  criteria live in the repository.
- **Deployed application URL** — any reachable `http(s)` link to your running application.
- **Loom walkthrough URL** — must be on `loom.com`.

Workflow:

1. Fill in your evidence and select **Save draft** as often as you like.
2. Use the submission checklist to confirm all required week tasks are complete, at least four journal
   entries belong to this assignment attempt, and all three evidence URLs are present and valid.
3. Select **Submit for review**. TalentOS checks that the GitHub repository, deployed page, and Loom
   page are publicly reachable at that moment. Internal/private destinations are rejected.
4. If any check fails, the submission stays a draft (or revision), journals stay unchanged, and the
   page shows an actionable error. Successful submission timestamps the submission and locks only the
   journals for this assignment attempt.
5. A reviewer either **accepts** your submission or **requests changes** with written feedback. You are
   notified either way (see **Notifications**), and the feedback appears on the mission page.
6. If changes are requested, edit your evidence and **Resubmit for review** — readiness and public URL
   checks run again for the same assignment attempt.
7. If the reviewer asks you to repeat the week, your completed week tasks remain complete, but the new
   attempt needs at least four newly linked journal entries and fresh validated submission evidence.
8. An accepted submission is final: it becomes portfolio evidence for the mission's competencies.

The missions list shows a status chip per mission: **Not started**, **Draft saved**, **Submitted**,
**Revision requested**, or **Accepted**.

Daily reflection is recorded only through the dedicated Engineering Journal. The legacy inline
mission-submission journal is no longer shown in applicant or admin interfaces.

## Engineering Journal (`v0.17.0`)

The dedicated **Journal** dashboard page stores daily structured reflections. Entries are linked to
your tenant, user account, accepted program, selected published mission and the mission's week number.
You can create back-dated entries, but each date can have only one journal entry. If you already wrote
an entry for a date, edit that entry instead of creating another one. Today and past dates are allowed;
future dates are blocked in both the form and the server. The form uses your browser's local time zone
to determine today. There is no 24-hour creation cooldown.

Each journal entry asks for:

- What you worked on today
- What challenge you faced
- How you solved it
- What you learned
- How you used AI, or that no AI was used
- Confidence rating from 1 to 5, with an accessible explanation from "I need significant help" to
  "I could explain this to someone else"
- Time spent in hours
- Evidence links such as GitHub, PR, deployed URL or video links

You may write in English, Roman Urdu, Roman Hindi or another language. Use **Profile** to set your
Preferred Journal Language; new journal entries use that preference by default. TalentOS does not
translate or process languages automatically yet.

The mission submission checklist counts only journal entries linked to the exact current assignment
attempt and dated today or earlier. Previous attempts, another applicant/tenant, unlinked legacy rows,
and future dates do not count toward the minimum of four. `entryDate` is the date you selected;
submission time is recorded separately after all submission checks pass.

AI scoring columns exist in the database for future mentor/reviewer workflows, but real AI scoring is
not active in this version.

## Troubleshooting

| Issue | Likely Cause | Action |
| --- | --- | --- |
| Cannot sign in | Wrong tenant URL, wrong credentials, or stale Keycloak session | Use the correct tenant URL and sign out/in again. |
| Asked to change password | First-login security requirement | Complete the Keycloak password update. |
| "Access denied — not a member of this organization" | You opened a tenant subdomain where you have no membership | Use your own tenant's URL, or select **Apply to join** to apply to that organization. |
| Dashboard is not visible | Application is not accepted | Check application status first. |
| No missions are visible | No assigned published mission for your accepted program | Contact the program administrator. |
| Apply form does not show a program | No published program exists for the tenant | Contact the program administrator. |

## Known Limitations

- Real AI journal scoring, weekly AI summaries and portfolio publishing are not implemented yet.
- Evidence file attachments are not supported yet; journal and mission evidence use URL links.
- Screenshots are not part of this guide yet.
