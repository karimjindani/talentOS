/**
 * API Route: /api/graduates/request-access
 * Create recruiter access request for ALL public graduate profiles (PENDING — admin must approve)
 * This replaces the per-graduate request-access endpoint so recruiters only fill the form once.
 */

import { NextRequest, NextResponse } from "next/server";
import { createRecruiterAccessRequest, prisma } from "@talentos/db";
import { generateSecureToken, calculateTokenExpiry } from "@talentos/db";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      recruiterName,
      recruiterOrganization,
      recruiterDesignation,
      recruiterEmail,
      recruiterPhone,
      hiringRequirement,
    } = body;
    const identity = `${requestIp(request)}:${String(recruiterEmail || "").trim().toLowerCase()}`;
    const rateLimit = checkRateLimit(`access-request:${identity}`, { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!rateLimit.allowed) return NextResponse.json({ error: "Too many access requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });

    // Validate required fields
    if (!recruiterName || !recruiterEmail || !recruiterOrganization || !recruiterDesignation) {
      return NextResponse.json(
        { error: "Name, organization, designation, and email are required." },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recruiterEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Get all public graduate profiles
    const publicGraduates = await prisma.graduateProfile.findMany({
      where: { publicProfileEnabled: true },
      select: { id: true },
    });

    if (publicGraduates.length === 0) {
      return NextResponse.json(
        { error: "No public graduate profiles are currently available." },
        { status: 404 }
      );
    }

    // Create an access request for each public graduate
    const results = await Promise.all(
      publicGraduates.map((graduate) => {
        const token = generateSecureToken();
        const expiresAt = calculateTokenExpiry(7);
        return createRecruiterAccessRequest(
          graduate.id,
          {
            recruiterName: String(recruiterName).trim().slice(0, 200),
            recruiterOrganization: String(recruiterOrganization).trim().slice(0, 200),
            recruiterDesignation: String(recruiterDesignation).trim().slice(0, 200),
            recruiterEmail: String(recruiterEmail).trim().toLowerCase(),
            recruiterPhone: recruiterPhone ? String(recruiterPhone).trim().slice(0, 50) : undefined,
            hiringRequirement: hiringRequirement ? String(hiringRequirement).trim().slice(0, 2000) : undefined,
          },
          token,
          expiresAt
        ).catch(() => null); // Skip duplicates (same recruiter+graduate pair)
      })
    );

    const createdCount = results.filter(Boolean).length;

    return NextResponse.json({
      success: true,
      message: `Your access request has been submitted successfully for ${createdCount} graduate profile${createdCount !== 1 ? "s" : ""}. It is currently under review by our admin team. Once approved, you will receive an email containing a secure access link.`,
      requestCount: createdCount,
      status: "PENDING",
    });
  } catch (error) {
    console.error("Error in POST /api/graduates/request-access:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
