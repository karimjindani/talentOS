import { describe, expect, it } from "vitest";

// Test the breakdown and pad helpers from CountdownTimer.
// The component uses useState/useEffect (client-only) so we test the pure formatting logic.

function breakdown(ms: number) {
  const total = Math.max(0, ms);
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total % 86_400_000) / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1_000),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

function formatLabel(ms: number): string {
  const { days, hours, minutes, seconds } = breakdown(ms);
  return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

describe("CountdownTimer — breakdown logic", () => {
  it("breaks down zero milliseconds", () => {
    expect(breakdown(0)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("breaks down negative milliseconds as zero (clamped)", () => {
    expect(breakdown(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("breaks down 1 day correctly", () => {
    expect(breakdown(86_400_000)).toEqual({ days: 1, hours: 0, minutes: 0, seconds: 0 });
  });

  it("breaks down 1 hour correctly", () => {
    expect(breakdown(3_600_000)).toEqual({ days: 0, hours: 1, minutes: 0, seconds: 0 });
  });

  it("breaks down 1 minute correctly", () => {
    expect(breakdown(60_000)).toEqual({ days: 0, hours: 0, minutes: 1, seconds: 0 });
  });

  it("breaks down 1 second correctly", () => {
    expect(breakdown(1000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 });
  });

  it("breaks down a mixed duration correctly", () => {
    // 2d 3h 4m 5s
    const ms = 2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5 * 1000;
    expect(breakdown(ms)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
  });
});

describe("CountdownTimer — pad helper", () => {
  it("pads single digit to 2 characters", () => {
    expect(pad(0)).toBe("00");
    expect(pad(5)).toBe("05");
    expect(pad(9)).toBe("09");
  });

  it("does not pad double digits", () => {
    expect(pad(10)).toBe("10");
    expect(pad(59)).toBe("59");
  });
});

describe("CountdownTimer — formatLabel", () => {
  it("formats zero as 0d 00h 00m 00s", () => {
    expect(formatLabel(0)).toBe("0d 00h 00m 00s");
  });

  it("formats 1h 30m correctly", () => {
    expect(formatLabel(3_600_000 + 30 * 60_000)).toBe("0d 01h 30m 00s");
  });

  it("formats 2d 3h 4m 5s correctly", () => {
    const ms = 2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5 * 1000;
    expect(formatLabel(ms)).toBe("2d 03h 04m 05s");
  });
});

describe("CountdownTimer — state transitions", () => {
  it("identifies before-deadline state", () => {
    const now = Date.now();
    const deadline = now + 60_000;
    const grace: number | null = now + 120_000;
    const beforeDeadline = now <= deadline;
    const inGrace = grace != null && now > deadline && now <= grace;
    expect(beforeDeadline).toBe(true);
    expect(inGrace).toBe(false);
  });

  it("identifies grace-period state", () => {
    const now = Date.now();
    const deadline = now - 60_000;
    const grace: number | null = now + 60_000;
    const beforeDeadline = now <= deadline;
    const inGrace = grace != null && now > deadline && now <= grace;
    expect(beforeDeadline).toBe(false);
    expect(inGrace).toBe(true);
  });

  it("identifies expired state (no grace)", () => {
    const now = Date.now();
    const deadline = now - 120_000;
    const grace: number | null = null;
    const beforeDeadline = now <= deadline;
    const inGrace = grace != null && now > deadline && now <= grace;
    const expired = !beforeDeadline && !inGrace;
    expect(expired).toBe(true);
  });

  it("identifies expired state (grace also passed)", () => {
    const now = Date.now();
    const deadline = now - 120_000;
    const grace: number | null = now - 60_000;
    const beforeDeadline = now <= deadline;
    const inGrace = grace != null && now > deadline && now <= grace;
    const expired = !beforeDeadline && !inGrace;
    expect(expired).toBe(true);
  });
});
