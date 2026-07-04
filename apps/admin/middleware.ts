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

  if (!isAuthRoute && !isForbidden) {
    if (!req.auth) {
      const signInUrl = new URL("/api/auth/signin", nextUrl.origin);
      // Absolute callback (host + path), not just the path: login runs through the canonical
      // AUTH_URL host, so the post-login redirect must carry the tenant subdomain to return the
      // user to their own tenant. The auth `redirect` callback allows only base-domain hosts (D-060).
      signInUrl.searchParams.set("callbackUrl", nextUrl.href);
      return NextResponse.redirect(signInUrl);
    }
    const user = req.auth.user;
    if (!canEnterAdminPortal(user.platformRole, user.orgRole)) {
      return NextResponse.redirect(new URL("/forbidden", nextUrl.origin));
    }
  }

  const response = NextResponse.next();
  response.headers.set("x-talentos-tenant", tenant.tenantSlug);
  return response;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
