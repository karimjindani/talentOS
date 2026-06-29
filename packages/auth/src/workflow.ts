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
