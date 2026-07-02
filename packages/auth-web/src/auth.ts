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
import "./types";

export type TalentosAuthOptions = {
  clientId: string;
  clientSecret: string;
  issuer: string;
};

/**
 * Build a NextAuth v5 instance wired to Keycloak (OIDC). JWT sessions, with realm
 * roles decoded from the Keycloak access token into org + platform roles. DB-free so
 * the same config is edge-safe when reused in middleware.
 */
export function createTalentosAuth(options: TalentosAuthOptions): NextAuthResult {
  return NextAuth({
    trustHost: true,
    session: { strategy: "jwt" },
    providers: [
      Keycloak({
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        issuer: options.issuer
      })
    ],
    callbacks: {
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
