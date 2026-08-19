---
name: ssdlc-documentation
description: >
  Use this skill whenever finishing, or about to consider "done", a versioned iteration of work
  in the talentOS repo — a feature, fix, or change that will get a vX.Y.Z version — to determine
  which docs/ files must be created or updated before that iteration can be considered complete
  under this repo's SSDLC (docs/sdlc.md). Also trigger it when opening or editing any of
  docs/plans/*.md, docs/testing/*.md, Architecture.md, Data_Model.md, Data_Dictionary.md,
  Decision_Log.md, Deployment.md, Regression_Scenarios.md, Testing_Strategy.md,
  Version_Baseline.md, or docs/user-guides/*.md, to check the change is using the required
  template and staying in sync with its plan/test-results counterpart. Covers: which docs are
  mandatory every iteration vs. conditionally required (e.g. user guides only for user-facing
  portal changes), the required TEMPLATE.md structure for plans and test results, and the
  traceability chain from a plan's Test Scenarios through to Regression_Scenarios.md so nothing
  ships with scenarios silently missing. Does not replace [[version-allocation-and-gates]] — that
  skill governs version numbering and the confirmation gate on starting this documentation
  process; this skill governs what to write once that gate is cleared.
---

# SSDLC documentation checklist (talentOS)

`docs/sdlc.md` is the source of truth — read it fresh if it's been a while, since it can change.
This skill summarizes it into a checklist so a versioned iteration doesn't quietly ship with a
doc missing, stale, or out of sync with its plan.

**Before starting this process at all**: starting the documentation-update process for a
versioned iteration requires explicit user confirmation per `AGENTS.md` — see
[[version-allocation-and-gates]]. Get that confirmation (and the correct next version number)
before drafting any of the docs below.

## Why this exists

`docs/sdlc.md` principle 0 is blunt: "Do what is documented. Always document what you do." The
repo has been burned before by documentation drifting from reality — e.g. a `v0.17.0` feature
shipped with strong unit coverage but zero end-to-end scenario coverage because nothing forced
the plan to name its scenarios up front (D-076). The rules below close gaps like that one; treat
them as guardrails against a specific failure mode, not paperwork for its own sake.

## Required every iteration

These apply to essentially any versioned change, per `docs/sdlc.md` principles 1-7 and its
"Version and Documentation Control" section:

- **Plan** — `docs/plans/vX.Y.Z_<Title>.md`, created from `docs/plans/TEMPLATE.md`. Must include
  a filled-in **Test Scenarios** section written before/during implementation (not reconstructed
  afterward): for each scenario, name/actor/preconditions/steps/expected result, plus whether
  it's automated this iteration (name the `scripts/regression/run.ts` area) or explicitly
  deferred. At minimum cover the primary happy path, one authorization/role-denial case, one
  tenant-isolation case (if tenant-scoped data is touched), and one negative/edge case.
- **Test results** — `docs/testing/vX.Y.Z_<Title>_Test_Results.md`, created from
  `docs/testing/TEMPLATE.md`. Its **Scenario Results** table must have one row per scenario in
  the plan's Test Scenarios section (copy names verbatim) — if a plan scenario has no row here,
  the test-results doc is incomplete. Also records the gate command results (`typecheck`, `lint`,
  `test`, `build`, `regression:all`).
- **Regression_Scenarios.md** — every scenario from the plan lands here too, either as an
  automated case in `scripts/regression/run.ts` or as an explicit **Known Gap** with a stated
  reason. A scenario that exists only in the plan and nowhere else is a silent gap, which is
  exactly what this rule exists to prevent.
- **Architecture.md** — the single document covering technical design, deployment, functionality,
  testing process, and software design elements (UML preferred) is updated to reflect the change.
- **Testing_Strategy.md** — updated to reflect any change in how the product is tested.
- **Data_Model.md** and **Data_Dictionary.md** — updated each iteration per principle 6. If the
  iteration truly touched no data shape at all, note that explicitly rather than skipping silently.
- **Version_Baseline.md** — records the new version baseline.
- **Deployment.md** — updated if deployment steps changed.
- Any doc update must reference the code version it corresponds to, and implementation commits
  that establish/change a versioned baseline should mention that version (see
  `Source_Control_Policy.md` for the `(vX.Y.Z, D-0NN)` commit trailer format tying commits to
  `Decision_Log.md` entries).

## Conditionally required

- **User guides** (`docs/user-guides/Applicant_Portal_User_Guide.md`,
  `docs/user-guides/Back_Office_User_Guide.md`) — required in the **same iteration** for any
  user-facing portal change: routes, navigation, forms, workflows, role/capability changes,
  status labels, dashboard behavior, or troubleshooting guidance. Not required for changes with
  no user-visible surface (pure backend/internal refactors).
- **Decision_Log.md** — add an entry (`D-0NN`) when the change represents a notable
  architecture/process decision worth citing from a commit trailer, not for routine work.

## Traceability chain to double-check before calling an iteration done

Plan's Test Scenarios → Test Results' Scenario Results (1:1, same names) → each scenario is
either automated in `scripts/regression/run.ts` or listed as a Known Gap in
`Regression_Scenarios.md`. If any link in that chain is missing, the iteration isn't done per
`docs/sdlc.md` even if the code works and tests pass — the whole point of this chain is that a
green test suite alone isn't sufficient evidence for a feature with no scenario coverage.

**Check the first link with a script instead of eyeballing it**:
`node .claude/skills/ssdlc-documentation/scripts/check-scenario-coverage.js vX.Y.Z` (or pass
explicit plan/test-results paths as two arguments) diffs the plan's Test Scenarios against the
test-results Scenario Results table and prints exactly which plan scenarios have no matching row,
plus which result rows don't map back to a plan scenario (a sign of drift/renames worth a second
look). It handles both scenario formats used in this repo's history — `### Scenario S1: <title>`
headings and `- **Scenario**: <title>` bullets. Exits non-zero if anything's missing, so it's also
usable as a pre-commit sanity check, not just something to read the output of. The second link
(automated-or-Known-Gap) still needs a human read of `Regression_Scenarios.md` — the script only
confirms the row exists in test results, not that the scenario is actually covered.

## CI gate

`.github/workflows/ci.yml` runs `db:generate → typecheck → lint → test → build` on every push/PR;
all stages must pass to merge, per `docs/sdlc.md`'s CI/CD section.
