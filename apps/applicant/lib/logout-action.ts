"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { buildTenantLogoutUrl } from "@talentos/auth-web";

/**
 * RP-initiated Keycloak logout shared by every applicant-portal surface (PortalHeader, the
 * accepted-applicant dashboard shell and the access-denied page, v0.14.3 / D-066). Clears the app
 * session cookie and then terminates the Keycloak SSO session so a refresh cannot silently
 * re-authenticate (v0.10.2). Keycloak can only validate the canonical AUTH_URL origin as a
 * post-logout redirect (hostname wildcards are unsupported), so the user returns via the canonical
 * `/logged-out` route which bounces them back to the tenant subdomain they were on (D-060).
 */
export async function logoutAction(): Promise<void> {
  const activeSession = await auth();
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3100";
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const logoutUrl = buildTenantLogoutUrl({
    issuer: process.env.KEYCLOAK_ISSUER ?? "http://keycloak.lvh.me:8080/realms/talentos",
    idToken: activeSession?.idToken,
    clientId: process.env.KEYCLOAK_CLIENT_ID ?? "talentos-applicant",
    authUrl: process.env.AUTH_URL ?? `http://${host}`,
    requestOrigin: `${proto}://${host}`
  });
  await signOut({ redirect: false });
  redirect(logoutUrl);
}
