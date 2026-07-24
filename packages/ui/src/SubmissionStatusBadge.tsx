// Single source of truth for submission status pills (v0.15.0 SEM review loop). Replaces the
// duplicated local `SubmissionStatusBadge` (mission detail) and `SubmissionStatusChip` (dashboard).

const STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  REVIEWED: "bg-slate-100 text-slate-700",
  NEEDS_REVISION: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  REPEAT: "bg-rose-100 text-rose-700"
};

const LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted — awaiting review",
  REVIEWED: "Reviewed",
  NEEDS_REVISION: "Revision requested",
  ACCEPTED: "Accepted",
  REPEAT: "Repeat assigned"
};

type SubmissionStatusBadgeProps = {
  status: string | null;
  /** Label shown when there is no submission yet. */
  emptyLabel?: string;
};

export function SubmissionStatusBadge({ status, emptyLabel = "Not started" }: SubmissionStatusBadgeProps) {
  if (!status) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
        {emptyLabel}
      </span>
    );
  }
  const style = STYLES[status] ?? "bg-slate-100 text-slate-700";
  const label = LABELS[status] ?? status.replace(/_/g, " ");
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}
