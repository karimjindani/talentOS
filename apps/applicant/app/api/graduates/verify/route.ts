/**
 * API Route: /api/graduates/verify
 * Verify access token and log profile view
 */

import { NextRequest, NextResponse } from "next/server";
import { consumeRecruiterAccessToken } from "@talentos/db";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`recruiter-verify:${requestIp(request)}`, { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!rateLimit.allowed) return NextResponse.json({ error: "Too many verification attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Verify token
    const result = await consumeRecruiterAccessToken(token);

    if (!result) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      valid: true,
      graduateId: result.request.graduateId,
      slug: result.request.graduate.slug,
      expiresAt: result.request.expiresAt,
    });
    response.cookies.set("talentos_recruiter_session", result.sessionToken, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 24 * 60 * 60
    });
    return response;
  } catch (error) {
    console.error("Error in POST /api/graduates/verify:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
