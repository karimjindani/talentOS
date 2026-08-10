export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "WAITLISTED"
  | "DISQUALIFIED"
  | "AWAITING_MISSION_ASSIGNMENT";

// DISQUALIFIED and AWAITING_MISSION_ASSIGNMENT are set by system automation (the deadline sweep and
// the reject-with-no-alternate-mission path), not by an admin action through this transition table —
// they're terminal here, same as ACCEPTED/REJECTED, so no reviewer action button offers a way out.
const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW", "ACCEPTED", "REJECTED", "WAITLISTED"],
  UNDER_REVIEW: ["ACCEPTED", "REJECTED", "WAITLISTED"],
  ACCEPTED: [],
  REJECTED: [],
  WAITLISTED: ["ACCEPTED", "REJECTED"],
  DISQUALIFIED: [],
  AWAITING_MISSION_ASSIGNMENT: []
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

export type SubmissionStatus = "DRAFT" | "SUBMITTED" | "REVIEWED" | "NEEDS_REVISION" | "ACCEPTED" | "REPEAT";

// Mission-submission review loop (v0.15.0, D-067). The SEM revision loop is
// DRAFT → SUBMITTED → (ACCEPTED | NEEDS_REVISION | REPEAT) with NEEDS_REVISION → SUBMITTED for resubmission.
// ACCEPTED and REPEAT are terminal for one attempt. The REVIEWED enum
// value is retained in the schema but unused by MVP-1 (removing PostgreSQL enum values is not worth
// the migration risk).
const ALLOWED_SUBMISSION_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["ACCEPTED", "NEEDS_REVISION", "REPEAT"],
  REVIEWED: [],
  NEEDS_REVISION: ["SUBMITTED"],
  ACCEPTED: [],
  REPEAT: []
};

export function canTransitionSubmissionStatus(from: SubmissionStatus, to: SubmissionStatus): boolean {
  return ALLOWED_SUBMISSION_TRANSITIONS[from].includes(to);
}

/** Valid next statuses for a submission (drives the reviewer's action buttons). */
export function nextSubmissionStatuses(status: SubmissionStatus): SubmissionStatus[] {
  return [...ALLOWED_SUBMISSION_TRANSITIONS[status]];
}

export function assertSubmissionStatusTransition(from: SubmissionStatus, to: SubmissionStatus): void {
  if (!canTransitionSubmissionStatus(from, to)) {
    throw new Error(`Invalid submission status transition from ${from} to ${to}.`);
  }
}

/** True while the applicant may still edit the evidence fields (before/again between reviews). */
export function isSubmissionEditable(status: SubmissionStatus): boolean {
  return status === "DRAFT" || status === "NEEDS_REVISION";
}
