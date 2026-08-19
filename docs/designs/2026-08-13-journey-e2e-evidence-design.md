# Journey-Level E2E Tests With Evidence — Design

Date: 2026-08-13

Status: Approved (design). Implementation plan to follow; version allocated at that time.

> This is a design spec, not an SSDLC implementation plan. The `docs/plans/` document required by
> `docs/sdlc.md` (using `docs/plans/TEMPLATE.md`) comes next and will reference this file.

## Problem

The repository has two halves of an end-to-end capability, in separate tools that do not know about
each other:

| | What it does | What it lacks |
|---|---|---|
| `scripts/regression/run.ts` (3,696 lines, 53 scenarios) | Asserts hard — Prisma data plus HTTP status via `fetch` and a cookie jar | **No browser.** Zero Playwright; it never renders a page |
| `scripts/user-guide/capture-screenshots.ts` (397 lines, 34 shots) | Real Chromium, real Keycloak login, real pages | **Asserts nothing.** A documentation tool that photographs pages |

So there are assertions without a browser, and a browser without assertions. Neither walks a user
through a complete journey, and the screenshots can go stale silently because nothing checks the page
was correct when the photograph was taken.

## Outcome

Three journeys, each a Playwright spec that drives the real UI and asserts at every step, emitting a
per-journey evidence document as a by-product of passing assertions. A screenshot exists only if its
step's assertions held.

## Scope — three journeys

1. **Applicant arc** — sign up → apply → accepted → mission → journal → submit → reviewed → next
   mission. Built first, to prove the pattern.
2. **Admin authoring arc** — `ORG_ADMIN` logs in, creates a program, authors a mission (form and the
   `v0.20.0` Markdown import), adds mission-scoped tasks and resources, publishes, and sees it become
   visible to applicants.
3. **Org onboarding and isolation arc** — `SUPER_ADMIN` creates an organization, Keycloak
   auto-provisions its first `ORG_ADMIN`, branding is set, that admin reaches their own subdomain
   (positive path) **and** a user of another tenant is refused at the route (negative path).

Review-of-a-submission is not a separate journey; it sits inside the applicant arc, because the
applicant arc contains a review step.

## Architecture

```
tests/journeys/
  applicant-arc.spec.ts
  admin-authoring.spec.ts
  org-onboarding.spec.ts
  fixtures/
    journey.ts       the `journey` fixture: run id, actors, evidence hooks
    actors.ts        loginAs(role) -> authenticated BrowserContext
    cleanup.ts       marker registration + Keycloak reaping
playwright.config.ts
scripts/ci/journey-report.ts    renderer: Playwright JSON -> evidence + step summary
```

**A journey is one spec file. A step is a `test.step()`.** No custom step model is built: the numbered
steps in the evidence *are* Playwright steps. This is what makes the evidence cheap — `test.step`
already carries name, timing, status and attachments, which are the four things the artifact needs.

```ts
test("applicant arc", async ({ journey }) => {
  await journey.step("Applicant submits evidence", {
    actor: "applicant",
    proves: "Submission moves to SUBMITTED and appears in the reviewer's queue"
  }, async (page) => { /* ... */ });
});
```

`journey.step` wraps `test.step` and, on success, screenshots the active page and attaches it.

**Two browser contexts, one journey.** The applicant arc holds an applicant context and a reviewer
context open at once and switches between them: the applicant submits, the reviewer acts, the
applicant sees the outcome. This is what makes the review step real rather than a data-layer shortcut.

### Relationship to existing tooling

| Component | Change |
| --- | --- |
| `scripts/regression/run.ts` | **Unchanged.** Its 53 scenarios assert things a browser reaches badly or not at all — cross-tenant denial at the query layer, deadline-sweep idempotency, `FAILED`-state rejection. Journeys sit on top, they do not replace it |
| `scripts/user-guide/capture-screenshots.ts` | **Deleted.** Its 397 lines exist to drive Chromium through Keycloak and photograph pages, which a journey does anyway while also asserting |
| `scripts/ci/regression-summary.ts` | **Unchanged.** Still renders `run.ts` |
| `docs-only` Playwright project | **New.** Produces the user-guide screenshots that no journey naturally walks through, such as the Ops console |

## Test data isolation and cleanup

### Per-journey tenants

Each journey provisions its own tenant rather than sharing the seeded `demo` tenant.

The reason is specific: publishing a mission is a program-wide broadcast — `D-097` makes it resume
every applicant stuck on a dangling `REPEAT`. An admin-authoring journey publishing into `demo` would
silently mutate the seeded accepted applicant that `run.ts` scenarios and the documentation
screenshots both depend on. Cross-journey pollution of that kind is intermittent and expensive to
diagnose.

Setup uses existing server-side functions (`createOrganization`, `provisionOrgAdmin`) rather than the
UI, because provisioning is not what journeys 1 and 2 test. Journey 3 is the exception: there, tenant
creation *is* the journey and runs through the UI.

Per-journey tenants also need program and mission content seeded into them — the applicant arc cannot
start from an empty tenant.

### Run-scoped identities

