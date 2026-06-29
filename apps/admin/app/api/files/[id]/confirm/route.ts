import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import { getStoredFile, getTenantBySlug, markStoredFileReady } from "@talentos/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
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
  const existing = await getStoredFile(id, tenant.id);
  if (!existing) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const file = await markStoredFileReady(id, tenant.id);
  return NextResponse.json({ fileId: file?.id, status: file?.status });
}
