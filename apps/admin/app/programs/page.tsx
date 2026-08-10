import Link from "next/link";
import { auth } from "@/auth";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import { can } from "@talentos/auth";
import { getTenantBySlug, listTenantPrograms } from "@talentos/db";
import { parsePageParams, paginate } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";

type ProgramsPageProps = {
  searchParams?: Promise<{ status?: string; q?: string; page?: string; pageSize?: string }>;
};

const PROGRAM_STATUSES = ["PUBLISHED", "DRAFT", "ARCHIVED"] as const;

function formatDate(value: Date | null) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

const selectClass = "mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm";
const labelText = "text-xs font-semibold uppercase tracking-wide text-slate-500";

export default async function AdminProgramsPage({ searchParams }: ProgramsPageProps) {
  const params = (await searchParams) ?? {};
  const session = await auth();
  const canManage = can("managePrograms", {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  });
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const programs = tenant ? await listTenantPrograms(tenant.id) : [];

  const statusFilter = PROGRAM_STATUSES.includes(params.status as (typeof PROGRAM_STATUSES)[number])
    ? (params.status as (typeof PROGRAM_STATUSES)[number])
    : undefined;
  const query = (params.q ?? "").trim().toLowerCase();

  const filtered = programs.filter((program) => {
    if (statusFilter && program.status !== statusFilter) return false;
    if (query && !`${program.name} ${program.slug}`.toLowerCase().includes(query)) return false;
    return true;
  });

  const { page, pageSize } = parsePageParams(params);
  const { slice, total, totalPages, page: currentPage, start, end } = paginate(filtered, page, pageSize);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Programs</h1>
          <p className="mt-2 text-slate-600">Programs that applicants can apply to for {tenantSlug}.</p>
        </div>
        {canManage ? (
          <Link className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white" href="/programs/new">
            New program
          </Link>
        ) : null}
      </div>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="pageSize" value={pageSize} />
        <label className="block">
          <span className={labelText}>Search</span>
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Name or slug"
            className={`${selectClass} w-56`}
          />
        </label>
        <label className="block">
          <span className={labelText}>Status</span>
          <select name="status" defaultValue={statusFilter ?? ""} className={selectClass}>
            <option value="">All statuses</option>
            {PROGRAM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0) + status.slice(1).toLowerCase()}
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
          {programs.length === 0
            ? `No programs yet.${canManage ? " Create the first one." : ""}`
            : "No programs match these filters."}
        </p>
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Starts</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {slice.map((program) => (
                  <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50" key={program.id}>
                    <td className="px-4 py-3 font-medium">{program.name}</td>
                    <td className="px-4 py-3 text-slate-500">{program.slug}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={program.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(program.startsAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {canManage ? (
                        <Link className="font-semibold text-brand-blue hover:underline" href={`/programs/${program.id}`}>
                          Edit →
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            pathname="/programs"
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
