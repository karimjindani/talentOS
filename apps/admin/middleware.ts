import { NextResponse } from "next/server";
import { resolveTenantFromHost } from "@talentos/auth/tenant";
import { canEnterAdminPortal } from "@talentos/auth-web";
import { auth } from "@/auth";

// Every admin route requires an authenticated session with an admin-capable role
// (platform SUPER_ADMIN, or org ORG_ADMIN / HR / TECH_LEAD). APPLICANT is denied.
export default auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const tenant = resolveTenantFromHost(req.headers.get("host"));

  const isAuthRoute = pathname.startsWith("/api/auth");
  const isForbidden = pathname === "/forbidden";
  // Keycloak's post-logout redirect lands here without a session by definition (v0.14.3, D-066).
  const isLoggedOut = pathname === "/logged-out";

  if (!isAuthRoute && !isForbidden && !isLoggedOut) {
    // Build redirect URLs from the *request host* (not nextUrl.origin, which resolves to the
    // canonical AUTH_URL host inside Docker) so pages load on the same tenant subdomain the user
    // is browsing. This avoids cross-origin RSC fetch failures (v0.19.6, BUG-1).
    const origin = requestOrigin(
      req.headers.get("host"),
      req.headers.get("x-forwarded-proto"),
      nextUrl
    );
    if (!req.auth) {
      const signInUrl = new URL("/api/auth/signin", origin);
      const callbackUrl = tenantCallbackUrl(req.headers.get("host"), nextUrl);
      // Absolute callback (host + path), not just the path: login runs through the canonical
      // AUTH_URL host, so the post-login redirect must carry the tenant subdomain to return the
      // user to their own tenant. The auth `redirect` callback allows only base-domain hosts (D-060).
      signInUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(signInUrl);
    }
    const user = req.auth.user;
    if (!canEnterAdminPortal(user.platformRole, user.orgRole)) {
      return NextResponse.redirect(new URL("/forbidden", origin));
    }
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
 * Inside Docker, nextUrl.origin can resolve to the canonical AUTH_URL host (e.g. lvh.me:3200)
 * instead of the actual tenant subdomain (e.g. paysyslabs.lvh.me:3200), causing cross-origin
 * RSC fetch failures. Using the Host header preserves the tenant subdomain (v0.19.6, BUG-1).
 */
function requestOrigin(host: string | null, proto: string | null, nextUrl?: URL): string {
  if (host) {
    return `${proto ?? "http"}://${host}`;
  }
  return nextUrl?.origin ?? "http://localhost:3200";
}
