# Deployment

Code version: `v0.5.0`

Baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

Current deployment update: `v0.5.0`

> `v0.5.0` (Applications lifecycle) does not change the deployment topology. It does change behaviour:
> `/apply` now requires an authenticated applicant session, and the admin portal exposes a working
> application review workflow. The validation URLs and smoke tests below are updated accordingly.

As of `v0.2.0` the applicant and administrator modules are isolated into two containers
(`talentos-applicant` and `talentos-admin`). As of `v0.3.0` a Keycloak IAM (`talentos-keycloak`) and its
dedicated database (`talentos-keycloak-postgres`) provide authentication and RBAC for both portals.
As of `v0.4.0`, the first Alibaba Cloud deployment baseline targets a single ECS instance in Singapore
running the same Docker Compose service topology for public-IP validation.

## Local Development

1. Copy `.env.example` to `.env`.
2. If local ports are already in use, override them in `.env`. Defaults avoid the OpenPay
   `3000`/`5432` ports:

   ```env
   APPLICANT_PORT=3100
   ADMIN_PORT=3200
   POSTGRES_PORT=55432
   KEYCLOAK_PORT=8080
   NEXTAUTH_URL=http://localhost:3100
   ADMIN_NEXTAUTH_URL=http://localhost:3200
   NEXTAUTH_SECRET=replace-with-a-long-random-secret
   KEYCLOAK_ISSUER=http://host.docker.internal:8080/realms/talentos
   DATABASE_URL=postgresql://talentos:talentos_dev_password@localhost:55432/talentos?schema=public
   ```
3. Install dependencies:

   ```powershell
   npm.cmd install
   ```

4. Start PostgreSQL, the Keycloak database and Keycloak (the realm is auto-imported):

   ```powershell
   docker compose up postgres keycloak-postgres keycloak -d
   ```

5. Generate Prisma client:

   ```powershell
   npm.cmd run db:generate
   ```

6. Run migrations:

   ```powershell
   npm.cmd run db:migrate
   ```

7. Seed demo data:

   ```powershell
   npm.cmd run db:seed
   ```

8. Start either app in dev mode (separate terminals). For local (non-Docker) dev, set
   `KEYCLOAK_ISSUER=http://localhost:8080/realms/talentos`:

   ```powershell
   npm.cmd run dev:applicant
   npm.cmd run dev:admin
   ```

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
- `worker`: planned future background job container for AI, email, GitHub sync and certificates.

The `applicant` and `admin` services build from the single root `Dockerfile` using the `APP_NAME` and
`APP_DIR` build args declared in `docker-compose.yml`. They reach Keycloak at
`KEYCLOAK_ISSUER` (default `http://host.docker.internal:8080/realms/talentos`) and declare
`extra_hosts: host.docker.internal:host-gateway` so the issuer URL resolves the same way in the browser
and in the containers.

## Keycloak

- Admin console: `http://localhost:8080` (bootstrap admin `KC_ADMIN`/`KC_ADMIN_PASSWORD`, default
  `admin`/`admin`).
- Seeded **Super Admin** for local development: `superadmin@talentos.local`, temporary password
  `ChangeMeSuper#1`. First login forces a password change and authenticator-app (TOTP) setup.
- Demo org users (permanent password `ChangeMe123!`): `orgadmin@`, `hr@`, `techlead@`,
  `applicant@demo.talentos.local` with the matching realm roles.
- Password policy: min length 12, upper/lower/digit/special, not equal to username, last-5 history.

## Local Validation URLs

Keycloak (`KEYCLOAK_PORT=8080`):

- Admin console: `http://localhost:8080`
- Realm OIDC discovery: `http://localhost:8080/realms/talentos/.well-known/openid-configuration`

Applicant container (`APPLICANT_PORT=3100`):

- Public portal: `http://localhost:3100`
- Login (Keycloak sign-in): `http://localhost:3100/login`
- Apply page (authenticated): `http://localhost:3100/apply`
- Applicant application page (authenticated): `http://localhost:3100/application`

Admin container (`ADMIN_PORT=3200`, routes at root, RBAC-gated):

- Admin overview: `http://localhost:3200`
- Admin applications: `http://localhost:3200/applications`
- Admin programs: `http://localhost:3200/programs`
- Admin settings: `http://localhost:3200/settings`
- Forbidden page: `http://localhost:3200/forbidden`

## Smoke Tests

After deployment, verify:

- `http://localhost:8080/realms/talentos/.well-known/openid-configuration` returns HTTP 200.
- `http://localhost:3100/` loads publicly; `http://localhost:3100/apply` and `/application` redirect to
  `/login` when unauthenticated (both require an applicant session as of `v0.5.0`).
- `http://localhost:3200/` redirects unauthenticated users to Keycloak sign-in.
- Sign in to the admin portal as `applicant@demo.talentos.local` → `/forbidden`; as `orgadmin@…` /
  `hr@…` / `techlead@…` / `superadmin@talentos.local` → admin routes load.
- Module isolation: `http://localhost:3100/applications` returns 404 (admin routes are not served by the
  applicant container).
- Application lifecycle (`v0.5.0`): sign in as `applicant@demo.talentos.local`, submit `/apply`, and
  confirm `/application` shows `SUBMITTED`; sign in to the admin portal as `hr@demo.talentos.local`,
  open the application under `/applications` and accept it; the applicant then sees `ACCEPTED`.
  `techlead@demo.talentos.local` can open the admin portal but cannot decide (lacks `reviewApplications`).
