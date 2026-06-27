# Deployment

Code version: `v0.2.0`

Baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

Current deployment update: `v0.2.0`

As of `v0.2.0` the applicant and administrator modules are isolated into two containers
(`talentos-applicant` and `talentos-admin`).

## Local Development

1. Copy `.env.example` to `.env`.
2. If local ports are already in use, override them in `.env`. Defaults avoid the OpenPay
   `3000`/`5432` ports:

   ```env
   APPLICANT_PORT=3100
   ADMIN_PORT=3200
   POSTGRES_PORT=55432
   NEXTAUTH_URL=http://localhost:3100
   ADMIN_NEXTAUTH_URL=http://localhost:3200
   DATABASE_URL=postgresql://talentos:talentos_dev_password@localhost:55432/talentos?schema=public
   ```
3. Install dependencies:

   ```powershell
   npm.cmd install
   ```

4. Start PostgreSQL:

   ```powershell
   docker compose up postgres -d
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

8. Start either app in dev mode (separate terminals):

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

## Services

- `applicant`: stateless applicant Next.js container (`talentos-applicant`).
- `admin`: stateless administrator Next.js container (`talentos-admin`).
- `postgres`: PostgreSQL database container.
- `worker`: planned future background job container for AI, email, GitHub sync and certificates.

The `applicant` and `admin` services build from the single root `Dockerfile` using the `APP_NAME` and
`APP_DIR` build args declared in `docker-compose.yml`.

## Local Validation URLs

Applicant container (`APPLICANT_PORT=3100`):

- Public portal: `http://localhost:3100`
- Apply page: `http://localhost:3100/apply`
- Signup page: `http://localhost:3100/signup`
- Login page: `http://localhost:3100/login`
- 2FA setup page: `http://localhost:3100/2fa/setup`
- Applicant application page: `http://localhost:3100/application`

Admin container (`ADMIN_PORT=3200`, routes at root):

- Admin overview: `http://localhost:3200`
- Admin applications: `http://localhost:3200/applications`
- Admin application detail: `http://localhost:3200/applications/<id>`
- Admin programs: `http://localhost:3200/programs`
- Admin settings: `http://localhost:3200/settings`

## Smoke Tests

After deployment, verify:

- `http://localhost:3100/` loads the public applicant portal.
- `http://localhost:3100/apply` loads the application page.
- `http://localhost:3100/2fa/setup` displays an authenticator setup URI.
- `http://localhost:3200/` loads the admin overview.
- `http://localhost:3200/applications` loads the admin applications list.
- Module isolation: `http://localhost:3100/applications` and `http://localhost:3200/apply` both
  return 404.
