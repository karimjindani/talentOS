// Presentational status pill for application lifecycle statuses, shared by both portals.
const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  WAITLISTED: "bg-violet-100 text-violet-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-slate-200 text-slate-600",
  // Mission-submission review loop (v0.15.0, D-067).
  NEEDS_REVISION: "bg-amber-100 text-amber-800",
  // Mission-deadline/reject-loop program outcomes (v0.18.5).
  DISQUALIFIED: "bg-rose-100 text-rose-700",
  AWAITING_MISSION_ASSIGNMENT: "bg-amber-100 text-amber-800"
};

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
