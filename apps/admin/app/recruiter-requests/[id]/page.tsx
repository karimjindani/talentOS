import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { getAccessRequestDetail, getConsentHistory } from "@talentos/db";
import { RecruiterRequestActions } from "./RecruiterRequestActions";

function formatDateTime(value: Date | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-rose-100 text-rose-800",
  REVOKED: "bg-slate-200 text-slate-700",
  EXPIRED: "bg-slate-200 text-slate-500",
};

export default async function RecruiterRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTenantAccess();
  const { id } = await params;
  const request = await getAccessRequestDetail(id);

  if (!request) notFound();

  const consentHistory = request.graduate
    ? await getConsentHistory(request.graduate.id)
    : [];

  return (
    <>
      <div className="mb-6">
        <Link href="/recruiter-requests" className="text-sm font-medium text-brand-blue hover:text-blue-700">
          ← Back to Recruiter Access Requests
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Recruiter Access Request</h1>
        <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${STATUS_COLORS[request.status] || "bg-slate-100 text-slate-600"}`}>
          {request.status}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recruiter Info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Recruiter Information</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Name</dt>
              <dd className="font-medium text-slate-900">{request.recruiterName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Email</dt>
              <dd className="font-medium text-slate-900">{request.recruiterEmail}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Organization</dt>
              <dd className="font-medium text-slate-900">{request.recruiterOrganization || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Designation</dt>
              <dd className="font-medium text-slate-900">{request.recruiterDesignation || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Phone</dt>
              <dd className="font-medium text-slate-900">{request.recruiterPhone || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Requested</dt>
              <dd className="font-medium text-slate-900">{formatDateTime(request.createdAt)}</dd>
            </div>
          </dl>

          {request.hiringRequirement ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-600">Hiring Requirement</p>
              <p className="mt-1 text-sm text-slate-800">{request.hiringRequirement}</p>
            </div>
          ) : null}
        </div>

        {/* Graduate Info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Graduate Information</h2>
          {request.graduate ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Name</dt>
                <dd className="font-medium text-slate-900">{request.graduate.user.name || request.graduate.user.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Program</dt>
                <dd className="font-medium text-slate-900">{request.graduate.program?.name || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Rating</dt>
                <dd className="font-medium text-slate-900">{request.graduate.overallRating.toFixed(1)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Graduation Date</dt>
                <dd className="font-medium text-slate-900">{formatDateTime(request.graduate.graduationDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Public Profile</dt>
                <dd className="font-medium text-slate-900">
                  {request.graduate.publicProfileEnabled ? "Enabled" : "Disabled"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Consent Status</dt>
                <dd className="font-medium text-slate-900">{request.graduate.consentStatus || "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Graduate profile no longer exists.</p>
          )}

          {/* Consent History */}
          {consentHistory.length > 0 ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-600">Consent History</p>
              <div className="mt-2 space-y-2">
                {consentHistory.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="font-mono text-slate-400">{new Date(entry.createdAt).toLocaleDateString()}</span>
                    <span className="font-semibold text-slate-700">{entry.status}</span>
                    <span>{entry.action}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Review Info */}
      {request.reviewedAt ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Review Information</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Reviewed At</dt>
              <dd className="font-medium text-slate-900">{formatDateTime(request.reviewedAt)}</dd>
            </div>
            {request.rejectionReason ? (
              <div className="flex justify-between">
                <dt className="text-slate-600">Rejection Reason</dt>
                <dd className="font-medium text-slate-900">{request.rejectionReason}</dd>
              </div>
            ) : null}
            {request.revokedAt ? (
              <div className="flex justify-between">
                <dt className="text-slate-600">Revoked At</dt>
                <dd className="font-medium text-slate-900">{formatDateTime(request.revokedAt)}</dd>
              </div>
            ) : null}
            {request.expiresAt && request.status === "APPROVED" ? (
              <div className="flex justify-between">
                <dt className="text-slate-600">Access Expires</dt>
                <dd className="font-medium text-slate-900">{formatDateTime(request.expiresAt)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-6">
        <RecruiterRequestActions requestId={request.id} status={request.status} />
      </div>
    </>
  );
}
