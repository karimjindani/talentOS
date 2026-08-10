"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RecruiterRequestActionsProps {
  requestId: string;
  status: string;
}

export function RecruiterRequestActions({ requestId, status }: RecruiterRequestActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleAction = async (action: "approve" | "reject" | "revoke") => {
    setLoading(action);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/recruiter-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rejectionReason: action === "reject" ? rejectionReason : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed.");

      setSuccess(data.message || `${action} successful.`);
      setShowRejectForm(false);
      setRejectionReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Actions</h2>

      {error ? (
        <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>
      ) : null}

      {showRejectForm ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">Rejection Reason (optional)</label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            placeholder="Explain why the request is being rejected..."
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleAction("reject")}
              disabled={loading === "reject"}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              {loading === "reject" ? "Rejecting…" : "Confirm Reject"}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          {status === "PENDING" ? (
            <>
              <button
                type="button"
                onClick={() => handleAction("approve")}
                disabled={loading !== null}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {loading === "approve" ? "Approving…" : "Approve & Send Email"}
              </button>
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                disabled={loading !== null}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          ) : null}

          {status === "APPROVED" ? (
            <button
              type="button"
              onClick={() => handleAction("revoke")}
              disabled={loading !== null}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading === "revoke" ? "Revoking…" : "Revoke Access"}
            </button>
          ) : null}

          {status === "REJECTED" || status === "REVOKED" || status === "EXPIRED" ? (
            <p className="text-sm text-slate-500">No further actions available for this request.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