`journey-<runId>-applicant@journeys.talentos.local`, tenant slug `jrn-<runId>`. Collisions between concurrent CI runs become
impossible rather than unlikely.

### Cleanup, including Keycloak

`cleanupRegressionData(runId)` deletes entities marked in `RegressionDataMarker` in FK-safe order
(`REGRESSION_CLEANUP_ORDER`) inside a single Prisma transaction. A Keycloak user cannot participate in
that transaction — it is an HTTP call to another service with no rollback.

```
1. mark   KeycloakUser -> RegressionDataMarker   (new entityType, skipped by the Prisma pass)
2. run    cleanupRegressionData(runId)           (existing transaction, unchanged)
3. reap   Keycloak users via Admin REST          (after the tx, idempotent, 404 = already gone)
4. sweep  orphans by email prefix                (safety net)
```

Step 4 is load-bearing. A CI job cancelled between signup and cleanup leaves a Keycloak user with no
marker row to find it by, so marker-based reaping alone leaks. The prefix sweep (`journey-*@`, older
than 24 hours) is the only thing that catches those; without it the leak is discovered at a few
hundred users.

### Concurrency

`workers: 1` initially. Per-tenant isolation makes parallelism possible, but Keycloak realm writes and
the shared Postgres make it a separate exercise. Three journeys run serially in a few minutes.

## The evidence artifact

### Each step declares what it proves

`proves` is a **required** field on `journey.step`, not optional. Without it a reader sees a screenshot
of a page and must infer the claim; with it, each row is an assertion that held and the screenshot is
corroboration.

### Pipeline

```
playwright json reporter -> .ops/journey-results/journeys-<runId>.json
                                     |
                     scripts/ci/journey-report.ts
                                     |
         +---------------------------+------------------+
    $GITHUB_STEP_SUMMARY                    evidence/<journey>.md
    (verdict + step table, failures first)  (numbered steps + embedded shots)
```

The renderer inherits `regression-summary.ts`'s discipline: dependency-free, and **never throws** — if
the JSON is missing because the stack died, it says so and exits 0 rather than replacing the real
failure with a confusing one.

### Evidence document shape

| # | Actor | Step | Proves | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | applicant | Signs up and lands on the application form | Self-registration creates a Keycloak user and a tenant-scoped applicant | Pass 2.4s | `01-signup.png` |
| 2 | applicant | Submits application | Application is `SUBMITTED`; a duplicate is blocked | Pass 1.1s | `02-applied.png` |

### Storage

- Step screenshots and rendered evidence documents — **CI artifact** (30 days), alongside the existing
  `e2e-evidence` payload. There are many per run; committing them would bloat the repository.
- The 34 **user-guide** screenshots — still committed to `docs/user-guides/screenshots/`, as today.
- The durable SSDLC link — the versioned test-results document cites the run id and workflow run,
  matching the pattern used for `v0.20.1` and `v0.20.2`.

### Failure handling

Trace and video are `retain-on-failure` only; traces are large and worthless on green runs. On failure
the evidence document still renders, with the failed step in place carrying its error text and
preceding steps' screenshots intact — usually the fastest read on where a journey diverged.

### Explicit limitation

A screenshot proves the page rendered in a state where the assertions held. It does **not** prove the
page looked right. There is no visual regression or layout checking here. That is a separate mechanism
(snapshot diffing) with its own flakiness budget, deliberately not bundled in.

## The time problem

Three rules compose into a hard constraint on the applicant arc:

| Rule | Source |
| --- | --- |
| Submission needs 4 journal entries for the attempt | `REQUIRED_JOURNAL_ENTRY_COUNT = 4` |
| Entry date >= mission start | `D-099` |
| Entry date <= today (no future dates) | `packages/db/src/journal.ts:508` |
| One entry per mission per date | `v0.20.1` |

A journey that creates a tenant, publishes a mission and accepts it *today* has exactly **one** legal
journal date, so it can never reach "submit" — the arc would dead-end around step 5 of 12. This is not
hypothetical; it is why `run.ts` carries `FIXTURE_ACCEPTED_AT` and `backdateAcceptanceTo`.

**Resolution: one explicit, labelled time-travel step that appears in the evidence.**

| # | Actor | Step | Proves |
| --- | --- | --- | --- |
| 4 | applicant | Accepts the mission | Deadline set to Thursday, >= 4 working days |
| 5 | **system** | **Backdates acceptance by 4 days** | **Simulates elapsed time — not a user action** |
| 6 | applicant | Writes 4 journal entries across 4 dates | Per-mission-per-date uniqueness holds; readiness reaches 4/4 |

Marking it `system` and stating that it is not a user action is required, not cosmetic. Evidence that
quietly implied an applicant journaled over four real days would be misleading, and this artifact's
entire value is that a reader can trust it.

## Journey 3 in detail — onboarding and isolation

The org onboarding arc creates a second tenant as its natural output, which is exactly the fixture an
isolation check needs. Rather than a fourth journey with its own tenant setup, the isolation
assertions extend the third:

