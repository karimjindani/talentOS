import { describe, expect, it } from "vitest";
import { renderJourneyMarkdown, renderProcessRollup, type JourneyRecord } from "./evidence-summary";
import { PLATFORM, SCOPE } from "../lib/evidence-taxonomy";

const record: JourneyRecord = {
  journey: "applicant-arc",
  runId: "abc123",
  startedAt: "2026-08-13T10:00:00.000Z",
  durationMs: 42_000,
  status: "passed",
  steps: [
    {
      index: 1,
      name: "Applicant signs up",
      actor: "applicant",
      process: "Applicant Signup & Approval",
      proves: "Creates a user",
      status: "passed",
      durationMs: 2400,
      screenshot: "01-applicant-signs-up.png"
    }
  ]
};

// These six carry over verbatim from the retired journey-report.test.ts — the Markdown contract
// did not change when the two summary writers merged, and the column order is load-bearing.
describe("renderJourneyMarkdown", () => {
  it("leads with the verdict", () => {
    expect(renderJourneyMarkdown(record)).toContain("✅ **Passed**");
  });

  it("pins the column order actor, name, proves", () => {
    expect(renderJourneyMarkdown(record)).toContain("| 1 | applicant | Applicant signs up | Creates a user |");
  });

  it("shows the error text and no screenshot reference for a failed step", () => {
    const failed: JourneyRecord = {
      ...record,
      status: "failed",
      steps: [{ ...record.steps[0], status: "failed", screenshot: null, error: "Timed out" }]
    };
    const md = renderJourneyMarkdown(failed);
    expect(md).toContain("❌ **Failed**");
    expect(md).toContain("Timed out");
    expect(md).not.toContain(".png");
  });

  it("escapes pipes so a step name cannot break the table", () => {
    const piped: JourneyRecord = { ...record, steps: [{ ...record.steps[0], name: "a | b" }] };
    expect(renderJourneyMarkdown(piped)).toContain("a \\| b");
  });

  it("renders a zero-step record without throwing", () => {
    const empty: JourneyRecord = { ...record, steps: [] };
    expect(renderJourneyMarkdown(empty)).toContain("0/0 steps");
  });

  it("flattens a multi-line proves into one cell but keeps newlines inside a fenced error", () => {
    const multiline: JourneyRecord = {
      ...record,
      status: "failed",
      steps: [
        {
          ...record.steps[0],
          proves: "line one\nline two",
          status: "failed",
          screenshot: null,
          error: "first\nsecond"
        }
      ]
    };
    const md = renderJourneyMarkdown(multiline);
    expect(md).toContain("line one line two");
    expect(md).toContain("first\nsecond");
  });
});

describe("renderProcessRollup", () => {
  const scenarios = [
    { id: "TOS-APP-01", area: "applicant", scopes: [SCOPE.ASA], name: "Applies", status: "passed" as const, durationMs: 10 },
    { id: "TOS-MIS-01", area: "missions", scopes: [SCOPE.MAJ], name: "Accepts", status: "failed" as const, durationMs: 20 },
    { id: "TOS-OPS-01", area: "ops", scopes: [PLATFORM], name: "Ops login", status: "passed" as const, durationMs: 5 }
  ];

  it("gives every business process a row, plus one for platform", () => {
    const md = renderProcessRollup([record], scenarios);
    for (const name of [
      "Applicant Signup & Approval",
      "Mission Acceptance & Journal",
      "Submission & Mission Acceptance",
      "Final Mission & Public Profile",
      "Recruiter Journey",
      PLATFORM
    ]) {
      expect(md).toContain(name);
    }
  });

  it("counts journey steps and scenario checks side by side for the same process", () => {
    const md = renderProcessRollup([record], scenarios);
    expect(md).toContain("| Applicant Signup & Approval | 1/1 | 1/1 | — |");
  });

  it("flags a process whose scenario failed", () => {
    const md = renderProcessRollup([record], scenarios);
    expect(md).toContain("| Mission Acceptance & Journal | 0/0 | 0/1 | ❌ 1 |");
  });

  it("shows no step count for platform, which never has journey steps", () => {
    const md = renderProcessRollup([record], scenarios);
    expect(md).toContain(`| ${PLATFORM} | — | 1/1 | — |`);
  });

  it("renders with no evidence at all rather than throwing", () => {
    expect(() => renderProcessRollup([], [])).not.toThrow();
    expect(renderProcessRollup([], [])).toContain("Coverage by business process");
  });
});
