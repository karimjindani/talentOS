# Back Office User Guide

Applies to version: `v0.16.0`

Last verified: 2026-07-07

Note (`v0.14.3`): signing out with the sidebar **Logout** button now works from tenant subdomains
(for example `demo.lvh.me:3200`) as well as the canonical host; it ends the Keycloak single sign-on
session and returns you to the tenant you were on.

Audience: platform super admins, organization admins, HR reviewers, and tech leads.

Required access: Keycloak account with a Back Office role and matching tenant membership where applicable.

## Purpose

The Back Office/Admin Portal is the operating console for TalentOS. It is used to manage organizations,
tenant programs, applicant review, missions, tenant settings, and local development operations.

## Related URLs

Local development URLs:

- Admin Portal: `http://lvh.me:3200`
- Demo Admin Portal: `http://demo.lvh.me:3200`
- Applications: `http://demo.lvh.me:3200/applications`
- Programs: `http://demo.lvh.me:3200/programs`
- Missions: `http://demo.lvh.me:3200/missions`
- Settings: `http://demo.lvh.me:3200/settings`
- Operations: `http://demo.lvh.me:3200/operations`
- Organizations, Super Admin only: `http://lvh.me:3200/organizations`
- Keycloak Admin Console: `http://keycloak.lvh.me:8080`

Production URL: to be provided by the tenant or platform operator.

## Local Demo Credentials

These credentials are for local development only.

| Role / Service | Username | Password | Notes |
| --- | --- | --- | --- |
| Super Admin | `superadmin@talentos.local` | `ChangeMeSuper#1` | Platform-level organization management. |
| Org Admin | `orgadmin@demo.talentos.local` | `ChangeMe123!` | Tenant program, mission, settings, application review, and operations access. |
| HR | `hr@demo.talentos.local` | `ChangeMe123!` | Application review access. |
| Tech Lead | `techlead@demo.talentos.local` | `ChangeMe123!` | Read-only admin access where permitted. |
| Keycloak local admin | `admin` | `admin` | Local IAM administration. |

Super Admin may be forced through a first-login password change depending on the current local Keycloak
state. Authenticator-app TOTP is currently **disabled** platform-wide (`v0.14.2`); newly provisioned org
admins are asked only to set a password on first login, not to configure 2FA.

## Login and Tenant Context

1. Open the Admin Portal.
2. Sign in through Keycloak.
3. Use the tenant-specific hostname for tenant-scoped work, for example `http://demo.lvh.me:3200`.
4. Use the apex host `http://lvh.me:3200` for platform-level Super Admin organization management.

Back Office access requires both:

- a valid Keycloak realm role, and
- a matching TalentOS `TenantMembership` for tenant-scoped actions.

## Role and Capability Matrix

| Capability | SUPER_ADMIN | ORG_ADMIN | HR | TECH_LEAD |
| --- | --- | --- | --- | --- |
| Access Back Office | Yes | Yes | Yes | Yes |
| Create organizations | Yes | No | No | No |
| Manage tenant settings | Yes | Yes | No | No |
| Manage programs | Yes | Yes | No | No |
| Manage missions | Yes | Yes | No | No |
| Review applications | Yes | Yes | Yes | No |
| View missions | Yes | Yes | Yes | Yes |
| Review mission submissions (`v0.15.0`) | Yes | Yes | No | Yes |
| View mission submissions (`v0.15.0`) | Yes | Yes | Yes | Yes |
| Manage program content (`v0.16.0`) | Yes | Yes | No | No |
| Use local Operations page | Yes | Yes | No | No |

## Organizations

Super Admins create new tenant organizations from `http://lvh.me:3200/organizations`.

1. Sign in as `SUPER_ADMIN`.
2. Open **Organizations**.
3. Enter organization name, tenant slug, brand colors, and first Org Admin email.
4. Create the organization.
5. Share the generated first-login credential with the new Org Admin through a secure channel.

Tenant slugs become local subdomains, for example `{slug}.lvh.me`.

## Applications Review

1. Open **Applications**.
2. Select an applicant submission.
3. Review motivation, profile links, and CV/download links when provided.
4. Change the status to the appropriate review outcome.

Supported review outcomes include accepted, rejected, waitlisted, and under review. Status changes are
audited.

## Programs

Organization Admins and Super Admins manage programs.

1. Open **Programs**.
2. Create a draft program.
3. Edit program details.
4. Publish the program when ready for applicants.
5. Archive programs that should no longer appear in the applicant apply flow.

Only published programs are visible to applicants.

### Program content (`v0.16.0`)

