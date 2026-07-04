import { randomBytes } from "node:crypto";

// Server-only Keycloak Admin REST client used to auto-provision an org admin when a SUPER_ADMIN creates
// an organization (v0.11.0). It authenticates with the confidential `talentos-provisioner` service
// account (client_credentials) — no master-admin password in app config. This module must never be
// imported by edge middleware or an edge barrel: it uses Node `fetch` + secrets and runs only in server
// actions.

const REALM = process.env.KEYCLOAK_REALM ?? "talentos";

/** Derive the Keycloak server base (no realm path) from the OIDC issuer,
 *  e.g. `http://host:8080/realms/talentos` → `http://host:8080`. */
export function adminBaseFromIssuer(issuer: string): string {
  return issuer.replace(/\/realms\/[^/]+\/?$/, "").replace(/\/$/, "");
}

function serverUrl(): string {
  if (process.env.KEYCLOAK_SERVER_URL) {
    return process.env.KEYCLOAK_SERVER_URL.replace(/\/$/, "");
  }
  return adminBaseFromIssuer(process.env.KEYCLOAK_ISSUER ?? "http://keycloak.lvh.me:8080/realms/talentos");
}

const adminApi = () => `${serverUrl()}/admin/realms/${REALM}`;

// Ambiguous-character-free sets; the mix satisfies the realm password policy
// (length ≥ 12, upper, lower, digit, special).
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGIT = "23456789";
const SPECIAL = "!@#$%^&*-_";

function pick(set: string): string {
  return set[randomBytes(1)[0] % set.length];
}

/** A strong one-time temporary password guaranteed to satisfy the realm policy. */
export function generateTempPassword(): string {
  const all = UPPER + LOWER + DIGIT + SPECIAL;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SPECIAL)];
  while (chars.length < 16) chars.push(pick(all));
  // Fisher–Yates shuffle so the guaranteed characters are not positionally predictable.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

type TokenResponse = { access_token?: string; error?: string; error_description?: string };
type KeycloakUser = { id: string; username?: string; email?: string };
type KeycloakRole = { id: string; name: string };

async function getAdminToken(): Promise<string> {
  const clientId = process.env.KEYCLOAK_PROVISIONER_CLIENT_ID ?? "talentos-provisioner";
  const clientSecret = process.env.KEYCLOAK_PROVISIONER_CLIENT_SECRET ?? "talentos-provisioner-secret";
  const res = await fetch(`${serverUrl()}/realms/${REALM}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret
    }),
    cache: "no-store"
  });
  const payload = (await res.json()) as TokenResponse;
  if (!res.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? `Keycloak admin token failed (HTTP ${res.status}).`);
  }
  return payload.access_token;
}

async function findUserByEmail(token: string, email: string): Promise<KeycloakUser | null> {
  const res = await fetch(`${adminApi()}/users?email=${encodeURIComponent(email)}&exact=true`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`Keycloak user lookup failed (HTTP ${res.status}).`);
  const users = (await res.json()) as KeycloakUser[];
  return users[0] ?? null;
}

async function createUser(token: string, email: string, name: string | null): Promise<string> {
  const [firstName, ...rest] = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const res = await fetch(`${adminApi()}/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      username: email,
      email,
      enabled: true,
      emailVerified: true,
      ...(firstName ? { firstName } : {}),
      ...(rest.length ? { lastName: rest.join(" ") } : {}),
      requiredActions: ["UPDATE_PASSWORD", "CONFIGURE_TOTP"]
    })
  });
  if (res.status === 201) {
    const id = res.headers.get("location")?.split("/").pop();
    if (id) return id;
  } else if (!res.ok) {
    throw new Error(`Keycloak user create failed (HTTP ${res.status}).`);
  }
  // 201 without a usable Location header (or a race) — resolve by lookup.
  const existing = await findUserByEmail(token, email);
  if (existing) return existing.id;
  throw new Error("Keycloak user created but its id could not be resolved.");
}

async function setTemporaryPassword(token: string, userId: string, password: string): Promise<void> {
  const res = await fetch(`${adminApi()}/users/${userId}/reset-password`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "password", value: password, temporary: true })
  });
  if (!res.ok) throw new Error(`Keycloak set-password failed (HTTP ${res.status}).`);
}

async function ensureRealmRole(token: string, userId: string, roleName: string): Promise<void> {
  const roleRes = await fetch(`${adminApi()}/roles/${encodeURIComponent(roleName)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!roleRes.ok) throw new Error(`Keycloak role lookup failed (HTTP ${roleRes.status}).`);
  const role = (await roleRes.json()) as KeycloakRole;

  const assignRes = await fetch(`${adminApi()}/users/${userId}/role-mappings/realm`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ id: role.id, name: role.name }])
  });
  // Keycloak returns 204 on success; re-assigning an existing mapping is a no-op 204.
  if (!assignRes.ok) throw new Error(`Keycloak role assignment failed (HTTP ${assignRes.status}).`);
}

export type ProvisionResult = {
  created: boolean;
  tempPassword: string | null;
  keycloakUserId: string;
};

/**
 * Ensure a Keycloak user exists for the org admin and holds the ORG_ADMIN realm role. Idempotent:
 * a brand-new user is created with `emailVerified`, required actions (UPDATE_PASSWORD + CONFIGURE_TOTP)
 * and a generated temporary password (returned once); an existing user keeps their credentials and just
 * gains the role. Realm-role assignment always runs.
 */
export async function provisionOrgAdmin({
  email,
  name
}: {
  email: string;
  name?: string | null;
}): Promise<ProvisionResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const token = await getAdminToken();

  const existing = await findUserByEmail(token, normalizedEmail);
  let userId: string;
  let created = false;
  let tempPassword: string | null = null;

  if (existing) {
    userId = existing.id;
  } else {
    userId = await createUser(token, normalizedEmail, name ?? null);
    created = true;
    tempPassword = generateTempPassword();
    await setTemporaryPassword(token, userId, tempPassword);
  }

  await ensureRealmRole(token, userId, "ORG_ADMIN");
  return { created, tempPassword, keycloakUserId: userId };
}
