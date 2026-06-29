import { describe, expect, it } from "vitest";
import { nextStatusesFor, canTransitionApplicationStatus } from "./workflow";

describe("nextStatusesFor", () => {
  it("offers reviewer decisions from a submitted application", () => {
    expect(nextStatusesFor("SUBMITTED")).toEqual(["UNDER_REVIEW", "ACCEPTED", "REJECTED", "WAITLISTED"]);
  });

  it("offers only accept/reject from a waitlisted application", () => {
    expect(nextStatusesFor("WAITLISTED")).toEqual(["ACCEPTED", "REJECTED"]);
  });

  it("returns no further actions for terminal statuses", () => {
    expect(nextStatusesFor("ACCEPTED")).toEqual([]);
    expect(nextStatusesFor("REJECTED")).toEqual([]);
  });

  it("stays consistent with canTransitionApplicationStatus", () => {
    for (const to of nextStatusesFor("UNDER_REVIEW")) {
      expect(canTransitionApplicationStatus("UNDER_REVIEW", to)).toBe(true);
    }
    expect(canTransitionApplicationStatus("UNDER_REVIEW", "DRAFT")).toBe(false);
  });

  it("returns a fresh array (callers cannot mutate the transition table)", () => {
    const first = nextStatusesFor("SUBMITTED");
    first.push("DRAFT");
    expect(nextStatusesFor("SUBMITTED")).toEqual(["UNDER_REVIEW", "ACCEPTED", "REJECTED", "WAITLISTED"]);
  });
});
