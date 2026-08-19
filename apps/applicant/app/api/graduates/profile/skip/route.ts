import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { skipGraduateConsent, prisma } from "@talentos/db";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    try {
      await skipGraduateConsent(user.id);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Failed to skip graduate consent:", error);
      return NextResponse.json({ error: "Unable to skip consent." }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in POST /api/graduates/profile/skip:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
