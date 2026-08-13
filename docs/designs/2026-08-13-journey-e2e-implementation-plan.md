# Journey E2E Evidence — Implementation Plan (Iteration 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the applicant-arc journey — a Playwright spec that drives the real UI end to end, asserts at every step, and emits a per-journey evidence document — plus the fixture, renderer and CI wiring that journeys 2 and 3 will reuse.

**Architecture:** A `journey` Playwright fixture wraps `test.step`, resolves the acting browser context from the step's `actor`, screenshots on success, and accumulates an ordered evidence record. On teardown the fixture writes that record to `.ops/journey-results/` and its screenshots to `.ops/journey-evidence/`. A dependency-free renderer turns those into a GitHub step summary and a per-journey Markdown document. Each journey provisions its own tenant so a mission publish cannot leak across journeys (`D-097`).

**Tech Stack:** `@playwright/test` 1.61 (already a dependency), TypeScript, `tsx`, Prisma 6.19, Keycloak 26 Admin REST, GitHub Actions.

**Source design:** `docs/designs/2026-08-13-journey-e2e-evidence-design.md`

## Scope of this plan

Spec delivery steps 1–3 only: the applicant arc, the `docs-only` project replacing
`capture-screenshots.ts`, and CI wiring. Journeys 2 (admin authoring) and 3 (org onboarding +
isolation) get their own plans once this pattern is proven in CI.

## Global Constraints

- **Version: `v0.20.3`.** Computed from `origin/main` at `461db80` (declares `v0.20.2` in
  `docs/sdlc.md`) with no active unmerged remote branches. **Re-verify immediately before pushing** —
  `node .claude/skills/version-allocation-and-gates/scripts/allocate-version.js`.
- **Commit trailer format:** `(v0.20.3, D-103)`. Do not add a `Co-Authored-By` trailer.
- **Never `git push` without explicit user confirmation** (`AGENTS.md`).
- **Node 24**, ES modules, `"type": "module"` throughout.
- **No new secrets.** `repairLocalEnv()` generates all Keycloak credentials.
- `npm run lint` runs with `--max-warnings=0`. Zero warnings.
- Every `journey.step` call **must** pass a non-empty `proves` string and contain at least one
  `expect()`. This is the guard against evidence that proves nothing.
- Journey artifacts go to `.ops/` (git-ignored). Only user-guide screenshots are committed.

## Deviation from the design spec

The spec's §3 had the renderer consume Playwright's JSON reporter. This plan has the **fixture write
the evidence JSON directly** instead. Playwright's step model carries no custom fields, so `actor` and
`proves` would have to be encoded into step titles and parsed back out — fragile across versions. The
Playwright JSON/HTML reporters remain enabled for the team's own debugging. The artifact is unchanged.

## File Structure

| File | Responsibility |
| --- | --- |
| `playwright.config.ts` | Projects, reporters, timeouts, worker count |
| `tests/journeys/fixtures/types.ts` | Shared types: `Actor`, `StepMeta`, `JourneyStepRecord`, `JourneyRecord` |
| `tests/journeys/fixtures/evidence.ts` | Pure: step-record building, filename slugs, JSON shape |
| `tests/journeys/fixtures/keycloak.ts` | Keycloak Admin REST: create user, delete user, prefix sweep |
| `tests/journeys/fixtures/tenant.ts` | Per-journey tenant + seeded program/mission, marker registration |
| `tests/journeys/fixtures/actors.ts` | `loginAs(actor)` → authenticated `Page`; Keycloak login hop |
| `tests/journeys/fixtures/journey.ts` | The `journey` test fixture; wires the above together |
| `tests/journeys/applicant-arc.spec.ts` | Journey 1 |
| `tests/journeys/docs-only.spec.ts` | Orphan user-guide screenshots (Ops console, etc.) |
| `scripts/ci/journey-report.ts` | Renderer: evidence JSON → step summary + Markdown |
| `.github/workflows/ci.yml` | Replace capture step with journeys; add renderer step |

Pure logic (`evidence.ts`) is split from I/O (`keycloak.ts`, `tenant.ts`) so the evidence shape is
unit-testable without a browser or a database — the same split `packages/auth-web/src/tenant-redirect.ts`
uses.

---

### Task 1: Scaffold Playwright and prove it runs

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/journeys/smoke.spec.ts` (deleted in Task 8)
- Modify: `package.json` (scripts), `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: `npm run journeys`, `npm run journeys:applicant`; `JOURNEY_RESULTS_DIR = ".ops/journey-results"`, `JOURNEY_EVIDENCE_DIR = ".ops/journey-evidence"` exported from `playwright.config.ts`

- [ ] **Step 1: Write the config**

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export const JOURNEY_RESULTS_DIR = ".ops/journey-results";
export const JOURNEY_EVIDENCE_DIR = ".ops/journey-evidence";

export default defineConfig({
  testDir: "tests/journeys",
  // Serial until per-tenant isolation is proven against Keycloak realm write contention.
  workers: 1,
  fullyParallel: false,
  // A journey is long by construction: signup, Keycloak hops, a dozen steps.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: ".ops/playwright-report" }],
    ["json", { outputFile: `${JOURNEY_RESULTS_DIR}/playwright.json` }]
  ],
  use: {
    // journey.step screenshots explicitly on success; Playwright's automatic
    // failure screenshots would muddle the curated evidence set.
    screenshot: "off",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000
  },
  projects: [
    { name: "applicant-arc", use: { ...devices["Desktop Chrome"] }, testMatch: /applicant-arc\.spec\.ts/ },
    { name: "docs-only", use: { ...devices["Desktop Chrome"] }, testMatch: /docs-only\.spec\.ts/ }
  ]
});
```

- [ ] **Step 2: Add npm scripts**

In `package.json` `"scripts"`, after `"regression:all"`:

```json
"journeys": "playwright test",
"journeys:applicant": "playwright test --project=applicant-arc",
"journeys:docs": "playwright test --project=docs-only",
"journeys:report": "tsx scripts/ci/journey-report.ts"
```

- [ ] **Step 3: Ignore journey artifacts**

Append to `.gitignore`:

```
.ops/journey-results/
.ops/journey-evidence/
.ops/playwright-report/
test-results/
```

- [ ] **Step 4: Write a smoke spec that proves the runner works**

```ts
// tests/journeys/smoke.spec.ts
import { expect, test } from "@playwright/test";

test("applicant portal is reachable", async ({ page }) => {
  const response = await page.goto("http://demo.lvh.me:3100/");
  expect(response?.status()).toBe(200);
});
```

- [ ] **Step 5: Run it**

Run: `npm run journeys -- --project=applicant-arc --grep "reachable"`
Expected: the stack must be up (`npm run local:bootstrap`). PASS. If it fails with
`net::ERR_CONNECTION_REFUSED`, the stack is down — that is the prerequisite, not a code bug.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/journeys/smoke.spec.ts package.json .gitignore
git commit -m "test(journeys): scaffold Playwright runner and journey scripts (v0.20.3, D-103)"
```

---

### Task 2: Evidence types and pure record building

