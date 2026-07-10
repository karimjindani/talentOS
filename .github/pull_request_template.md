<!-- See docs/Source_Control_Policy.md for the full PR policy. -->

## Summary

<!-- What does this PR change and why? -->

## Version & Decision

- Target baseline version: `vX.Y.Z`
- Decision Log reference: `D-0NN`

## Checklist

- [ ] Branch named `<type>/vX.Y.Z-<slug>`; commits follow Conventional Commits
      (`type(scope): subject`, with the `(vX.Y.Z, D-0NN)` trailer on baseline-changing commits)
- [ ] Local gate passes: `npm run typecheck && npm run lint && npm run test`
- [ ] CI is green (`db:generate → typecheck → lint → test → build`)
- [ ] Docs updated per SSDLC: `docs/plans/`, `docs/testing/`, `docs/Version_Baseline.md`,
      `docs/Decision_Log.md` (and Data Model / Data Dictionary if the schema changed)
- [ ] Plan's **Test Scenarios** section (`docs/plans/TEMPLATE.md`) is filled in with real end-to-end
      cases, not left as boilerplate or unit-test restatements; every listed scenario is either
      automated in `scripts/regression/run.ts`/`docs/Regression_Scenarios.md` or logged there as an
      explicit Known Gap; the test-results doc reports one Scenario Results row per plan scenario
- [ ] No secrets committed (`.env`, keys, passwords)
- [ ] At least one reviewer assigned
