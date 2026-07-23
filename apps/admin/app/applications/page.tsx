import Link from "next/link";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import { getTenantBySlug, listTenantApplications, listTenantPrograms } from "@talentos/db";
import { parsePageParams, paginate } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";

type ApplicationsPageProps = {
  searchParams?: Promise<{ status?: string; programId?: string; q?: string; page?: string; pageSize?: string }>;
};

const APPLICATION_STATUSES = [
  ["ACCEPTED", "Accepted"],
  ["SUBMITTED", "Pending review"],
  ["UNDER_REVIEW", "Under review"],
  ["WAITLISTED", "Waitlisted"],
  ["REJECTED", "Rejected"],
  ["DISQUALIFIED", "Disqualified"],
  ["AWAITING_MISSION_ASSIGNMENT", "Awaiting mission"],
  ["DRAFT", "Draft"]
] as const;

const KNOWN_STATUSES = APPLICATION_STATUSES.map(([value]) => value) as readonly string[];

function formatDate(value: Date | null) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

const selectClass = "mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm";
const labelText = "text-xs font-semibold uppercase tracking-wide text-slate-500";

export default async function AdminApplicationsPage({ searchParams }: ApplicationsPageProps) {
  const params = (await searchParams) ?? {};
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const [applications, programs] = tenant
    ? await Promise.all([listTenantApplications(tenant.id), listTenantPrograms(tenant.id)])
    : [[], []];

  const statusFilter = params.status && KNOWN_STATUSES.includes(params.status) ? params.status : undefined;
  const programFilter = params.programId || undefined;
  const query = (params.q ?? "").trim().toLowerCase();

  const filtered = applications.filter((application) => {
    if (statusFilter && application.status !== statusFilter) return false;
    if (programFilter && application.program.id !== programFilter) return false;
    if (query) {
      const haystack = `${application.applicant.name ?? ""} ${application.applicant.email}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const { page, pageSize } = parsePageParams(params);
  const { slice, total, totalPages, page: currentPage, start, end } = paginate(filtered, page, pageSize);

  return (
    <>
      <h1 className="text-3xl font-bold">Applications</h1>
      <p className="mt-2 text-slate-600">Review and decide on applications for {tenantSlug}.</p>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="pageSize" value={pageSize} />
        <label className="block">
          <span className={labelText}>Search</span>
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Name or email"
            className={`${selectClass} w-56`}
          />
        </label>
        <label className="block">
          <span className={labelText}>Status</span>
          <select name="status" defaultValue={statusFilter ?? ""} className={selectClass}>
            <option value="">All statuses</option>
            {APPLICATION_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelText}>Program</span>
          <select name="programId" defaultValue={programFilter ?? ""} className={selectClass}>
            <option value="">All programs</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
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
          {applications.length === 0 ? "No applications have been submitted yet." : "No applications match these filters."}
        </p>
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {slice.map((application) => (
                  <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50" key={application.id}>
                    <td className="px-4 py-3 font-medium">{application.applicant.name ?? application.applicant.email}</td>
                    <td className="px-4 py-3">{application.program.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={application.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(application.submittedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link className="font-semibold text-brand-blue hover:underline" href={`/applications/${application.id}`}>
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            pathname="/applications"
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