**Files:**
- Create: `tests/journeys/fixtures/types.ts`
- Create: `tests/journeys/fixtures/evidence.ts`
- Test: `tests/journeys/fixtures/evidence.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Actor = "applicant" | "reviewer" | "admin" | "superadmin" | "system"`
  - `type StepMeta = { actor: Actor; proves: string }`
  - `type JourneyStepRecord = { index: number; name: string; actor: Actor; proves: string; status: "passed" | "failed"; durationMs: number; screenshot: string | null; error?: string }`
  - `type JourneyRecord = { journey: string; runId: string; startedAt: string; durationMs: number; status: "passed" | "failed"; steps: JourneyStepRecord[] }`
  - `screenshotFilename(index: number, name: string): string`
  - `buildStepRecord(input): JourneyStepRecord`
  - `journeyStatus(steps: JourneyStepRecord[]): "passed" | "failed"`

This task is pure logic with no browser or database, so it is unit-tested under Vitest and runs in the
existing `npm test` suite.

- [ ] **Step 1: Write the failing test**

```ts
// tests/journeys/fixtures/evidence.test.ts
import { describe, expect, it } from "vitest";
import { buildStepRecord, journeyStatus, screenshotFilename } from "./evidence";

describe("screenshotFilename", () => {
  it("zero-pads the index and slugs the step name", () => {
    expect(screenshotFilename(1, "Applicant signs up")).toBe("01-applicant-signs-up.png");
    expect(screenshotFilename(12, "Reviewer requests changes")).toBe("12-reviewer-requests-changes.png");
  });

  it("collapses punctuation and repeated separators", () => {
    expect(screenshotFilename(3, "Submits evidence — URLs, notes")).toBe("03-submits-evidence-urls-notes.png");
  });

  it("truncates very long names so the path stays portable", () => {
    const name = "a".repeat(200);
    expect(screenshotFilename(4, name).length).toBeLessThanOrEqual(64);
  });
});

describe("buildStepRecord", () => {
  const base = { index: 1, name: "Signs up", actor: "applicant" as const, proves: "Creates a user", durationMs: 1200 };

  it("records a passing step with its screenshot", () => {
    expect(buildStepRecord({ ...base, error: null })).toEqual({
      index: 1, name: "Signs up", actor: "applicant", proves: "Creates a user",
      status: "passed", durationMs: 1200, screenshot: "01-signs-up.png"
    });
  });

  it("records a failing step with no screenshot and the error text", () => {
    const record = buildStepRecord({ ...base, error: "expected 200, got 500" });
    expect(record.status).toBe("failed");
    // Evidence must never show a screenshot for a step whose assertions did not hold.
    expect(record.screenshot).toBeNull();
    expect(record.error).toBe("expected 200, got 500");
  });
});

describe("journeyStatus", () => {
  const passing = { index: 1, name: "a", actor: "applicant" as const, proves: "p", status: "passed" as const, durationMs: 1, screenshot: "01-a.png" };

  it("passes only when every step passed", () => {
    expect(journeyStatus([passing, { ...passing, index: 2 }])).toBe("passed");
  });

  it("fails when any step failed", () => {
    expect(journeyStatus([passing, { ...passing, index: 2, status: "failed", screenshot: null }])).toBe("failed");
  });

  it("treats an empty journey as failed rather than vacuously passing", () => {
    expect(journeyStatus([])).toBe("failed");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/journeys/fixtures/evidence.test.ts`
Expected: FAIL — `Failed to resolve import "./evidence"`.

- [ ] **Step 3: Write the types**

```ts
// tests/journeys/fixtures/types.ts

/** Who performs a step. `system` marks a non-user action, e.g. simulated elapsed time. */
export type Actor = "applicant" | "reviewer" | "admin" | "superadmin" | "system";

export type StepMeta = {
  actor: Actor;
  /**
   * What this step proves. Required, never optional: without it the evidence is a screenshot of a
   * page and the reader must infer the claim.
   */
  proves: string;
};

export type JourneyStepRecord = {
  index: number;
  name: string;
  actor: Actor;
  proves: string;
  status: "passed" | "failed";
  durationMs: number;
  /** Null when the step failed — evidence never shows a shot for an unmet assertion. */
  screenshot: string | null;
  error?: string;
};

export type JourneyRecord = {
  journey: string;
  runId: string;
  startedAt: string;
  durationMs: number;
  status: "passed" | "failed";
  steps: JourneyStepRecord[];
};
```

- [ ] **Step 4: Write the implementation**

```ts
// tests/journeys/fixtures/evidence.ts
import type { Actor, JourneyStepRecord } from "./types";

const MAX_FILENAME_LENGTH = 64;

/** `01-applicant-signs-up.png` — ordered, readable, and safe on every filesystem. */
export function screenshotFilename(index: number, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const prefix = String(index).padStart(2, "0");
  const budget = MAX_FILENAME_LENGTH - prefix.length - ".png".length - 1;
  return `${prefix}-${slug.slice(0, budget).replace(/-+$/, "")}.png`;
}

export function buildStepRecord(input: {
  index: number;
  name: string;
  actor: Actor;
  proves: string;
  durationMs: number;
  error: string | null;
}): JourneyStepRecord {
  const failed = input.error !== null;
  return {
    index: input.index,
    name: input.name,
    actor: input.actor,
    proves: input.proves,
    status: failed ? "failed" : "passed",
    durationMs: input.durationMs,
    screenshot: failed ? null : screenshotFilename(input.index, input.name),
    ...(failed ? { error: input.error as string } : {})
  };
}

/** A journey with no steps is a failure, not a vacuous pass. */
export function journeyStatus(steps: JourneyStepRecord[]): "passed" | "failed" {
  if (steps.length === 0) return "failed";
  return steps.every((step) => step.status === "passed") ? "passed" : "failed";
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/journeys/fixtures/evidence.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Confirm Vitest picks it up in the main suite**

Run: `npm test`
Expected: PASS, previous total + 8. If the file is not collected, add `tests/**/*.test.ts` to the
Vitest `include` in `vitest.config.ts`.

- [ ] **Step 7: Commit**

```bash
git add tests/journeys/fixtures/types.ts tests/journeys/fixtures/evidence.ts tests/journeys/fixtures/evidence.test.ts
git commit -m "test(journeys): evidence record types and pure builders (v0.20.3, D-103)"
```

---

### Task 3: Keycloak user lifecycle and orphan sweep

**Files:**
- Create: `tests/journeys/fixtures/keycloak.ts`
- Test: `tests/journeys/fixtures/keycloak.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `journeyEmail(runId: string, actor: string): string`
  - `isJourneyEmail(email: string): boolean`
  - `orphanCutoff(now: Date): Date`
  - `adminToken(): Promise<string>`
  - `createJourneyUser(input: { email: string; password: string; firstName: string; lastName: string }): Promise<string>`
  - `deleteJourneyUser(userId: string): Promise<void>`
  - `sweepOrphanJourneyUsers(now: Date): Promise<number>`

Only the pure helpers are unit-tested; the HTTP functions are exercised by the journey itself.

- [ ] **Step 1: Write the failing test**

