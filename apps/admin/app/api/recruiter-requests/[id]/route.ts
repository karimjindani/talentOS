/**
 * Admin API: /api/recruiter-requests/[id]
 * GET    - Get request detail
 * PATCH  - Approve / Reject / Revoke
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAccessRequestDetail,
  approveAccessRequest,
  rejectAccessRequest,
  revokeAccessRequest,
} from "@talentos/db";
import { generateSecureToken, generateVerificationUrl } from "@talentos/db";
import { resolveTenantAccess } from "@/lib/tenant-guard";
import { sendVerificationEmail } from "@/lib/email-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await resolveTenantAccess();
  if (!access.ok) {
    if (access.reason === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const request = await getAccessRequestDetail(id);
  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  return NextResponse.json({ request });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await resolveTenantAccess();
  if (!access.ok) {
    if (access.reason === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action, rejectionReason } = body;

  const reviewerId = access.actorUserId ?? "admin";

  try {
    if (action === "approve") {
      // Generate a new secure token on approval — this is the token the recruiter receives
      const rawToken = generateSecureToken();
      const result = await approveAccessRequest(id, reviewerId, rawToken);

      // Send the verification email to the recruiter
      const baseUrl = process.env.NEXT_PUBLIC_APPLICANT_URL || process.env.AUTH_URL || "http://localhost:3100";
      const verificationUrl = generateVerificationUrl(baseUrl, rawToken);

      try {
        await sendVerificationEmail({
          to: result.request.recruiterEmail,
          recruiterName: result.request.recruiterName,
          graduateName: result.request.graduate?.user?.name || "a Graduate",
          verificationUrl,
          expiresAt: result.expiresAt,
        });
      } catch (emailError) {
        console.error("Failed to send approval email:", emailError);
        // The request is still approved — the admin can resend later
      }

      return NextResponse.json({
        success: true,
        message: "Request approved. Verification email sent to recruiter.",
        status: "APPROVED",
        expiresAt: result.expiresAt,
      });
    }

    if (action === "reject") {
      await rejectAccessRequest(id, reviewerId, rejectionReason);
      return NextResponse.json({
        success: true,
        message: "Request rejected.",
        status: "REJECTED",
      });
    }

    if (action === "revoke") {
      await revokeAccessRequest(id, reviewerId);
      return NextResponse.json({
        success: true,
        message: "Access revoked. Recruiter can no longer view the profile.",
        status: "REVOKED",
      });
    }

    return NextResponse.json({ error: "Invalid action. Use 'approve', 'reject', or 'revoke'." }, { status: 400 });
  } catch (error) {
    console.error("Error in PATCH /api/recruiter-requests/[id]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
