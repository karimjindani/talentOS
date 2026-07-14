import Link from "next/link";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import { getTenantBySlug, listTenantPrograms, listTenantSubmissions, type SubmissionStatus } from "@talentos/db";

type SubmissionsPageProps = {
  searchParams?: Promise<{ status?: string; programId?: string }>;
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
  const { status: statusParam, programId: programIdParam } = (await searchParams) ?? {};
  const selectedStatus = isKnownStatusOption(statusParam) ? statusParam : "SUBMITTED";
  const status = selectedStatus === "ALL" ? undefined : selectedStatus;
  const programId = programIdParam && programIdParam !== "ALL" ? programIdParam : undefined;

  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const programs = tenant ? await listTenantPrograms(tenant.id) : [];
  const submissions = tenant ? await listTenantSubmissions(tenant.id, { status, programId }) : [];

  return (
    <>
      <h1 className="text-3xl font-bold">Submissions</h1>
      <p className="mt-2 text-slate-600">
        Applicant mission evidence across every program, filterable by status and program. Review opens the
        same evidence, journal and previous-attempt context as the per-mission view.
      </p>

      <form className="mt-6 flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Status</span>
          <select
            name="status"
            defaultValue={selectedStatus}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Program</span>
          <select
            name="programId"
            defaultValue={programId ?? "ALL"}
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2"
          >
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

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{submissions.length} submission{submissions.length === 1 ? "" : "s"}</h2>
        {submissions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No submissions match these filters.</p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Applicant</th>
                <th className="py-2 pr-4">Mission</th>
                <th className="py-2 pr-4">Program</th>
                <th className="py-2 pr-4">Week</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Submitted</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <tr key={submission.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-medium text-slate-800">
                    {submission.applicant.name ?? submission.applicant.email}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">{submission.mission.title}</td>
                  <td className="py-3 pr-4 text-slate-600">{submission.mission.program.name}</td>
                  <td className="py-3 pr-4 text-slate-600">{submission.mission.weekNumber}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={submission.status} />
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {submission.submittedAt ? submission.submittedAt.toLocaleDateString() : "—"}
                  </td>
                  <td className="py-3 text-right">
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
        )}
      </div>
    </>
  );
}
