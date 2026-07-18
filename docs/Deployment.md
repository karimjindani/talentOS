# Deployment

Code version: `v0.19.5`

Deployment evidence commit: `2b3afce`

Current deployment update: `v0.19.5` (requires database migration
`20260716090000_weekly_tasks_submission_readiness`, Prisma generation, Week 1 seed refresh and Applicant/
Admin rebuild; no container-topology, Keycloak, permission or environment-variable change)

## v0.19.5 Release And Deployment Notes

### User-visible changes

- Applicants see week-based learning tasks with ordered Markdown/YouTube resources and completion
  progress alongside the separate mission workflow checklist.
- Engineering Journal guidance is clearer; future entry dates are rejected; final submission requires
  at least four eligible entries linked to the current assignment attempt.
- GitHub, one or more deployment URLs, and Loom evidence are checked individually for safe public
  reachability. Applicant and Admin pages render deployment URLs separately.
- Admins can author weekly tasks/resources through existing program-content permissions.
- Existing regression areas report the new readiness/safety scenarios in the Ops dashboard.

### Deployment procedure

1. Back up the target PostgreSQL database.
2. Run `npm ci` when dependencies are not already installed.
3. Run `npx prisma migrate deploy --schema packages/db/prisma/schema.prisma`.
4. Run `npm run db:generate`.
5. Run `npm run db:seed` to upsert the Week 1 task/resource demo content where desired.
6. Rebuild the affected portals: `docker compose up -d --build applicant admin`.
7. Run `npm run local:doctor` in local development and the relevant smoke/regression checks below.

The migration adds `LearningResourceType`, extends `program_tasks` and `video_resources`, and adds/
backfills authoritative `tenantId` on `user_task_completions` before applying its foreign key and
unique/index rules. It does not add a deployment-link table; multi-URL evidence remains in
`Submission.deploymentUrl` as a normalized semicolon-separated string.

### Compatibility and rollback

- Historical single deployment URLs remain readable and valid.
- Existing `VideoResource` rows default to `YOUTUBE`; null task association keeps legacy rows valid.
- `Submission.journalMarkdown` remains stored for backward compatibility but is not the dedicated
  journal readiness source.
- An application rollback can leave the additive database columns/table enum in place; old code should
  not depend on them. Do not manually drop columns, enum values or backfilled tenant IDs without a
  verified database backup and a separately reviewed rollback migration.
- Seed is idempotent for its known demo records. Production content should be reviewed before running
  demo seed commands.

### Known limitations

- The final TalentOS introduction YouTube URL is pending; the UI shows that state explicitly.
- Public services can time out or rate-limit checks, causing a fail-closed submission blocker.
- No asynchronous retry/cache or reviewer override exists for reachability checks.
- Browser-level automation for every rendered deployment link is deferred; central parsing/link data is
  unit-tested and Admin review data is exercised by regression.

