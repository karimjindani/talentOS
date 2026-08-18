# Public portal implementation status

## Purpose

TalentOS graduates who complete four scored missions can consent to a public profile. Anyone can browse the safe public summary. A recruiter must submit identity details and verify an emailed, time-limited link before seeing assignment evidence and engineering journals.

## End-to-end flow

1. An admin reviews a mission submission and assigns a score from 1 to 5 when accepting it.
2. The applicant dashboard reports completion from accepted mission submissions.
3. After four accepted and scored missions in one program, the graduate can open `/dashboard/graduate-profile`.
4. Publishing records consent, calculates the real average score, derives the completion date, and creates a stable public slug.
5. `/graduates` lists enabled profiles, highest rating first by default.
6. `/graduates/[slug]` exposes only safe public fields and provides the recruiter request form.
7. The request stores a SHA-256 hash of the random token and sends the raw token only in the verification URL.
8. `/graduates/verify` verifies the link and redirects to `/graduates/[slug]/portfolio`.
9. The portfolio API verifies that the token belongs to that exact graduate, returns accepted assignment evidence and linked journals, and records an audit row.

## Runtime boundaries

- `docker-compose.yml`: Postgres, Keycloak, MinIO, applicant, and admin services.
- `packages/db/prisma`: database models and migrations.
- `packages/db/src`: eligibility, scoring, public reads, recruiter access, token, and audit persistence.
- `apps/admin`: reviewer score input when accepting a submission.
- `apps/applicant/app/api/graduates`: public, authenticated graduate, recruiter, verification, and portfolio APIs.
- `apps/applicant/app/graduates`: public directory, public profile, verification, and private portfolio pages.
- `apps/applicant/app/dashboard/graduate-profile`: authenticated consent and publication entry point.

## Implemented in the current milestone

- Evidence-backed eligibility: four accepted, scored missions in one program.
- Reviewer rating field with database-level 1-to-5 constraint.
- Real overall rating and graduation date; placeholder values were removed.
- Stable collision-safe graduate slugs.
- Authenticated consent/profile publication.
- Public directory and public profile pages.
- Recruiter request validation with required name, organization, designation, and email.
- Hashed, seven-day access tokens scoped to one graduate.
- SMTP email delivery plus explicit local `log` delivery mode.
- Verified full portfolio page with mission links and engineering journal entries.
- Profile-view audit logging.
- Docker build and host smoke test.

## Local use

```powershell
docker compose up -d postgres keycloak minio
npm.cmd run db:migrate
docker compose up -d --build applicant
```

Open the public directory at `http://lvh.me:3100/graduates` and the applicant dashboard at `http://lvh.me:3100/dashboard`.

Local email defaults to `EMAIL_DELIVERY_MODE=log`. Retrieve a verification URL with `docker compose logs applicant`. Configure `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, and `EMAIL_FROM` for real SMTP delivery.

## Verified checks

- Prisma schema validation: passed.
- Prisma migrations: applied to local Postgres.
- Monorepo TypeScript check: passed.
- Applicant and admin lint: passed.
- Existing submission workflow tests: 24 passed.
- Applicant production build: passed.
- Docker applicant startup: passed.
- `GET /api/graduates`: HTTP 200.
- `GET /graduates`: HTTP 200.

An empty directory is currently expected because no eligible graduate has consented in the local database.

## Not yet complete

- Rate limiting/CAPTCHA and abuse monitoring on recruiter requests.
- A true single-use token exchange. The current verified link remains valid for its seven-day lifetime.
- Automated tests dedicated to graduate eligibility, token scoping, and portfolio serialization.
- Graduate controls to edit, preview, and disable a published profile from the dashboard.
- Admin analytics UI for recruiter requests and profile views.
- Downloadable candidate report, save/contact actions, AI evaluation summary, and certificate verification.
- Production email-provider credentials and deliverability monitoring.
