import { NextRequest, NextResponse } from "next/server";
import { revokeRecruiterSession } from "@talentos/db";

export async function POST(request: NextRequest) {
  await revokeRecruiterSession(request.cookies.get("talentos_recruiter_session")?.value);
  const response = NextResponse.json({ success: true });
  const useSecureCookie = process.env.COOKIE_SECURE === "true" ||
    (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false");
  response.cookies.set("talentos_recruiter_session", "", { httpOnly: true, sameSite: "lax", secure: useSecureCookie, path: "/", maxAge: 0 });
  return response;
}
