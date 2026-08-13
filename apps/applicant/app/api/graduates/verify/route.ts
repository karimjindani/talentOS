/**
 * API Route: /api/graduates/verify
 * Verify access token and log profile view
 */

import { NextRequest, NextResponse } from "next/server";
import { consumeRecruiterAccessToken } from "@talentos/db";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`recruiter-verify:${requestIp(request)}`, { limit: 50, windowMs: 15 * 60 * 1000 });
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
        { error: "Invalid or expired token", reason: "INVALID" },
        { status: 401 }
      );
    }

    if ("error" in result) {
      const errorMessages: Record<string, { message: string; status: number }> = {
        EXPIRED: { message: "Your access has expired. The 7-day access period has ended. Please submit a new access request.", status: 401 },
        REVOKED: { message: "Your access has been revoked by the administrator. Please submit a new access request if you need access again.", status: 403 },
        REJECTED: { message: "Your access request was rejected by the administrator.", status: 403 },
        PENDING: { message: "Your access request is still pending admin review. You will receive an email once it is approved.", status: 403 },
        CONSUMED: { message: "This access link has already been used. Please use your recruiter session to access the portfolio.", status: 401 },
        PROFILE_DISABLED: { message: "This graduate has disabled their public profile.", status: 404 },
        INVALID: { message: "Invalid or expired token.", status: 401 },
      };
      const errorCode = result.error as string;
      const info = errorMessages[errorCode] ?? { message: "Invalid or expired token.", status: 401 };
      const responseBody: { error: string; reason: string; rejectionReason?: string | null } = { error: info.message, reason: errorCode };
      if ("rejectionReason" in result && result.rejectionReason) {
        responseBody.rejectionReason = result.rejectionReason;
      }
      return NextResponse.json(responseBody, { status: info.status });
    }

    const response = NextResponse.json({
      success: true,
      valid: true,
      graduateId: result.request.graduateId,
      slug: result.request.graduate.slug,
      expiresAt: result.request.expiresAt,
    });
    // Secure flag is only set when HTTPS is actually in use. In Docker we run
    // NODE_ENV=production but serve plain HTTP on port 3100, so checking NODE_ENV
    // alone would set Secure and the browser would drop the cookie over HTTP.
    const useSecureCookie = process.env.COOKIE_SECURE === "true" ||
      (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false");
    response.cookies.set("talentos_recruiter_session", result.sessionToken, {
      httpOnly: true, sameSite: "lax", secure: useSecureCookie, path: "/", maxAge: 30 * 24 * 60 * 60
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
