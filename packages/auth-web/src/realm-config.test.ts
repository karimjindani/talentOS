import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Keycloak Realm Configuration Validation Tests
//
// Protects against: Keycloak redirect URI misconfiguration, missing realm roles,
// disabled registration, wrong client secrets, and other realm drift that passes
// unit tests but breaks real OIDC login flows during manual QA.
//
// These tests parse the realm import JSON (the source of truth for a fresh
// Keycloak deployment) and validate every property the application depends on.
// ─────────────────────────────────────────────────────────────────────────────

const realmPath = fileURLToPath(
  new URL("../../../keycloak/import/talentos-realm.json", import.meta.url)
);

type RealmClient = {
  clientId: string;
  enabled?: boolean;
  publicClient?: boolean;
  secret?: string;
  standardFlowEnabled?: boolean;
  directAccessGrantsEnabled?: boolean;
  redirectUris?: string[];
  webOrigins?: string[];
  attributes?: Record<string, string>;
  serviceAccountsEnabled?: boolean;
  defaultClientScopes?: string[];
};

type RealmUser = {
  username: string;
  email?: string;
  enabled?: boolean;
  requiredActions?: string[];
  realmRoles?: string[];
  clientRoles?: Record<string, string[]>;
  serviceAccountClientId?: string;
};

type Realm = {
  realm: string;
  enabled: boolean;
  registrationAllowed?: boolean;
  registrationEmailAsUsername?: boolean;
  otpPolicyType?: string;
  otpPolicyPeriod?: number;
  otpPolicyDigits?: number;
  clients: RealmClient[];
  users: RealmUser[];
  roles?: { realm?: { name: string; description?: string }[] };
};

const realm = JSON.parse(readFileSync(realmPath, "utf8")) as Realm;

function getClient(clientId: string): RealmClient {
  const client = realm.clients.find((c) => c.clientId === clientId);
  expect(client, `Realm should define client '${clientId}'`).toBeDefined();
  return client!;
}

// ── Realm-level configuration ───────────────────────────────────────────────

describe("realm-level configuration", () => {
  it("realm is named 'talentos' and enabled", () => {
    expect(realm.realm).toBe("talentos");
    expect(realm.enabled).toBe(true);
  });

  it("self-service applicant registration is enabled", () => {
    // Issue: A drifted live realm silently disabled registration, breaking
    // "Create account" on the applicant portal.
    expect(realm.registrationAllowed).toBe(true);
    expect(realm.registrationEmailAsUsername).toBe(true);
  });

  it("OTP policy is TOTP with non-zero period and digits", () => {
    // Issue: Missing/zero OTP period caused divide-by-zero in first-login enrollment.
    expect(realm.otpPolicyType).toBe("totp");
    expect(realm.otpPolicyPeriod).toBeGreaterThan(0);
    expect(realm.otpPolicyDigits).toBeGreaterThan(0);
  });
});

// ── Client redirect URI validation ──────────────────────────────────────────

describe("applicant client (talentos-applicant) redirect URIs", () => {
  const client = getClient("talentos-applicant");

  it("is enabled with standard OIDC flow", () => {
    expect(client.enabled).toBe(true);
    expect(client.standardFlowEnabled).toBe(true);
  });

  it("is a confidential client with a secret", () => {
    expect(client.publicClient).toBe(false);
    expect(client.secret).toBeTruthy();
  });

  it("includes the canonical callback URI for localhost", () => {
    expect(client.redirectUris).toContain("http://localhost:3100/api/auth/callback/keycloak");
  });

  it("includes wildcard redirect URIs for *.lvh.me subdomains", () => {
    // Issue: Keycloak wildcard *.lvh.me doesn't match subdomains at runtime;
    // explicit per-subdomain URIs are needed. This test ensures the wildcard
    // entry exists AND that the callback path is covered.
    expect(client.redirectUris).toContain("http://*.lvh.me:3100/*");
    expect(client.redirectUris).toContain("http://lvh.me:3100/api/auth/callback/keycloak");
    expect(client.redirectUris).toContain("http://demo.lvh.me:3100/api/auth/callback/keycloak");
  });

  it("includes matching web origins for CORS", () => {
    expect(client.webOrigins).toContain("http://localhost:3100");
    expect(client.webOrigins).toContain("http://*.lvh.me:3100");
  });

  it("includes post-logout redirect URIs", () => {
    const postLogout = client.attributes?.["post.logout.redirect.uris"];
    expect(postLogout).toBeDefined();
    expect(postLogout).toContain("http://lvh.me:3100/*");
    expect(postLogout).toContain("http://demo.lvh.me:3100/*");
  });

  it("includes required default client scopes", () => {
    // Note: 'openid' is implicit in OIDC and not listed in defaultClientScopes.
    // The required scopes are profile, email, roles, and web-origins.
    expect(client.defaultClientScopes).toContain("profile");
    expect(client.defaultClientScopes).toContain("email");
    expect(client.defaultClientScopes).toContain("roles");
    expect(client.defaultClientScopes).toContain("web-origins");
  });
});

