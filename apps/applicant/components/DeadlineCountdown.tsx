"use client";

import { useEffect, useState } from "react";

type DeadlineCountdownProps = {
  deadlineAt: string | Date;
  graceEndsAt: string | Date;
};

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / (60 * 1000)));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}

/** Ticking days/hours/minutes countdown to a mission's deadline, switching to grace-period styling
 * once the deadline has passed but the grace window hasn't ended yet. */
export function DeadlineCountdown({ deadlineAt, graceEndsAt }: DeadlineCountdownProps) {
  const deadline = new Date(deadlineAt).getTime();
  const graceEnds = new Date(graceEndsAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (now <= deadline) {
    return (
      <div className="rounded-xl border border-brand-blue/30 bg-brand-mist/40 px-4 py-3 text-sm">
        <p className="font-semibold text-brand-navy">{formatRemaining(deadline - now)} remaining</p>
        <p className="mt-0.5 text-xs text-slate-500">Deadline: {new Date(deadline).toLocaleString()}</p>
      </div>
    );
  }

  if (now <= graceEnds) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
        <p className="font-semibold text-amber-800">
          Deadline passed — grace period: {formatRemaining(graceEnds - now)} remaining
        </p>
        <p className="mt-0.5 text-xs text-amber-700">
          A submission now will be marked late. After the grace period this mission will fail.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm">
      <p className="font-semibold text-rose-700">Deadline and grace period have both passed.</p>
    </div>
  );
}
