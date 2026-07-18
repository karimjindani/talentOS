import { describe, expect, it } from "vitest";
import { computeWeeklyDeadline } from "./deadline-cadence";

// All fixtures use the LOCAL-time Date constructor so expectations hold in any timezone.
// Week of 2026-07-13: Mon 13, Tue 14, Wed 15, Thu 16, Fri 17, Sat 18, Sun 19 (mid-July —
// no DST transition in any common zone).
function localDate(day: number, hour = 10, minute = 0, second = 0, ms = 0): Date {
  return new Date(2026, 6, day, hour, minute, second, ms);
}

function endOfDay(day: number): Date {
  return new Date(2026, 6, day, 23, 59, 59, 999);
}

function inclusiveDays(from: Date, to: Date): number {
  const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toMidnight = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toMidnight.getTime() - fromMidnight.getTime()) / 86_400_000) + 1;
}

describe("computeWeeklyDeadline", () => {
  it("gives a Monday acceptance this week's Thursday (4 inclusive days)", () => {
    expect(computeWeeklyDeadline(localDate(13))).toEqual(endOfDay(16));
  });

  it("rolls Tuesday, Wednesday and Thursday acceptances to next week's Thursday", () => {
    expect(computeWeeklyDeadline(localDate(14))).toEqual(endOfDay(23)); // Tue
    expect(computeWeeklyDeadline(localDate(15))).toEqual(endOfDay(23)); // Wed (the user's example)
    expect(computeWeeklyDeadline(localDate(16))).toEqual(endOfDay(23)); // Thu
  });

  it("gives Friday, Saturday and Sunday acceptances the coming Thursday (7/6/5 days)", () => {
    expect(computeWeeklyDeadline(localDate(17))).toEqual(endOfDay(23)); // Fri
    expect(computeWeeklyDeadline(localDate(18))).toEqual(endOfDay(23)); // Sat
    expect(computeWeeklyDeadline(localDate(19))).toEqual(endOfDay(23)); // Sun
  });

  it("keeps this Thursday for an acceptance exactly at Monday local midnight", () => {
    expect(computeWeeklyDeadline(localDate(13, 0, 0, 0, 0))).toEqual(endOfDay(16));
  });

  it("rolls to next Thursday for an acceptance at the very end of a Thursday", () => {
    expect(computeWeeklyDeadline(localDate(16, 23, 59, 59, 999))).toEqual(endOfDay(23));
  });

  it("always lands on an end-of-Thursday with at least 4 inclusive calendar days", () => {
    for (let day = 13; day <= 19; day++) {
      const acceptedAt = localDate(day);
      const deadline = computeWeeklyDeadline(acceptedAt);
      expect(deadline.getDay()).toBe(4);
      expect([deadline.getHours(), deadline.getMinutes(), deadline.getSeconds(), deadline.getMilliseconds()]).toEqual([
        23, 59, 59, 999
      ]);
      expect(inclusiveDays(acceptedAt, deadline)).toBeGreaterThanOrEqual(4);
    }
  });

  it("does not mutate its input", () => {
    const acceptedAt = localDate(13);
    const before = acceptedAt.getTime();
    computeWeeklyDeadline(acceptedAt);
    expect(acceptedAt.getTime()).toBe(before);
  });
});
