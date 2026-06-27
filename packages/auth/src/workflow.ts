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

export function assertApplicationStatusTransition(from: ApplicationStatus, to: ApplicationStatus): void {
  if (!canTransitionApplicationStatus(from, to)) {
    throw new Error(`Invalid application status transition from ${from} to ${to}.`);
  }
}