```ts
// tests/journeys/fixtures/keycloak.test.ts
import { describe, expect, it } from "vitest";
import { isJourneyEmail, journeyEmail, orphanCutoff } from "./keycloak";

describe("journeyEmail", () => {
  it("builds a run-scoped address so concurrent runs cannot collide", () => {
    expect(journeyEmail("abc123", "applicant")).toBe("journey-abc123-applicant@journeys.talentos.local");
  });
});

describe("isJourneyEmail", () => {
  it("matches addresses this suite creates", () => {
    expect(isJourneyEmail("journey-abc123-applicant@journeys.talentos.local")).toBe(true);
  });

  it("never matches seeded or real users", () => {
    for (const email of [
      "applicant@demo.talentos.local",
      "accepted@demo.talentos.local",
      "superadmin@talentos.local",
      "notjourney-abc@journeys.talentos.local"
    ]) {
      expect(isJourneyEmail(email)).toBe(false);
    }
  });
});

describe("orphanCutoff", () => {
  it("is 24 hours before now, so a run in flight is never reaped", () => {
    expect(orphanCutoff(new Date("2026-08-13T12:00:00.000Z")).toISOString()).toBe("2026-08-12T12:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/journeys/fixtures/keycloak.test.ts`
Expected: FAIL — cannot resolve `./keycloak`.

- [ ] **Step 3: Write the implementation**

```ts
// tests/journeys/fixtures/keycloak.ts
/**
 * Keycloak user lifecycle for journey runs.
 *
 * A journey's signup step creates a *Keycloak* user, which cannot participate in the Prisma cleanup
 * transaction used for database rows. These helpers mark, reap and — critically — sweep: a CI job
 * cancelled between signup and cleanup leaves a user with no marker row to find it by, so
 * marker-based reaping alone leaks (design §"Cleanup, including Keycloak", step 4).
 */
const EMAIL_DOMAIN = "journeys.talentos.local";
const EMAIL_PREFIX = "journey-";
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

export function journeyEmail(runId: string, actor: string): string {
  return `${EMAIL_PREFIX}${runId}-${actor}@${EMAIL_DOMAIN}`;
}

export function isJourneyEmail(email: string): boolean {
  return email.startsWith(EMAIL_PREFIX) && email.endsWith(`@${EMAIL_DOMAIN}`);
}

/** Users created before this instant are orphans from a killed run. */
export function orphanCutoff(now: Date): Date {
  return new Date(now.getTime() - ORPHAN_AGE_MS);
}

function realmBase(): string {
  const issuer = process.env.KEYCLOAK_ISSUER ?? "http://keycloak.lvh.me:8080/realms/talentos";
  const [base, realm] = issuer.split("/realms/");
  return `${base}/admin/realms/${realm}`;
}

export async function adminToken(): Promise<string> {
  const issuer = process.env.KEYCLOAK_ISSUER ?? "http://keycloak.lvh.me:8080/realms/talentos";
  const [base] = issuer.split("/realms/");
  const response = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      // This repo's bootstrap vars are KC_ADMIN / KC_ADMIN_PASSWORD (docker-compose.yml,
      // scripts/local/support.ts) — not KEYCLOAK_ADMIN_*.
      username: process.env.KC_ADMIN ?? "admin",
      password: process.env.KC_ADMIN_PASSWORD ?? "admin"
    })
  });
  if (!response.ok) throw new Error(`Keycloak admin token failed: ${response.status}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

export async function createJourneyUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<string> {
  const token = await adminToken();
  const response = await fetch(`${realmBase()}/users`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      username: input.email,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: true,
      emailVerified: true,
      credentials: [{ type: "password", value: input.password, temporary: false }]
    })
  });
  if (!response.ok) throw new Error(`Keycloak user create failed: ${response.status} ${await response.text()}`);
  const id = response.headers.get("location")?.split("/").pop();
  if (!id) throw new Error("Keycloak user create returned no Location header");
  return id;
}

/** Idempotent: a 404 means a previous reap already removed it. */
export async function deleteJourneyUser(userId: string): Promise<void> {
  const token = await adminToken();
  const response = await fetch(`${realmBase()}/users/${userId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` }
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Keycloak user delete failed: ${response.status}`);
  }
}

/** Safety net for runs killed before cleanup. Returns how many users were removed. */
export async function sweepOrphanJourneyUsers(now: Date = new Date()): Promise<number> {
  const token = await adminToken();
  const response = await fetch(`${realmBase()}/users?search=${EMAIL_PREFIX}&max=500`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Keycloak user search failed: ${response.status}`);
  const users = (await response.json()) as { id: string; email?: string; createdTimestamp?: number }[];
  const cutoff = orphanCutoff(now).getTime();

  let removed = 0;
  for (const user of users) {
    if (!user.email || !isJourneyEmail(user.email)) continue;
    if ((user.createdTimestamp ?? 0) >= cutoff) continue;
    await deleteJourneyUser(user.id);
    removed += 1;
  }
  return removed;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/journeys/fixtures/keycloak.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Verify against the real Keycloak**

With the stack up:

```bash
npx tsx -e "import {createJourneyUser,deleteJourneyUser,journeyEmail} from './tests/journeys/fixtures/keycloak.ts'; \
const e=journeyEmail('probe','applicant'); \
const id=await createJourneyUser({email:e,password:'Probe123!',firstName:'P',lastName:'Robe'}); \
console.log('created',id); await deleteJourneyUser(id); await deleteJourneyUser(id); console.log('deleted twice, no throw');"
```

Expected: prints a user id, then `deleted twice, no throw` — proving delete is idempotent.

- [ ] **Step 6: Commit**

```bash
git add tests/journeys/fixtures/keycloak.ts tests/journeys/fixtures/keycloak.test.ts
git commit -m "test(journeys): Keycloak user lifecycle with orphan sweep (v0.20.3, D-103)"
```

---

### Task 4: Per-journey tenant provisioning

**Files:**
- Create: `tests/journeys/fixtures/tenant.ts`
- Modify: `packages/db/src/regression.ts:4-22` (add `"KeycloakUser"` to `RegressionEntityType`)

**Interfaces:**
- Consumes: `journeyEmail` (Task 3)
- Produces: `provisionJourneyTenant(runId: string): Promise<JourneyTenant>` where
  `JourneyTenant = { tenantId: string; tenantSlug: string; programId: string; missionId: string; adminUserId: string; adminEmail: string }`

Setup runs through server-side functions, not the UI: provisioning is not what the applicant arc
tests. A mission publish is a program-wide broadcast (`D-097`), which is exactly why this tenant must
be the journey's own.

- [ ] **Step 1: Allow Keycloak users to be marked**

In `packages/db/src/regression.ts`, extend the union:

```ts
export type RegressionEntityType =
  | "ApplicationAnswer"
  | "Application"
  | "StoredFile"
  | "Submission"
  | "EngineeringJournalEntry"
  | "MissionAssignment"
  | "Mission"
  | "Program"
  | "TenantMembership"
  | "User"
  | "Tenant"
  // Reaped over Keycloak's Admin REST API after the Prisma transaction commits — it cannot
  // participate in that transaction (v0.20.3, D-103).
  | "KeycloakUser";
```

Leave `REGRESSION_CLEANUP_ORDER` unchanged: omitting `"KeycloakUser"` is what makes the Prisma pass
skip it.

- [ ] **Step 2: Write the provisioning fixture**

