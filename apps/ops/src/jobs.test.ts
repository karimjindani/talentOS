import { describe, expect, it } from "vitest";
import { summarizeStepStatus } from "./jobs";

describe("ops job progress", () => {
  it("summarizes step exit states", () => {
    expect(summarizeStepStatus(0, false)).toBe("passed");
    expect(summarizeStepStatus(1, false)).toBe("failed");
    expect(summarizeStepStatus(null, true)).toBe("failed");
  });
});
