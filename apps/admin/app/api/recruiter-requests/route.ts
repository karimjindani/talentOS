/**
 * Admin API: GET /api/recruiter-requests
 * List all recruiter access requests with optional status filter and pagination.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPendingAccessRequests, getAccessRequestStats } from "@talentos/db";
import { resolveTenantAccess } from "@/lib/tenant-guard";

export async function GET(request: NextRequest) {
  const access = await resolveTenantAccess();
  if (!access.ok) {
    if (access.reason === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;
  const status = searchParams.get("status") as "PENDING" | "APPROVED" | "REJECTED" | "REVOKED" | "EXPIRED" | null;

  const [result, stats] = await Promise.all([
    getPendingAccessRequests({ page, limit, status: status ?? undefined }),
    getAccessRequestStats()
  ]);

  return NextResponse.json({ ...result, stats });
}