> `v0.19.4` (Mission Task Checklist Lifecycle Guard, D-085 + Weekly Mission Deadline Cadence,
> D-091) **requires no database migration** — rebuild the applicant container:
> `docker compose up -d --build applicant`. **New operational requirement (D-091):** the mission
> deadline is now computed as end-of-Thursday in the **server's local timezone** at acceptance
> time. Pin the `TZ` environment variable to the same value on every process that can accept a
> mission (applicant container/app instances) so "Thursday" is identical across instances; the
> deadline sweep itself compares stored timestamps and is timezone-immune. In-flight assignments
> accepted before this baseline keep their previously stored deadlines.
>
> `v0.19.2` (Logout Regression Fix & Confirmation Gates, D-083) **requires no database migration** —
> rebuild the applicant container: `docker compose up -d --build applicant`. `AGENTS.md` is a
> repo-governance doc; it has no deployment effect.
>
> `v0.19.1` (Dashboard Wiring & Same-Week Repeat, D-082) **requires no database migration** — rebuild
> both containers: `docker compose up -d --build applicant admin`.
>
> `v0.19.0` (Mission-Driven Tasks & Submissions Admin Tab, D-081) **requires a database migration**:
> `20260714110000_mission_tasks` (adds `mission_task_completions`, `missions.tutorialUrl`). After
> pulling the code, run `npx prisma migrate deploy --schema packages/db/prisma/schema.prisma`, then
> rebuild both containers: `docker compose up -d --build applicant admin`. No topology change; the
> legacy `ProgramTask`/`VideoResource`/`UserTaskCompletion` tables are left in place, unused.
>
> `v0.18.5` (Mission Deadline & Lifecycle, D-080) **requires a database migration**:
> `20260714090000_mission_deadlines_and_lifecycle` (adds `missions.deadlineHours`/
> `gracePeriodHours`, `mission_assignments.acceptedAt`/`deadlineAt`/`graceEndsAt`, rebuilds the
> `MissionAssignmentStatus` enum, extends `ApplicationStatus`). After pulling the code, run
> `npx prisma migrate deploy --schema packages/db/prisma/schema.prisma`, then rebuild both
> containers: `docker compose up -d --build applicant admin`. **New operational requirement:** this
> baseline adds a standalone deadline-sweep script (`scripts/mission-deadlines/sweep.ts`) that is
> **not** wired into any request path or container — it must be scheduled as an external cron job
> (e.g. hourly) running `npm run mission-deadlines:sweep` against the deployment's database and
> environment. The sweep is idempotent (safe to run more often than needed, or to re-run after a
> failure) but if it is never scheduled, assignments will never transition to `OVERDUE`/`FAILED` and
> applicants will never be marked `DISQUALIFIED` for a missed deadline. No topology change beyond
> adding this cron entry.
>
> `v0.18.1`/`v0.18.2` require **no deployment, infra or migration change** — `v0.18.1` is the
> plan-template governance patch and `v0.18.2` adds regression scenarios and documentation only; no
> product code, schema or Docker configuration changed in either.
>
> `v0.18.0` (Mission Assignment MVP, D-075) **requires a database migration**:
> `20260708120000_v0_18_0_mission_assignment_mvp` (adds `mission_assignments`). After pulling the
> code, run `npx prisma migrate deploy --schema packages/db/prisma/schema.prisma`, then rebuild both
> containers: `docker compose up -d --build applicant admin`. No topology change.
>
> `v0.17.1` (journal entry date uniqueness, D-074) **requires a database migration**:
> `20260708100000_v0_17_1_journal_entry_date_unique`. **Operational note — check before applying to
> any environment with real data:** this migration normalizes existing `EngineeringJournalEntry`
> rows to a calendar day (`date_trunc('day', ...)`) and then adds a unique index on
> `[tenantId, applicantId, entryDate]`. If a target database already has two entries for the same
> applicant on the same calendar day (possible if `v0.17.0` was ever used ahead of this patch), the
> `CREATE UNIQUE INDEX` step will fail the migration outright — it does not silently drop or merge
> data, but it does block deploy until the duplicate is resolved manually (e.g. delete or re-date one
> of the conflicting rows before re-running `migrate deploy`). Not applicable to any environment
> today; this hasn't been deployed beyond local dev. See `docs/Regression_Scenarios.md` Known Gaps.
>
> `v0.17.0` (Engineering Journal MVP, D-073) **requires a database migration**:
> `20260707190000_v0_17_0_engineering_journal_mvp` (adds `engineering_journal_entries` and
> `users.preferredJournalLanguage`). Same procedure: `migrate deploy`, then rebuild both containers.
>
> `v0.16.0`–`v0.16.4` require **no deployment, infra or migration change**. `v0.16.0`
> (mission-driven dashboard progress + Program Content admin CRUD) is code-only — rebuild with
> `docker compose up -d --build applicant admin`; `v0.16.1`–`v0.16.4` are docs/tooling baselines.
>
> `v0.15.1` (four-week mission seed, D-068) has no schema or topology change, but a fresh install's
> demo content comes from the reworked idempotent seed — run `npm run db:seed` (or
> `local:bootstrap`) to upsert the four TaskPilot missions into an existing local environment.
>
> `v0.15.0` (Mission Submission Workflow, D-067) **requires a database migration**:
> `20260706090000_v0_15_0_mission_submissions` (extends `submissions` with `tenantId`, reviewer
> fields and the unique `[missionId, applicantId]`). After pulling the code, run
> `npx prisma migrate deploy --schema packages/db/prisma/schema.prisma` against the target
> database, then rebuild both containers: `docker compose up -d --build applicant admin`.
>
> `v0.14.0` (Mission Engine MVP) **requires a database migration**:
> `20260704160000_v0_14_0_mission_engine_mvp` (extends `missions` with status, week/order and the
> SEM content fields). Same procedure: `migrate deploy`, then rebuild both containers.
> `v0.14.2` (applicant tenant guard) and `v0.14.3` (logout fixes) are code-only rebuilds; `v0.14.3`
> also adds the `/logged-out` route on the canonical host of each portal. `v0.14.1` is docs-only.
>
> `v0.13.0` (scenario regression) makes no topology change — it adds the host-run regression runner
> (`scripts/regression/run.ts`, `npm run regression:*`) surfaced in the Ops Console.
>
> `v0.12.2` hardens local development deployment. Run `npm.cmd run local:bootstrap` from the repo root
> to repair/create ignored `.env`, rebuild Compose services, run Prisma setup, seed demo/dashboard data,
> non-destructively repair stale Keycloak clients in an existing local realm, and start the host-only Ops
> Console. Local OIDC now uses one browser-and-container reachable issuer:
> `http://keycloak.lvh.me:8080/realms/talentos`. Do not use `host.docker.internal` in browser-facing
> Keycloak URLs.

