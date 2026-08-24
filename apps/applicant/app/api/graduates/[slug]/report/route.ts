import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@talentos/ui";
import { getFullProfileForRecruiter, getRecruiterSession, getTenantBySlug } from "@talentos/db";
import { buildCandidateReport } from "@/lib/candidate-report";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getRecruiterSession(request.cookies.get("talentos_recruiter_session")?.value);
  if (!session) return NextResponse.json({ error: "Recruiter sign-in required." }, { status: 401 });
  const { slug } = await params;
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  const profile = await getFullProfileForRecruiter(slug, session.recruiterId, tenant.id);
  if (!profile) return NextResponse.json({ error: "Portfolio access is required." }, { status: 403 });
  const report = buildCandidateReport(profile);
  return new NextResponse(new Uint8Array(report), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${slug}-candidate-report.pdf"`, "Cache-Control": "private, no-store" } });
}
