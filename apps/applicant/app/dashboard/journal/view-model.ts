export type JournalModeSearchParams = {
  mode?: string | string[];
};

export type JournalMissionOption = {
  id: string;
  title: string;
  weekNumber: number;
};

export function isJournalEditMode(searchParams: JournalModeSearchParams | null | undefined): boolean {
  const mode = Array.isArray(searchParams?.mode) ? searchParams?.mode[0] : searchParams?.mode;
  return mode === "edit";
}

export function getJournalEntryPageTitle(editMode: boolean): string {
  return editMode ? "Edit journal entry" : "Journal entry";
}

export function toJournalDateInput(value: Date): string {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatJournalDate(value: Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

// Generic so callers keep any extra fields they attach (e.g. startedAt for the entry-date bound).
export function getDefaultNewJournalMission<TMission extends JournalMissionOption>(
  missions: TMission[]
): TMission | null {
  return missions.length === 1 ? missions[0] : null;
}

export function findJournalMissionOption<TMission extends JournalMissionOption>(
  missions: TMission[],
  missionId: string
): TMission | null {
  return missions.find((mission) => mission.id === missionId) ?? null;
}


// ---------------------------------------------------------------------------
// Journal tab grouping (v0.20.0)
// ---------------------------------------------------------------------------

/** The subset of an entry these helpers need — keeps them testable without Prisma types. */
export type GroupableJournalEntry = {
  id: string;
  missionId: string;
  missionAssignmentId: string | null;
  weekNumber: number;
  lockedAt: Date | null;
  mission: { title: string };
  missionAssignment: { attemptNumber: number } | null;
};

export type JournalMissionGroup<TEntry extends GroupableJournalEntry> = {
  missionId: string;
  missionTitle: string;
  weekNumber: number;
  /** Null for legacy entries written before assignments were linked. */
  attemptNumber: number | null;
  /** True when the week has more than one mission group, i.e. it was repeated. */
  showAttempt: boolean;
  entryCount: number;
  /** True only when every entry in the group is locked. */
  locked: boolean;
  entries: Array<TEntry & { locked: boolean }>;
};

/**
 * Whether an entry can still be edited.
 *
 * Mirrors `/dashboard/journal/[id]`: once an attempt is submitted, `submitSubmission` stamps
 * `lockedAt` on its entries, so for assignment-linked entries that field is the whole answer. The
 * mission-level fallback applies only to legacy entries that predate assignment linking — a linked
 * entry is deliberately NOT locked just because its mission is.
 */
export function isJournalEntryLocked(
  entry: Pick<GroupableJournalEntry, "lockedAt" | "missionAssignmentId">,
  missionLocked: boolean
): boolean {
  return Boolean(entry.lockedAt) || (!entry.missionAssignmentId && missionLocked);
}

/**
 * Groups entries into one collapsible section per mission, newest work first.
 *
 * Grouping is by mission rather than by week on purpose: a repeated week is served by a *different*
 * mission, so week 2 legitimately yields two groups. Merging them would mix the reflections from a
 * failed attempt with those from its retry.
 *
 * Entry order within a group is preserved from the caller (the query already sorts entryDate desc).
 */
export function groupJournalEntriesByMission<TEntry extends GroupableJournalEntry>(
  entries: TEntry[],
  lockedMissionIds: ReadonlySet<string> = new Set()
): Array<JournalMissionGroup<TEntry>> {
  const groups = new Map<string, JournalMissionGroup<TEntry>>();

  for (const entry of entries) {
    const locked = isJournalEntryLocked(entry, lockedMissionIds.has(entry.missionId));
    const existing = groups.get(entry.missionId);
    if (existing) {
      existing.entries.push({ ...entry, locked });
      existing.entryCount += 1;
      existing.locked = existing.locked && locked;
      continue;
    }
    groups.set(entry.missionId, {
      missionId: entry.missionId,
      missionTitle: entry.mission.title,
      weekNumber: entry.weekNumber,
      attemptNumber: entry.missionAssignment?.attemptNumber ?? null,
      showAttempt: false,
      entryCount: 1,
      locked,
      entries: [{ ...entry, locked }]
    });
  }

  const ordered = [...groups.values()].sort(
    (a, b) => b.weekNumber - a.weekNumber || (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0)
  );

  // Only surface "Attempt N" where it disambiguates, so the common single-attempt week stays clean.
  const groupsPerWeek = new Map<number, number>();
  for (const group of ordered) {
    groupsPerWeek.set(group.weekNumber, (groupsPerWeek.get(group.weekNumber) ?? 0) + 1);
  }
  for (const group of ordered) {
    group.showAttempt = group.attemptNumber !== null && (groupsPerWeek.get(group.weekNumber) ?? 0) > 1;
  }

  return ordered;
}
