# Deployment

Code version: `v0.1.0`

Baseline commit: `4e2390ce270ef1e049652495885d792a0cbed959`

## Local Development

1. Copy `.env.example` to `.env`.
2. Install dependencies:

   ```powershell
   npm.cmd install
   ```

3. Start PostgreSQL:

   ```powershell
   docker compose up postgres -d
   ```

4. Generate Prisma client:

   ```powershell
   npm.cmd run db:generate
   ```

5. Run migrations:

   ```powershell
   npm.cmd run db:migrate
   ```

6. Seed demo data:

   ```powershell
   npm.cmd run db:seed
   ```

7. Start the web app:

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

## Smoke Tests

After deployment, verify:

- `/` loads the public applicant portal.
- `/apply` loads the application page.
- `/login` loads the login page.
- `/2fa/setup` displays an authenticator setup URI.
- `/admin` loads the admin shell.
