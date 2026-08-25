import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGraduateProfileDefaults, getCompletionSnapshot, resolveApplicantTenantId, prisma } from "@talentos/db";

/**
 * POST /api/graduates/profile/acknowledge
 * Record consent (ACKNOWLEDGED) without requiring completed missions.
 * If training is already complete (4+ accepted missions with ratings in one program),
 * the profile is auto-published to the public portal immediately.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { graduateProfile: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if training is already complete (4+ accepted missions with ratings in one program)
    const acceptedSubmissions = await prisma.submission.findMany({
      where: { applicantId: user.id, status: "ACCEPTED", rating: { not: null } },
      select: { mission: { select: { programId: true } } }
    });
    const programCounts = new Map<string, number>();
    for (const s of acceptedSubmissions) {
      programCounts.set(s.mission.programId, (programCounts.get(s.mission.programId) ?? 0) + 1);
    }
    const trainingComplete = [...programCounts.values()].some((count) => count >= 4);

    // When training is complete, carry the real snapshot (overallRating = average of accepted
    // week ratings, graduationDate, programId) into the profile so it never publishes with a
    // placeholder 0 rating. Falls back to null if the strict eligibility check fails.
    let completion: { programId: string; graduationDate: Date; overallRating: number } | null = null;
    if (trainingComplete) {
      try {
        const snapshot = await getCompletionSnapshot(user.id);
        completion = {
          programId: snapshot.programId,
          graduationDate: snapshot.graduationDate,
          overallRating: snapshot.overallRating
        };
      } catch {
        completion = null;
      }
    }

    // If a graduate profile already exists, update consent status.
    // If not, create a minimal placeholder that will be completed later
    // once the applicant finishes their training.
    if (user.graduateProfile) {
      const updated = await prisma.graduateProfile.update({
        where: { userId: user.id },
        data: {
          consentStatus: "ACKNOWLEDGED",
          consentDate: new Date(),
          publicProfileEnabled: trainingComplete, // auto-publish if training is done
          ...(completion
            ? { programId: completion.programId, graduationDate: completion.graduationDate, overallRating: completion.overallRating }
            : {}),
        },
      });
      await prisma.consentHistory.create({
        data: {
          graduateProfileId: updated.id,
          status: "ACKNOWLEDGED",
          action: trainingComplete
            ? "Applicant acknowledged consent — profile auto-published (training complete)"
            : "Applicant acknowledged consent (profile will publish after training completion)",
        },
      });
    } else {
      // Create a minimal graduate profile placeholder to store the consent decision.
      const slug = `${user.name?.toLowerCase().replace(/[^a-z0-9]/g, "-") ?? user.email.split("@")[0]}-${user.id.slice(-6)}`;
      const defaults = await getGraduateProfileDefaults(user.id);
      const tenantId = await resolveApplicantTenantId(user.id);
      const created = await prisma.graduateProfile.create({
        data: {
          userId: user.id,
          tenantId,
          slug,
          consentStatus: "ACKNOWLEDGED",
          consentDate: new Date(),
          publicProfileEnabled: trainingComplete,
          graduationDate: completion?.graduationDate ?? new Date(), // placeholder until training done
          overallRating: completion?.overallRating ?? 0,
          bio: "TalentOS program graduate",
          ...(completion ? { programId: completion.programId } : {}),
          ...defaults,
        },
      });
      await prisma.consentHistory.create({
        data: {
          graduateProfileId: created.id,
          status: "ACKNOWLEDGED",
          action: trainingComplete
            ? "Applicant acknowledged consent — profile auto-published (training complete)"
            : "Applicant acknowledged consent (profile will publish after training completion)",
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: trainingComplete
        ? "Consent recorded. Your profile is now live on the public portal."
        : "Consent recorded. Your profile will be published on the public portal once you complete your training program.",
    });
  } catch (error) {
    console.error("Error in POST /api/graduates/profile/acknowledge:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
