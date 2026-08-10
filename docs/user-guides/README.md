# TalentOS User Guides

Applies to version: `v0.19.5`

Last verified: 2026-07-19

These guides are the role-facing operating manuals for TalentOS. They explain how real users work with
the Applicant Portal and Back Office/Admin Portal, illustrated with screenshots.

## Guides

- [Applicant Portal User Guide](Applicant_Portal_User_Guide.md) — applicants and accepted participants.
- [Back Office User Guide](Back_Office_User_Guide.md) — super admins, org admins, HR reviewers and tech leads.

## Screenshots

Both guides embed screenshots from [`screenshots/`](screenshots/), captured against the local demo
deployment. To regenerate them:

1. Start and seed the local stack: `npm run local:bootstrap`
2. Install the Playwright browser once: `npx playwright install chromium`
3. Capture: `npx tsx scripts/user-guide/capture-screenshots.ts` (or a subset, e.g. `... apply admin`)

Screenshots are full-page PNGs at a 1440×900 viewport written to `docs/user-guides/screenshots/`.

## Maintenance Rule

These guides are living documentation. Any change to a user-facing route, workflow, role, permission,
status, form, dashboard, or portal navigation must update the relevant guide — and, where the view
changed, its screenshot — in the same pull request.