```
 1-5   SUPER_ADMIN creates org B, provisions its admin, sets branding
 6     org B's admin logs in on their subdomain and sees their tenant      <- positive path
 7     org A's admin requests org B's mission URL      -> refused          <- negative path
 8     org A's admin requests org B's submission URL   -> refused
 9     org A's admin requests org B's journal URL      -> refused
10     no title, count, or redirect discloses that B's records exist
```

The journey's claim becomes "an organization is created **and is genuinely isolated**", which is the
actual business promise of multi-tenancy.

This closes a gap that is currently open and documented. `v0.20.1` closed cross-tenant denial at the
**query layer** via three `regression:tenant` scenarios; `docs/Regression_Scenarios.md` records that
"browser route-level checks remain open". A data-layer guard can be correct while a page still leaks a
title, a count, or a redirect that discloses existence — that is what steps 7–10 test.

## Preventing vacuous passes

The chief risk of journey tests is a step that navigates, screenshots and asserts nothing: evidence
that proves nothing while looking thorough.

- `proves` is a required field, so a step cannot be written without stating its claim.
- Each step must contain at least one `expect()`. Reviewable, and cheap to check.

## CI wiring

The existing `e2e-evidence` job is extended rather than duplicated: roughly four of its five minutes
are stack boot, which a second job would pay again for no benefit.

```diff
  - name: Run E2E scenarios
    run: npm run regression:all

- - name: Capture portal screenshots
-   if: always()
-   run: npx tsx scripts/user-guide/capture-screenshots.ts
+ - name: Run journeys
+   if: always()                      # evidence even when regression failed
+   run: npm run journeys             # includes the docs-only project

  - name: Write run summary
    if: always()
    run: npx tsx scripts/ci/regression-summary.ts
+
+ - name: Write journey evidence
+   if: always()
+   run: npx tsx scripts/ci/journey-report.ts
```

`if: always()` on the journeys step is deliberate: when `regression:all` fails, how far a real user got
is the most useful thing to know. It does not weaken the gate — the earlier step's failure still fails
the job.

The artifact grows by `.ops/journey-results/*.json` and `.ops/journey-evidence/**`.

### `playwright.config.ts`

```ts
workers: 1,                              // serial until per-tenant isolation is proven
retries: process.env.CI ? 1 : 0,
timeout: 120_000,                        // a journey is long by construction
use: { trace: "retain-on-failure", video: "retain-on-failure", screenshot: "off" },
reporter: [["list"], ["html", { open: "never" }], ["json", { outputFile: JOURNEY_RESULTS_FILE }]],
projects: [applicantArc, adminAuthoring, orgOnboarding, docsOnly]
```

`screenshot: "off"` is intentional: `journey.step` takes them explicitly on success, so Playwright's
automatic failure screenshots would muddle the evidence set.

`retries: 1` in CI is a deliberate trade-off that hides genuine flakiness behind a green tick. It is
taken initially because these journeys traverse Keycloak redirects and a large surface; the retry count
is then tracked and driven to zero, because a step that only ever passes on retry is a bug, not a flake.

### Local use

```
npm run journeys                # all; requires the stack to be up
npm run journeys:applicant      # one journey while iterating
npx playwright test --ui        # time-travel debugging
```

Runtime: the job moves from roughly 5 minutes to 8–9, well inside `timeout-minutes: 40`, and stays off
`push` — pull requests and manual dispatch only.

## Delivery sequence

1. `playwright.config.ts`, the `journey` fixture and the evidence renderer, with the **applicant arc** —
   proves the pattern end to end.
2. The `docs-only` project absorbs the orphan screenshots; **delete `capture-screenshots.ts`**.
3. CI wiring.
4. Admin authoring arc.
5. Org onboarding and isolation arc.

Steps 1–3 form one iteration and deliver working evidence. Steps 4–5 follow the established pattern.

## Out of scope

- **Visual regression / snapshot diffing.** Separate mechanism, separate flakiness budget.
- **Ops Console integration.** Journey results will not appear on the Ops dashboard the way `run.ts`
  results do; that needs the Ops result envelope and is its own slice.
- **Parallel journey execution.** Possible once per-tenant isolation is proven, but gated on Keycloak
  realm write contention.
- **Replacing `run.ts`.** Explicitly not a goal.

## Risks

- **Keycloak self-registration** must be enabled in the realm for the signup step. Delivered in
  `v0.7.1`, so it should hold — confirm against the realm export before building.
- **Keycloak redirects** are historically the flakiest surface in this stack.
- **Per-journey tenant provisioning** is the largest chunk of new fixture code, materially more than a
  "log in as the seeded applicant" approach would need. Accepted for the isolation it buys.
- **No new secrets required**: `repairLocalEnv()` already generates Keycloak admin credentials for CI.

## SSDLC obligations

Under `docs/sdlc.md` the implementation iteration needs a plan and test-results pair, plus updates to
`Testing_Strategy.md`, `Regression_Scenarios.md` (traceability and the closed browser-route gap),
`CI_CD_Pipeline.md` (the job changes again) and `Version_Baseline.md`.

The version must be computed from `origin/main` and all active branches at that time. It is **not**
assumed to be `v0.20.3`.
