"use server";

import { revalidatePath } from "next/cache";
import { requireTenantAccess } from "@/lib/tenant-guard";
import {
  getPublishedProgramMission,
  listApplicantApplications,
  parseEvidenceUrl,
  saveSubmissionDraft,
  submitSubmission
} from "@talentos/db";

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
    const mission = await getPublishedProgramMission(missionId, tenant.id, acceptedApp.program.id);
    if (!mission) {
      return { ok: false, error: "Mission not found for your program." };
    }

    const repositoryUrl = parseEvidenceUrl(String(formData.get("repositoryUrl") ?? ""), "repository");
    const deploymentUrl = parseEvidenceUrl(String(formData.get("deploymentUrl") ?? ""), "deployment");
    const loomUrl = parseEvidenceUrl(String(formData.get("loomUrl") ?? ""), "loom");
    const journalRaw = String(formData.get("journalMarkdown") ?? "").trim();

    const draft = await saveSubmissionDraft({
      tenantId: tenant.id,
      missionId: mission.id,
      applicantId: actorUserId,
      repositoryUrl,
      deploymentUrl,
      loomUrl,
      journalMarkdown: journalRaw || null
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
