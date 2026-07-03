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
- [ ] No secrets committed (`.env`, keys, passwords)
- [ ] At least one reviewer assigned
