# Contributing to TalentOS

This is the developer quickstart. The full governance is in
[`docs/Source_Control_Policy.md`](docs/Source_Control_Policy.md) and
[`docs/CI_CD_Pipeline.md`](docs/CI_CD_Pipeline.md); the SSDLC principles are in
[`docs/sdlc.md`](docs/sdlc.md).

## Workflow at a glance

1. **Branch off the latest `main`.** Name it `<type>/vX.Y.Z-<slug>` where
   `<type>` ∈ `{feat, fix, docs, ci, chore, refactor}` — e.g. `feat/v0.12.0-audit-export`.
2. **Commit using Conventional Commits:** `type(scope): subject`. When the commit establishes or
   changes a versioned baseline, add the `(vX.Y.Z, D-0NN)` version + Decision-Log trailer.
3. **Run the gate locally before pushing:**
   ```bash
   npm run typecheck && npm run lint && npm run test
   ```
4. **Open a Pull Request into `main`.** Fill in the PR template. CI
   (`db:generate → typecheck → lint → test → build`) must be green and you need **≥1 approving review**.
5. **Rebase on `main` before merge**; integrate via a **merge commit**. Never force-push `main`.

## Documentation is part of the change (SSDLC)

Per [`docs/sdlc.md`](docs/sdlc.md), a versioned change must also update:

- an implementation plan in `docs/plans/`, using [`docs/plans/TEMPLATE.md`](docs/plans/TEMPLATE.md)
  — **fill in its Test Scenarios section with real end-to-end behavioral cases, not just unit tests**,
  before or while you implement, not after,
- testing details/results in `docs/testing/`, using
  [`docs/testing/TEMPLATE.md`](docs/testing/TEMPLATE.md) — one Scenario Results row per plan scenario,
- every scenario from the plan added to `docs/Regression_Scenarios.md`, either automated
  (`scripts/regression/run.ts`) or logged as an explicit Known Gap with a reason,
- `docs/Version_Baseline.md` (baseline summary) and `docs/Decision_Log.md` (a `D-0NN` entry),
- the Data Model / Data Dictionary if the schema changed.

## Commit types

`feat` (new capability), `fix` (bug/security fix), `docs`, `ci`, `chore`, `refactor`, `test`.

## Security

TalentOS follows shift-left security (principle 7). Do not commit secrets (`.env`, AccessKeys, DB or
Keycloak passwords, `NEXTAUTH_SECRET`). Report security-relevant changes in the PR and Decision Log.
