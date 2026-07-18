# Applicant Portal User Guide

Applies to version: `v0.18.4`

Last verified: 2026-07-14

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

### Access to an organization you have not joined

The Dashboard and Application pages are restricted to members of the tenant whose subdomain you are on. If
you open another tenant's `/dashboard` or `/application` without a membership there, you are redirected to
an **Access denied** page ("You are not a member of this organization") with two options: **Apply to
join** (opens that tenant's apply form) or **Sign out**. Applying is open to anyone signed in — submitting
an application is what enrolls you as an `APPLICANT` in that tenant.

## Missions

Missions are the learning-by-building assignments in TalentOS. As of `v0.18.0`, accepted applicants can
view assigned published missions for their accepted program.

To view missions:

1. Sign in as an accepted applicant.
2. Open the dashboard.
3. Select **Missions** in the sidebar.
4. Open a mission to review the objective, acceptance criteria, deliverables, evaluation criteria, and
   competency tags.

The seeded Week 1 mission is **Build a Public Product Landing Page**.

In `v0.18.0`, Week 1 has multiple seeded variants so interns do not all start with the exact same
assignment. The assigned mission is the one that appears in your dashboard.

| Week | Mission | Difficulty |
| --- | --- | --- |
| 1 | One seeded Week 1 variant assigned to you | Beginner |
| 2 | Design and Build the TaskPilot Application | Intermediate |
| 3 | Containerize, Automate and Load-Test TaskPilot | Advanced |
| 4 | Take TaskPilot to Production | Expert |

## Tasks

Every mission breaks into the same fixed 3-step checklist (`v0.19.0`):

1. **Review the Mission Brief** — read the objective and brief, then mark the task complete.
2. **Study the Tutorial** — when the tutorial is a YouTube video, "Mark as complete" unlocks only
   after watching it to the end.
3. **Build & Submit Evidence** — has no checkbox of its own; it completes automatically when you
   submit the mission for review.

Tasks 1 and 2 must both be complete before **Submit for Review** is available on the mission.

As of `v0.19.4`, the checklist follows your mission's lifecycle:

- The checklist is editable only while the mission is actually in progress (accepted and not yet
  submitted, including the overdue grace period).
- Before you **Accept** a mission, its tasks are locked — the task page explains that tasks unlock
  once you start the mission.
- After you submit, the checklist locks while the submission is reviewed.
- A **passed** mission always shows all three tasks completed, and its checklist is locked — your
  finished work can no longer be unchecked.
- When a reviewer sends you a **repeat** (a new mission for the same week), the new mission starts
  with a fresh checklist: it is a different mission, so its brief and tutorial must be reviewed
  again. The closed attempt's page explains this instead of showing an error.

## AI Mentor

The AI Mentor is a conversational assistant available to accepted applicants at
`http://demo.lvh.me:3100/dashboard/mentor`.

### What the AI Mentor does

The mentor answers questions about your program, tasks, missions, software engineering practices (SDLC,
SEM, mission framework), and general career guidance. It uses a rule-based classifier to stay on-topic
and a knowledge base drawn from platform documentation.

### Using the AI Mentor

1. Sign in as an accepted applicant.
2. Open the dashboard.
3. Select **AI Mentor** in the sidebar.
4. Type a question in the chat input and press **Enter** or click **Send**.
5. The mentor's response appears as a formatted message with Markdown rendering and syntax-highlighted
   code blocks.
6. Use the **suggested questions** chips above the input for quick prompts.

### Conversation management

- **New Chat**: Click the **New Chat** button to start a fresh conversation.
- **Conversation history**: Previous conversations are listed in the sidebar. Click any to resume.
- **Persistence**: Conversations are saved to your browser's local storage and to the database, so they
  persist across sessions.
- **Loading indicator**: Each conversation shows its own loading spinner while the mentor is thinking.
  A "Still working..." message appears if the response takes more than a few seconds.

### Rich cards

The mentor can render rich cards inside responses, including task cards, progress indicators, timelines,
tips, badges, and warnings.

### Response caching

The mentor caches LLM responses to avoid redundant API calls and reduce latency:

- **Dynamic questions** (about your tasks, progress, timeline) are cached per user and per context — if
  your program state hasn't changed, asking the same question again returns the cached response
  instantly.
- **Static knowledge questions** (e.g., "Explain SDLC") are cached across all users, so common
  questions are fast for everyone.
- Cached responses expire after 5 minutes. If you complete a task or your context changes, the cache
  is automatically invalidated for dynamic questions.

Daily reflection is recorded only through the dedicated Engineering Journal. The legacy inline
mission-submission journal is no longer shown in applicant or admin interfaces.

## Engineering Journal (`v0.17.0`)

The dedicated **Journal** dashboard page stores daily structured reflections. Entries are linked to
your tenant, user account, accepted program, selected published mission and the mission's week number.
You can create back-dated entries, but each date can have only one journal entry. If you already wrote
an entry for a date, edit that entry instead of creating another one.

Each journal entry asks for:

- What you worked on today
- What challenge you faced
- How you solved it
- What you learned
- How you used AI, or that no AI was used
- Confidence rating from 1 to 5
- Time spent in hours
- Evidence links such as GitHub, PR, deployed URL or video links

You may write in English, Roman Urdu, Roman Hindi or another language. Use **Profile** to set your
Preferred Journal Language; new journal entries use that preference by default. TalentOS does not
translate or process languages automatically yet.

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
