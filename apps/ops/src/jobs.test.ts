import { describe, expect, it } from "vitest";
import { parseRegressionSummary, summarizeStepStatus } from "./jobs";

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
});
