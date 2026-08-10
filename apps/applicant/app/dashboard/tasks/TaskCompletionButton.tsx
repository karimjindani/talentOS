"use client";

import { useActionState } from "react";
import { completeTaskAction, type TaskCompletionState } from "./actions";

const INITIAL_STATE: TaskCompletionState = { ok: false, error: null };

export function TaskCompletionButton({
  taskId,
  missionAssignmentId,
  disabled = false,
  disabledReason
}: {
  taskId: string;
  missionAssignmentId: string;
  /** Blocks completion (e.g. required video not yet watched to 90%). */
  disabled?: boolean;
  disabledReason?: string;
}) {
  const action = completeTaskAction.bind(null, taskId, missionAssignmentId);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="grid justify-items-start gap-2">
      <button
        type="submit"
        disabled={pending || disabled}
        title={disabled ? disabledReason : undefined}
        className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving..." : "Mark complete"}
      </button>
      {disabled && disabledReason ? <p className="text-xs text-slate-500">{disabledReason}</p> : null}
      {state.error ? <p className="max-w-xs text-xs text-rose-700">{state.error}</p> : null}
    </form>
  );
}
