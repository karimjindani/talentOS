# TalentOS User Guide (Illustrated)

**Code version:** v0.16.0 (`main`, commit `a95a42b`) — shipped as documentation baseline `v0.16.1`
**Captured:** 2026-07-07 against the local Docker deployment (`npm run local:bootstrap`)
**Screenshots:** [`docs/user-guide/screenshots/`](screenshots/) — captured automatically by [`scripts/user-guide/capture-screenshots.ts`](../../scripts/user-guide/capture-screenshots.ts) (see [Regenerating the screenshots](#regenerating-the-screenshots)).

This guide walks every user-facing flow of TalentOS with one screenshot per test case. Each section maps to a regression test area (`npm run regression:<area>`), so the images double as visual evidence of the flows the regression suite covers.

## Coverage map

| # | Screenshot | Flow / test case | Regression area | Role |
| --- | --- | --- | --- | --- |
| 01 | `01-applicant-home.png` | Tenant landing page | tenant | Anonymous |
| 02 | `02-applicant-login.png` | Portal login entry | auth | Anonymous |
| 03 | `03-keycloak-signin.png` | Keycloak SSO sign-in | auth | Anonymous |
| 03b | `03b-keycloak-register.png` | Self-registration | auth | New applicant |
| 04 | `04-applicant-apply.png` | Application form | applicant | New applicant |
| 05 | `05-applicant-application-status.png` | Application status tracking | applicant | New applicant |
| 06 | `06-dashboard-overview.png` | Dashboard overview & progress | dashboard | Accepted applicant |
| 07 | `07-dashboard-missions.png` | Missions list | missions | Accepted applicant |
| 08 | `08-dashboard-mission-detail.png` | Mission detail & submission | missions | Accepted applicant |
| 09 | `09-dashboard-tasks.png` | Weekly tasks checklist | dashboard | Accepted applicant |
| 10 | `10-dashboard-resources.png` | Video resources | dashboard | Accepted applicant |
| 11 | `11-dashboard-calendar.png` | Program calendar | dashboard | Accepted applicant |
| 12 | `12-dashboard-notifications.png` | Notifications | dashboard | Accepted applicant |
| 13 | `13-dashboard-profile.png` | Profile | dashboard | Accepted applicant |
| 14 | `14-dashboard-program.png` | My Program overview | dashboard | Accepted applicant |
| 15 | `15-admin-overview.png` | Admin overview | admin | Org Admin |
| 16 | `16-admin-applications.png` | Applications review queue | admin | Org Admin |
| 17 | `17-admin-application-detail.png` | Application review & decision | admin | Org Admin |
| 18 | `18-admin-programs.png` | Programs management | programs | Org Admin |
| 19 | `19-admin-program-detail.png` | Program detail & publishing | programs | Org Admin |
| 20 | `20-admin-program-content.png` | Program content management (v0.16.0) | programs | Org Admin |
| 21 | `21-admin-missions.png` | Missions authoring list | missions | Org Admin |
| 22 | `22-admin-mission-detail.png` | Mission detail & submissions | missions | Org Admin |
| 24 | `24-admin-settings.png` | Tenant settings & branding | tenant | Org Admin |
| 25 | `25-admin-operations.png` | Operations health | ops | Org Admin |
| 26 | `26-ops-console.png` | Local Ops Console | ops | Org Admin |

> Not captured: the admin submission-review page (`/missions/{id}/submissions/{submissionId}`) — the demo mission had no reviewable submission link at capture time. Re-run the capture after an applicant submits a mission to include it.

---

## 1. Getting started

The local deployment URLs and seeded credentials are listed in the [README](../../README.md#local-startup-urls-and-credentials). The flows below use the `demo` tenant (`demo.lvh.me`).

### 1.1 Tenant landing page

Each tenant gets a branded landing page on its own subdomain (`http://demo.lvh.me:3100`).

![Tenant landing page](screenshots/01-applicant-home.png)

### 1.2 Signing in

The portal delegates all authentication to Keycloak (`http://lvh.me:3100/login`). Click **Sign in with Keycloak**; new applicants use **Create account**.

![Portal login](screenshots/02-applicant-login.png)

Keycloak owns credentials, password policy and authenticator-app 2FA:

![Keycloak sign-in](screenshots/03-keycloak-signin.png)

### 1.3 Creating an account (applicant self-registration)

**Create account** opens Keycloak's hosted registration form. After registering, the user is returned to the portal already signed in.

![Keycloak registration](screenshots/03b-keycloak-register.png)

---

## 2. Applicant journey: apply and track

### 2.1 Submitting an application

A signed-in visitor who is not yet a tenant member sees the application form at `/apply`: choose a published program, explain your motivation, attach a CV (PDF, max 5 MB) and optionally link GitHub/LinkedIn profiles.

![Application form](screenshots/04-applicant-apply.png)

### 2.2 Tracking the application

After submitting, `/application` shows the application with its current review status (`SUBMITTED`, `UNDER_REVIEW`, `WAITLISTED`, `ACCEPTED` or `REJECTED`).

![Application status](screenshots/05-applicant-application-status.png)

---

## 3. Applicant dashboard (accepted applicants)

Once an application is **accepted**, signing in lands on the dashboard. As of v0.16.0, Overall Progress, the week bars and the stat tiles derive from **accepted mission submissions**; weekly tasks are a supplementary checklist.

### 3.1 Overview

![Dashboard overview](screenshots/06-dashboard-overview.png)

### 3.2 Missions

The missions list shows each week's mission and its submission status. Opening a mission shows the brief, acceptance criteria and the submission form (draft → submit → review loop).

![Missions list](screenshots/07-dashboard-missions.png)

![Mission detail](screenshots/08-dashboard-mission-detail.png)

### 3.3 Tasks, resources, calendar

![Weekly tasks](screenshots/09-dashboard-tasks.png)

![Video resources](screenshots/10-dashboard-resources.png)

![Calendar](screenshots/11-dashboard-calendar.png)

### 3.4 Notifications, profile, my program

![Notifications](screenshots/12-dashboard-notifications.png)

![Profile](screenshots/13-dashboard-profile.png)

![My Program](screenshots/14-dashboard-program.png)

---

## 4. Admin portal (Org Admin / HR / Tech Lead)

Admins sign in at `http://demo.lvh.me:3200` with an admin role. Access to each page is capability-gated (RBAC) and all sensitive actions are audit-logged.

### 4.1 Overview

![Admin overview](screenshots/15-admin-overview.png)

### 4.2 Applications review

The queue lists every application for the tenant with status badges. **Review** opens the detail page where the reviewer can download the CV, read answers and set the decision (accept / reject / under review / waitlist) with notes.

![Applications queue](screenshots/16-admin-applications.png)

![Application review](screenshots/17-admin-application-detail.png)

### 4.3 Programs and program content

Programs are created, edited, published and archived under `/programs` (gated by `managePrograms`). The **Content** page (v0.16.0, gated by `manageProgramContent`) manages the program's video resources, weekly tasks and calendar events that feed the applicant dashboard.

![Programs](screenshots/18-admin-programs.png)

![Program detail](screenshots/19-admin-program-detail.png)

![Program content management](screenshots/20-admin-program-content.png)

### 4.4 Missions authoring and review

Admins author weekly missions (brief, acceptance criteria) and review applicant submissions; accepted submissions drive the applicant's dashboard progress.

![Missions authoring](screenshots/21-admin-missions.png)

![Mission detail](screenshots/22-admin-mission-detail.png)

### 4.5 Tenant settings (white-label branding)

Name, brand colors and logo apply live across both portals; branding writes are capability-gated and audited.

![Tenant settings](screenshots/24-admin-settings.png)

### 4.6 Operations

Health checks for the tenant's services (requires `SUPER_ADMIN` or `ORG_ADMIN`).

![Admin operations](screenshots/25-admin-operations.png)

---

## 5. Local Ops Console

The Ops Console (`http://127.0.0.1:3300`, local only) provides out-of-band health checks, regression-suite execution and local reset controls, protected by the same Keycloak session.

![Ops console](screenshots/26-ops-console.png)

---

## Regenerating the screenshots

1. Ensure the local stack is running and seeded: `npm run local:bootstrap`
2. Install the Playwright browser once: `npx playwright install chromium`
   (if the default browser directory is not writable, set `PLAYWRIGHT_BROWSERS_PATH` to a writable directory for both this command and step 3)
3. Capture: `npx tsx scripts/user-guide/capture-screenshots.ts` — or a subset, e.g. `npx tsx scripts/user-guide/capture-screenshots.ts apply admin`

Notes:

- The apply flow (`apply` section) registers a fresh `guide.applicant.<id>@demo.talentos.local` Keycloak account and submits a real application each run, because existing tenant members are redirected away from `/apply`.
- Screenshots are full-page PNGs at a 1440×900 viewport, written to `docs/user-guide/screenshots/`.
