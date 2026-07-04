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
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set("x-talentos-tenant", tenant.tenantSlug);
  return response;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