Organization Admins and Super Admins manage the applicant dashboard's curriculum content per
program from **Programs → [program] → Manage content** (`/programs/[id]/content`):

- **Video resources** — title, video URL (YouTube/Loom/etc.), description, optional week (1–4).
  Shown on the applicant Resources page and week views.
- **Weekly tasks** — title, description, week (1–4), order, optional due date. Shown on the
  applicant Tasks page; applicants tick them off as a checklist.
- **Calendar events** — title, description, start/end time, location. Shown on the applicant
  Calendar page.

Each entry can be edited inline or deleted. All changes are audited. HR and Tech Lead see a
read-only notice on this page.

## Missions

Organization Admins and Super Admins manage missions.

1. Open **Missions**.
2. Create a draft mission for a program.
3. Add the mission objective, acceptance criteria, deliverables, evaluation criteria, and competency
   tags.
4. Publish the mission when it is ready for accepted applicants.
5. Archive missions that should no longer be visible to applicants.

The mission form includes SEM-aligned authoring guidance. Use the helper text to write objectives as
learning outcomes, frame the real-world brief, list the evidence applicants must submit, define the
minimum acceptance bar, and explain how staff should judge quality during review. Competency tags are
comma-separated; accepted submissions become evidence for those competencies, so keep tag names
consistent across missions.

HR and Tech Lead users can view missions but cannot create, edit, publish, or archive them.

The demo program seeds the full four-week mission arc (`v0.15.1`) — Week 1 **Build a Public Product
Landing Page** (Beginner) through Week 4 **Take TaskPilot to Production** (Expert) — all published
and visible to accepted applicants.

### Reviewing mission submissions (`v0.15.0`)

Each mission detail page lists its applicant submissions (applicant, status, submitted and reviewed
dates). Org Admins, Tech Leads, and Super Admins review them; HR can view but not decide. Applicants
never review each other's work (Graduate Profile: graduates are not code reviewers).

1. Open **Missions** and select the mission.
2. In **Submissions**, select **Review** on a submitted entry.
3. Inspect the evidence: Git repository, deployed application, and Loom walkthrough (links open in a
   new tab), plus all dedicated **Engineering Journal** entries for that applicant and mission
   assignment attempt. Engineering Journal entries are read-only for reviewers. The legacy
   `Submission.journalMarkdown` field is retained for data compatibility but is not displayed.
4. Either **Accept submission** — final; the submission becomes portfolio evidence for the mission's
   competency tags — **Request changes**, which returns the same attempt for revision, or **Repeat
   week**, which closes the current attempt and creates a fresh assignment attempt. Requesting changes
   or a repeat requires written feedback.
5. The applicant is notified automatically (acceptance or revision request with your feedback), and
   the review is recorded in the audit log.

A submission can be reviewed only while it is in **Submitted** status. A revision reuses the current
attempt. A repeat keeps the old submission and its locked Engineering Journal entries as read-only
history while new entries attach to the new attempt.

## Settings

Tenant settings control white-label presentation.

1. Open **Settings** on the tenant Admin Portal.
2. Update tenant name, brand colors, or logo.
3. Save changes.

Branding changes apply to both Applicant and Admin portals for that tenant.

## Operations

The Operations page is a local-development tool. It is not a production operations console.

Use it to:

- view app-visible service health,
- run scenario regression areas,
- inspect pass/fail/skip counts,
- run safe regression cleanup for marker-tagged records,
- view reset guidance for local TalentOS resources.

The Operations page must not be used as evidence that production monitoring exists.

## Known Limitations

- Full Back Office user/role management UI is not complete yet.
- Production deployment operations, backups, alerting, and monitoring are not covered by this guide.
- A dedicated engineering-journal module, public portfolios, and hiring intelligence are future
  workflows (mission submission review shipped in `v0.15.0`).
- Screenshots are not part of this guide yet.

## Troubleshooting

| Issue | Likely Cause | Action |
| --- | --- | --- |
| Access denied after login | Missing tenant membership or wrong tenant host | Use the correct tenant subdomain and verify membership/role. |
| Organizations link is missing | User is not `SUPER_ADMIN` | Sign in with Super Admin credentials. |
| Cannot edit programs or missions | User lacks `managePrograms` or `manageMissions` | Use `ORG_ADMIN` or `SUPER_ADMIN`. |
| Cannot review applications | User lacks `reviewApplications` | Use `HR`, `ORG_ADMIN`, or `SUPER_ADMIN`. |
| Operations page is unavailable | User is not `SUPER_ADMIN` or `ORG_ADMIN` | Sign in with an allowed role. |
