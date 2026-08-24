/**
 * API Route: /api/graduates/[slug]
 * Get public profile information (no auth required)
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@talentos/ui";
import { getPublicProfile, getTenantBySlug } from "@talentos/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: "Slug is required" },
        { status: 400 }
      );
    }

    const { tenantSlug } = await getTenantContext();
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const profile = await getPublicProfile(slug, tenant.id);

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error("Error in GET /api/graduates/[slug]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
