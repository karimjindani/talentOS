import { NextResponse, type NextRequest } from "next/server";
import { resolveTenantFromHost } from "@talentos/auth/tenant";

export function middleware(request: NextRequest) {
  const tenant = resolveTenantFromHost(request.headers.get("host"));
  const response = NextResponse.next();
  response.headers.set("x-talentos-tenant", tenant.tenantSlug);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
