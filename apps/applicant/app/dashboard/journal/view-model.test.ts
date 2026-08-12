import { describe, expect, it } from "vitest";
import {
  findJournalMissionOption,
  groupJournalEntriesByMission,
  isJournalEntryLocked,
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

describe("journal entry lock", () => {
  const linked = { lockedAt: null, missionAssignmentId: "assignment-1" };

  it("locks an entry once its attempt has been submitted", () => {
    expect(isJournalEntryLocked({ ...linked, lockedAt: new Date("2026-08-01") }, false)).toBe(true);
  });

  it("locks a legacy unlinked entry when its mission is locked", () => {
    expect(isJournalEntryLocked({ lockedAt: null, missionAssignmentId: null }, true)).toBe(true);
    expect(isJournalEntryLocked({ lockedAt: null, missionAssignmentId: null }, false)).toBe(false);
  });

  // The detail page deliberately ignores mission-level lock for linked entries: lockedAt is stamped
  // at submit time and is the single source of truth for them.
  it("does not lock a linked entry merely because its mission is locked", () => {
    expect(isJournalEntryLocked(linked, true)).toBe(false);
  });
});

describe("groupJournalEntriesByMission", () => {
  const entry = (
    id: string,
    missionId: string,
    missionTitle: string,
    weekNumber: number,
    attemptNumber: number | null,
    lockedAt: Date | null = null
  ) => ({
    id,
    missionId,
    missionAssignmentId: attemptNumber === null ? null : `assignment-${missionId}`,
    weekNumber,
    lockedAt,
    mission: { title: missionTitle },
    missionAssignment: attemptNumber === null ? null : { attemptNumber }
  });

  // Mirrors the live data: week 2 was repeated, so it is served by two different missions.
  const repeatedWeek = () => [
    entry("e5", "asdf", "asdf", 2, 2),
    entry("e4", "asdf", "asdf", 2, 2),
    entry("e3", "taskpilot", "TaskPilot", 2, 1, new Date("2026-08-08")),
    entry("e1", "waitlist", "Waitlist Page", 1, 1, new Date("2026-08-06"))
  ];

  it("keeps a repeated week as two mission groups, newest attempt first", () => {
    const groups = groupJournalEntriesByMission(repeatedWeek());

    expect(groups.map((group) => group.missionId)).toEqual(["asdf", "taskpilot", "waitlist"]);
    expect(groups[0]).toMatchObject({ weekNumber: 2, attemptNumber: 2, entryCount: 2 });
    expect(groups[1]).toMatchObject({ weekNumber: 2, attemptNumber: 1, entryCount: 1 });
  });

  it("shows the attempt number only for the repeated week", () => {
    const groups = groupJournalEntriesByMission(repeatedWeek());
    expect(groups.map((group) => group.showAttempt)).toEqual([true, true, false]);
  });

  it("orders groups by week descending", () => {
    const groups = groupJournalEntriesByMission(repeatedWeek());
    expect(groups.map((group) => group.weekNumber)).toEqual([2, 2, 1]);
  });

  it("locks a group only when every entry in it is locked", () => {
    const groups = groupJournalEntriesByMission([
      entry("e2", "asdf", "asdf", 2, 2, new Date("2026-08-10")),
      entry("e1", "asdf", "asdf", 2, 2, null)
    ]);
    expect(groups[0].locked).toBe(false);
    expect(groups[0].entries.map((item) => item.locked)).toEqual([true, false]);
  });

  it("preserves the caller's entry order within a group", () => {
    const groups = groupJournalEntriesByMission(repeatedWeek());
    expect(groups[0].entries.map((item) => item.id)).toEqual(["e5", "e4"]);
  });

  it("applies mission-level locks to legacy unlinked entries", () => {
    const groups = groupJournalEntriesByMission(
      [entry("legacy", "old-mission", "Legacy Mission", 1, null)],
      new Set(["old-mission"])
    );
    expect(groups[0]).toMatchObject({ locked: true, attemptNumber: null, showAttempt: false });
  });

  it("returns no groups for an applicant with no entries", () => {
    expect(groupJournalEntriesByMission([])).toEqual([]);
  });
});