```ts
// tests/journeys/fixtures/tenant.ts
import { createMission, createProgram, createOrganization, markRegressionData, prisma } from "@talentos/db";
import { journeyEmail } from "./keycloak";

export type JourneyTenant = {
  tenantId: string;
  tenantSlug: string;
  programId: string;
  missionId: string;
  adminUserId: string;
  adminEmail: string;
};

/**
 * Creates a tenant owned by this run, with one published program and one published Week 1 mission.
 *
 * Journeys do not share the seeded `demo` tenant: publishing a mission resumes every applicant stuck
 * on a dangling REPEAT across the whole program (D-097), so a journey publishing into `demo` would
 * mutate the seeded applicant that run.ts scenarios and the documentation screenshots depend on.
 */
export async function provisionJourneyTenant(runId: string): Promise<JourneyTenant> {
  const slug = `jrn-${runId}`.toLowerCase();
  const adminEmail = journeyEmail(runId, "admin");

  const organization = await createOrganization({
    name: `Journey ${runId}`,
    slug,
    primaryColor: "#1f2937",
    secondaryColor: "#6366f1",
    adminEmail,
    adminName: `Journey ${runId} Admin`,
    actorUserId: null
  });

  const tenantId = organization.tenant.id;
  const adminUserId = organization.adminUser.id;

  const program = await createProgram({
    tenantId,
    name: "Journey Program",
    slug: "journey-program",
    description: "Program provisioned for a journey run.",
    status: "PUBLISHED",
    actorUserId: adminUserId
  });

  const mission = await createMission({
    tenantId,
    programId: program.id,
    title: "Journey Week 1 Mission",
    difficulty: "FOUNDATION",
    status: "PUBLISHED",
    weekNumber: 1,
    order: 1,
    brief: "Build and ship the Week 1 deliverable.",
    objective: "Demonstrate the end-to-end submission workflow.",
    acceptanceCriteria: "A deployed URL, a repository URL and a walkthrough recording.",
    deliverables: "Repository, deployment, recording.",
    evaluationCriteria: "Completeness, clarity, working deployment.",
    competencyTags: ["delivery"],
    tutorialUrl: null,
    actorUserId: adminUserId
  });

  // Registered newest-first is unnecessary: cleanup walks REGRESSION_CLEANUP_ORDER, not insert order.
  for (const [entityType, entityId] of [
    ["Mission", mission.id],
    ["Program", program.id],
    ["User", adminUserId],
    ["Tenant", tenantId]
  ] as const) {
    await markRegressionData({ runId, entityType, entityId });
  }

  return {
    tenantId,
    tenantSlug: slug,
    programId: program.id,
    missionId: mission.id,
    adminUserId,
    adminEmail
  };
}

export { prisma };
```

- [ ] **Step 3: Verify it provisions and cleans up**

With the stack up:

```bash
npx tsx -e "import {provisionJourneyTenant} from './tests/journeys/fixtures/tenant.ts'; \
import {cleanupRegressionData} from '@talentos/db'; \
const t=await provisionJourneyTenant('probe1'); console.log(t); \
console.log(await cleanupRegressionData('probe1'));"
```

Expected: prints the tenant, then a cleanup summary showing `Mission`, `Program`, `User`, `Tenant`
each deleted. If a foreign-key error appears, the entity is missing from `REGRESSION_CLEANUP_ORDER` —
fix the order, not the fixture.

- [ ] **Step 4: Typecheck and commit**

```bash
npm run typecheck
git add packages/db/src/regression.ts tests/journeys/fixtures/tenant.ts
git commit -m "test(journeys): per-journey tenant provisioning and KeycloakUser marker (v0.20.3, D-103)"
```

---

### Task 5: Actors — authenticated pages per role

**Files:**
- Create: `tests/journeys/fixtures/actors.ts`

**Interfaces:**
- Consumes: `JourneyTenant` (Task 4), `Actor` (Task 2)
- Produces: `portalUrl(actor: Actor, tenantSlug: string): string`, `completeLogin(page: Page, email: string, password: string): Promise<void>`, `JOURNEY_PASSWORD`

`completeLogin` is lifted from `scripts/user-guide/capture-screenshots.ts:71-96`, which is deleted in
Task 8. It is the one piece of that script worth keeping.

- [ ] **Step 1: Write the module**

```ts
// tests/journeys/fixtures/actors.ts
import type { Page } from "@playwright/test";
import type { Actor } from "./types";

// Must satisfy the realm's password policy:
// length(12) and upperCase(1) and lowerCase(1) and digits(1) and specialChars(1).
// "Journey123!" was 11 characters and is rejected at user creation (found in Task 3).
export const JOURNEY_PASSWORD = "JourneyPass123!";

const APPLICANT_PORT = 3100;
const ADMIN_PORT = 3200;

/** Applicant actors browse the applicant portal; every other actor browses the admin portal. */
export function portalUrl(actor: Actor, tenantSlug: string): string {
  const port = actor === "applicant" ? APPLICANT_PORT : ADMIN_PORT;
  return `http://${tenantSlug}.lvh.me:${port}`;
}

/**
 * Drives whatever login hop the current page shows — the portal's "Sign in with Keycloak" button or
 * the Keycloak credential form — until the page is neither. Lifted from the retired
 * capture-screenshots.ts, which had to solve the same multi-hop problem.
 */
