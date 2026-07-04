import { describe, expect, it } from "vitest";
import {
  nextStatusesFor,
  canTransitionApplicationStatus,
  nextProgramStatuses,
  canTransitionProgramStatus,
  assertProgramStatusTransition,
  nextMissionStatuses,
  canTransitionMissionStatus,
  assertMissionStatusTransition
} from "./workflow";

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

describe("program status transitions", () => {
  it("allows publishing and archiving a draft program", () => {
    expect(nextProgramStatuses("DRAFT")).toEqual(["PUBLISHED", "ARCHIVED"]);
    expect(canTransitionProgramStatus("DRAFT", "PUBLISHED")).toBe(true);
  });

  it("allows a published program to be archived or returned to draft", () => {
    expect(nextProgramStatuses("PUBLISHED")).toEqual(["ARCHIVED", "DRAFT"]);
  });

  it("allows an archived program to be restored to draft only", () => {
    expect(nextProgramStatuses("ARCHIVED")).toEqual(["DRAFT"]);
    expect(canTransitionProgramStatus("ARCHIVED", "PUBLISHED")).toBe(false);
  });

  it("asserts and rejects invalid program transitions", () => {
    expect(() => assertProgramStatusTransition("DRAFT", "PUBLISHED")).not.toThrow();
    expect(() => assertProgramStatusTransition("ARCHIVED", "PUBLISHED")).toThrow("Invalid program status");
  });
});

describe("mission status transitions", () => {
  it("allows publishing and archiving a draft mission", () => {
    expect(nextMissionStatuses("DRAFT")).toEqual(["PUBLISHED", "ARCHIVED"]);
    expect(canTransitionMissionStatus("DRAFT", "PUBLISHED")).toBe(true);
  });

  it("allows a published mission to be archived or returned to draft", () => {
    expect(nextMissionStatuses("PUBLISHED")).toEqual(["ARCHIVED", "DRAFT"]);
  });

  it("allows an archived mission to be restored to draft only", () => {
    expect(nextMissionStatuses("ARCHIVED")).toEqual(["DRAFT"]);
    expect(canTransitionMissionStatus("ARCHIVED", "PUBLISHED")).toBe(false);
  });

  it("asserts and rejects invalid mission transitions", () => {
    expect(() => assertMissionStatusTransition("DRAFT", "PUBLISHED")).not.toThrow();
    expect(() => assertMissionStatusTransition("ARCHIVED", "PUBLISHED")).toThrow("Invalid mission status");
  });
});
