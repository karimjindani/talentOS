import { NextRequest, NextResponse } from "next/server";
import { getFullProfileForRecruiter, getRecruiterSession, logProfileView, prisma } from "@talentos/db";
import { sendProfileViewNotification } from "@/lib/email-service";

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

    // Notify the graduate that their profile was viewed (best-effort, non-blocking)
    try {
      const graduateUser = await prisma.user.findFirst({
        where: { graduateProfile: { id: profile.graduateId } },
        select: { email: true, name: true }
      });
      if (graduateUser) {
        await sendProfileViewNotification({
          to: graduateUser.email,
          graduateName: graduateUser.name || "TalentOS Graduate",
          recruiterName: session.recruiter.name,
          recruiterOrganization: session.recruiter.organization,
          viewedAt: new Date(),
        });
      }
    } catch (notifyError) {
      console.error("Failed to send profile-view notification:", notifyError);
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("Error in GET /api/graduates/[slug]/portfolio:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
