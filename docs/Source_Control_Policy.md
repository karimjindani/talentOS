# Source Control & Branching Policy

Code version: `v0.11.2`

Baseline commit: `7bc6d5e`

This policy documents how source control is operated for TalentOS. It **codifies the workflow the
repository already follows** (see git history) and fills the governance gaps that were previously
unwritten, in line with SSDLC principle 0 ("Always document what you do"). It is referenced from
[`sdlc.md`](sdlc.md) and complemented by the delivery policy in
[`CI_CD_Pipeline.md`](CI_CD_Pipeline.md).

## Branching Model

TalentOS uses a **trunk-based** model with short-lived branches:

- `main` is the single source of truth and is **always releasable**. It is protected (see
  [Protected Branch Rules](#protected-branch--merge-freeze-rules)).
- All work happens on a **short-lived branch cut from the latest `main`** and is deleted after merge.
- There are **no long-lived release branches** at the current single-baseline cadence. If parallel
  release lines become necessary (e.g. maintaining `v1.x` after `v2.0`), a `release/vX.Y` branch model
  will be introduced and documented here.
- Direct commits to `main` are not allowed — every change lands via a reviewed Pull Request.

## Branch Naming

Branches follow `<type>/vX.Y.Z-<slug>`:

- `<type>` ∈ `{ feat, fix, docs, ci, chore, refactor }` — the same vocabulary as commit types.
- `vX.Y.Z` — the target baseline version the work is for.
- `<slug>` — a short kebab-case description.

Examples from history:

- `feat/v0.11.0-org-admin-provisioning`
- `fix/v0.10.3-tenant-isolation`
- `ci/github-actions-pipeline`
- `docs/v0.11.2-engineering-governance`

## Commit Message Standard

Commits follow **Conventional Commits**: `type(scope): subject`.

- **Types:** `feat`, `fix`, `docs`, `ci`, `chore`, `refactor`, `test`.
- **Scopes** (optional, the affected area): `auth`, `auth-web`, `admin`, `applicant`, `db`, `ops`,
  `storage`, `ui`, `keycloak`, or a doc area.
- **Version + decision trailer:** when a commit **establishes or changes a versioned baseline**, its
  subject must carry the version and Decision-Log reference — `(vX.Y.Z, D-0NN)`. This satisfies
  Version/Documentation Control rule 4.
- **Subject:** imperative mood, no trailing period, ≤ ~72 chars.

Examples from history:

```
feat(auth): reserve infra/routing tenant slugs (v0.11.1, D-054)
fix(admin): bind admin authorization to TenantMembership (v0.10.3, D-051)
docs: SSDLC closeout — align architecture/backlog/sdlc with v0.10.2
ci: add github actions pipeline
```

## Pull Request & Code Review Policy

- **Every change to `main` goes through a Pull Request.** No direct pushes.
- **At least one approving review** is required before merge (routed via
  [`CODEOWNERS`](../.github/CODEOWNERS)).
- **CI must be green** — all jobs in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
  (`db:generate → typecheck → lint → test → build`) must pass on the PR before it can merge.
- **An author does not merge their own unreviewed PR.**
- The **PR description** (see the [PR template](../.github/pull_request_template.md)) links the target
  version and Decision-Log ID, and confirms the `docs/plans/` and `docs/testing/` entries required by
  doc-control were updated.

## Merge & Conflict Policy

- **Rebase feature branches on the latest `main` before merge** to keep a clean, linear branch history
  and surface conflicts on the branch (not on `main`).
- **Integrate PRs via a merge commit** (`Merge pull request #NN from …`) — this matches the existing
  history and preserves the PR context/number.
- **Resolve conflicts on the feature branch.** Re-run the local gate
  (`npm run typecheck && npm run lint && npm run test`) after resolving.
- **Never force-push `main`.** Force-pushing your own feature branch (after a rebase) is fine before it
  has approvals; avoid it afterward.

## Protected Branch & Merge-Freeze Rules

`main` must be configured with the following protections:

- Require a Pull Request before merging.
- Require **≥1 approving review**.
- Require **status checks to pass** (the CI workflow) and be up to date with `main`.
- **No force-push**, **no deletion**, no direct commits (including by admins where feasible).

A **merge freeze** applies while a baseline is being tagged and recorded in
[`Version_Baseline.md`](Version_Baseline.md): during the freeze only the baseline-recording commit lands,
so the tagged commit and the baseline document stay consistent.

## Enforcement

The branch-protection rules above are **not stored in the repository** — they must be enabled in the
GitHub repository settings (Settings → Branches → Branch protection rules for `main`). Enabling them is
required for this policy to be enforced rather than aspirational:

- [ ] `main` requires a PR before merging
- [ ] `main` requires ≥1 approving review
- [ ] `main` requires the CI status check to pass and be up to date
- [ ] `main` blocks force-pushes and deletion
