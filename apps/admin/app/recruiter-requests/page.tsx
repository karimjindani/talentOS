import Link from "next/link";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { getPendingAccessRequests, getAccessRequestStats } from "@talentos/db";

function formatDate(value: Date | null) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-rose-100 text-rose-800",
  REVOKED: "bg-slate-200 text-slate-700",
  EXPIRED: "bg-slate-200 text-slate-500",
};

export default async function RecruiterRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireTenantAccess();
  const params = await searchParams;
  const status = params.status as "PENDING" | "APPROVED" | "REJECTED" | "REVOKED" | "EXPIRED" | undefined;
  const page = Number(params.page) || 1;

  const [result, stats] = await Promise.all([
    getPendingAccessRequests({ page, limit: 20, status }),
    getAccessRequestStats(),
  ]);

  const statusFilters = [
    { label: "All", value: undefined, count: stats.total },
    { label: "Pending", value: "PENDING", count: stats.pending },
    { label: "Approved", value: "APPROVED", count: stats.approved },
    { label: "Rejected", value: "REJECTED", count: stats.rejected },
    { label: "Revoked", value: "REVOKED", count: stats.revoked },
  ];

  return (
    <>
      <h1 className="text-3xl font-bold">Recruiter Access Requests</h1>
      <p className="mt-2 text-slate-600">
        Review and manage recruiter requests to view graduate portfolios.
      </p>

      {/* Stats summary */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {statusFilters.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/recruiter-requests?status=${filter.value}` : "/recruiter-requests"}
            className={`rounded-2xl border p-4 text-center transition hover:shadow-sm ${
              status === filter.value || (!status && !filter.value)
                ? "border-brand-blue bg-brand-mist"
                : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-2xl font-bold text-slate-900">{filter.count}</p>
            <p className="text-sm text-slate-600">{filter.label}</p>
          </Link>
        ))}
      </div>

      {/* Requests table */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {result.requests.length === 0 ? (
          <p className="p-8 text-center text-slate-600">
            No recruiter access requests found.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">Recruiter</th>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Graduate</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {result.requests.map((req) => (
                <tr className="border-t border-slate-100" key={req.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{req.recruiterName}</p>
                    <p className="text-xs text-slate-500">{req.recruiterEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{req.recruiterOrganization || "—"}</p>
                    <p className="text-xs text-slate-500">{req.recruiterDesignation || ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    {req.graduate ? (
                      <span>{req.graduate.user.name || req.graduate.user.email}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[req.status] || "bg-slate-100 text-slate-600"}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(req.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {req.status === "APPROVED" ? formatDate(req.expiresAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link className="text-brand-blue" href={`/recruiter-requests/${req.id}`}>
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {result.pagination.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: result.pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/recruiter-requests?${status ? `status=${status}&` : ""}page=${p}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                p === result.pagination.page
                  ? "bg-brand-blue text-white"
                  : "border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      ) : null}
    </>
  );
}
