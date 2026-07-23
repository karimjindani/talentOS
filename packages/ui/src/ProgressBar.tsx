import type { ReactNode } from "react";

type ProgressTone = "blue" | "emerald" | "amber";

const FILL_TONE: Record<ProgressTone, string> = {
  blue: "bg-brand-blue",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500"
};

const SIZE: Record<NonNullable<ProgressBarProps["size"]>, string> = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-2.5"
};

type ProgressBarProps = {
  /** Current progress. Clamped to [0, max]. */
  value: number;
  /** Denominator; defaults to 100 so `value` can be a raw percentage. */
  max?: number;
  tone?: ProgressTone;
  size?: "sm" | "md" | "lg";
  /** Optional label rendered above the track (left side). */
  label?: ReactNode;
  /** Optional value/status text rendered above the track (right side). */
  valueText?: ReactNode;
  className?: string;
  /** Accessible name when no visible `label` is provided. */
  "aria-label"?: string;
};

/** Shared progress bar — replaces the inline track/fill `div`s duplicated on the dashboard, tasks
 * page and mission workspace. Reports progress to assistive tech via role="progressbar". */
export function ProgressBar({
  value,
  max = 100,
  tone = "blue",
  size = "md",
  label,
  valueText,
  className = "",
  ...aria
}: ProgressBarProps) {
  const safeMax = max <= 0 ? 1 : max;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = Math.round((clamped / safeMax) * 100);

  return (
    <div className={className}>
      {label || valueText ? (
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
          {label ? <span className="font-medium text-slate-700">{label}</span> : <span />}
          {valueText ? <span className="text-slate-500">{valueText}</span> : null}
        </div>
      ) : null}
      <div
        className={`${SIZE[size]} overflow-hidden rounded-full bg-slate-100`}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={aria["aria-label"]}
      >
        <div className={`h-full rounded-full transition-all ${FILL_TONE[tone]}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
