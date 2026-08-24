import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@talentos/ui";
import { getRecruiterDashboard, getRecruiterSession, getTenantBySlug, updateRecruiterAccount } from "@talentos/db";

async function sessionFor(request: NextRequest) { return getRecruiterSession(request.cookies.get("talentos_recruiter_session")?.value); }

export async function GET(request: NextRequest) {
  const session = await sessionFor(request);
  if (!session) return NextResponse.json({ error: "Recruiter sign-in required." }, { status: 401 });
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  return NextResponse.json({ success: true, dashboard: await getRecruiterDashboard(session.recruiterId, tenant.id) });
}

export async function PATCH(request: NextRequest) {
  const session = await sessionFor(request);
  if (!session) return NextResponse.json({ error: "Recruiter sign-in required." }, { status: 401 });
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const organization = typeof body.organization === "string" ? body.organization.trim().slice(0, 200) : "";
  const designation = typeof body.designation === "string" ? body.designation.trim().slice(0, 200) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 50) : null;
  if (!name || !organization || !designation) return NextResponse.json({ error: "Name, organization, and designation are required." }, { status: 400 });
  const account = await updateRecruiterAccount(session.recruiterId, { name, organization, designation, phone });
  return NextResponse.json({ success: true, account: { name: account.name, organization: account.organization, designation: account.designation, phone: account.phone } });
}
