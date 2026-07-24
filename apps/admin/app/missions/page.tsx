import Link from "next/link";
import { auth } from "@/auth";
import { can } from "@talentos/auth";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import { getTenantBySlug, listTenantMissions, listTenantPrograms } from "@talentos/db";
import { parsePageParams, paginate } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";

type MissionsPageProps = {
  searchParams?: Promise<{ programId?: string; status?: string; page?: string; pageSize?: string }>;
};

const MISSION_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const selectClass = "mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm";
const labelText = "text-xs font-semibold uppercase tracking-wide text-slate-500";

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

  const { page, pageSize } = parsePageParams(params);
  const { slice, total, totalPages, page: currentPage, start, end } = paginate(missions, page, pageSize);

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

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="pageSize" value={pageSize} />
        <label className="block">
          <span className={labelText}>Program</span>
          <select name="programId" defaultValue={params.programId ?? ""} className={selectClass}>
            <option value="">All programs</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelText}>Status</span>
          <select name="status" defaultValue={selectedStatus ?? ""} className={selectClass}>
            <option value="">All statuses</option>
            {MISSION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white">
          Filter
        </button>
      </form>

      {total === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          No missions match these filters.{canManage ? " Create the first mission." : ""}
        </p>
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
                {slice.map((mission) => (
                  <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50" key={mission.id}>
                    <td className="px-4 py-3 font-medium">{mission.title}</td>
                    <td className="px-4 py-3 text-slate-500">{mission.program.name}</td>
                    <td className="px-4 py-3 text-slate-500">Week {mission.weekNumber}</td>
                    <td className="px-4 py-3 text-slate-500">{mission.difficulty}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={mission.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link className="font-semibold text-brand-blue hover:underline" href={`/missions/${mission.id}`}>
                        {canManage ? "Edit" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            pathname="/missions"
            params={params}
            page={currentPage}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            start={start}
            end={end}
          />
        </>
      )}
    </>
  );
}
