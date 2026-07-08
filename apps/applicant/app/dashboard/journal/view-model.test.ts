import { describe, expect, it } from "vitest";
import {
  findJournalMissionOption,
  formatJournalDate,
  getDefaultNewJournalMission,
  getJournalEntryPageTitle,
  isJournalEditMode,
  toJournalDateInput
} from "./view-model";

describe("journal view model", () => {
  const mission = { id: "mission-1", title: "Assigned Mission", weekNumber: 1 };

  it("opens saved journal entries in read-only mode by default", () => {
    expect(isJournalEditMode(undefined)).toBe(false);
    expect(isJournalEditMode({})).toBe(false);
    expect(getJournalEntryPageTitle(false)).toBe("Journal entry");
  });

  it("uses explicit edit mode only when requested", () => {
    expect(isJournalEditMode({ mode: "edit" })).toBe(true);
    expect(isJournalEditMode({ mode: ["edit"] })).toBe(true);
    expect(isJournalEditMode({ mode: "view" })).toBe(false);
    expect(getJournalEntryPageTitle(true)).toBe("Edit journal entry");
  });

  it("locks the new-entry mission field when exactly one assigned mission exists", () => {
    expect(getDefaultNewJournalMission([mission])).toEqual(mission);
    expect(getDefaultNewJournalMission([mission, { id: "mission-2", title: "Second", weekNumber: 2 }])).toBeNull();
    expect(getDefaultNewJournalMission([])).toBeNull();
  });

  it("formats journal dates using the UTC calendar date", () => {
    const value = new Date("2026-07-07T19:48:04.479Z");
    expect(toJournalDateInput(value)).toBe("2026-07-07");
    expect(formatJournalDate(value)).toBe("Jul 7, 2026");
  });

  it("finds the locked mission option for saved entries", () => {
    expect(findJournalMissionOption([mission], "mission-1")).toEqual(mission);
    expect(findJournalMissionOption([mission], "missing")).toBeNull();
  });
});

