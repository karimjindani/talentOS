import { describe, expect, it } from "vitest";
import { renderJourneyMarkdown } from "./journey-report";

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

describe("renderJourneyMarkdown", () => {
  it("leads with the verdict", () => {
    expect(renderJourneyMarkdown(record)).toContain("✅ **Passed**");
  });

  it("renders one row per step carrying actor, claim and screenshot", () => {
    const md = renderJourneyMarkdown(record);
    expect(md).toContain("| 1 | applicant | Applicant signs up | Creates a user |");
    expect(md).toContain("01-applicant-signs-up.png");
  });

  it("shows the error and no screenshot for a failed step", () => {
    const failed = {
      ...record,
      status: "failed" as const,
      steps: [{ ...record.steps[0], status: "failed" as const, screenshot: null, error: "timeout" }]
    };
    const md = renderJourneyMarkdown(failed);
    expect(md).toContain("❌ **Failed**");
    expect(md).toContain("timeout");
    expect(md).not.toContain(".png");
  });

  it("escapes pipes so a claim containing one cannot break the table", () => {
    const piped = { ...record, steps: [{ ...record.steps[0], proves: "a | b" }] };
    expect(renderJourneyMarkdown(piped)).toContain("a \\| b");
  });

  // The renderer runs under `if: always()`, so it must describe a bad record rather than throw and
  // replace the real CI failure with a confusing one.
  it("renders a journey that recorded no steps without throwing", () => {
    const empty = { ...record, status: "failed" as const, steps: [] };
    const md = renderJourneyMarkdown(empty);
    expect(md).toContain("❌ **Failed**");
    expect(md).toContain("0/0 steps");
  });

  it("keeps a multi-line error inside the table row it belongs to", () => {
    const multiline = {
      ...record,
      status: "failed" as const,
      steps: [
        {
          ...record.steps[0],
          status: "failed" as const,
          screenshot: null,
          proves: "line one\nline two",
          error: "first\nsecond"
        }
      ]
    };
    const md = renderJourneyMarkdown(multiline);
    // The claim is flattened so it cannot break the table...
    expect(md).toContain("line one line two");
    // ...while the error keeps its newlines inside the fenced block below the table.
    expect(md).toContain("first\nsecond");
  });
});
