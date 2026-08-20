import { describe, expect, it } from "vitest";
import { buildProcessReportHtml, flattenSteps, groupByProcess, type JourneyRecord } from "./journey-pdf-report";

const record: JourneyRecord = {
  journey: "applicant-arc",
  runId: "abc123",
  startedAt: "2026-08-13T10:00:00.000Z",
  durationMs: 42_000,
  status: "passed" as const,
  steps: [
    {
      index: 1,
      name: "Applicant signs up",
      actor: "applicant" as const,
      process: "Applicant Signup & Approval" as const,
      proves: "Creates a user",
      status: "passed" as const,
      durationMs: 2400,
      screenshot: "01-applicant-signs-up.png"
    }
  ]
};

const noResolver = () => null;

function items(records: JourneyRecord[]) {
  return flattenSteps(records);
}

describe("flattenSteps / groupByProcess", () => {
  it("groups steps from multiple records by their process tag, preserving order", () => {
    const second = {
      ...record,
      journey: "recruiter-access",
      runId: "def456",
      steps: [{ ...record.steps[0], index: 1, process: "Recruiter Journey" as const }]
    };
    const groups = groupByProcess(items([record, second]));
    expect(groups.get("Applicant Signup & Approval")).toHaveLength(1);
    expect(groups.get("Recruiter Journey")).toHaveLength(1);
    expect(groups.get("Mission Acceptance & Journal")).toHaveLength(0);
  });

  it("drops a step whose process tag matches no known process, rather than throwing", () => {
    const stray = { ...record, steps: [{ ...record.steps[0], process: "Something Unknown" as never }] };
    const groups = groupByProcess(items([stray]));
    for (const bucket of groups.values()) expect(bucket).toHaveLength(0);
  });
});

describe("buildProcessReportHtml", () => {
  it("leads with the process name, its position, and a summary of steps/pass rate", () => {
    const html = buildProcessReportHtml("Applicant Signup & Approval", 1, items([record]), noResolver);
    expect(html).toContain("Applicant Signup &amp; Approval");
    expect(html).toContain("Process 1 of 5");
    expect(html).toContain(">1<"); // total steps stat
    expect(html).toContain("100%");
  });

  it("renders a step card with actor pill, name, proves text and a passed result", () => {
    const html = buildProcessReportHtml("Applicant Signup & Approval", 1, items([record]), noResolver);
    expect(html).toContain("actor-applicant");
    expect(html).toContain("Applicant signs up");
    expect(html).toContain("Creates a user");
    expect(html).toContain("Passed · 2.4s");
  });

  it("embeds the resolved screenshot data URI for a passed step", () => {
    const html = buildProcessReportHtml("Applicant Signup & Approval", 1, items([record]), (journey, runId, filename) => {
      expect(journey).toBe("applicant-arc");
      expect(runId).toBe("abc123");
      expect(filename).toBe("01-applicant-signs-up.png");
      return "data:image/png;base64,AAAA";
    });
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it("shows a missing-screenshot note rather than a broken image when the resolver returns null", () => {
    const html = buildProcessReportHtml("Applicant Signup & Approval", 1, items([record]), noResolver);
    expect(html).toContain("No screenshot was captured for this step.");
    expect(html).not.toContain("<img");
  });

  it("shows the error text instead of an image for a failed step, and never tries to resolve its screenshot", () => {
    const failed = {
      ...record,
      status: "failed" as const,
      steps: [{ ...record.steps[0], status: "failed" as const, screenshot: null, error: "Timed out waiting for selector" }]
    };
    const html = buildProcessReportHtml("Applicant Signup & Approval", 1, items([failed]), () => {
      throw new Error("must not be called for a failed step");
    });
    expect(html).toContain("Timed out waiting for selector");
    expect(html).toContain("Failed");
  });

  it("escapes HTML-significant characters in step names, claims and errors", () => {
    const withHtml = {
      ...record,
      steps: [{ ...record.steps[0], name: '<script>alert("x")</script>', proves: "a < b & c" }]
    };
    const html = buildProcessReportHtml("Applicant Signup & Approval", 1, items([withHtml]), noResolver);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &lt; b &amp; c");
  });

  it("renders a readable placeholder rather than crashing when the process has no steps at all", () => {
    const html = buildProcessReportHtml("Recruiter Journey", 5, [], noResolver);
    expect(html).toContain("No steps were recorded for this process");
    expect(html).toContain(">0<");
  });

  it("computes a partial pass rate and marks the failed-count stat when some steps fail", () => {
    const mixed = {
      ...record,
      status: "failed" as const,
      steps: [
        record.steps[0],
        { ...record.steps[0], index: 2, status: "failed" as const, screenshot: null, error: "boom" }
      ]
    };
    const html = buildProcessReportHtml("Applicant Signup & Approval", 1, items([mixed]), noResolver);
    expect(html).toContain("50%");
    expect(html).toContain('class="stat fail"');
  });
});
