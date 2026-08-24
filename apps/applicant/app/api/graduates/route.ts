/**
 * API Route: /api/graduates
 * Get list of public graduate profiles
 * No authentication required
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@talentos/ui";
import { getPublicProfiles, getTenantBySlug } from "@talentos/db";

export async function GET(request: NextRequest) {
  try {
    const { tenantSlug } = await getTenantContext();
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sort = (searchParams.get("sort") || "rating") as "rating" | "date" | "name";
    const search = searchParams.get("search") || undefined;
    const country = searchParams.get("country") || undefined;
    const programId = searchParams.get("programId") || undefined;
    const monthFrom = searchParams.get("monthFrom")
      ? new Date(searchParams.get("monthFrom")!)
      : undefined;
    const monthTo = searchParams.get("monthTo")
      ? new Date(searchParams.get("monthTo")!)
      : undefined;

    // Validate pagination params
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Invalid pagination parameters" },
        { status: 400 }
      );
    }

    // Fetch profiles
    const result = await getPublicProfiles(tenant.id, {
      page,
      limit,
      sort,
      search,
      country,
      monthFrom,
      monthTo,
      programId,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in GET /api/graduates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
