import NextAuth, { type NextAuthResult, type Session } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import {
  canEnterAdminPortal,
  extractRealmRoles,
  extractSuperAdmin,
  mapKeycloakRolesToTenantRoles,
  primaryOrgRole
} from "./roles";
import type { AppToken } from "./types";
import { resolveTenantRedirect } from "./tenant-redirect";
import "./types";

export type TalentosAuthOptions = {
  clientId: string;
  clientSecret: string;
  issuer: string;
};

/**
 * Multi-tenant cookie + redirect config (v0.12.1, D-060).
 *
 * Tenants are addressed by subdomain (e.g. `sbp.<base>`), but next-auth (beta.25) derives the OIDC
 * redirect_uri from a *pinned* AUTH_URL — it cannot mint a per-subdomain callback. So login always
 * runs through one canonical AUTH_URL host, and we scope the auth cookies to the parent base domain
 * (`.<base>`) so the session set during that callback is readable on every tenant subdomain. A user
 * signs in once on the canonical host and is redirected back to their tenant subdomain, where the
 * shared cookie satisfies the tenant guard. `APP_BASE_DOMAIN` drives both pieces; when it is unset or
 * `localhost` (single-label — browsers reject a Domain attribute on it) we fall back to next-auth's
 * host-only cookie defaults so nothing changes for a single-host deployment.
 */
function baseDomainCookieConfig() {
  const baseDomain = process.env.APP_BASE_DOMAIN;
  if (!baseDomain || baseDomain === "localhost") return undefined;

  const secure = (process.env.AUTH_URL ?? "").startsWith("https://");
  // __Host- forbids a Domain attribute (so cannot be shared cross-subdomain); __Secure- is fine.
  const prefix = secure ? "__Secure-" : "";
  const shared = { domain: `.${baseDomain}`, path: "/", sameSite: "lax" as const, secure };

  return {
    sessionToken: { name: `${prefix}authjs.session-token`, options: { ...shared, httpOnly: true } },
    callbackUrl: { name: `${prefix}authjs.callback-url`, options: { ...shared } },
    csrfToken: { name: `${prefix}authjs.csrf-token`, options: { ...shared, httpOnly: true } },
    pkceCodeVerifier: { name: `${prefix}authjs.pkce.code_verifier`, options: { ...shared, httpOnly: true, maxAge: 900 } },
    state: { name: `${prefix}authjs.state`, options: { ...shared, httpOnly: true, maxAge: 900 } },
    nonce: { name: `${prefix}authjs.nonce`, options: { ...shared, httpOnly: true } }
  };
}

/**
 * Build a NextAuth v5 instance wired to Keycloak (OIDC). JWT sessions, with realm
 * roles decoded from the Keycloak access token into org + platform roles. DB-free so
 * the same config is edge-safe when reused in middleware.
 */
export function createTalentosAuth(options: TalentosAuthOptions): NextAuthResult {
  const cookies = baseDomainCookieConfig();
  const baseDomain = process.env.APP_BASE_DOMAIN;

  return NextAuth({
    trustHost: true,
    session: { strategy: "jwt" },
    ...(cookies ? { cookies } : {}),
    providers: [
      Keycloak({
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        issuer: options.issuer
      })
    ],
    callbacks: {
      // Post-login/logout landing guard. Default next-auth only allows the AUTH_URL origin and
      // relative paths, which would trap a tenant user on the canonical auth host. We additionally
      // allow any subdomain of APP_BASE_DOMAIN so a user returns to their own tenant — but nothing
      // outside it, so this is not an open redirect (v0.12.1, D-060).
      redirect({ url, baseUrl }) {
        return resolveTenantRedirect(url, baseUrl, baseDomain);
      },
      jwt({ token, account, profile }) {
        if (account?.access_token) {
          const appToken = token as AppToken;
          const realmRoles = extractRealmRoles(account.access_token);
          const orgRoles = mapKeycloakRolesToTenantRoles(realmRoles);
          appToken.roles = orgRoles;
          appToken.orgRole = primaryOrgRole(orgRoles);
          appToken.platformRole = extractSuperAdmin(realmRoles);
          appToken.keycloakSubjectId = (profile?.sub as string | undefined) ?? appToken.sub;
          // Expose the Keycloak email_verified claim (edge-safe, read-only). Not enforced yet.
          const emailVerified = (profile as { email_verified?: boolean } | undefined)?.email_verified;
          appToken.emailVerified = typeof emailVerified === "boolean" ? emailVerified : null;
          // Keep the id_token for RP-initiated logout (id_token_hint).
          if (account.id_token) {
            appToken.idToken = account.id_token;
          }
        }
        return token;
      },
      session({ session, token }) {
        const appToken = token as AppToken;
        session.user.roles = appToken.roles ?? [];
        session.user.orgRole = appToken.orgRole ?? null;
        session.user.platformRole = appToken.platformRole ?? null;
        session.user.isSuperAdmin = appToken.platformRole === "SUPER_ADMIN";
        session.user.keycloakSubjectId = appToken.keycloakSubjectId ?? null;
        session.user.isEmailVerified = appToken.emailVerified ?? null;
        session.idToken = appToken.idToken ?? null;
        return session;
      }
    }
  });
}

/** Admin-portal guard for a resolved session (super admin or an admin-capable org role). */
export function sessionCanEnterAdminPortal(session: Session | null | undefined): boolean {
  if (!session?.user) return false;
  return canEnterAdminPortal(session.user.platformRole, session.user.orgRole);
}
