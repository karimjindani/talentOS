/**
 * API Route: /api/graduates/request-access
 * Create a SINGLE recruiter access request (PENDING — admin must approve)
 * One form submission = one request, regardless of how many public graduates exist.
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

    // Get the first public graduate profile to attach the request to.
    // The schema requires a graduateId on each RecruiterAccessRequest, so we
    // create a SINGLE request rather than one per graduate. When the admin
    // approves this request, the recruiter receives a token that grants
    // access to the full directory.
    const firstPublicGraduate = await prisma.graduateProfile.findFirst({
      where: { publicProfileEnabled: true },
      select: { id: true },
    });

    if (!firstPublicGraduate) {
      return NextResponse.json(
        { error: "No public graduate profiles are currently available." },
        { status: 404 }
      );
    }

    const token = generateSecureToken();
    const expiresAt = calculateTokenExpiry(7);

    await createRecruiterAccessRequest(
      firstPublicGraduate.id,
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
    );

    return NextResponse.json({
      success: true,
      message: "Your access request has been submitted successfully. It is currently under review by our admin team. Once approved, you will receive an email containing a secure access link to view all public graduate profiles.",
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
