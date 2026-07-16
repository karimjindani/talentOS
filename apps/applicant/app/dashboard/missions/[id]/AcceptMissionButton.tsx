"use client";

import { useActionState } from "react";
import { acceptMissionAction, type AcceptMissionFormState } from "./actions";

const INITIAL_STATE: AcceptMissionFormState = { ok: false, error: null };

export function AcceptMissionButton({ missionId }: { missionId: string }) {
  const action = acceptMissionAction.bind(null, missionId);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="mt-4 grid gap-3">
      {state.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.error}</p>
      ) : null}
      <p className="text-sm text-slate-600">
        Accepting starts your deadline countdown for this mission. You won&apos;t be able to submit evidence until
        you accept.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="w-fit cursor-pointer rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy disabled:opacity-60"
      >
        Accept Mission
      </button>
    </form>
  );
}
