"use server";

import { revalidatePath } from "next/cache";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { markApplicantTaskCompleted } from "@talentos/db";

export type TaskCompletionState = {
  ok: boolean;
  error: string | null;
};

export async function completeTaskAction(
  taskId: string,
  missionAssignmentId: string,
  _previous: TaskCompletionState
): Promise<TaskCompletionState> {
  try {
    const { tenant, actorUserId } = await requireTenantAccess("accessApplicantPortal");
    if (!actorUserId) {
      return { ok: false, error: "Your account is not linked to this organization." };
    }

    await markApplicantTaskCompleted({
      tenantId: tenant.id,
      applicantId: actorUserId,
      taskId,
      missionAssignmentId
    });
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/program");
    revalidatePath("/dashboard/missions");
    // The Mission Workspace (v0.20.0) shows these learning tasks inline, so refresh it too.
    revalidatePath("/dashboard/missions/[id]", "page");
    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Task completion could not be saved."
    };
  }
}
