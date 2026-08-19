// tests/journeys/fixtures/journey.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { cleanupRegressionData, markRegressionData } from "@talentos/db";
import { JOURNEY_EVIDENCE_DIR, JOURNEY_RESULTS_DIR } from "../../../playwright.config";
import { buildStepRecord, journeyStatus, screenshotFilename } from "./evidence";
import { deleteJourneyUser, sweepOrphanJourneyUsers } from "./keycloak";
import { portalUrl, provisionJourneyAdminIdentity } from "./actors";
import { provisionJourneyTenant, type JourneyTenant } from "./tenant";
import type { Actor, JourneyRecord, JourneyStepRecord, StepMeta } from "./types";

export type Journey = {
  runId: string;
  tenant: JourneyTenant;
  step(name: string, meta: StepMeta, body: (page: Page) => Promise<void>): Promise<void>;
  pageFor(actor: Actor): Promise<Page>;
  registerKeycloakUser(userId: string): Promise<void>;
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
    // Namespaced by runId as well as journey: playwright.config.ts sets `retries: 1` under CI, and
    // a retry gets a fresh runId but the same project name and the same step-indexed screenshot
    // filenames. Without runId here, attempt 2 silently overwrites attempt 1's PNGs while
    // attempt 1's already-written JSON still points at them.
    const evidenceDir = join(JOURNEY_EVIDENCE_DIR, journeyName, runId);
    mkdirSync(evidenceDir, { recursive: true });

    const steps: JourneyStepRecord[] = [];
    const pages = new Map<Actor, Page>();
    const keycloakUserIds: string[] = [];

    const journey: Journey = {
      runId,
      tenant,
      async registerKeycloakUser(userId) {
        keycloakUserIds.push(userId);
        // Awaited, not fire-and-forget: an unawaited marker write can land AFTER
        // cleanupRegressionData has deleted this run's markers, leaving a permanent orphan row,
        // and a rejection would surface as an unhandled promise rejection with no owning step.
        await markRegressionData({ runId, entityType: "KeycloakUser", entityId: userId });
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

          // A failing screenshot must not delete the step from the record. If it threw here the
          // push below would never run, the step would vanish from the JSON, and journeyStatus()
          // would report "passed" over the remaining steps while the Playwright run had actually
          // failed — evidence disagreeing with what happened, which is the one thing this suite
          // must never do.
          if (error === null) {
            try {
              const file = screenshotFilename(index, name);
              await page.screenshot({ path: join(evidenceDir, file), fullPage: true });
            } catch (thrown) {
              error = `Step succeeded but its screenshot failed: ${
                thrown instanceof Error ? thrown.message : String(thrown)
              }`;
            }
          }

          steps.push(buildStepRecord({ ...meta, index, name, durationMs: Date.now() - started, error }));
          if (error !== null) throw new Error(error);
        });
      }
    };

    // The tenant admin exists only as a Prisma row until now: createOrganization writes the User
    // and its ORG_ADMIN membership, but login reads roles from the Keycloak access token, so the
    // reviewer has nothing to sign in with until the realm account exists (see Task 5).
    //
    // Guarded, because this runs BEFORE use(): a throw here (Keycloak unreachable, say) would skip
    // the whole teardown block below, and provisionJourneyTenant has already created and marked a
    // Tenant, User, Program and Mission. Nothing else would ever collect them — the 24h sweep only
    // looks in the Keycloak realm, never in Prisma.
    try {
      await journey.registerKeycloakUser(await provisionJourneyAdminIdentity(tenant));
    } catch (thrown) {
      // Swallowed so a failing cleanup cannot replace `thrown` and hide the setup failure that
      // actually matters — but logged, because everywhere else in this fixture a leak is loud.
      await cleanupRegressionData(runId).catch((cleanupError: unknown) => {
        console.error(
          `Journey ${runId} setup failed AND its cleanup failed; rows may be orphaned: ${
            cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          }`
        );
      });
      throw thrown;
    }

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

    // Database rows first (one transaction), then Keycloak (no rollback available), then the
    // orphan sweep for users left by runs that were killed before reaching this point.
    //
    // Each stage is independently guarded. A failing Prisma cleanup must not skip the Keycloak
    // reap: the realm has no transaction to roll back and no marker row to find these users by
    // later, so a skipped reap leaks identities until the 24h sweep catches them. Teardown
    // reports every failure it hit and then throws, so a leak is loud rather than silent.
    const teardownErrors: string[] = [];
    const attempt = async (what: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (thrown) {
        teardownErrors.push(`${what}: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
      }
    };

    // Closing contexts is a teardown stage like any other: an unguarded close() on a crashed
    // browser would throw here and skip every cleanup below it.
    for (const [actor, page] of pages.entries()) {
      await attempt(`close ${actor} browser context`, () => page.context().close());
    }

    await attempt("database cleanup", () => cleanupRegressionData(runId));
    for (const userId of keycloakUserIds) {
      await attempt(`delete Keycloak user ${userId}`, () => deleteJourneyUser(userId));
    }
    await attempt("orphan sweep", () => sweepOrphanJourneyUsers());

    if (teardownErrors.length > 0) {
      throw new Error(`Journey teardown left resources behind:\n- ${teardownErrors.join("\n- ")}`);
    }
  }
});

export { expect };
