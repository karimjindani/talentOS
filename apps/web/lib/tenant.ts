import { headers } from "next/headers";
import { resolveTenantFromHost } from "@talentos/auth/tenant";

export async function getTenantContext() {
  const headerList = await headers();
  const host = headerList.get("host");
  return resolveTenantFromHost(host);
}
