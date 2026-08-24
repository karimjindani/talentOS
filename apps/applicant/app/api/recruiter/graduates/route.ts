/**
 * API Route: /api/recruiter/graduates
 * Returns all public, consented graduate profiles for a verified recruiter.
 * Used by the left sidebar in the recruiter full-access workspace.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@talentos/ui";
import { getAllAccessibleGraduates, getRecruiterSession, getTenantBySlug } from "@talentos/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getRecruiterSession(request.cookies.get("talentos_recruiter_session")?.value);
    if (!session) {
      return NextResponse.json(
        { error: "Please verify your recruiter email to continue." },
        { status: 401 }
      );
    }

    const { tenantSlug } = await getTenantContext();
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const result = await getAllAccessibleGraduates(session.recruiterId, tenant.id);
    if (!result) {
      return NextResponse.json(
        { error: "Your access has expired or been revoked." },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Error in GET /api/recruiter/graduates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
