import { NextResponse, type NextRequest } from "next/server";
import { resolveTenantRedirect } from "@talentos/auth-web";

/**
 * Post-logout landing on the canonical AUTH_URL host (v0.14.3, D-066). Keycloak redirects here after
 * RP-initiated logout, echoing the tenant origin the admin logged out from in `state`. We bounce them
 * back to that tenant through `resolveTenantRedirect`, which only allows the canonical origin and
 * subdomains of APP_BASE_DOMAIN — anything else collapses to the canonical host (no open redirect).
 */
export function GET(request: NextRequest): NextResponse {
  const state = request.nextUrl.searchParams.get("state");
  const baseUrl = new URL(process.env.AUTH_URL ?? "http://lvh.me:3200").origin;
  const target = resolveTenantRedirect(state ?? baseUrl, baseUrl, process.env.APP_BASE_DOMAIN);
  return NextResponse.redirect(target);
}
