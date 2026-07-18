"use client";

import { useActionState } from "react";
import { completeTaskAction, type TaskCompletionState } from "./actions";

const INITIAL_STATE: TaskCompletionState = { ok: false, error: null };

export function TaskCompletionButton({
  taskId,
  missionAssignmentId
}: {
  taskId: string;
  missionAssignmentId: string;
}) {
  const action = completeTaskAction.bind(null, taskId, missionAssignmentId);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="grid justify-items-end gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy disabled:opacity-60"
      >
        {pending ? "Saving..." : "Mark complete"}
      </button>
      {state.error ? <p className="max-w-xs text-right text-xs text-rose-700">{state.error}</p> : null}
    </form>
  );
}
