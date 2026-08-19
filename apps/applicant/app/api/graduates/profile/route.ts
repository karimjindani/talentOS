/**
 * API Route: /api/graduates/profile
 * Create or update graduate profile (POST)
 * Get current user's profile (GET)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createOrUpdateGraduateProfile, prisma } from "@talentos/db";
import { evaluateGraduateProfile } from "@/lib/graduate-evaluation";

function optionalHttpUrl(value: unknown, field: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new Error(`${field} must be a valid http(s) URL.`);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bio, linkedinUrl, githubUrl, country, skills, interests, emailPublic, profilePhotoUrl, profilePhotoFileId, artifacts } = body;

    // Validate required fields
    if (typeof bio !== "string" || !bio.trim() || bio.trim().length > 500) {
      return NextResponse.json(
        { error: "Bio is required and must be 500 characters or fewer." },
        { status: 400 }
      );
    }

    // Get user ID from session
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Create or update profile
    const profile = await createOrUpdateGraduateProfile(user.id, {
      bio: bio.trim(),
      linkedinUrl: optionalHttpUrl(linkedinUrl, "LinkedIn URL"),
      githubUrl: optionalHttpUrl(githubUrl, "GitHub URL"),
      profilePhotoUrl: optionalHttpUrl(profilePhotoUrl, "Profile photo URL"),
      profilePhotoFileId: typeof profilePhotoFileId === "string" && profilePhotoFileId ? profilePhotoFileId : null,
      country: typeof country === "string" ? country.trim().slice(0, 100) : null,
      skills: Array.isArray(skills) ? skills.filter((skill): skill is string => typeof skill === "string").map((skill) => skill.trim().toLowerCase()).filter(Boolean).slice(0, 25) : [],
      interests: Array.isArray(interests) ? interests.filter((interest): interest is string => typeof interest === "string").map((interest) => interest.trim().toLowerCase()).filter(Boolean).slice(0, 25) : [],
      emailPublic: emailPublic === true,
      artifacts: Array.isArray(artifacts) ? artifacts.slice(0, 10).map((artifact: unknown) => {
        const value = artifact as { title?: unknown; url?: unknown; description?: unknown };
        if (typeof value.title !== "string" || !value.title.trim()) throw new Error("Every artifact needs a title.");
        return { title: value.title.trim().slice(0, 120), url: optionalHttpUrl(value.url, "Artifact URL")!, description: typeof value.description === "string" ? value.description.trim().slice(0, 500) : null };
      }) : [],
    });
    let aiEvaluationStatus = "pending";
    try { aiEvaluationStatus = (await evaluateGraduateProfile(profile.id)).status; } catch (evaluationError) { console.error("Graduate AI evaluation failed:", evaluationError); }

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        slug: profile.slug,
        publicProfileEnabled: profile.publicProfileEnabled,
        bio: profile.bio,
        linkedinUrl: profile.linkedinUrl,
        githubUrl: profile.githubUrl,
        overallRating: profile.overallRating,
        graduationDate: profile.graduationDate,
      },
      aiEvaluationStatus,
    });
  } catch (error) {
    console.error("Error in POST /api/graduates/profile:", error);
    if (error instanceof Error && error.message.includes("four accepted missions")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && (error.message.includes("must be a valid http(s) URL") || error.message.includes("artifact needs a title") || error.message.includes("Profile photo upload"))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        graduateProfile: { include: { artifacts: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (!user.graduateProfile) {
      return NextResponse.json(
        { error: "No graduate profile found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: user.graduateProfile,
    });
  } catch (error) {
    console.error("Error in GET /api/graduates/profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
