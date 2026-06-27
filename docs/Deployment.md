# Deployment

Code version: `v0.1.1`

Baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

Current deployment update: `v0.1.1`

## Local Development

1. Copy `.env.example` to `.env`.
2. If local ports `3000` or `5432` are already in use, override them in `.env`:

   ```env
   WEB_PORT=3100
   POSTGRES_PORT=55432
   NEXTAUTH_URL=http://localhost:3100
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

8. Start the web app:

   ```powershell
   npm.cmd run dev
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

- `web`: stateless Next.js app container.
- `postgres`: PostgreSQL database container.
- `worker`: planned future background job container for AI, email, GitHub sync and certificates.

## Local Validation URLs

When `WEB_PORT=3100`, validate:

- Public portal: `http://localhost:3100`
- Apply page: `http://localhost:3100/apply`
- Signup page: `http://localhost:3100/signup`
- Login page: `http://localhost:3100/login`
- 2FA setup page: `http://localhost:3100/2fa/setup`
- Applicant application page: `http://localhost:3100/application`
- Admin portal: `http://localhost:3100/admin`
- Admin applications: `http://localhost:3100/admin/applications`
- Admin programs: `http://localhost:3100/admin/programs`
- Admin settings: `http://localhost:3100/admin/settings`

## Smoke Tests

After deployment, verify:

- `/` loads the public applicant portal.
- `/apply` loads the application page.
- `/login` loads the login page.
- `/2fa/setup` displays an authenticator setup URI.
- `/admin` loads the admin shell.
