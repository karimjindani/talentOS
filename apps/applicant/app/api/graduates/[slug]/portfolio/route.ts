import { NextRequest, NextResponse } from "next/server";
import { getFullProfileForRecruiter, getRecruiterSession, logProfileView } from "@talentos/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const session = await getRecruiterSession(request.cookies.get("talentos_recruiter_session")?.value);
    if (!session) return NextResponse.json({ error: "Please verify your recruiter email to continue." }, { status: 401 });
    const profile = await getFullProfileForRecruiter(slug, session.recruiterId);
    if (!profile) return NextResponse.json({ error: "Your access to this portfolio is unavailable or has expired." }, { status: 403 });

    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    await logProfileView(
      profile.graduateId,
      profile.accessRequestId,
      {
        recruiterEmail: session.recruiter.email,
        recruiterName: session.recruiter.name,
        recruiterOrganization: session.recruiter.organization
      },
      forwardedFor || request.headers.get("x-real-ip") || undefined,
      request.headers.get("user-agent") || undefined
    );

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("Error in GET /api/graduates/[slug]/portfolio:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
