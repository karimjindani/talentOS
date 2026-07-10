# Principles of Software Development

Current code version: `v0.18.1`

Baseline commit: _set on merge_ (previous: `v0.18.0` @ `bf59ca4`)

0. Do what is documented. Always document what you do. Documents should be updated in docs folder in markdown format.
1. Every iteration of development must ensure that previously committed and tested work remains functional.
2. A single product architecture document covering the Product's technical design, deployment details, functionality, testing process and software design elements (preferably in UML format) is updated on each iteration.
3. Testing is done for each new iteration and a Regression test suite is updated every time the new updates are done.
4. Product runs on Docker containers so deployment is easy.
5. Deployment steps are documented in markdown and uploaded to product's technical document repo.
6. Data Model and Data Dictionary is created and updated on each iteration.
7. Product has to be Secure in design from 1st iteration - Shift left security is the fundamental principle.

## Version and Documentation Control

1. Every implementation plan must be stored as Markdown in `docs/plans/`.
2. Every version must include Markdown testing details and results in `docs/testing/`.
3. Every documentation update must reference the relevant code version.
4. Every implementation commit should mention the version when the work establishes or changes a versioned baseline.
5. Version baselines must be recorded in `docs/Version_Baseline.md`.
6. User-facing portal changes must update the relevant user guide in `docs/user-guides/` in the same
   iteration. This applies to route changes, navigation changes, forms, workflows, role/capability
   changes, status labels, dashboard behavior and troubleshooting guidance.
7. Every implementation plan must use [`docs/plans/TEMPLATE.md`](plans/TEMPLATE.md) and fill in its
   **Test Scenarios** section — end-to-end/behavioral scenarios distinct from unit tests — written
   before or during implementation, not discovered afterward. Each scenario listed there must be added
   to [`Regression_Scenarios.md`](Regression_Scenarios.md) in the same iteration, either as an
   automated `scripts/regression/run.ts` case or as an explicit Known Gap with a stated reason. Every
   `docs/testing/` result must use [`docs/testing/TEMPLATE.md`](testing/TEMPLATE.md) and report one
   Scenario Results row per plan scenario, so a plan can't silently ship without its scenarios being
   verified or explicitly deferred. (`v0.18.1`, D-076 — added after an audit found `v0.17.0`
   Engineering Journal shipped with strong unit coverage but zero scenario-level regression coverage,
   because nothing required the plan to name the scenarios in the first place.)

## Source Control, Branching & Code Review

Source control is operated under a documented policy (`v0.11.2`, D-055) — see
[`Source_Control_Policy.md`](Source_Control_Policy.md). In brief:

1. **Trunk-based branching.** `main` is always releasable and protected; work happens on short-lived
   branches cut from `main` and deleted after merge.
2. **Branch naming** `<type>/vX.Y.Z-<slug>` (`type` ∈ `feat, fix, docs, ci, chore, refactor`).
3. **Commits follow Conventional Commits** (`type(scope): subject`), carrying the `(vX.Y.Z, D-0NN)`
   version + Decision-Log trailer when they change a versioned baseline (ties to Version/Documentation
   Control rule 4).
4. **Every change lands via a Pull Request** — ≥1 approving review, CI green, no direct pushes to
   `main`; authors do not merge their own unreviewed PRs.
5. **Rebase before merge, integrate via merge commit; never force-push `main`.** `main` is protected
   (PR + passing CI + review required; no force-push/deletion), with a merge freeze while a baseline is
   tagged.

## CI/CD & Delivery

The delivery pipeline is governed by [`CI_CD_Pipeline.md`](CI_CD_Pipeline.md) (`v0.11.2`, D-056) and the
[`Deployment.md`](Deployment.md) guide. In brief:

1. **CI gate (implemented):** `.github/workflows/ci.yml` runs `db:generate → typecheck → lint → test →
   build` on every push and PR; all stages must pass to merge.
2. **Security scanning (target, principle 7):** a dependency/SAST/secret/container-image scan stage is
   specified to shift security left; it is documented as a follow-up, not yet implemented.
3. **CD & image policy (target):** images build from the single root `Dockerfile`, are tagged with both
   the baseline `vX.Y.Z` and the git SHA, pushed to a registry, and never deployed untagged.
4. **Environment promotion:** dev (local Compose) → staging (auto-deploy on `main`) → prod (deploy a
   `vX.Y.Z` tag behind a manual approval); per-environment secrets are never committed.
5. **Rollback:** redeploy the previous known-good image tag; reverse a bad migration only via a new
   forward migration (never hand-reverse a live schema change).
