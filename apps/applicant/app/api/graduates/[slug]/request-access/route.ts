/**
 * API Route: /api/graduates/[slug]/request-access
 * Create recruiter access request (PENDING — admin must approve before email/token are sent)
 */

import { NextRequest, NextResponse } from "next/server";
import { createRecruiterAccessRequest, prisma } from "@talentos/db";
import { generateSecureToken, calculateTokenExpiry } from "@talentos/db";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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

    // Get graduate profile
    const graduate = await prisma.graduateProfile.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!graduate || !graduate.publicProfileEnabled) {
      return NextResponse.json(
        { error: "Profile not found or not public" },
        { status: 404 }
      );
    }

    // Generate secure token (stored hashed; will be regenerated on admin approval)
    const token = generateSecureToken();
    const expiresAt = calculateTokenExpiry(7); // Valid for 7 days after approval

    // Create access request as PENDING — no email sent yet
    const accessRequest = await createRecruiterAccessRequest(
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
    );

    // Do NOT send email here — admin must approve first.
    // The email with the secure link is sent when the admin approves the request.

    return NextResponse.json({
      success: true,
      message: "Your access request has been submitted successfully. It is currently under review by our admin team. Once approved, you will receive an email containing a secure access link.",
      accessRequestId: accessRequest.id,
      status: "PENDING",
    });
  } catch (error) {
    console.error("Error in POST /api/graduates/[slug]/request-access:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
