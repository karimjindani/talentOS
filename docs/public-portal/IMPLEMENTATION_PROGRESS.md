# Public Portal implementation progress

Updated: July 15, 2026

## Completed in this milestone

| Requested capability | Implementation |
| --- | --- |
| Graduation-month filter | Month picker sends an exact UTC month range to the directory API. |
| Program filter | Public profiles are linked to their completed program and the directory exposes a populated program selector. |
| Graduate photo | Authenticated JPG, PNG, and WebP upload to private MinIO storage, limited to 2 MB, with short-lived public delivery URLs. |
| Additional artifacts | Graduates can add up to 10 titled evidence links with descriptions; verified recruiters see them in the portfolio and report. |
| AI evaluation summary | GLM evaluates only verified evidence and returns five 1–5 scores plus a summary. No score is fabricated when the provider is unconfigured. |
| Download candidate report | Verified recruiters can download a paginated PDF containing profile, scores, mission evidence, and artifacts. |
| Contact candidate | Verified recruiters can send a message through TalentOS; the graduate's private address is not exposed and replies go to the recruiter. |
| Save candidate | Passwordless recruiter accounts can save or unsave candidates after receiving portfolio access. |
| Single-use verification | The email token is atomically consumed once and exchanged for a secure, HTTP-only recruiter session cookie. |
| Recruiter registration | The access form now creates or updates a passwordless recruiter account and verifies it through the email link. |
| Share buttons | Public profiles include Copy Link, LinkedIn, WhatsApp, and Email actions. |
| Skills and interests | Graduate form, database, APIs, verified portfolio, and report are connected. |

## Configuration-dependent capability

Real SMTP delivery is implemented but requires valid `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, and `EMAIL_FROM` values with `EMAIL_DELIVERY_MODE=smtp`. Docker intentionally remains in log/preview mode until credentials are supplied. GLM evaluation similarly requires `GLM_Z_API_KEY` or `ZHIPUAI_API_KEY`.

## Recruiter workspace and security follow-up

- Added `/recruiter` with verified account details, editable recruiter information, saved-candidate management, access-expiry status, and server-side sign-out/session revocation.
- Replaced the temporary contact prompt with an accessible contact dialog containing privacy guidance, validation, sending, success, and error states.
- Added fixed-window abuse limits for access requests, verification attempts, and recruiter-to-candidate messages. Production multi-instance deployments should back this interface with Redis or another shared store.
- Added content-signature checks for uploaded JPG, PNG, and WebP profile photos.
- Added focused tests for token entropy/hashing, rate limiting, IP handling, and image signatures.
- Added `npm run seed:public-portal-demo`, an idempotent local demo seeder that publishes four graduates with accepted applications, one passed and rated assignment for each of weeks 1–4, consented profiles, skills, interests, and portfolio artifacts. Use `npm run cleanup:public-portal-demo` to remove only those demo users and their cascading records.
- Connected the Public Portal demo seeder to `npm run local:bootstrap`, so a fresh local setup automatically shows all four graduate profiles in `/graduates`. Teams that do not want the records can remove them independently with the cleanup command.

## Verification completed

- Prisma migration `20260715190000_expand_public_portal` applied successfully.
- TypeScript checks passed for root, applicant, admin, and ops.
- ESLint passed for applicant and admin.
- 43 test files and 390 tests passed.
- Applicant and admin production builds passed.
- Candidate-report PDF rendered to two pages and visually inspected without clipping.
- Docker applicant container rebuilt; `/graduates` and `/api/graduates` return 200, while protected portfolio/report endpoints correctly return 401 without recruiter authentication.
- Added the dedicated `npm run regression:public-portal` scenario. It creates exactly one mission for each of weeks 1–4, accepts and assigns an applicant, submits and rates all four assignments, verifies graduate eligibility, records profile consent, confirms public discovery, and cleans up its marked fixtures. The database-backed scenario passed on July 18, 2026.
