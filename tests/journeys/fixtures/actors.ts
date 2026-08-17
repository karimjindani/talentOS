// tests/journeys/fixtures/actors.ts
import type { Page } from "@playwright/test";
import { createJourneyUser } from "./keycloak";
import type { JourneyTenant } from "./tenant";
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
 * Waits until the page has stopped fetching and its client components have hydrated.
 *
 * `locator.count()` does not auto-wait, so the login loop below must not inspect a page that has
 * only reached `domcontentloaded`: the portal's sign-in button is rendered by a client component,
 * and an unhydrated page shows neither that button nor the Keycloak form — which the loop would
 * read as "already authenticated" and return successfully from an anonymous page.
 */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(750);
}

/**
 * Drives whatever login hop the current page shows — the portal's "Sign in with Keycloak" button or
 * the Keycloak credential form — until the page is neither. Lifted from the retired
 * capture-screenshots.ts, which had to solve the same multi-hop problem.
 */
export async function completeLogin(page: Page, email: string, password: string): Promise<void> {
  for (let hop = 0; hop < 15; hop++) {
    await settle(page);

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

/**
 * Creates the Keycloak account behind `tenant.adminEmail` and returns its user id.
 *
 * createOrganization only writes the Prisma User and its ORG_ADMIN TenantMembership; login reads
 * roles from the access token, not from that membership, so without this the reviewer cannot sign
 * in. The caller must register the returned id for reaping — teardown has no other handle on it.
 */
export async function provisionJourneyAdminIdentity(tenant: JourneyTenant): Promise<string> {
  return createJourneyUser({
    email: tenant.adminEmail,
    password: JOURNEY_PASSWORD,
    firstName: "Journey",
    lastName: "Admin",
    realmRoles: ["ORG_ADMIN"]
  });
}
