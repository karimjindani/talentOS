# Applicant Portal User Guide

Applies to version: `v0.14.2`

Last verified: 2026-07-05

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

Missions are the learning-by-building assignments in TalentOS. In `v0.14.0`, accepted applicants can view
published missions for their accepted program.

To view missions:

1. Sign in as an accepted applicant.
2. Open the dashboard.
3. Select **Missions** in the sidebar.
4. Open a mission to review the objective, acceptance criteria, deliverables, evaluation criteria, and
   competency tags.

The seeded Week 1 mission is **Build a Public Product Landing Page**.

Mission submission, engineering journal entries, and portfolio publishing are future workflows.

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

## Troubleshooting

| Issue | Likely Cause | Action |
| --- | --- | --- |
| Cannot sign in | Wrong tenant URL, wrong credentials, or stale Keycloak session | Use the correct tenant URL and sign out/in again. |
| Asked to change password | First-login security requirement | Complete the Keycloak password update. |
| "Access denied — not a member of this organization" | You opened a tenant subdomain where you have no membership | Use your own tenant's URL, or select **Apply to join** to apply to that organization. |
| Dashboard is not visible | Application is not accepted | Check application status first. |
| No missions are visible | No published missions for accepted program | Contact the program administrator. |
| Apply form does not show a program | No published program exists for the tenant | Contact the program administrator. |

## Known Limitations

- Applicant mission submission is not implemented yet.
- Engineering journal and portfolio publishing are not implemented yet.
- Screenshots are not part of this guide yet.
