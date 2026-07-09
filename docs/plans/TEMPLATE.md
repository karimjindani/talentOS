# vX.Y.Z <Title>

Code version: `vX.Y.Z`

Previous baseline: `vPrev`

Plan status: Draft | Implemented

<!--
This template is required for every new docs/plans/*.md file (docs/sdlc.md, Version and
Documentation Control). Delete this comment block before committing the plan. Do not delete or
leave empty the "Test Scenarios" section — it is the part of this template that closes the gap
found in the v0.18.1 audit: plans specified unit-test-level intent but never end-to-end scenarios,
so features shipped with strong unit coverage and zero scenario-level regression coverage
(Engineering Journal, v0.17.0/v0.17.1, being the case that prompted this template).
-->

## Summary

What is being built and why. One paragraph.

## Scope

- Bullet list of what this version delivers.

## Out of Scope

- Bullet list of what is explicitly deferred, and why.

## Test Scenarios

List every end-to-end, user-facing or cross-cutting behavior this change introduces or changes, as a
concrete scenario — **not** a restatement of unit tests. Write this section before or during
implementation, not after. A unit test proves a function is correct in isolation; a scenario proves a
real actor (applicant/admin/tenant/attacker) gets the right outcome going through the actual
route/action/API. If you can't describe how a human would exercise this end-to-end, the scope isn't
concrete enough yet.

For each scenario:

- **Scenario**: short name.
- **Actor**: role/persona (e.g. accepted applicant, ORG_ADMIN, another tenant's user).
- **Preconditions**: what must already be true (seeded data, prior state, role/membership).
- **Steps**: what the actor does.
- **Expected result**: the specific, checkable outcome (including negative cases — what must be
  denied/rejected, not just what must succeed).
- **Automation**: one of —
  - `Added this iteration` — name the `scripts/regression/run.ts` area/scenario it becomes.
  - `Deferred` — state why, and add it to the Known Gaps section of `docs/Regression_Scenarios.md`
    in this same iteration so the gap is visible, not silently missing.

Include at minimum: the primary happy path, one authorization/role-denial case, one tenant-isolation
case (if the feature touches tenant-scoped data), and one negative/edge case specific to the feature
(e.g. a uniqueness conflict, a state-machine violation, an expired/locked resource).

## Security and Data Rules

Bullet list of access control, validation and audit requirements, if applicable.

## Tests

Filled in once implemented: unit test files/counts added or changed.

## Verification

See `docs/testing/vX.Y.Z_<Title>_Test_Results.md`.