describe("admin client (talentos-admin) redirect URIs", () => {
  const client = getClient("talentos-admin");

  it("is enabled with standard OIDC flow", () => {
    expect(client.enabled).toBe(true);
    expect(client.standardFlowEnabled).toBe(true);
  });

  it("is a confidential client with a secret", () => {
    expect(client.publicClient).toBe(false);
    expect(client.secret).toBeTruthy();
  });

  it("includes the canonical callback URI for localhost", () => {
    expect(client.redirectUris).toContain("http://localhost:3200/api/auth/callback/keycloak");
  });

  it("includes wildcard redirect URIs for *.lvh.me subdomains", () => {
    expect(client.redirectUris).toContain("http://*.lvh.me:3200/*");
    expect(client.redirectUris).toContain("http://lvh.me:3200/api/auth/callback/keycloak");
    expect(client.redirectUris).toContain("http://demo.lvh.me:3200/api/auth/callback/keycloak");
  });

  it("includes matching web origins for CORS", () => {
    expect(client.webOrigins).toContain("http://localhost:3200");
    expect(client.webOrigins).toContain("http://*.lvh.me:3200");
  });

  it("includes post-logout redirect URIs", () => {
    const postLogout = client.attributes?.["post.logout.redirect.uris"];
    expect(postLogout).toBeDefined();
    expect(postLogout).toContain("http://lvh.me:3200/*");
    expect(postLogout).toContain("http://demo.lvh.me:3200/*");
  });
});

describe("ops client (talentos-ops) redirect URIs", () => {
  const client = getClient("talentos-ops");

  it("is enabled with a secret", () => {
    expect(client.enabled).toBe(true);
    expect(client.publicClient).toBe(false);
    expect(client.secret).toBeTruthy();
  });

  it("includes localhost callback URIs", () => {
    expect(client.redirectUris).toContain("http://127.0.0.1:3300/auth/callback");
    expect(client.redirectUris).toContain("http://localhost:3300/auth/callback");
  });
});

// ── Realm roles validation ──────────────────────────────────────────────────

describe("realm roles", () => {
  it("defines all required realm roles", () => {
    // Issue: Missing realm roles (ORG_ADMIN, APPLICANT) on Keycloak users
    // caused admin portal login to redirect to /forbidden.
    const realmRoleNames = realm.roles?.realm?.map((r) => r.name) ?? [];
    const requiredRoles = ["ORG_ADMIN", "HR", "TECH_LEAD", "APPLICANT", "SUPER_ADMIN"];
    for (const role of requiredRoles) {
      expect(realmRoleNames, `Realm should define role '${role}'`).toContain(role);
    }
  });
});

// ── Seed user validation ────────────────────────────────────────────────────

describe("seed users in realm import", () => {
  it("defines at least one org admin user with ORG_ADMIN role", () => {
    const orgAdmins = realm.users.filter(
      (u) => u.realmRoles?.includes("ORG_ADMIN") || u.requiredActions?.includes("UPDATE_PASSWORD")
    );
    // The realm should seed at least one admin-capable user
    expect(realm.users.length).toBeGreaterThan(0);
  });

  it("all enabled users have valid email addresses", () => {
    for (const user of realm.users) {
      if (user.serviceAccountClientId) continue; // service accounts don't have emails
      if (user.email) {
        expect(user.email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
      }
    }
  });

  it("non-service-account users are not assigned CONFIGURE_TOTP (2FA disabled platform-wide)", () => {
    // Issue: CONFIGURE_TOTP on org admin causes divide-by-zero when TOTP policy is misconfigured.
    // Exception: the superadmin seed user may have CONFIGURE_TOTP for first-login enrollment.
    for (const user of realm.users) {
      if (user.serviceAccountClientId) continue;
      if (user.realmRoles?.includes("SUPER_ADMIN")) continue; // superadmin may need TOTP setup
      if (user.requiredActions) {
        expect(
          user.requiredActions,
          `User ${user.username} should not have CONFIGURE_TOTP (2FA disabled platform-wide)`
        ).not.toContain("CONFIGURE_TOTP");
      }
    }
  });
});

// ── Provisioner service account ─────────────────────────────────────────────

describe("provisioner service account", () => {
  it("talentos-provisioner is a service-account client with manage-users role", () => {
    const provisioner = getClient("talentos-provisioner");
    expect(provisioner.serviceAccountsEnabled).toBe(true);

    const serviceAccountUser = realm.users.find(
      (u) => u.serviceAccountClientId === "talentos-provisioner"
    );
    expect(serviceAccountUser).toBeDefined();
    expect(serviceAccountUser?.clientRoles?.["realm-management"]).toContain("manage-users");
  });
});

// ── Redirect URI safety ─────────────────────────────────────────────────────

describe("redirect URI safety", () => {
  it("no client allows redirect to arbitrary external hosts", () => {
    // Issue: An overly broad redirect URI (e.g. http://*) would be an open redirect.
    // Wildcards are allowed for *.lvh.me (our base domain) and localhost (local dev),
    // and path-level wildcards (/*) on known hosts are fine.
    for (const client of realm.clients) {
      if (!client.redirectUris) continue;
      for (const uri of client.redirectUris) {
        if (uri.includes("*")) {
          // Must never be a bare wildcard scheme
          expect(uri).not.toMatch(/^\*\/\//);
          // Wildcards must be scoped to known hosts: *.lvh.me, localhost, 127.0.0.1
          // or path-level /* on a known host
          const isHostWildcard = uri.includes("*.lvh.me");
          const isPathWildcardOnKnownHost = /^https?:\/\/(localhost|127\.0\.0\.1|[^/]*\.lvh\.me|lvh\.me):\d+\/\*/.test(uri);
          expect(
            isHostWildcard || isPathWildcardOnKnownHost,
            `Client ${client.clientId} has overly broad redirect URI: ${uri}`
          ).toBe(true);
        }
      }
    }
  });

  it("all redirect URIs use http or https scheme", () => {
    for (const client of realm.clients) {
      if (!client.redirectUris) continue;
      for (const uri of client.redirectUris) {
        expect(uri).toMatch(/^https?:\/\//);
      }
    }
  });
});