export async function completeLogin(page: Page, email: string, password: string): Promise<void> {
  for (let hop = 0; hop < 15; hop++) {
    await page.waitForLoadState("domcontentloaded");

    if (await page.locator("#kc-form-login").count()) {
      await page.fill("#username", email);
      await page.fill("#password", password);
      await page.click("#kc-login");
      continue;
    }

    const ssoButton = page.locator('button:has-text("Sign in with Keycloak")');
    if (await ssoButton.count()) {
      await ssoButton.first().click();
      continue;
    }

    return;
  }
  throw new Error(`Login flow did not converge for ${email} at ${page.url()}`);
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add tests/journeys/fixtures/actors.ts
git commit -m "test(journeys): actor portal URLs and Keycloak login hop (v0.20.3, D-103)"
```

---

### Task 6: The `journey` fixture

**Files:**
- Create: `tests/journeys/fixtures/journey.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–5
- Produces: `export const test` (extended Playwright `test`) exposing a `journey` fixture:
  - `journey.runId: string`
  - `journey.tenant: JourneyTenant`
  - `journey.step(name: string, meta: StepMeta, body: (page: Page) => Promise<void>): Promise<void>`
  - `journey.pageFor(actor: Actor): Promise<Page>`
  - `journey.registerKeycloakUser(userId: string): void`
- Also re-exports `expect` so specs import both from one place.

- [ ] **Step 1: Write the fixture**

```ts
// tests/journeys/fixtures/journey.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, expect, type Browser, type Page } from "@playwright/test";
import { cleanupRegressionData, markRegressionData } from "@talentos/db";
import { JOURNEY_EVIDENCE_DIR, JOURNEY_RESULTS_DIR } from "../../../playwright.config";
import { buildStepRecord, journeyStatus, screenshotFilename } from "./evidence";
import { deleteJourneyUser, sweepOrphanJourneyUsers } from "./keycloak";
import { portalUrl } from "./actors";
import { provisionJourneyTenant, type JourneyTenant } from "./tenant";
import type { Actor, JourneyRecord, JourneyStepRecord, StepMeta } from "./types";

export type Journey = {
  runId: string;
  tenant: JourneyTenant;
  step(name: string, meta: StepMeta, body: (page: Page) => Promise<void>): Promise<void>;
  pageFor(actor: Actor): Promise<Page>;
  registerKeycloakUser(userId: string): void;
};

function newRunId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const test = base.extend<{ journey: Journey }>({
  journey: async ({ browser }, use, testInfo) => {
    const runId = newRunId();
    const startedAt = new Date();
    const tenant = await provisionJourneyTenant(runId);

    const journeyName = testInfo.project.name;
    const evidenceDir = join(JOURNEY_EVIDENCE_DIR, journeyName);
    mkdirSync(evidenceDir, { recursive: true });

    const steps: JourneyStepRecord[] = [];
    const pages = new Map<Actor, Page>();
    const keycloakUserIds: string[] = [];

    const journey: Journey = {
      runId,
      tenant,
      registerKeycloakUser(userId) {
        keycloakUserIds.push(userId);
        void markRegressionData({ runId, entityType: "KeycloakUser", entityId: userId });
      },
      async pageFor(actor) {
        const existing = pages.get(actor);
        if (existing) return existing;
        // A separate context per actor: the applicant and the reviewer must hold
        // independent sessions simultaneously for the review step to be real.
        const context = await browser.newContext({ baseURL: portalUrl(actor, tenant.tenantSlug) });
        const page = await context.newPage();
        pages.set(actor, page);
        return page;
      },
      async step(name, meta, body) {
        const index = steps.length + 1;
        const started = Date.now();
        // `system` steps are not user actions; they borrow the applicant's page only so the
        // evidence has something to show, and say so in `proves`.
        const page = await journey.pageFor(meta.actor === "system" ? "applicant" : meta.actor);

        await base.step(`${index}. ${name}`, async () => {
          let error: string | null = null;
          try {
            await body(page);
          } catch (thrown) {
            error = thrown instanceof Error ? thrown.message : String(thrown);
          }

          if (error === null) {
            const file = screenshotFilename(index, name);
            await page.screenshot({ path: join(evidenceDir, file), fullPage: true });
          }

          steps.push(buildStepRecord({ ...meta, index, name, durationMs: Date.now() - started, error }));
          if (error !== null) throw new Error(error);
        });
      }
    };

    await use(journey);

    // --- teardown: write evidence first, then clean up -------------------------------------
    const record: JourneyRecord = {
      journey: journeyName,
      runId,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      status: journeyStatus(steps),
      steps
    };
    mkdirSync(JOURNEY_RESULTS_DIR, { recursive: true });
    writeFileSync(join(JOURNEY_RESULTS_DIR, `${journeyName}-${runId}.json`), JSON.stringify(record, null, 2), "utf8");

    for (const page of pages.values()) await page.context().close();

    // Database rows first (one transaction), then Keycloak (no rollback available), then the
    // orphan sweep for users left by runs that were killed before reaching this point.
    await cleanupRegressionData(runId);
    for (const userId of keycloakUserIds) await deleteJourneyUser(userId);
    await sweepOrphanJourneyUsers();
  }
});

export { expect };
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean. If importing `playwright.config` fails, export the two constants from a small
`tests/journeys/fixtures/paths.ts` instead and import that from both places.

- [ ] **Step 3: Commit**

```bash
git add tests/journeys/fixtures/journey.ts
git commit -m "test(journeys): journey fixture with per-actor contexts and evidence teardown (v0.20.3, D-103)"
```

---

### Task 7: The applicant arc

**Files:**
- Create: `tests/journeys/applicant-arc.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `Journey` (Task 6); `JOURNEY_PASSWORD`, `completeLogin` (Task 5)
- Produces: `.ops/journey-results/applicant-arc-<runId>.json` and screenshots

**The time constraint.** Submission requires 4 journal entries; entries must be dated on or after
mission start and not in the future, one per mission per date. A mission accepted today therefore has
exactly one legal journal date, so step 5 backdates acceptance. It is an `actor: "system"` step and
says plainly that it is not a user action — evidence implying an applicant journaled over four real
days would be misleading.

- [ ] **Step 1: Write the spec**

```ts
// tests/journeys/applicant-arc.spec.ts
import { createJourneyUser, journeyEmail } from "./fixtures/keycloak";
import { JOURNEY_PASSWORD, completeLogin } from "./fixtures/actors";
import { expect, test } from "./fixtures/journey";
import { prisma } from "./fixtures/tenant";

test("applicant arc", async ({ journey }) => {
  const applicantEmail = journeyEmail(journey.runId, "applicant");

  await journey.step("Applicant account is created in Keycloak", {
    actor: "system",
    proves: "Signup identity exists in the realm — not a user action, it stands in for self-registration"
  }, async () => {
    const userId = await createJourneyUser({
      email: applicantEmail,
      password: JOURNEY_PASSWORD,
      firstName: "Journey",
      lastName: "Applicant"
    });
    journey.registerKeycloakUser(userId);
    expect(userId).toBeTruthy();
  });

  await journey.step("Applicant signs in and reaches the apply page", {
    actor: "applicant",
    proves: "Keycloak login succeeds and an unaccepted applicant is routed to /apply"
  }, async (page) => {
    await page.goto("/apply");
    await completeLogin(page, applicantEmail, JOURNEY_PASSWORD);
    await expect(page).toHaveURL(/\/apply/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  await journey.step("Applicant submits an application", {
    actor: "applicant",
    proves: "Application is persisted as SUBMITTED against the journey tenant"
  }, async (page) => {
    await page.getByRole("button", { name: /submit/i }).first().click();
    await page.waitForLoadState("networkidle");

    const application = await prisma.application.findFirst({
      where: { tenantId: journey.tenant.tenantId, applicant: { email: applicantEmail } }
    });
    expect(application?.status).toBe("SUBMITTED");
  });

  await journey.step("Reviewer accepts the application", {
    actor: "reviewer",
    proves: "Acceptance assigns the Week 1 mission — an accepted applicant is never left with none"
  }, async (page) => {
    await page.goto("/applications");
    await completeLogin(page, journey.tenant.adminEmail, JOURNEY_PASSWORD);
    await page.getByRole("link", { name: /journey applicant/i }).first().click();
    await page.getByRole("button", { name: /accept/i }).first().click();
    await page.waitForLoadState("networkidle");

    const assignment = await prisma.missionAssignment.findFirst({
      where: { tenantId: journey.tenant.tenantId, missionId: journey.tenant.missionId }
    });
    expect(assignment).not.toBeNull();
  });

  await journey.step("Applicant accepts the mission", {
    actor: "applicant",
    proves: "Acceptance sets a Thursday deadline at least four working days out"
  }, async (page) => {
    await page.goto("/dashboard/missions");
    await page.getByRole("link", { name: /journey week 1 mission/i }).click();
    await page.getByRole("button", { name: /accept mission/i }).click();
    await page.waitForLoadState("networkidle");

    const assignment = await prisma.missionAssignment.findFirstOrThrow({
      where: { tenantId: journey.tenant.tenantId, missionId: journey.tenant.missionId }
    });
    expect(assignment.acceptedAt).not.toBeNull();
    expect(assignment.deadlineAt?.getUTCDay()).toBe(4); // Thursday
  });

  await journey.step("Mission acceptance is backdated by four days", {
    actor: "system",
    proves: "Simulates elapsed time — NOT a user action. Four journal entries need four distinct dates on or after mission start and not in the future, so a mission accepted today has only one legal date"
  }, async () => {
    const backdated = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const { count } = await prisma.missionAssignment.updateMany({
      where: { tenantId: journey.tenant.tenantId, missionId: journey.tenant.missionId },
      data: { acceptedAt: backdated, assignedAt: backdated }
    });
    expect(count).toBe(1);
  });

  await journey.step("Applicant writes four journal entries across four dates", {
    actor: "applicant",
    proves: "Per-mission-per-date uniqueness holds and submission readiness reaches 4 of 4 journals"
  }, async (page) => {
    for (let daysAgo = 4; daysAgo >= 1; daysAgo--) {
      const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await page.goto("/dashboard/journal/new");
      await page.fill('input[name="entryDate"]', date);
      await page.fill('textarea[name="whatIDid"]', `Day ${5 - daysAgo}: implemented and tested a slice.`);
      await page.fill('textarea[name="whatILearned"]', "Reinforced the review loop.");
      await page.fill('input[name="timeSpentHours"]', "3");
      await page.getByRole("button", { name: /save/i }).click();
      await page.waitForLoadState("networkidle");
    }

    const entries = await prisma.engineeringJournalEntry.count({
      where: { tenantId: journey.tenant.tenantId, missionId: journey.tenant.missionId }
    });
    expect(entries).toBe(4);
  });

  await journey.step("Applicant completes the mission tasks", {
    actor: "applicant",
    proves: "Mission-scoped task completion is recorded per assignment (v0.20.0, D-096)"
  }, async (page) => {
    await page.goto("/dashboard/tasks");
    const checkboxes = page.getByRole("button", { name: /mark complete/i });
    const total = await checkboxes.count();
    for (let i = 0; i < total; i++) {
      await checkboxes.nth(0).click();
      await page.waitForLoadState("networkidle");
    }
    await expect(page.getByRole("button", { name: /mark complete/i })).toHaveCount(0);
  });

  await journey.step("Applicant submits the mission evidence", {
    actor: "applicant",
    proves: "Readiness gates pass and the submission moves to SUBMITTED"
  }, async (page) => {
    await page.goto("/dashboard/missions");
    await page.getByRole("link", { name: /journey week 1 mission/i }).click();
    await page.fill('input[name="repositoryUrl"]', "https://github.com/karimjindani/talentOS");
    await page.fill('input[name="deploymentUrl"]', "https://example.com");
    await page.fill('input[name="walkthroughUrl"]', "https://example.com/walkthrough");
    await page.getByRole("button", { name: /^submit/i }).click();
    await page.waitForLoadState("networkidle");

    const submission = await prisma.submission.findFirst({
      where: { tenantId: journey.tenant.tenantId, missionId: journey.tenant.missionId }
    });
    expect(submission?.status).toBe("SUBMITTED");
  });

  await journey.step("Reviewer requests changes", {
    actor: "reviewer",
    proves: "A NEEDS_REVISION decision appends an immutable SubmissionReview round (v0.20.0, D-098)"
  }, async (page) => {
    await page.goto("/submissions");
    await page.getByRole("link", { name: /journey week 1 mission/i }).first().click();
    await page.fill('textarea[name="feedback"]', "Add tests for the failure path, then resubmit.");
    await page.getByRole("button", { name: /request changes/i }).click();
    await page.waitForLoadState("networkidle");

    const reviews = await prisma.submissionReview.count({
      where: { missionAssignment: { tenantId: journey.tenant.tenantId, missionId: journey.tenant.missionId } }
    });
    expect(reviews).toBe(1);
  });

  await journey.step("Applicant sees the reviewer's feedback", {
    actor: "applicant",
    proves: "Review feedback reaches the applicant's workspace — closing the loop the arc exists to prove"
  }, async (page) => {
    await page.goto("/dashboard/missions");
    await page.getByRole("link", { name: /journey week 1 mission/i }).click();
    await expect(page.getByText(/add tests for the failure path/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it with the stack up**

Run: `npm run journeys:applicant`
Expected: PASS. Selector mismatches are likely on the first run — fix the **selector**, never the
assertion. If a `proves` claim cannot be made true, that is a product finding: record it rather than
weakening the step.

- [ ] **Step 3: Confirm the evidence exists**

```bash
cat .ops/journey-results/applicant-arc-*.json | head -40
ls .ops/journey-evidence/applicant-arc/
```

Expected: a `JourneyRecord` with `"status": "passed"` and 11 steps, and 11 PNGs.

- [ ] **Step 4: Confirm cleanup left nothing behind**

```bash
npx tsx -e "import {prisma} from '@talentos/db'; \
console.log('tenants:', await prisma.tenant.count({where:{slug:{startsWith:'jrn-'}}})); \
console.log('markers:', await prisma.regressionDataMarker.count());"
```

Expected: `tenants: 0`. A non-zero count means teardown did not run — investigate before continuing.

- [ ] **Step 5: Commit**

```bash
git add tests/journeys/applicant-arc.spec.ts
git commit -m "test(journeys): applicant arc end-to-end journey (v0.20.3, D-103)"
```

---

### Task 8: Retire `capture-screenshots.ts`

**Files:**
- Create: `tests/journeys/docs-only.spec.ts`
- Delete: `scripts/user-guide/capture-screenshots.ts`
- Delete: `tests/journeys/smoke.spec.ts`
- Modify: `package.json` (drop any capture script)

**Interfaces:**
- Consumes: `completeLogin`, `portalUrl` (Task 5)
- Produces: the user-guide screenshots that no journey walks through, written to
  `docs/user-guides/screenshots/`

- [ ] **Step 1: Inventory which screenshots the applicant arc does not produce**

```bash
git show HEAD:scripts/user-guide/capture-screenshots.ts | grep -oE '"[0-9]{2}-[a-z0-9-]+\.png"' | sort -u
```

Every filename not covered by an applicant-arc step belongs in `docs-only.spec.ts`. The Ops console
section is certainly in this set; so are the admin pages the applicant arc never opens.

- [ ] **Step 2: Write the docs-only spec**

Model each capture on this shape, one `test` per section so a single broken page does not lose the
rest:

```ts
// tests/journeys/docs-only.spec.ts
import { expect, test } from "@playwright/test";
import { completeLogin } from "./fixtures/actors";

const SHOTS = "docs/user-guides/screenshots";

test("ops console screenshots", async ({ page }) => {
  await page.goto("http://127.0.0.1:3300/");
  await completeLogin(page, "orgadmin@demo.talentos.local", "demo-password");
  // Assert before photographing: a screenshot of an error page is worse than no screenshot.
  await expect(page.getByRole("heading", { name: /ops/i })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/30-ops-console.png`, fullPage: true });
});
```

Use the seeded `demo` tenant here, not a journey tenant — these shots document the seeded state the
user guides describe.

- [ ] **Step 3: Run and compare against the committed set**

Run: `npm run journeys:docs && git status --short docs/user-guides/screenshots/`
Expected: modified PNGs, **no deletions**. A deletion means a screenshot lost its producer — add it to
this spec before continuing.

- [ ] **Step 4: Delete the retired script and the smoke spec**

```bash
git rm scripts/user-guide/capture-screenshots.ts tests/journeys/smoke.spec.ts
```

- [ ] **Step 5: Confirm nothing else references it**

Run: `grep -rn "capture-screenshots" --include=*.ts --include=*.json --include=*.yml --include=*.md . | grep -v node_modules`
Expected: only historical mentions in `docs/`. Any live reference in `.github/workflows/ci.yml` is
handled in Task 9; a reference in `package.json` must be removed now.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(journeys): docs-only project replaces capture-screenshots.ts (v0.20.3, D-103)"
```

---

### Task 9: Evidence renderer

**Files:**
- Create: `scripts/ci/journey-report.ts`
- Test: `scripts/ci/journey-report.test.ts`

**Interfaces:**
- Consumes: `JourneyRecord` JSON written by Task 6
- Produces: `renderJourneyMarkdown(record: JourneyRecord): string`; writes
  `.ops/journey-evidence/<journey>/evidence.md` and appends to `$GITHUB_STEP_SUMMARY`

Mirrors `scripts/ci/regression-summary.ts`: dependency-free, and **never throws** — it runs with
`if: always()`, including when the stack died before producing anything.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/ci/journey-report.test.ts
import { describe, expect, it } from "vitest";
import { renderJourneyMarkdown } from "./journey-report";

const record = {
  journey: "applicant-arc",
  runId: "abc123",
  startedAt: "2026-08-13T10:00:00.000Z",
  durationMs: 42_000,
  status: "passed" as const,
  steps: [
    { index: 1, name: "Applicant signs up", actor: "applicant" as const, proves: "Creates a user",
      status: "passed" as const, durationMs: 2400, screenshot: "01-applicant-signs-up.png" }
  ]
};

describe("renderJourneyMarkdown", () => {
  it("leads with the verdict", () => {
    expect(renderJourneyMarkdown(record)).toContain("✅ **Passed**");
  });

  it("renders one row per step carrying actor, claim and screenshot", () => {
    const md = renderJourneyMarkdown(record);
    expect(md).toContain("| 1 | applicant | Applicant signs up | Creates a user |");
    expect(md).toContain("01-applicant-signs-up.png");
  });

  it("shows the error and no screenshot for a failed step", () => {
    const failed = {
      ...record,
      status: "failed" as const,
      steps: [{ ...record.steps[0], status: "failed" as const, screenshot: null, error: "timeout" }]
    };
    const md = renderJourneyMarkdown(failed);
    expect(md).toContain("❌ **Failed**");
    expect(md).toContain("timeout");
    expect(md).not.toContain(".png");
  });

  it("escapes pipes so a claim containing one cannot break the table", () => {
    const piped = { ...record, steps: [{ ...record.steps[0], proves: "a | b" }] };
    expect(renderJourneyMarkdown(piped)).toContain("a \\| b");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run scripts/ci/journey-report.test.ts`
Expected: FAIL — cannot resolve `./journey-report`.

- [ ] **Step 3: Write the renderer**

```ts
// scripts/ci/journey-report.ts
/**
 * Renders journey evidence into a GitHub step summary and a per-journey Markdown document.
 *
 * Same contract as scripts/ci/regression-summary.ts: dependency-free and non-throwing. It runs with
 * `if: always()`, including when the stack failed to boot and no evidence exists — a crash here would
 * replace the real failure with a confusing one. The journey step itself owns the pass/fail exit code.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type StepRecord = {
  index: number; name: string; actor: string; proves: string;
  status: "passed" | "failed"; durationMs: number; screenshot: string | null; error?: string;
};
type JourneyRecord = {
  journey: string; runId: string; startedAt: string; durationMs: number;
  status: "passed" | "failed"; steps: StepRecord[];
};

const RESULTS_DIR = resolve(process.argv[2] ?? join(".ops", "journey-results"));
const EVIDENCE_DIR = resolve(process.argv[3] ?? join(".ops", "journey-evidence"));

function emit(markdown: string): void {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (!target) {
    process.stdout.write(`${markdown}\n`);
    return;
  }
  try {
    appendFileSync(target, `${markdown}\n`, "utf8");
  } catch (error) {
    process.stdout.write(`Could not write step summary: ${String(error)}\n${markdown}\n`);
  }
}

function escapePipes(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function renderJourneyMarkdown(record: JourneyRecord): string {
  const verdict = record.status === "failed" ? "❌ **Failed**" : "✅ **Passed**";
  const passed = record.steps.filter((s) => s.status === "passed").length;

  const lines: string[] = [
    `## Journey: ${record.journey}`,
    "",
    `${verdict} — ${passed}/${record.steps.length} steps · ${seconds(record.durationMs)}`,
    "",
    `Run \`${record.runId}\` · started ${record.startedAt}`,
    "",
    "| # | Actor | Step | Proves | Result | Evidence |",
    "| --- | --- | --- | --- | --- | --- |"
  ];

  for (const step of record.steps) {
    const result = step.status === "passed" ? `✅ ${seconds(step.durationMs)}` : "❌ failed";
    const evidence = step.screenshot ? `\`${step.screenshot}\`` : "—";
    lines.push(
      `| ${step.index} | ${step.actor} | ${escapePipes(step.name)} | ${escapePipes(step.proves)} | ${result} | ${evidence} |`
    );
  }

  const failures = record.steps.filter((s) => s.status === "failed");
  if (failures.length > 0) {
    lines.push("", "### Failures", "");
    for (const step of failures) {
      lines.push(`**${step.index}. ${escapePipes(step.name)}**`, "", "```", (step.error ?? "no error text").trim(), "```", "");
    }
  }

  return lines.join("\n");
}

function main(): void {
  if (!existsSync(RESULTS_DIR)) {
    emit(
      "## Journey evidence\n\n⚠️ **No journey results were produced.**\n\n" +
        `Nothing matched \`${RESULTS_DIR}/*.json\`, which usually means the stack failed to boot ` +
        "before the journeys ran. Check the bootstrap step's log and the uploaded Docker logs."
    );
    return;
  }

  const files = readdirSync(RESULTS_DIR).filter((n) => n.endsWith(".json") && n !== "playwright.json");
  if (files.length === 0) {
    emit("## Journey evidence\n\n⚠️ No journey result files found.");
    return;
  }

  for (const file of files) {
    let record: JourneyRecord;
    try {
      record = JSON.parse(readFileSync(join(RESULTS_DIR, file), "utf8")) as JourneyRecord;
    } catch (error) {
      emit(`## Journey evidence\n\n⚠️ Could not parse \`${file}\`: ${String(error)}`);
      continue;
    }

    const markdown = renderJourneyMarkdown(record);
    emit(markdown);

    try {
      const dir = join(EVIDENCE_DIR, record.journey);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "evidence.md"), `${markdown}\n`, "utf8");
    } catch (error) {
      process.stdout.write(`Could not write evidence document: ${String(error)}\n`);
    }
  }
}

