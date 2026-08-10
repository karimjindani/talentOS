/**
 * API Route: /api/graduates/[slug]/request-access
 * Create recruiter access request and send verification email
 */

import { NextRequest, NextResponse } from "next/server";
import { createRecruiterAccessRequest, prisma } from "@talentos/db";
import {
  generateSecureToken,
  calculateTokenExpiry,
  generateVerificationUrl,
} from "@talentos/db";
import { sendVerificationEmail } from "@/lib/email-service";
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

    // Generate secure token
    const token = generateSecureToken();
    const expiresAt = calculateTokenExpiry(7); // Valid for 7 days

    // Create access request in database
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

    // Generate verification URL
    const baseUrl = process.env.PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3100";
    const verificationUrl = generateVerificationUrl(baseUrl, token);

    // Send verification email
    try {
      await sendVerificationEmail({
        to: String(recruiterEmail).trim().toLowerCase(),
        recruiterName: String(recruiterName).trim(),
        graduateName: graduate.user?.name || "a Graduate",
        verificationUrl,
        expiresAt,
      });
    } catch (emailError) {
      console.error("Error sending verification email:", emailError);
      await prisma.recruiterAccessRequest.delete({ where: { id: accessRequest.id } });
      return NextResponse.json(
        { error: "We could not send the verification email. Please try again later." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification email sent to " + recruiterEmail,
      expiresAt,
      accessRequestId: accessRequest.id,
    });
  } catch (error) {
    console.error("Error in POST /api/graduates/[slug]/request-access:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
