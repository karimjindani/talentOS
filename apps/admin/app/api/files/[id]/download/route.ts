import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import { getStoredFile, getTenantBySlug } from "@talentos/db";
import { getPresignedDownloadUrl } from "@talentos/storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ error: `Unknown tenant "${tenantSlug}".` }, { status: 400 });
  }

  const { id } = await params;
  // Tenant-scoped lookup: a file from another tenant resolves to null → 404.
  const file = await getStoredFile(id, tenant.id);
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const url = await getPresignedDownloadUrl({ key: file.storageKey });
  return NextResponse.redirect(url, 302);
}
