export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "WAITLISTED";

const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW", "ACCEPTED", "REJECTED", "WAITLISTED"],
  UNDER_REVIEW: ["ACCEPTED", "REJECTED", "WAITLISTED"],
  ACCEPTED: [],
  REJECTED: [],
  WAITLISTED: ["ACCEPTED", "REJECTED"]
};

export function canTransitionApplicationStatus(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Valid next statuses for a given status (drives the reviewer's action buttons). */
export function nextStatusesFor(status: ApplicationStatus): ApplicationStatus[] {
  return [...ALLOWED_TRANSITIONS[status]];
}

export function assertApplicationStatusTransition(from: ApplicationStatus, to: ApplicationStatus): void {
  if (!canTransitionApplicationStatus(from, to)) {
    throw new Error(`Invalid application status transition from ${from} to ${to}.`);
  }
}

export type ProgramStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

// Programs can be published, archived and restored to draft; archive is reversible to draft.
const ALLOWED_PROGRAM_TRANSITIONS: Record<ProgramStatus, ProgramStatus[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED", "DRAFT"],
  ARCHIVED: ["DRAFT"]
};

export function canTransitionProgramStatus(from: ProgramStatus, to: ProgramStatus): boolean {
  return ALLOWED_PROGRAM_TRANSITIONS[from].includes(to);
}

/** Valid next statuses for a program (drives the admin's status-action buttons). */
export function nextProgramStatuses(status: ProgramStatus): ProgramStatus[] {
  return [...ALLOWED_PROGRAM_TRANSITIONS[status]];
}

export function assertProgramStatusTransition(from: ProgramStatus, to: ProgramStatus): void {
  if (!canTransitionProgramStatus(from, to)) {
    throw new Error(`Invalid program status transition from ${from} to ${to}.`);
  }
}

export type MissionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

const ALLOWED_MISSION_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED", "DRAFT"],
  ARCHIVED: ["DRAFT"]
};

export function canTransitionMissionStatus(from: MissionStatus, to: MissionStatus): boolean {
  return ALLOWED_MISSION_TRANSITIONS[from].includes(to);
}

export function nextMissionStatuses(status: MissionStatus): MissionStatus[] {
  return [...ALLOWED_MISSION_TRANSITIONS[status]];
}

export function assertMissionStatusTransition(from: MissionStatus, to: MissionStatus): void {
  if (!canTransitionMissionStatus(from, to)) {
    throw new Error(`Invalid mission status transition from ${from} to ${to}.`);
  }
}
