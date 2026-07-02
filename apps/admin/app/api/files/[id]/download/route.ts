import { NextResponse } from "next/server";
import { getStoredFile } from "@talentos/db";
import { getPresignedDownloadUrl } from "@talentos/storage";
import { resolveTenantAccess } from "@/lib/tenant-guard";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  // Candidate CVs are reviewer-grade PII. Require the reviewApplications capability *held in the
  // resolved tenant* (TenantMembership-backed) — previously any authenticated session could presign
  // any file of the host-resolved tenant. See lib/tenant-guard.ts (D-051).
  const access = await resolveTenantAccess("reviewApplications");
  if (!access.ok) {
    const status =
      access.reason === "unauthenticated" ? 401 : access.reason === "unknown-tenant" ? 400 : 403;
    return NextResponse.json({ error: access.reason }, { status });
  }

  const { id } = await params;
  // Tenant-scoped lookup: a file from another tenant resolves to null → 404.
  const file = await getStoredFile(id, access.tenant.id);
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const url = await getPresignedDownloadUrl({ key: file.storageKey });
  return NextResponse.redirect(url, 302);
}
