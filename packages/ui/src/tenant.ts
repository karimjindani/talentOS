import { headers } from "next/headers";
import { resolveTenantFromHost } from "@talentos/auth/tenant";

export async function getTenantContext() {
  const headerList = await headers();
  // Prefer x-forwarded-host (the original browser host) over the direct Host header.
  // In Next.js dev server, server-action redirect RSC flight requests can carry the
  // internal Host (e.g. localhost:3100) instead of the tenant subdomain, which would
  // resolve to the wrong tenant. The x-forwarded-host preserves the real tenant host.
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  return resolveTenantFromHost(host);
}
