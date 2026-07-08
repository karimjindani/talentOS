import Link from "next/link";
import { auth } from "@/auth";
import { can } from "@talentos/auth";
import { getTenantContext } from "@talentos/ui";
import { getTenantBySlug, listTenantPrograms } from "@talentos/db";
import { createMissionAction } from "../actions";
import { MissionForm } from "../MissionForm";

export default async function NewMissionPage() {
  const session = await auth();
  const canManage = can("manageMissions", {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  });
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const programs = tenant ? await listTenantPrograms(tenant.id) : [];

  if (!canManage) {
    return (
      <>
        <h1 className="text-3xl font-bold">New mission</h1>
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          Your role can view missions but cannot create or edit them.
        </p>
      </>
    );
  }

  if (programs.length === 0) {
    return (
      <>
        <h1 className="text-3xl font-bold">New mission</h1>
        <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
          Create a program before adding missions.
        </p>
        <Link href="/programs/new" className="mt-4 inline-flex rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white">
          Create program
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold">New mission</h1>
      <p className="mt-2 text-slate-600">
        Create a SEM-aligned engineering assignment that helps applicants discover, specify, build,
        test, deploy, and reflect inside one practical mission.
      </p>
      <MissionForm action={createMissionAction} programs={programs} submitLabel="Create mission" />
    </>
  );
}
