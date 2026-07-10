"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  assertSubmissionStatusTransition,
  assertTenantScopedAccess,
  type SubmissionStatus
} from "@talentos/auth";
import { getTenantSubmission, getUserByEmail, reviewSubmission } from "@talentos/db";
import { requireTenantAccess } from "@/lib/tenant-guard";

/**
 * Review a mission submission (v0.15.0, D-067): accept it or request changes with written feedback.
 * Gated on the reviewSubmissions capability (ORG_ADMIN / TECH_LEAD; SUPER_ADMIN bypass) bound to the
 * Host-resolved tenant (D-051). The DB helper re-enforces tenant scoping and the SUBMITTED-only
 * transition, and notifies the applicant in the same transaction.
 */
export async function reviewSubmissionAction(formData: FormData) {
  const { tenant, actorUserId } = await requireTenantAccess("reviewSubmissions");

  // SUPER_ADMIN may review without a membership in this tenant; attribute the review to their
  // DB user row (backfilled at login by linkKeycloakIdentity).
  let reviewerUserId = actorUserId;
  if (!reviewerUserId) {
    const session = await auth();
    const reviewer = session?.user?.email ? await getUserByEmail(session.user.email) : null;
    reviewerUserId = reviewer?.id ?? null;
  }
  if (!reviewerUserId) {
    throw new Error("Reviewer account is not linked to a platform user.");
  }

  const id = String(formData.get("submissionId") ?? "");
  const decision = String(formData.get("decision") ?? "") as SubmissionStatus;
  if (decision !== "ACCEPTED" && decision !== "NEEDS_REVISION" && decision !== "REPEAT") {
    throw new Error("Invalid review decision.");
  }

  const reviewerFeedback = String(formData.get("reviewerFeedback") ?? "").trim();
  if ((decision === "NEEDS_REVISION" || decision === "REPEAT") && !reviewerFeedback) {
    throw new Error("Written feedback is required when requesting changes or a repeat week.");
  }

  const existing = await getTenantSubmission(id, tenant.id);
  if (!existing) {
    throw new Error("Submission not found.");
  }
  assertTenantScopedAccess(existing.tenantId, tenant.id);
  assertSubmissionStatusTransition(existing.status, decision);

  await reviewSubmission({
    id,
    tenantId: tenant.id,
    status: decision,
    reviewerFeedback,
    reviewerUserId
  });

  revalidatePath(`/missions/${existing.missionId}`);
  revalidatePath(`/missions/${existing.missionId}/submissions/${id}`);
}
