import Link from "next/link";
import { auth } from "@/auth";
import { can } from "@talentos/auth";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import { getTenantBySlug, listTenantMissions, listTenantPrograms } from "@talentos/db";

type MissionsPageProps = {
  searchParams?: Promise<{ programId?: string; status?: string }>;
};

const MISSION_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export default async function AdminMissionsPage({ searchParams }: MissionsPageProps) {
  const params = (await searchParams) ?? {};
  const session = await auth();
  const canManage = can("manageMissions", {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  });
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const programs = tenant ? await listTenantPrograms(tenant.id) : [];
  const selectedStatus = MISSION_STATUSES.includes(params.status as (typeof MISSION_STATUSES)[number])
    ? (params.status as (typeof MISSION_STATUSES)[number])
    : undefined;
  const missions = tenant
    ? await listTenantMissions(tenant.id, {
        programId: params.programId || undefined,
        status: selectedStatus
      })
    : [];

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Missions</h1>
          <p className="mt-2 text-slate-600">Mission-based learning assignments for {tenantSlug}.</p>
        </div>
        {canManage ? (
          <Link className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white" href="/missions/new">
            New mission
          </Link>
        ) : null}
      </div>

      <form className="mt-6 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Program</span>
          <select name="programId" defaultValue={params.programId ?? ""} className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">All programs</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
          <select name="status" defaultValue={selectedStatus ?? ""} className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {MISSION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="self-end rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">
          Filter
        </button>
      </form>

      {missions.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          No missions yet.{canManage ? " Create the first mission." : ""}
        </p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">Mission</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Week</th>
                <th className="px-4 py-3">Difficulty</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {missions.map((mission) => (
                <tr className="border-t border-slate-100" key={mission.id}>
                  <td className="px-4 py-3 font-medium">{mission.title}</td>
                  <td className="px-4 py-3 text-slate-500">{mission.program.name}</td>
                  <td className="px-4 py-3 text-slate-500">Week {mission.weekNumber}</td>
                  <td className="px-4 py-3 text-slate-500">{mission.difficulty}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={mission.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link className="text-brand-blue" href={`/missions/${mission.id}`}>
                      {canManage ? "Edit" : "View"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
