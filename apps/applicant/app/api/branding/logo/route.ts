import { NextResponse } from "next/server";
import { getTenantContext } from "@talentos/ui";
import { getTenantBySlug, getStoredFile } from "@talentos/db";
import { getPresignedDownloadUrl } from "@talentos/storage";

export async function GET() {
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant?.logoFileId) {
    return new NextResponse(null, { status: 404 });
  }
  // IDOR-safe: scoped to the host-resolved tenant's own file only
  const file = await getStoredFile(tenant.logoFileId, tenant.id);
  if (!file) {
    return new NextResponse(null, { status: 404 });
  }
  const url = await getPresignedDownloadUrl({ key: file.storageKey });
  return NextResponse.redirect(url, 302);
}
