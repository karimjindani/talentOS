# CI/CD & Delivery Policy

Code version: `v0.16.3`

Baseline commit: `pending`

This policy documents the Continuous Integration pipeline that **exists today** and defines the
Continuous Delivery / deployment governance that **does not yet exist** — image versioning, a registry,
environment promotion, and rollback. It is referenced from [`sdlc.md`](sdlc.md) and complements the
[Source Control & Branching Policy](Source_Control_Policy.md) and [Deployment](Deployment.md) guide.

> **Status (v0.16.3):** This is a **policy/design document**, first established in `v0.11.2`. The CI
> gate below — the `ci` job plus the `realm-import` job — is implemented
> ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) and has been stable since `v0.11.3`;
> the **security-scan stage, image build/push, environment promotion, and CD deploy remain
> documented targets, not yet built.** A later implementation baseline will realize them.

## Continuous Integration (implemented)

The CI gate runs on **every `push` and `pull_request`**
([`.github/workflows/ci.yml`](../.github/workflows/ci.yml), Node 24, `ubuntu-latest`):

| Stage | Command | Purpose |
|---|---|---|
| Install | `npm ci` | Clean, lockfile-exact install |
| Prisma | `npm run db:generate` | Generate the Prisma client |
| Typecheck | `npm run typecheck` | TypeScript across root + apps |
| Lint | `npm run lint` | ESLint (`--max-warnings=0`) |
| Test | `npm run test` | Vitest regression suite |
| Build | `npm run build` | Production build of both apps |

A parallel **`realm-import`** job boots Keycloak the same way production does
(`start-dev --import-realm`, in-memory H2) against `keycloak/import/` and fails if the realm does not
import cleanly — a boot-level guard against a malformed realm JSON reaching `main` (added in `v0.11.3`,
D-057).

**Both jobs — all stages of `ci` plus `realm-import` — must pass** for a PR to merge (see the PR
policy in the Source Control Policy). This is the mandatory pre-merge gate.

Note: the Vitest stage runs the **unit suite** (202 tests as of `v0.16.0`). Scenario regression
(`npm run regression:*`, see [`Testing_Strategy.md`](Testing_Strategy.md)) needs the running Docker
stack and is a local/Ops-Console capability, not a CI stage.

## Security Scanning (target — principle 7)

To satisfy SSDLC principle 7 ("Secure in design from iteration 1 — shift-left"), CI must add a
**security-scan stage**. Documented here so the gap is on record; **not implemented in v0.11.2**:

| Scan | Tool (proposed) | Blocks merge on |
|---|---|---|
| Dependency vulnerabilities | `npm audit` + Dependabot | High / Critical |
| SAST (code) | CodeQL | High / Critical |
| Secret detection | gitleaks | Any finding |
| Container image | Trivy (on the built image) | High / Critical |

Lower-severity findings warn but do not block. The scan runs alongside the CI gate on PRs.

## Continuous Delivery (target)

CI currently **builds** the apps but does **not** publish or deploy an artifact. The target CD design:

- On **merge to `main`**, build the images and deploy to **staging** automatically.
- On a **version tag** (`vX.Y.Z`), build, publish, and deploy to **production** behind a manual
  approval gate.
- Both `applicant` and `admin` build from the **single root [`Dockerfile`](../Dockerfile)** (via the
  `APP_NAME`/`APP_DIR` build args declared in [`docker-compose.yml`](../docker-compose.yml)).

## Artifact / Image Versioning & Registry Policy

- **Registry:** a container registry is required (GitHub Container Registry `ghcr.io`, or Alibaba
  Container Registry (ACR) to sit next to the ECS target). Images are **pushed**, not built on the
  deploy host.
- **Tagging:** every published image is tagged with **both**:
  - the **baseline version** — `vX.Y.Z` (immutable, one per baseline), and
  - the **git commit SHA** — immutable, exact provenance.
  - `latest` tracks the newest `main` build (convenience only).
- **Immutability:** a `vX.Y.Z` tag is never overwritten. `main` is **never deployed from an untagged
  image** — every deployed artifact is traceable to a commit.
- **Retention:** keep all `vX.Y.Z` release tags; SHA/`latest` images may be pruned on a rolling window.

## Environment Promotion (dev → staging → prod)

| Environment | Topology | Deploy trigger | Config/secrets |
|---|---|---|---|
| **dev / local** | Docker Compose ([Deployment](Deployment.md)) | manual (`docker compose up`) | `.env` (local, never committed) |
| **staging** | single Alibaba ECS box (the current `v0.4.0` validation instance) | auto on merge to `main` | server-side only, per-environment |
| **prod** | hardened topology (HTTPS/domain, Keycloak prod mode, backups) | deploy a specific `vX.Y.Z` tag behind a **manual approval** | server-side only, per-environment |

Config and secrets are **per-environment and never committed** — this extends the existing
`.env` / server-side-secrets rule already stated in [Deployment](Deployment.md) (RAM AccessKeys, DB
passwords, Keycloak bootstrap passwords, `NEXTAUTH_SECRET`, and the `talentos-provisioner` client secret
live only on the target host / in CI secrets).

## Rollback / Rollforward

Because every image is **version + SHA tagged and immutable**, recovery is deterministic:

- **Rollback (app):** redeploy the previous known-good `vX.Y.Z` (or SHA) image tag.
- **Rollforward:** ship a new forward `vX.Y.(Z+1)` with the fix.
- **Database caveat:** roll the **app** back first. **Never** hand-reverse an applied migration on a
  live DB — undo a bad schema change only via a **new forward migration** (consistent with the project's
  Prisma migration workflow: diff → manual migration file → `migrate deploy`). A rollback that requires
  a schema change must therefore be a rollforward.
- **Trigger:** a **failed post-deploy smoke test / health check** (see [Deployment](Deployment.md) smoke
  tests) triggers rollback. The deployer (or on-call, once defined) authorizes it.

## Enforcement

- Registry credentials, the deploy SSH target, and per-environment secrets are **GitHub Actions
  secrets / server-side config** — documented as a checklist, never committed:
  - [ ] Registry (`ghcr.io` / ACR) push credentials configured as CI secrets
  - [ ] Staging deploy target (ECS host + SSH key) configured as CI secrets
  - [ ] Production approval gate (environment protection rule) configured in GitHub
  - [ ] Per-environment `.env` provisioned server-side (never committed)
