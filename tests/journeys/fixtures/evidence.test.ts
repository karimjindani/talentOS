import { describe, expect, it } from "vitest";
import { buildStepRecord, journeyStatus, screenshotFilename } from "./evidence";

describe("screenshotFilename", () => {
  it("zero-pads the index and slugs the step name", () => {
    expect(screenshotFilename(1, "Applicant signs up")).toBe("01-applicant-signs-up.png");
    expect(screenshotFilename(12, "Reviewer requests changes")).toBe("12-reviewer-requests-changes.png");
  });

  it("collapses punctuation and repeated separators", () => {
    expect(screenshotFilename(3, "Submits evidence — URLs, notes")).toBe("03-submits-evidence-urls-notes.png");
  });

  it("truncates very long names so the path stays portable", () => {
    const name = "a".repeat(200);
    expect(screenshotFilename(4, name).length).toBeLessThanOrEqual(64);
  });
});

describe("buildStepRecord", () => {
  const base = { index: 1, name: "Signs up", actor: "applicant" as const, proves: "Creates a user", durationMs: 1200 };

  it("records a passing step with its screenshot", () => {
    expect(buildStepRecord({ ...base, error: null })).toEqual({
      index: 1, name: "Signs up", actor: "applicant", proves: "Creates a user",
      status: "passed", durationMs: 1200, screenshot: "01-signs-up.png"
    });
  });

  it("records a failing step with no screenshot and the error text", () => {
    const record = buildStepRecord({ ...base, error: "expected 200, got 500" });
    expect(record.status).toBe("failed");
    // Evidence must never show a screenshot for a step whose assertions did not hold.
    expect(record.screenshot).toBeNull();
    expect(record.error).toBe("expected 200, got 500");
  });
});

describe("journeyStatus", () => {
  const passing = { index: 1, name: "a", actor: "applicant" as const, proves: "p", status: "passed" as const, durationMs: 1, screenshot: "01-a.png" };

  it("passes only when every step passed", () => {
    expect(journeyStatus([passing, { ...passing, index: 2 }])).toBe("passed");
  });

  it("fails when any step failed", () => {
    expect(journeyStatus([passing, { ...passing, index: 2, status: "failed", screenshot: null }])).toBe("failed");
  });

  it("treats an empty journey as failed rather than vacuously passing", () => {
    expect(journeyStatus([])).toBe("failed");
  });
});
