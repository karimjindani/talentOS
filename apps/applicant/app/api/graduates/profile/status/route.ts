import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGraduateEligibility, getUserByEmail, prisma } from "@talentos/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const eligibility = await getGraduateEligibility(user.id);
    if (!eligibility.eligible) {
      return NextResponse.json({
        success: true,
        eligible: false,
        consentRequired: false,
        reason: eligibility.reason,
      });
    }

    const profile = await prisma.graduateProfile.findUnique({
      where: { userId: user.id },
      select: { publicProfileEnabled: true, consentDate: true, consentVersion: true },
    });

    return NextResponse.json({
      success: true,
      eligible: true,
      consentRequired: !profile?.publicProfileEnabled,
      profile: profile ?? null,
    });
  } catch (error) {
    console.error("Error in GET /api/graduates/profile/status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
