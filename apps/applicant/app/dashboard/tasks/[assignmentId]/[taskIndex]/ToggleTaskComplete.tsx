"use client";

import { useActionState } from "react";
import { setTaskCompletionAction, type TaskCompletionFormState } from "./actions";
import type { MissionTaskIndex } from "@talentos/db";

const INITIAL_STATE: TaskCompletionFormState = { ok: false, error: null };

export function ToggleTaskComplete({
  assignmentId,
  taskIndex,
  complete,
  disabled = false,
  disabledReason,
  lockedReason = null
}: {
  assignmentId: string;
  taskIndex: MissionTaskIndex;
  complete: boolean;
  /** Blocks only the "mark as complete" direction (e.g. video not watched yet) — un-completing is never blocked. */
  disabled?: boolean;
  disabledReason?: string;
  /** Set when the assignment's lifecycle status freezes the checklist (v0.19.4) — replaces the toggle entirely. */
  lockedReason?: string | null;
}) {
  const action = setTaskCompletionAction.bind(null, assignmentId, taskIndex, !complete);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const blocked = !complete && disabled;

  if (lockedReason) {
    return (
      <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {lockedReason}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-4">
      {state.error ? (
        <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending || blocked}
        className={`cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          complete
            ? "border border-slate-200 text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            : "bg-brand-blue text-white hover:bg-brand-navy"
        }`}
      >
        {complete ? "Mark as not complete" : "Mark as complete"}
      </button>
      {blocked && disabledReason ? <p className="mt-2 text-xs text-slate-500">{disabledReason}</p> : null}
    </form>
  );
}
