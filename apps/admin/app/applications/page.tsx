import Link from "next/link";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import { getTenantBySlug, listTenantApplications } from "@talentos/db";

function formatDate(value: Date | null) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export default async function AdminApplicationsPage() {
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const applications = tenant ? await listTenantApplications(tenant.id) : [];

  return (
    <>
      <h1 className="text-3xl font-bold">Applications</h1>
      <p className="mt-2 text-slate-600">Review and decide on applications for {tenantSlug}.</p>

      {applications.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          No applications have been submitted yet.
        </p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr className="border-t border-slate-100" key={application.id}>
                  <td className="px-4 py-3 font-medium">
                    {application.applicant.name ?? application.applicant.email}
                  </td>
                  <td className="px-4 py-3">{application.program.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={application.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(application.submittedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link className="text-brand-blue" href={`/applications/${application.id}`}>
                      Review
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
