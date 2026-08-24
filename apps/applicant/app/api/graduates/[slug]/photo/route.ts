import { NextResponse } from "next/server";
import { getTenantContext } from "@talentos/ui";
import { getGraduatePhoto, getTenantBySlug } from "@talentos/db";
import { getPresignedDownloadUrl } from "@talentos/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  const photo = await getGraduatePhoto(slug, tenant.id);
  const key = photo?.profilePhotoFile?.storageKey;
  if (!key) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  return NextResponse.redirect(await getPresignedDownloadUrl({ key, expiresIn: 300 }));
}
