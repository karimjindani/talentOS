import { describe, expect, it } from "vitest";
import { parseRegressionSummaries, parseRegressionSummary, summarizeStepStatus } from "./jobs";

describe("ops job progress", () => {
  it("summarizes step exit states", () => {
    expect(summarizeStepStatus(0, false)).toBe("passed");
    expect(summarizeStepStatus(1, false)).toBe("failed");
    expect(summarizeStepStatus(null, true)).toBe("failed");
  });

  it("parses structured regression summaries from command output", () => {
    const summary = parseRegressionSummary(
      'logs\nREGRESSION_RESULT_JSON:{"summary":{"area":"auth","total":5,"passed":5,"failed":0,"skipped":0,"durationMs":123}}\n'
    );

    expect(summary).toEqual({ area: "auth", total: 5, passed: 5, failed: 0, skipped: 0, durationMs: 123 });
  });

  it("groups structured regression results by functional area", () => {
    const summaries = parseRegressionSummaries(
      [
        "logs",
        'REGRESSION_RESULT_JSON:{"summary":{"area":"all","total":4,"passed":2,"failed":1,"skipped":1,"durationMs":1000},"results":[{"area":"auth","name":"login","status":"passed","durationMs":120},{"area":"auth","name":"roles","status":"failed","durationMs":80},{"area":"missions","name":"publish","status":"passed","durationMs":210},{"area":"storage","name":"upload","status":"skipped","durationMs":5}]}',
        ""
      ].join("\n")
    );

    expect(summaries).toEqual([
      { area: "auth", total: 2, passed: 1, failed: 1, skipped: 0, durationMs: 200 },
      { area: "missions", total: 1, passed: 1, failed: 0, skipped: 0, durationMs: 210 },
      { area: "storage", total: 1, passed: 0, failed: 0, skipped: 1, durationMs: 5 }
    ]);
  });

  it("falls back to the aggregate summary when detailed results are unavailable", () => {
    const summaries = parseRegressionSummaries(
      'REGRESSION_RESULT_JSON:{"summary":{"area":"unit","total":1,"passed":1,"failed":0,"skipped":0,"durationMs":40}}\n'
    );

    expect(summaries).toEqual([{ area: "unit", total: 1, passed: 1, failed: 0, skipped: 0, durationMs: 40 }]);
  });
});
