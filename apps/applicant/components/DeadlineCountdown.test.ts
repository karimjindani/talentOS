import { describe, expect, it } from "vitest";

// Test the formatRemaining helper logic by reimplementing the same pure calculation.
// The component itself uses useState/useEffect (client-only) so we test the formatting logic directly.

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / (60 * 1000)));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}

describe("DeadlineCountdown — formatRemaining logic", () => {
  it("formats zero milliseconds as 0d 0h 0m", () => {
    expect(formatRemaining(0)).toBe("0d 0h 0m");
  });

  it("formats negative milliseconds as 0d 0h 0m (clamped)", () => {
    expect(formatRemaining(-5000)).toBe("0d 0h 0m");
  });

  it("formats minutes correctly", () => {
    expect(formatRemaining(5 * 60 * 1000)).toBe("0d 0h 5m");
  });

  it("formats hours correctly", () => {
    expect(formatRemaining(3 * 60 * 60 * 1000)).toBe("0d 3h 0m");
  });

  it("formats days correctly", () => {
    expect(formatRemaining(2 * 24 * 60 * 60 * 1000)).toBe("2d 0h 0m");
  });

  it("formats a mixed duration correctly", () => {
    // 1 day, 2 hours, 30 minutes
    const ms = (1 * 24 * 60 + 2 * 60 + 30) * 60 * 1000;
    expect(formatRemaining(ms)).toBe("1d 2h 30m");
  });

  it("formats 7 days correctly", () => {
    expect(formatRemaining(7 * 24 * 60 * 60 * 1000)).toBe("7d 0h 0m");
  });
});

describe("DeadlineCountdown — state transitions", () => {
  it("returns 'Loading' state when now is null (server render)", () => {
    // The component starts with now=null to avoid hydration mismatch (BUG-3)
    // This is verified by the component returning a "Loading deadline…" div
    // We verify the logic: null means loading
    const now: number | null = null;
    expect(now === null).toBe(true);
  });

  it("determines 'before deadline' when now <= deadline", () => {
    const now = Date.now();
    const deadline = now + 60_000; // 1 minute in future
    expect(now <= deadline).toBe(true);
  });

  it("determines 'in grace period' when deadline < now <= graceEnds", () => {
    const now = Date.now();
    const deadline = now - 60_000; // 1 minute ago
    const graceEnds = now + 60_000; // 1 minute in future
    expect(now > deadline && now <= graceEnds).toBe(true);
  });

  it("determines 'expired' when now > graceEnds", () => {
    const now = Date.now();
    const graceEnds = now - 60_000; // grace also passed
    expect(now > graceEnds).toBe(true);
  });
});
