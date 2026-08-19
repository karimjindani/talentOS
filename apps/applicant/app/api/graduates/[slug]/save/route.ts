import { NextRequest, NextResponse } from "next/server";
import { getFullProfileForRecruiter, getRecruiterSession, toggleSavedCandidate } from "@talentos/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getRecruiterSession(request.cookies.get("talentos_recruiter_session")?.value);
  if (!session) return NextResponse.json({ error: "Recruiter sign-in required." }, { status: 401 });
  const { slug } = await params;
  if (!await getFullProfileForRecruiter(slug, session.recruiterId)) return NextResponse.json({ error: "Portfolio access is required." }, { status: 403 });
  const result = await toggleSavedCandidate(session.recruiterId, slug);
  return result ? NextResponse.json(result) : NextResponse.json({ error: "Graduate not found." }, { status: 404 });
}
