import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import { getStoredFile, getTenantBySlug } from "@talentos/db";
import { getPresignedDownloadUrl } from "@talentos/storage";

type RouteContext = { params: Promise<{ id: string }> };

// Applicant-facing download for learning-resource documents only. Unlike the admin route (which
// gates reviewer-grade CVs), this presigns any file in the applicant's tenant that was uploaded as a
// learning resource — so applicants can download task documents, but not other tenant files.
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
  const file = await getStoredFile(id, tenant.id);
  if (!file || file.category !== "learning-resource") {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const url = await getPresignedDownloadUrl({ key: file.storageKey });
  return NextResponse.redirect(url, 302);
}
