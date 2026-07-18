/**
 * Weekly mission deadline cadence (v0.19.4, D-091).
 *
 * Missions run Monday → Thursday with an end-of-Thursday cutoff (Thursday 23:59:59.999,
 * SERVER-LOCAL time), and every applicant is guaranteed at least 4 inclusive calendar days:
 *
 * - Accept on Monday        → this week's Thursday (Mon–Thu = 4 days)
 * - Accept on Tue/Wed/Thu   → NEXT week's Thursday (2–3 days would be too short)
 * - Accept on Fri/Sat/Sun   → the coming Thursday (7/6/5 days)
 *
 * Formally: the earliest end-of-Thursday whose inclusive calendar-day count from the
 * acceptance date is >= 4. `mission.deadlineHours` is no longer read; `gracePeriodHours`
 * still applies after this cutoff.
 *
 * DST note: `setDate`/`setHours` re-pin the wall-clock time after a transition, so the
 * cutoff is always Thursday 23:59:59.999 local wall time even if the elapsed duration is
 * ±1 hour across a DST change — the wall-clock Thursday is what matters.
 */
export function computeWeeklyDeadline(acceptedAt: Date): Date {
  const THURSDAY = 4;
  let daysUntilThursday = (THURSDAY - acceptedAt.getDay() + 7) % 7; // 0 when accepted on a Thursday
  if (daysUntilThursday + 1 < 4) {
    // Inclusive day count would be Tue=3, Wed=2, Thu=1 — below the 4-day minimum.
    daysUntilThursday += 7;
  }
  const deadline = new Date(acceptedAt);
  deadline.setDate(deadline.getDate() + daysUntilThursday);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
}
