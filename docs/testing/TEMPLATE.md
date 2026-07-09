# vX.Y.Z <Title> Test Results

<!--
Required for every new docs/testing/*.md file (docs/sdlc.md, Version and Documentation Control).
Delete this comment block before committing. The "Scenario Results" section must map 1:1 to the
"Test Scenarios" section of the matching docs/plans/vX.Y.Z_<Title>.md — every scenario listed in the
plan gets a row here with its actual outcome, not just a unit-test/gate summary.
-->

Date: YYYY-MM-DD

## Summary

One paragraph: what was verified and the overall outcome.

## Gate Commands

| Check | Result |
| --- | --- |
| `npm run typecheck` | |
| `npm run lint` | |
| `npm test` | |
| `npm run build` | |
| `npm run regression:all` | |

## Scenario Results

One row per scenario listed in the plan's Test Scenarios section — copy the scenario names verbatim.

| Scenario | Automation | Result |
| --- | --- | --- |
| <scenario name from plan> | Added this iteration (`regression:<area>`) / Deferred | Passed / Failed / Skipped — evidence or reason |

If any plan scenario is missing from this table, the test-results doc is incomplete — go back and
either automate it or record it in `docs/Regression_Scenarios.md` Known Gaps, per `docs/sdlc.md`.

## Notes

Anything relevant: environment quirks, known gaps carried forward, follow-up work.

## Verification

See `docs/plans/vX.Y.Z_<Title>.md`.
