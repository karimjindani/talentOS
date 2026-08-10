import Link from "next/link";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import { getTenantBySlug, listTenantPrograms, listTenantSubmissions, type SubmissionStatus } from "@talentos/db";
import { parsePageParams, paginate } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";

type SubmissionsPageProps = {
  searchParams?: Promise<{ status?: string; programId?: string; page?: string; pageSize?: string }>;
};

const STATUS_OPTIONS: { value: SubmissionStatus | "ALL"; label: string }[] = [
  { value: "SUBMITTED", label: "Pending review" },
  { value: "NEEDS_REVISION", label: "Needs revision" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REPEAT", label: "Repeat assigned" },
  { value: "DRAFT", label: "Draft" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "ALL", label: "All statuses" }
];

function isKnownStatusOption(value: string | undefined): value is SubmissionStatus | "ALL" {
  return Boolean(value) && STATUS_OPTIONS.some((option) => option.value === value);
}

export default async function SubmissionsPage({ searchParams }: SubmissionsPageProps) {
  const params = (await searchParams) ?? {};
  const selectedStatus = isKnownStatusOption(params.status) ? params.status : "SUBMITTED";
  const status = selectedStatus === "ALL" ? undefined : selectedStatus;
  const programId = params.programId && params.programId !== "ALL" ? params.programId : undefined;

  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const programs = tenant ? await listTenantPrograms(tenant.id) : [];
  const submissions = tenant ? await listTenantSubmissions(tenant.id, { status, programId }) : [];

  const { page, pageSize } = parsePageParams(params);
  const { slice, total, totalPages, page: currentPage, start, end } = paginate(submissions, page, pageSize);

  return (
    <>
      <h1 className="text-3xl font-bold">Submissions</h1>
      <p className="mt-2 text-slate-600">
        Applicant mission evidence across every program, filterable by status and program.
      </p>

      <form className="mt-6 flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="pageSize" value={pageSize} />
        <label className="block text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
          <select name="status" defaultValue={selectedStatus} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Program</span>
          <select name="programId" defaultValue={programId ?? "ALL"} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="ALL">All programs</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white">
          Apply filters
        </button>
      </form>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-slate-600">
          {total} submission{total === 1 ? "" : "s"}
        </h2>
        {total === 0 ? (
          <p className="mt-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            No submissions match these filters.
          </p>
        ) : (
          <>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Applicant</th>
                    <th className="px-4 py-3">Mission</th>
                    <th className="px-4 py-3">Program</th>
                    <th className="px-4 py-3">Week</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {slice.map((submission) => (
                    <tr key={submission.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {submission.applicant.name ?? submission.applicant.email}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{submission.mission.title}</td>
                      <td className="px-4 py-3 text-slate-600">{submission.mission.program.name}</td>
                      <td className="px-4 py-3 text-slate-600">{submission.mission.weekNumber}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={submission.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {submission.submittedAt ? submission.submittedAt.toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/missions/${submission.mission.id}/submissions/${submission.id}`}
                          className="font-semibold text-brand-blue hover:underline"
                        >
                          Review →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              pathname="/submissions"
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
      </div>
    </>
  );
}
