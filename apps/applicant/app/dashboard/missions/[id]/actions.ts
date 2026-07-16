"use server";

import { revalidatePath } from "next/cache";
import { requireTenantAccess } from "@/lib/tenant-guard";
import {
  acceptMissionAssignment,
  getAssignedProgramMission,
  getLatestMissionAssignmentForMission,
  listApplicantApplications,
  normalizeDeploymentUrls,
  parseEvidenceUrl,
  saveSubmissionDraft,
  submitSubmission
} from "@talentos/db";

export type AcceptMissionFormState = {
  ok: boolean;
  error: string | null;
};

/** The applicant's explicit "Accept Mission" action — starts the deadline/grace countdown. */
export async function acceptMissionAction(
  missionId: string,
  _prev: AcceptMissionFormState,
  _formData: FormData
): Promise<AcceptMissionFormState> {
  try {
    const { tenant, actorUserId } = await requireTenantAccess("accessApplicantPortal");
    if (!actorUserId) {
      return { ok: false, error: "Your account is not linked to this organization." };
    }

    const assignment = await getLatestMissionAssignmentForMission(tenant.id, actorUserId, missionId);
    if (!assignment) {
      return { ok: false, error: "Mission is not assigned to your account." };
    }

    await acceptMissionAssignment({
      tenantId: tenant.id,
      applicantId: actorUserId,
      missionAssignmentId: assignment.id
    });

    revalidatePath(`/dashboard/missions/${missionId}`);
    revalidatePath("/dashboard/missions");
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong. Try again." };
  }
}

export type SubmissionFormState = {
  ok: boolean;
  error: string | null;
};

/**
 * Save (and optionally submit) the signed-in applicant's evidence for a mission (v0.15.0, D-067).
 * Guarded by the tenant-membership guard (D-065) plus the accepted-application → published-mission
 * chain, mirroring the mission detail page. The DB helpers re-enforce tenant scoping, ownership and
 * the status machine as defense in depth.
 */
export async function saveSubmissionAction(
  missionId: string,
  _prev: SubmissionFormState,
  formData: FormData
): Promise<SubmissionFormState> {
  try {
    const { tenant, actorUserId } = await requireTenantAccess("accessApplicantPortal");
    if (!actorUserId) {
      return { ok: false, error: "Your account is not linked to this organization." };
    }

    // The mission must be a published mission of the applicant's accepted program.
    const applications = await listApplicantApplications(actorUserId, tenant.id);
    const acceptedApp = applications.find((application) => application.status === "ACCEPTED");
    if (!acceptedApp) {
      return { ok: false, error: "Missions are available after your application is accepted." };
    }
    const mission = await getAssignedProgramMission(missionId, tenant.id, actorUserId, acceptedApp.program.id);
    if (!mission) {
      return { ok: false, error: "Mission is not assigned to your account." };
    }

    const repositoryUrl = parseEvidenceUrl(String(formData.get("repositoryUrl") ?? ""), "repository");
    const deploymentUrl = normalizeDeploymentUrls(String(formData.get("deploymentUrl") ?? ""));
    const loomUrl = parseEvidenceUrl(String(formData.get("loomUrl") ?? ""), "loom");

    const draft = await saveSubmissionDraft({
      tenantId: tenant.id,
      missionId: mission.id,
      applicantId: actorUserId,
      repositoryUrl,
      deploymentUrl,
      loomUrl
    });

    if (formData.get("intent") === "submit") {
      await submitSubmission({ id: draft.id, tenantId: tenant.id, applicantId: actorUserId });
    }

    revalidatePath(`/dashboard/missions/${mission.id}`);
    revalidatePath("/dashboard/missions");
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong. Try again." };
  }
}
