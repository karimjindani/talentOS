import { NextResponse } from "next/server";
import { resolveTenantFromHost } from "@talentos/auth/tenant";
import { auth } from "@/auth";

// Applicant-only routes that require an authenticated session. The landing page stays
// public; applying and the applicant's own application area require a Keycloak sign-in.
const PROTECTED_PREFIXES = ["/apply", "/application", "/dashboard"];

export default auth((req) => {
  const { nextUrl } = req;
  const tenant = resolveTenantFromHost(req.headers.get("host"));

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => nextUrl.pathname === prefix || nextUrl.pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !req.auth) {
    // Build the login URL from the *request host* (not nextUrl.origin, which resolves to the
    // canonical AUTH_URL host inside Docker) so the login page loads on the same tenant subdomain
    // the user is browsing. This avoids cross-origin RSC fetch failures when the browser is on
    // paysyslabs.lvh.me but the redirect sends it to lvh.me (v0.19.6, BUG-1).
    const loginUrl = new URL(
      "/login",
      requestOrigin(req.headers.get("host"), req.headers.get("x-forwarded-proto"), nextUrl)
    );
    const callbackUrl = tenantCallbackUrl(req.headers.get("host"), nextUrl);
    // Absolute callback (host + path): login runs through the canonical AUTH_URL host, so the
    // post-login redirect must carry the tenant subdomain to return the applicant to their tenant.
    // The auth `redirect` callback allows only base-domain hosts (v0.12.1, D-060).
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set("x-talentos-tenant", tenant.tenantSlug);
  return response;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

function tenantCallbackUrl(host: string | null, nextUrl: URL) {
  const requestHost = host ?? nextUrl.host;
  return `${nextUrl.protocol}//${requestHost}${nextUrl.pathname}${nextUrl.search}`;
}

/**
 * Resolve the request origin from the Host header, falling back to nextUrl.origin.
 * Inside Docker, nextUrl.origin can resolve to the canonical AUTH_URL host (e.g. lvh.me:3100)
 * instead of the actual tenant subdomain (e.g. paysyslabs.lvh.me:3100), causing cross-origin
 * RSC fetch failures. Using the Host header preserves the tenant subdomain (v0.19.6, BUG-1).
 */
function requestOrigin(host: string | null, proto: string | null, nextUrl?: URL): string {
  if (host) {
    return `${proto ?? "http"}://${host}`;
  }
  return nextUrl?.origin ?? "http://localhost:3100";
}
