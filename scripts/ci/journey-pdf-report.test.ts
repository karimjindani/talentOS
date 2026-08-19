import { describe, expect, it } from "vitest";
import { buildJourneyReportHtml } from "./journey-pdf-report";

const record = {
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
      proves: "Creates a user",
      status: "passed" as const,
      durationMs: 2400,
      screenshot: "01-applicant-signs-up.png"
    }
  ]
};

const noResolver = () => null;

describe("buildJourneyReportHtml", () => {
  it("leads with a summary of steps, pass/fail counts and pass rate", () => {
    const html = buildJourneyReportHtml([record], noResolver);
    expect(html).toContain("Journey Evidence Report");
    expect(html).toContain(">1<"); // total steps stat
    expect(html).toContain("100%");
  });

  it("renders a step row with actor, name, claim and a passed result", () => {
    const html = buildJourneyReportHtml([record], noResolver);
    expect(html).toContain("<td>applicant</td>");
    expect(html).toContain("Applicant signs up");
    expect(html).toContain("Creates a user");
    expect(html).toContain("Passed · 2.4s");
  });

  it("embeds the resolved screenshot data URI for a passed step", () => {
    const html = buildJourneyReportHtml([record], (journey, runId, filename) => {
      expect(journey).toBe("applicant-arc");
      expect(runId).toBe("abc123");
      expect(filename).toBe("01-applicant-signs-up.png");
      return "data:image/png;base64,AAAA";
    });
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it("shows a missing-screenshot note rather than a broken image when the resolver returns null", () => {
    const html = buildJourneyReportHtml([record], noResolver);
    expect(html).toContain("No screenshot was captured for this step.");
    expect(html).not.toContain("<img");
  });

  it("shows the error text instead of an image for a failed step, and never tries to resolve its screenshot", () => {
    const failed = {
      ...record,
      status: "failed" as const,
      steps: [{ ...record.steps[0], status: "failed" as const, screenshot: null, error: "Timed out waiting for selector" }]
    };
    const html = buildJourneyReportHtml([failed], () => {
      throw new Error("must not be called for a failed step");
    });
    expect(html).toContain("Timed out waiting for selector");
    expect(html).toContain("FAILED");
  });

  it("escapes HTML-significant characters in step names, claims and errors", () => {
    const withHtml = {
      ...record,
      steps: [{ ...record.steps[0], name: '<script>alert("x")</script>', proves: "a < b & c" }]
    };
    const html = buildJourneyReportHtml([withHtml], noResolver);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &lt; b &amp; c");
  });

  it("renders a readable placeholder rather than crashing when there are no journey records at all", () => {
    const html = buildJourneyReportHtml([], noResolver);
    expect(html).toContain("No journey results were found");
    expect(html).toContain("0 journey(s)");
  });

  it("renders a journey that recorded no steps without throwing", () => {
    const empty = { ...record, status: "failed" as const, steps: [] };
    const html = buildJourneyReportHtml([empty], noResolver);
    expect(html).toContain("This journey recorded no steps.");
    expect(html).toContain("FAILED");
  });

  it("starts every journey after the first on a new PDF page", () => {
    const second = { ...record, journey: "docs-only", runId: "def456" };
    const html = buildJourneyReportHtml([record, second], noResolver);
    const sections = html.split('<section class="journey"');
    expect(sections).toHaveLength(3); // split produces 1 pre-match chunk + one per section
    expect(sections[1]).not.toContain("page-break-before");
    expect(sections[2]).toContain("page-break-before: always");
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
    const html = buildJourneyReportHtml([mixed], noResolver);
    expect(html).toContain("50%");
    expect(html).toContain('class="stat fail"');
  });
});
