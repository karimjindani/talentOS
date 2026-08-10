import { NextRequest, NextResponse } from "next/server";
import { getRecruiterGraduateContact, getRecruiterSession } from "@talentos/db";
import { sendCandidateContactEmail } from "@/lib/email-service";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getRecruiterSession(request.cookies.get("talentos_recruiter_session")?.value);
  if (!session) return NextResponse.json({ error: "Recruiter sign-in required." }, { status: 401 });
  const rateLimit = checkRateLimit(`candidate-contact:${session.recruiterId}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Message limit reached. Please try again later." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  const { slug } = await params;
  const body = await request.json();
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 10 || message.length > 2000) return NextResponse.json({ error: "Message must be between 10 and 2,000 characters." }, { status: 400 });
  const contact = await getRecruiterGraduateContact(slug, session.recruiterId);
  if (!contact) return NextResponse.json({ error: "Portfolio access is required." }, { status: 403 });
  await sendCandidateContactEmail({ to: contact.graduateEmail, graduateName: contact.graduateName, recruiterName: contact.recruiter.name, recruiterEmail: contact.recruiter.email, organization: contact.recruiter.organization || undefined, message });
  return NextResponse.json({ success: true });
}