main();
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run scripts/ci/journey-report.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Render a real run**

Run: `GITHUB_STEP_SUMMARY=.ops/summary.md npx tsx scripts/ci/journey-report.ts && cat .ops/summary.md`
Expected: the applicant-arc table with 11 rows.

- [ ] **Step 6: Prove it survives a missing directory**

Run: `npx tsx scripts/ci/journey-report.ts .ops/does-not-exist; echo "exit=$?"`
Expected: the "No journey results were produced" warning and `exit=0`.

- [ ] **Step 7: Commit**

```bash
git add scripts/ci/journey-report.ts scripts/ci/journey-report.test.ts
git commit -m "ci(journeys): render journey evidence into step summary and Markdown (v0.20.3, D-103)"
```

---

### Task 10: CI wiring

**Files:**
- Modify: `.github/workflows/ci.yml` (the `e2e-evidence` job)

**Interfaces:**
- Consumes: `npm run journeys`, `npm run journeys:report`
- Produces: journey evidence inside the existing `e2e-evidence` artifact

The existing job is extended rather than duplicated: roughly four of its five minutes are stack boot.

- [ ] **Step 1: Replace the capture step and add the renderer**

In the `e2e-evidence` job, replace the `Capture portal screenshots` step:

```yaml
      # Journeys drive the real UI and assert at every step; the docs-only project produces the
      # user-guide screenshots no journey walks through. if: always() so a failing regression run
      # still shows how far a real user got.
      - name: Run journeys
        if: always()
        run: npm run journeys

      - name: Write run summary
        if: always()
        run: npx tsx scripts/ci/regression-summary.ts

      - name: Write journey evidence
        if: always()
        run: npm run journeys:report
```

