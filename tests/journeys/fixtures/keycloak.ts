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
      username: process.env.KC_ADMIN ?? "admin",
      password: process.env.KC_ADMIN_PASSWORD ?? "admin"
    })
  });
  if (!response.ok) throw new Error(`Keycloak admin token failed: ${response.status}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

/** Realm role representations, needed by name -> {id,name} for the role-mapping endpoint. */
async function realmRole(token: string, name: string): Promise<{ id: string; name: string }> {
  const response = await fetch(`${realmBase()}/roles/${encodeURIComponent(name)}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Keycloak realm role "${name}" lookup failed: ${response.status}`);
  const role = (await response.json()) as { id: string; name: string };
  return { id: role.id, name: role.name };
}

export async function assignRealmRoles(userId: string, roles: readonly string[]): Promise<void> {
  if (roles.length === 0) return;
  const token = await adminToken();
  const representations = await Promise.all(roles.map((role) => realmRole(token, role)));
  const response = await fetch(`${realmBase()}/users/${userId}/role-mappings/realm`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(representations)
  });
  if (!response.ok) {
    throw new Error(`Keycloak realm role assignment failed: ${response.status} ${await response.text()}`);
  }
}

/**
 * Creates a Keycloak user and assigns its realm roles.
 *
 * `realmRoles` is required, not optional with a default: a journey user with no role is never what
 * a caller wants, and a silent empty default reproduces exactly the defect this fixes — auth.ts
 * derives `orgRole` entirely from the token's `realm_access.roles`, so a roleless user authenticates
 * successfully but can access nothing.
 */
export async function createJourneyUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  realmRoles: readonly string[];
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
  await assignRealmRoles(id, input.realmRoles);
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

/**
 * Pure decision of whether a single Keycloak user is an orphan the sweep should reap.
 * Unknown age must fail SAFE (preserve), not toward deletion: a missing `createdTimestamp`
 * must never be treated as epoch-old — Keycloak types this field as optional, so the absent
 * case is real, and treating it as "always older than cutoff" would reap a run's own in-flight
 * user. Extracted so the guard logic can be unit-tested without any HTTP call.
 */
export function shouldReapUser(user: { email?: string; createdTimestamp?: number }, cutoffMs: number): boolean {
  if (!user.email || !isJourneyEmail(user.email)) return false;
  if ((user.createdTimestamp ?? Date.now()) >= cutoffMs) return false;
  return true;
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
    if (!shouldReapUser(user, cutoff)) continue;
    await deleteJourneyUser(user.id);
    removed += 1;
  }
  return removed;
}
