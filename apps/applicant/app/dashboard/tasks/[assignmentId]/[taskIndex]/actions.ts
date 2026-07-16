"use server";

import { revalidatePath } from "next/cache";
import { requireTenantAccess } from "@/lib/tenant-guard";
import {
  markMissionTaskComplete,
  unmarkMissionTaskComplete,
  type MissionTaskIndex
} from "@talentos/db";

export type TaskCompletionFormState = {
  ok: boolean;
  error: string | null;
};

export async function setTaskCompletionAction(
  assignmentId: string,
  taskIndex: MissionTaskIndex,
  complete: boolean,
  _prev: TaskCompletionFormState,
  _formData: FormData
): Promise<TaskCompletionFormState> {
  try {
    const { tenant, actorUserId } = await requireTenantAccess("accessApplicantPortal");
    if (!actorUserId) {
      return { ok: false, error: "Your account is not linked to this organization." };
    }

    if (complete) {
      await markMissionTaskComplete({ tenantId: tenant.id, applicantId: actorUserId, missionAssignmentId: assignmentId, taskIndex });
    } else {
      await unmarkMissionTaskComplete({ tenantId: tenant.id, applicantId: actorUserId, missionAssignmentId: assignmentId, taskIndex });
    }

    revalidatePath(`/dashboard/tasks/${assignmentId}/${taskIndex}`);
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard");
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong. Try again." };
  }
}