> `v0.12.0` (applicant dashboard) requires a database migration: `20260703150655_v0_12_0_applicant_dashboard`.
> After pulling the code, run `npx prisma migrate deploy --schema packages/db/prisma/schema.prisma` against
> the target database, then rebuild the applicant container: `docker compose up -d --build applicant`.
> The admin container is unchanged. Seed demo data with `npx tsx scripts/seed-dashboard.ts`.
>
> `v0.11.4` (UI polish) makes no deployment change — both containers rebuild with the same Docker
> Compose topology. Rebuild with `docker compose up -d --build applicant admin`.
>
> `v0.11.3` fixes a **crash-looping Keycloak** on fresh deployments: the `talentos-provisioner` client
> (v0.11.0) was written into `keycloak/import/talentos-realm.json` with an invalid
> `serviceAccountClientRoles` field, so `start-dev --import-realm` aborted at parse time on every
> startup. The fix expresses the service account's realm-management roles the canonical way (a
> `service-account-talentos-provisioner` user with `clientRoles`). **Fresh environments** now import the
> realm cleanly with no action — the import dir is a read-only volume mount, so no image rebuild is
> needed. **Already-running environments** that had the provisioner patched live via `kcadm.sh` need no
> action; the fix just makes the on-disk import valid so future restarts/redeploys no longer crash.
>
> `v0.11.2` (engineering-governance docs) and `v0.11.1` (reserved-slug blocklist) introduce **no
> deployment, infra, or migration change**. `v0.11.2` documents the delivery pipeline — see
> [Delivery Pipeline (CI/CD)](#delivery-pipeline-cicd) below and [`CI_CD_Pipeline.md`](CI_CD_Pipeline.md).
>
> `v0.11.0` (org-admin auto-provisioning) adds a confidential Keycloak service-account client
> `talentos-provisioner` (realm-management roles `manage-users`/`view-realm`/`query-users`) and four admin
> env vars (`KEYCLOAK_SERVER_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_PROVISIONER_CLIENT_ID`,
> `KEYCLOAK_PROVISIONER_CLIENT_SECRET`; defaults in `.env`/`.env.example`). A **fresh** environment gets
> the client from the realm import. For an **already-running** realm, add it live (non-destructive) via
> `kcadm.sh`:
> ```
> kcadm.sh create clients -r talentos -s clientId=talentos-provisioner -s enabled=true \
>   -s publicClient=false -s standardFlowEnabled=false -s directAccessGrantsEnabled=false \
>   -s serviceAccountsEnabled=true -s secret=talentos-provisioner-secret
> kcadm.sh add-roles -r talentos --uusername service-account-talentos-provisioner \
>   --cclientid realm-management --rolename manage-users --rolename view-realm --rolename query-users
> ```
> Then rebuild the admin container (`docker compose up -d --build admin`). No DB migration.
>
> `v0.10.4` (identity linking & email normalization) and `v0.10.3` (tenant isolation fix) are code-only —
> no deployment, infra, or migration change; a `docker compose up -d --build admin applicant` picks them
> up.
>
> `v0.10.2` (Keycloak SSO logout fix) registers a post-logout redirect on both clients so RP-initiated
> logout can return to the app. A fresh environment gets this from the realm import
> (`attributes."post.logout.redirect.uris"`: admin `http://localhost:3200/*`, applicant
> `http://localhost:3100/*`). For an **already-running** environment, patch the live clients
> non-destructively:
> ```
> docker compose exec keycloak sh -c '
>   kc=/opt/keycloak/bin/kcadm.sh
>   $kc config credentials --server http://localhost:8080 --realm master --user admin --password admin
>   aid=$($kc get clients -r talentos -q clientId=talentos-admin --fields id --format csv --noquotes)
>   pid=$($kc get clients -r talentos -q clientId=talentos-applicant --fields id --format csv --noquotes)
>   $kc update clients/$aid -r talentos -s "attributes={\"post.logout.redirect.uris\":\"http://localhost:3200/*\"}"
>   $kc update clients/$pid -r talentos -s "attributes={\"post.logout.redirect.uris\":\"http://localhost:3100/*\"}"
> '
> ```
> (The apps also now persist the Keycloak `id_token` for `id_token_hint`; no env change required.)
>
> `v0.10.1` (Keycloak OTP policy fix) pins the full TOTP policy in the realm import
> (`otpPolicyType: totp`, `otpPolicyPeriod: 30`, `otpPolicyDigits: 6`, `HmacSHA1`, look-ahead 1).
> Without a period, first-login authenticator-app setup returned a Keycloak internal server error
> (`ArithmeticException: / by zero`). For an **already-running** environment, apply the policy live
> without recreating the volume:
> ```
> docker compose exec keycloak /opt/keycloak/bin/kcadm.sh config credentials \
>   --server http://localhost:8080 --realm master --user admin --password admin
> docker compose exec keycloak /opt/keycloak/bin/kcadm.sh update realms/talentos \
>   -s otpPolicyType=totp -s otpPolicyAlgorithm=HmacSHA1 -s otpPolicyDigits=6 \
>   -s otpPolicyPeriod=30 -s otpPolicyInitialCounter=0 -s otpPolicyLookAheadWindow=1
> ```
> A fresh environment (clean `talentos-keycloak-postgres` volume) imports the corrected policy
> automatically. Users who scanned the broken QR must delete that authenticator entry and re-enroll.
>
> `v0.7.1` (Applicant self-signup) enables Keycloak self-registration in the realm import
> (`registrationAllowed`, default role `APPLICANT`). No topology change. Applying it to an existing
> environment requires re-importing the realm (recreate the `talentos-keycloak-postgres` volume) or
> toggling the setting in the Keycloak admin console, since `--import-realm` only imports a realm that
> does not yet exist.
>
> `v0.7.0` (Object storage) adds a self-hosted **MinIO** service (`talentos-minio`) to the Docker Compose
> topology — including on the Alibaba ECS box — plus a one-shot `minio-setup` that creates the private
> bucket. The S3 client/config (`S3_*`) is identical local and cloud.
>
> `v0.5.0` (Applications lifecycle) did not change the deployment topology but `/apply` now requires an
> authenticated applicant session and the admin portal exposes a working review workflow.

As of `v0.2.0` the applicant and administrator modules are isolated into two containers
(`talentos-applicant` and `talentos-admin`). As of `v0.3.0` a Keycloak IAM (`talentos-keycloak`) and its
dedicated database (`talentos-keycloak-postgres`) provide authentication and RBAC for both portals.
As of `v0.4.0`, the first Alibaba Cloud deployment baseline targets a single ECS instance in Singapore
running the same Docker Compose service topology for public-IP validation. As of `v0.7.0`, a self-hosted
MinIO object store (`talentos-minio`) is part of that same topology.

## Local Development

The supported local path is the idempotent bootstrap command:

```powershell
npm.cmd run local:bootstrap
```

The bootstrap command:

- repairs the ignored local `.env` file;
- keeps PostgreSQL on `55432` by default to avoid common local conflicts;
- rebuilds and starts Docker Compose services;
- runs `db:generate`, `db:migrate`, `db:seed` and `scripts/seed-dashboard.ts`;
- patches existing Keycloak realms non-destructively so stale local volumes gain current clients and
  redirect URIs;
- starts the host-only Local Ops Console on `127.0.0.1:3300`.

Validate the deployment:

```powershell
npm.cmd run local:doctor
npm.cmd run local:smoke-login
```

Local browser/container hostnames:

- App base domain: `lvh.me`
- Keycloak issuer: `http://keycloak.lvh.me:8080/realms/talentos`
- MinIO API endpoint: `http://minio.lvh.me:9000`
- Applicant canonical host: `http://lvh.me:3100`
- Applicant tenant host: `http://demo.lvh.me:3100`
- Admin canonical host: `http://lvh.me:3200`
- Admin tenant host: `http://demo.lvh.me:3200`
- Ops Console: `http://127.0.0.1:3300`

`lvh.me`, `*.lvh.me`, `keycloak.lvh.me` and `minio.lvh.me` resolve to loopback in the browser. Compose
maps `keycloak.lvh.me` and `minio.lvh.me` to the Docker host gateway inside app containers, so the
browser URL, container URL and OIDC issuer claim all match.

## Docker Compose Deployment

The first deployment target is a VPS running Docker Compose.

1. Configure production `.env` values.
2. Build and start services:

   ```powershell
   docker compose up --build -d
   ```

3. Run database migration commands from a release process before serving production traffic.

## Alibaba Cloud ECS Deployment

`v0.4.0` targets Alibaba Cloud ECS in Singapore (`ap-southeast-1`) for the first cloud validation
environment.

Initial deployment shape:

- One ECS instance.
- Public IPv4 address.
- Docker Compose runtime.
- Application PostgreSQL and Keycloak PostgreSQL running as containers on the ECS instance.
- Applicant Portal exposed on port `3100`.
- Admin Portal exposed on port `3200`.
- Keycloak exposed on port `8080` for validation.

Security group rules for validation:

- Allow `22/tcp` only from the deployer's current public IP.
- Allow `3100/tcp`, `3200/tcp` and `8080/tcp` for public validation.
- Do not expose PostgreSQL ports publicly.

Server-side environment values must be created on ECS only. Do not commit `.env.production`, RAM
AccessKeys, database passwords, Keycloak bootstrap passwords or generated SSH keys.

Validation URLs:

- Applicant Portal: `http://<ECS_PUBLIC_IP>:3100`
- Admin Portal: `http://<ECS_PUBLIC_IP>:3200`
- Keycloak: `http://<ECS_PUBLIC_IP>:8080`

This is not the final production topology. Production hardening should add HTTPS/domain routing,
Keycloak production mode, backups, monitoring, and an evaluation of Alibaba Cloud RDS for PostgreSQL.

## Services

- `applicant`: stateless applicant Next.js container (`talentos-applicant`).
- `admin`: stateless administrator Next.js container (`talentos-admin`).
- `keycloak`: identity provider (`talentos-keycloak`), realm `talentos` auto-imported from
  `keycloak/import` via `start-dev --import-realm`.
- `keycloak-postgres`: dedicated Keycloak database (`talentos-keycloak-postgres`).
- `postgres`: application PostgreSQL database container.
- `minio`: self-hosted S3-compatible object storage (`talentos-minio`); API `9000`, console `9001`,
  private `talentos` bucket created by the one-shot `minio-setup` service.
- `ops` (**host-run, not a Compose service**): the local Ops Console (`apps/ops`), a standalone Node
  HTTP server bound to `127.0.0.1:3300`, Keycloak-gated (clients `talentos-ops`/`talentos-ops-mfa`;
  `SUPER_ADMIN`/`ORG_ADMIN` only). Started by `local:bootstrap` or `npm run ops:start`; it runs
  regression, cleanup and stack-reset jobs on the host and is intentionally not containerized.
- `worker`: planned future background job container for AI, email, GitHub sync and certificates.

The `applicant` and `admin` services build from the single root `Dockerfile` using the `APP_NAME` and
`APP_DIR` build args declared in `docker-compose.yml`. They reach Keycloak at
`KEYCLOAK_ISSUER` (default `http://keycloak.lvh.me:8080/realms/talentos`) and map
`keycloak.lvh.me:host-gateway` so the issuer URL resolves the same way in the browser and in the
containers.

## Keycloak

- Admin console: `http://keycloak.lvh.me:8080` (bootstrap admin `KC_ADMIN`/`KC_ADMIN_PASSWORD`, default
  `admin`/`admin`).
- Seeded **Super Admin** for local development: `superadmin@talentos.local`, temporary password
  `ChangeMeSuper#1`. First login forces a password change and authenticator-app (TOTP) setup.
- Demo org users (permanent password `ChangeMe123!`): `orgadmin@`, `hr@`, `techlead@`,
  `applicant@demo.talentos.local` and `accepted@demo.talentos.local` with the matching realm roles.
- Password policy: min length 12, upper/lower/digit/special, not equal to username, last-5 history.
- **Self-registration (v0.7.1):** `registrationAllowed` is on; new accounts default to the `APPLICANT`
  role with email as username. Applicants self-serve via the portal "Create account" button
  (OIDC `prompt=create`) or the Register link on the Keycloak login page.

## Object Storage (MinIO)

- Console: `http://localhost:9001`, API: `http://minio.lvh.me:9000` (root creds
  `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`, dev defaults `talentos`/`talentos_dev_password`).
- The `talentos` bucket is created **private** by `minio-setup`; all access is via short-lived presigned
  URLs generated by the apps. Object keys are tenant-namespaced: `tenant/{tenantId}/{category}/…`.
- Config is the same env in every environment: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`,
  `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE=true`. Locally `S3_ENDPOINT` uses
  `http://minio.lvh.me:9000` so presigned URLs resolve in both the browser and the containers.
- As of `v0.7.3` the **`applicant`** container also receives the `S3_*` env (and `depends_on: minio`)
  because the apply flow uploads the CV to MinIO server-side; previously only `admin` needed it.
- **Cloud (Alibaba ECS):** MinIO runs as the same container on a persistent volume. Set `S3_ENDPOINT` to
  the ECS address reachable by the browser (e.g. `http://<ECS_PUBLIC_IP>:9000`) and open `9000/tcp` for
  validation only; keep the console `9001/tcp` closed and set strong root credentials server-side
  (never commit them). The same S3 code can target Alibaba OSS by config alone if ever preferred.

## LLM / AI Mentor Environment Variables

The AI Mentor feature (`v0.15.0`) requires the following environment variables in the applicant container:

| Variable | Purpose | Default |
| --- | --- | --- |
| `GLM_Z_API_KEY` | ZhipuAI / GLM API key for LLM access. | _(none — required for live LLM)_ |
| `AI_BASE_URL` | AI API base URL (LiteLLM proxy or ZhipuAI). | `https://api.z.ai/api/coding/paas/v4` |
| `AI_MODEL` | Model identifier to use. | `glm-5.2` |
| `LLM_MAX_TOKENS` | Maximum tokens in LLM response. | `1024` |
| `LLM_TEMPERATURE` | LLM sampling temperature. | `0.7` |

**Cache constants** (code-level, not environment-configurable — see D-070):

| Constant | Purpose | Value |
| --- | --- | --- |
| `LLM_CACHE_TTL_MS` | Time-to-live for cached LLM responses. | `300_000` (5 minutes) |
| `LLM_CACHE_MAX_SIZE` | Maximum cache entries before LRU eviction. | `200` |

When `GLM_Z_API_KEY` is absent or the LLM call fails, the API route falls back to a stub response so the
mentor UI remains functional during development.

## Local Validation URLs

Keycloak (`KEYCLOAK_PORT=8080`):

- Admin console: `http://keycloak.lvh.me:8080`
- Realm OIDC discovery: `http://keycloak.lvh.me:8080/realms/talentos/.well-known/openid-configuration`

Applicant container (`APPLICANT_PORT=3100`):

- Public portal: `http://lvh.me:3100`
- Demo tenant portal: `http://demo.lvh.me:3100`
- Login (Keycloak sign-in): `http://lvh.me:3100/login`
- Apply page (authenticated): `http://demo.lvh.me:3100/apply`
- Applicant application page (authenticated): `http://demo.lvh.me:3100/application`
- Accepted applicant dashboard: `http://demo.lvh.me:3100/dashboard`
- Applicant missions (`v0.14.0`, assigned-only as of `v0.18.0`; accept/deadline `v0.18.5`; task gate `v0.19.0`): `http://demo.lvh.me:3100/dashboard/missions`
- Per-task resource page (`v0.19.0`, YouTube watch-gate for the tutorial task): `http://demo.lvh.me:3100/dashboard/tasks/<assignmentId>/<taskIndex>`
- Engineering Journal (`v0.17.0`): `http://demo.lvh.me:3100/dashboard/journal`
- Access denied page (`v0.14.2`, non-members of the host tenant): `http://demo.lvh.me:3100/access-denied`
- Post-logout return route (`v0.14.3`, canonical host): `http://lvh.me:3100/logged-out`

Admin container (`ADMIN_PORT=3200`, routes at root, RBAC-gated):

- Admin overview: `http://lvh.me:3200`
- Demo tenant admin: `http://demo.lvh.me:3200`
- Admin applications: `http://demo.lvh.me:3200/applications`
- Admin programs: `http://demo.lvh.me:3200/programs`
- Program content management (`v0.16.0`, ORG_ADMIN): `http://demo.lvh.me:3200/programs/<programId>/content`
- Admin missions (`v0.14.0`; `tutorialUrl` field `v0.19.0`): `http://demo.lvh.me:3200/missions`
- Submission review (`v0.15.0`): `http://demo.lvh.me:3200/missions/<missionId>/submissions/<submissionId>`
- Submissions tab (`v0.19.0`, cross-mission filterable list): `http://demo.lvh.me:3200/submissions`
- Admin operations page: `http://demo.lvh.me:3200/operations`
- Organizations console (SUPER_ADMIN only): `http://lvh.me:3200/organizations`
- Admin settings: `http://demo.lvh.me:3200/settings`
- Forbidden page: `http://demo.lvh.me:3200/forbidden`
- Post-logout return route (`v0.14.3`, canonical host): `http://lvh.me:3200/logged-out`
- Local Ops Console: `http://127.0.0.1:3300`

## Smoke Tests

After deployment, verify:

- `npm.cmd run local:doctor` passes.
- `npm.cmd run local:smoke-login` passes.
- `http://keycloak.lvh.me:8080/realms/talentos/.well-known/openid-configuration` returns HTTP 200.
- `http://lvh.me:3100/` loads publicly; `http://demo.lvh.me:3100/apply` and `/application` redirect to
  `/login` when unauthenticated (both require an applicant session as of `v0.5.0`).
- `http://demo.lvh.me:3200/` redirects unauthenticated users to Keycloak sign-in.
- Sign in to the admin portal as `applicant@demo.talentos.local` → `/forbidden`; as `orgadmin@…` /
  `hr@…` / `techlead@…` / `superadmin@talentos.local` → admin routes load.
- Module isolation: `http://lvh.me:3100/applications` returns 404 (admin routes are not served by the
  applicant container).
- Application lifecycle (`v0.5.0`): sign in as `applicant@demo.talentos.local`, submit `/apply`, and
  confirm `/application` shows `SUBMITTED`; sign in to the admin portal as `hr@demo.talentos.local`,
  open the application under `/applications` and accept it; the applicant then sees `ACCEPTED`.
  `techlead@demo.talentos.local` can open the admin portal but cannot decide (lacks `reviewApplications`).
- CV & profile links (`v0.7.3`): on `/apply`, a CV (PDF, ≤ 5 MB) is required and GitHub/LinkedIn URLs
  are optional; the admin application-detail page shows a working **Download CV** link plus the profile
  links. Submitting without a CV, a non-PDF/over-size CV, or a non-github.com/linkedin.com URL is rejected.
- Missions (`v0.14.0`; assigned-only as of `v0.18.0`): sign in as `accepted@demo.talentos.local` and
  confirm `/dashboard/missions` lists only that applicant's one assigned Week 1 mission — not all
  four seeded published TaskPilot missions (`v0.15.1`); sign in to the admin portal as
  `orgadmin@demo.talentos.local` and confirm `/missions` lists and can edit all of them.
- Engineering Journal (`v0.17.0`/`v0.17.1`): as `accepted@…`, open `/dashboard/journal/new` against
  the assigned mission, submit an entry, and confirm it appears read-only on `/dashboard/journal`;
  a second entry for the same calendar date is rejected; after submitting the mission's evidence, the
  entry can no longer be edited.
- Submission loop (`v0.15.0`, readiness expanded in `v0.19.5`): as `accepted@…`, complete both
  assignment workflow tasks and every required weekly task, add at least four current-attempt journal
  entries on distinct non-future dates, and save GitHub, semicolon-separated deployment and Loom
  evidence. Submit only with real public URLs; as `orgadmin@…` (or `techlead@…`), open the submission
  from the mission's submissions page and accept it or request changes with feedback. Confirm a failed
  readiness/public-URL check leaves the draft status and journal locks unchanged.
- Mission-driven dashboard progress (`v0.16.0`): after accepting a submission, the applicant
  dashboard's Overall Progress / Missions Accepted tile moves and the **Current Mission** card
  advances to the next mission.
- Mission deadline lifecycle (`v0.18.5`): as `accepted@…`, a `NOT_STARTED` mission shows an Accept
  Mission action; accepting it starts a live deadline/grace countdown (`v0.19.1` for the
  Dashboard/My Program/Tasks wiring); running `npm run mission-deadlines:sweep` twice in a row
  against a fixture past its deadline transitions it to `OVERDUE` once and is a no-op the second
  time.
- Mission-driven tasks (`v0.19.0`): as `accepted@…`, a mission's Tasks 1/2 must be marked complete
  before the mission page's Submit button is enabled; a mission with a `tutorialUrl` requires
  watching the embedded video to the end before Task 2 can be marked complete.
- Submissions admin tab (`v0.19.0`): as `orgadmin@…`, `/submissions` lists submissions across every
  mission with status/program filters; `techlead@…` can also review, `hr@…` is read-only, and
  `applicant@…` cannot reach it.
- Same-week repeat (`v0.19.1`): rejecting a Week `N` submission (`REPEAT` decision) reassigns the
  applicant a different published mission for Week `N`, not a fresh Week 1 attempt.
- Scenario regression (`v0.13.0`): `npm run regression:all` completes with no failures (documented
  skips allowed), or run it from the Ops Console at `http://127.0.0.1:3300`.
