// Single source of truth for mission-assignment status pills. Replaces the three duplicated maps that
// lived on the mission detail page, missions list and dashboard. Keyed by string so `@talentos/ui`
// stays decoupled from `@talentos/db` (the enum values are strings at runtime).

const LIGHT_STYLES: Record<string, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600",
  ACCEPTED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  PENDING_EVALUATION: "bg-indigo-100 text-indigo-700",
  LATE_SUBMITTED: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-amber-100 text-amber-800",
  FAILED: "bg-rose-100 text-rose-700",
  PASSED: "bg-emerald-100 text-emerald-700",
  REPEAT: "bg-rose-100 text-rose-700"
};

// Translucent variants for use on the dark navy workspace header.
const ON_DARK_STYLES: Record<string, string> = {
  NOT_STARTED: "bg-white/10 text-brand-mist",
  ACCEPTED: "bg-white/20 text-white",
  IN_PROGRESS: "bg-white/20 text-white",
  PENDING_EVALUATION: "bg-indigo-400/30 text-white",
  LATE_SUBMITTED: "bg-amber-400/30 text-white",
  OVERDUE: "bg-amber-400/30 text-white",
  FAILED: "bg-rose-400/30 text-white",
  PASSED: "bg-emerald-400/30 text-white",
  REPEAT: "bg-rose-400/30 text-white"
};

const LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In progress",
  PENDING_EVALUATION: "Pending evaluation",
  LATE_SUBMITTED: "Late — pending evaluation",
  OVERDUE: "Overdue — grace period",
  FAILED: "Failed",
  PASSED: "Passed",
  REPEAT: "Repeat assigned"
};

type MissionStatusBadgeProps = {
  status: string | null;
  /** "light" for on-white surfaces (default); "onDark" for the navy workspace header. */
  tone?: "light" | "onDark";
};

export function MissionStatusBadge({ status, tone = "light" }: MissionStatusBadgeProps) {
  const key = status ?? "NOT_STARTED";
  const styles = tone === "onDark" ? ON_DARK_STYLES : LIGHT_STYLES;
  const style = styles[key] ?? styles.NOT_STARTED;
  const label = LABELS[key] ?? "Not started";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}
