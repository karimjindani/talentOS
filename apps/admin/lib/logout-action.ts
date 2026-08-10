"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { buildTenantLogoutUrl } from "@talentos/auth-web";

/**
 * RP-initiated Keycloak logout for the admin portal (v0.14.3 / D-066). Clears the app session
 * cookie and then terminates the Keycloak SSO session (v0.10.2). Keycloak can only validate the
 * canonical AUTH_URL origin as a post-logout redirect (hostname wildcards are unsupported), so the
 * admin returns via the canonical `/logged-out` route which bounces them back to the tenant
 * subdomain they were on (D-060).
 */
export async function logoutAction(): Promise<void> {
  const activeSession = await auth();
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3200";
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  // AUTH_URL is the NextAuth v5 canonical origin; NEXTAUTH_URL is the v4 alias that NextAuth v5
  // also reads. Use either before falling back to the request host — the request host is a tenant
  // subdomain (e.g. paysyslabs.lvh.me) which Keycloak cannot validate as a post-logout redirect.
  const canonicalAuthUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? `http://${host}`;
  const logoutUrl = buildTenantLogoutUrl({
    issuer: process.env.KEYCLOAK_ISSUER ?? "http://keycloak.lvh.me:8080/realms/talentos",
    idToken: activeSession?.idToken,
    clientId: process.env.KEYCLOAK_CLIENT_ID ?? "talentos-admin",
    authUrl: canonicalAuthUrl,
    requestOrigin: `${proto}://${host}`
  });
  await signOut({ redirect: false });
  redirect(logoutUrl);
}
