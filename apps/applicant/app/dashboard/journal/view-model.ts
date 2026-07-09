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

export function getDefaultNewJournalMission(missions: JournalMissionOption[]): JournalMissionOption | null {
  return missions.length === 1 ? missions[0] : null;
}

export function findJournalMissionOption(
  missions: JournalMissionOption[],
  missionId: string
): JournalMissionOption | null {
  return missions.find((mission) => mission.id === missionId) ?? null;
}