- [ ] **Step 2: Extend the artifact paths**

In the `Upload evidence` step's `path:` list, add:

```yaml
            .ops/journey-results/*.json
            .ops/journey-evidence/**
```

- [ ] **Step 3: Validate the YAML**

```bash
npx tsx -e "import {readFileSync} from 'node:fs'; \
const y=readFileSync('.github/workflows/ci.yml','utf8'); \
console.log('capture-screenshots refs:', (y.match(/capture-screenshots/g)||[]).length); \
console.log('journey steps:', (y.match(/journeys/g)||[]).length);"
```

Expected: `capture-screenshots refs: 0`, `journey steps: 2` or more.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(journeys): run journeys and publish their evidence on pull requests (v0.20.3, D-103)"
```

---

### Task 11: SSDLC documentation

**Files:**
- Create: `docs/plans/v0.20.3_Journey_Level_E2E_Evidence.md` (from `docs/plans/TEMPLATE.md`)
- Create: `docs/testing/v0.20.3_Journey_Level_E2E_Evidence_Test_Results.md` (from `docs/testing/TEMPLATE.md`)
- Modify: `docs/Decision_Log.md` (add `D-103`), `docs/Testing_Strategy.md`,
  `docs/Regression_Scenarios.md`, `docs/CI_CD_Pipeline.md`, `docs/Version_Baseline.md`, `docs/sdlc.md`

**Interfaces:**
- Consumes: everything above
- Produces: the traceability chain `docs/sdlc.md` requires

- [ ] **Step 1: Re-verify the version before writing it anywhere**

Run: `node .claude/skills/version-allocation-and-gates/scripts/allocate-version.js`
Expected: `v0.20.3`. If another branch has claimed it, use the next free number **everywhere in this
plan**, including the commit trailers already made — note the discrepancy in the plan rather than
rewriting history.

- [ ] **Step 2: Write the plan from the template**

Use `docs/plans/TEMPLATE.md`. Its Test Scenarios section must use the `- **Scenario**:` bullet form —
the coverage checker cannot parse other shapes. One scenario per journey step group, at minimum:
the happy path, the reviewer role boundary, tenant isolation, and a negative case.

- [ ] **Step 3: Write the test results from the template**

Use `docs/testing/TEMPLATE.md`. One Scenario Results row per plan scenario, names copied verbatim.
Record real numbers from the runs in Tasks 7 and 9 — not estimates.

- [ ] **Step 4: Verify the traceability chain mechanically**

Run: `node .claude/skills/ssdlc-documentation/scripts/check-scenario-coverage.js v0.20.3`
Expected: `N/N plan scenarios have a matching test-results row.`

- [ ] **Step 5: Add `D-103` and update the other docs**

`D-103` records: journeys are Playwright specs with a required `proves` field; each journey owns its
tenant because a mission publish is a program-wide broadcast (`D-097`); the applicant arc needs one
labelled `system` time-travel step; and `capture-screenshots.ts` is retired because an unasserted
screenshot can go stale silently.

In `Regression_Scenarios.md` add a `v0.20.3 Plan Scenario Traceability` section and update the
scenario-count statement. In `CI_CD_Pipeline.md` update the `e2e-evidence` step table. Bump
`Code version:` on every doc whose content changed, and `docs/sdlc.md` line 3 — the allocation script
reads that line, so leaving it stale makes the next iteration compute from the wrong number.

- [ ] **Step 6: Run every gate**

```bash
npm run typecheck && npm run lint && npm test && npm run build && npm run regression:all && npm run journeys
```

Expected: all pass. `regression:all` must still be 53/52/0/1 — journeys must not disturb it.

- [ ] **Step 7: Commit, then record the baseline**

```bash
git add -A
git commit -m "docs: v0.20.3 journey E2E evidence plan, results and decision (v0.20.3, D-103)"
# then backfill the code commit SHA into Version_Baseline.md and commit again:
git commit -am "docs: record v0.20.3 baseline commit (v0.20.3)"
```

- [ ] **Step 8: Stop. Do not push.**

`AGENTS.md` requires explicit user confirmation before any push to a remote. Report what was built and
ask.

---

## Self-review

**Spec coverage:**

| Spec section | Task |
| --- | --- |
| Architecture / file structure | 1, 2, 5, 6 |
| `journey.step` with required `proves` | 2 (type), 6 (fixture) |
| Two browser contexts in one journey | 6 (`pageFor`), 7 (applicant + reviewer) |
| Per-journey tenants, `D-097` rationale | 4 |
| Run-scoped identities | 3 |
| Keycloak cleanup, 4-step incl. prefix sweep | 3 (helpers), 6 (teardown order) |
| Concurrency `workers: 1` | 1 |
| Evidence artifact and storage | 6 (writes), 9 (renders) |
| Failure handling, trace retain-on-failure | 1 |
| The time problem, labelled system step | 7 (step 6) |
| Preventing vacuous passes | 2 (required `proves`), 7 (`expect` in every step) |
| CI wiring | 10 |
| `docs-only` project, delete capture script | 8 |
| SSDLC obligations | 11 |
| Journeys 2 and 3 | **Deferred by design** — separate plans |

**Type consistency:** `JourneyRecord` / `JourneyStepRecord` as defined in Task 2 are the exact shapes
written in Task 6 and parsed in Task 9. `Actor` is used identically in Tasks 2, 5, 6 and 7.
`JOURNEY_RESULTS_DIR` and `JOURNEY_EVIDENCE_DIR` are defined in Task 1 and consumed in Tasks 6 and 9.

**Known risk not resolvable on paper:** the selectors in Task 7 are written from route names and
conventional accessible roles, not from the rendered DOM. Expect to correct several on the first run.
Fix selectors; never weaken an assertion to make a step pass.
