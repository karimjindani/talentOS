"use client";

import { useEffect, useState } from "react";

type CountdownTimerProps = {
  deadlineAt: string | Date;
  /** When set, a grace window after the deadline counts down instead of showing expired. */
  graceEndsAt?: string | Date | null;
  /** "inline" = compact pill (mission header); "plain" = bare text (dashboard stat). */
  variant?: "inline" | "plain";
  className?: string;
};

function breakdown(ms: number) {
  const total = Math.max(0, ms);
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total % 86_400_000) / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1_000)
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Live days:hours:minutes:seconds countdown, ticking every second. Handles the grace window and the
 * fully-expired state. */
export function CountdownTimer({ deadlineAt, graceEndsAt, variant = "inline", className = "" }: CountdownTimerProps) {
  const deadline = new Date(deadlineAt).getTime();
  const grace = graceEndsAt != null ? new Date(graceEndsAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const beforeDeadline = now <= deadline;
  const inGrace = grace != null && now > deadline && now <= grace;
  const remainingMs = beforeDeadline ? deadline - now : inGrace ? grace! - now : 0;
  const { days, hours, minutes, seconds } = breakdown(remainingMs);
  const label = `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

  if (variant === "plain") {
    if (!beforeDeadline && !inGrace) {
      return <span className={`text-rose-600 ${className}`.trim()}>Expired</span>;
    }
    return <span className={`${inGrace ? "text-amber-600" : ""} ${className}`.trim()}>{label}</span>;
  }

  if (!beforeDeadline && !inGrace) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-rose-500/30 px-3 py-1 text-xs font-semibold text-white ${className}`.trim()}>
        Deadline passed
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white ${
        inGrace ? "bg-amber-400/30" : "bg-white/15"
      } ${className}`.trim()}
      title={inGrace ? "Grace period — submitting now will be marked late" : "Time until the deadline"}
    >
      <span aria-hidden="true">⏳</span>
      {inGrace ? "Grace " : ""}
      {label}
    </span>
  );
}
