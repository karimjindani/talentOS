"use client";

import { useActionState } from "react";
import { saveSubmissionAction, type SubmissionFormState } from "./actions";

const INITIAL_STATE: SubmissionFormState = { ok: false, error: null };

type SubmissionFormProps = {
  missionId: string;
  defaults: {
    repositoryUrl: string;
    deploymentUrl: string;
    loomUrl: string;
    journalMarkdown: string;
  };
  /** True when this is a resubmission after NEEDS_REVISION. */
  isRevision: boolean;
};

const inputClass =
  "w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 " +
  "focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30";

export function SubmissionForm({ missionId, defaults, isRevision }: SubmissionFormProps) {
  const action = saveSubmissionAction.bind(null, missionId);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="mt-4 grid gap-4">
      {state.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.error}</p>
      ) : null}
      {state.ok && !state.error ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Saved.
        </p>
      ) : null}

      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Git repository URL
        <input
          type="url"
          name="repositoryUrl"
          defaultValue={defaults.repositoryUrl}
          placeholder="https://github.com/your-username/your-mission-repo"
          className={inputClass}
        />
      </label>

      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Deployed application URL
        <input
          type="url"
          name="deploymentUrl"
          defaultValue={defaults.deploymentUrl}
          placeholder="https://your-app.example.com"
          className={inputClass}
        />
      </label>

      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Loom walkthrough URL
        <input
          type="url"
          name="loomUrl"
          defaultValue={defaults.loomUrl}
          placeholder="https://www.loom.com/share/your-demo"
          className={inputClass}
        />
      </label>

      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Engineering journal (Markdown)
        <textarea
          name="journalMarkdown"
          defaultValue={defaults.journalMarkdown}
          rows={8}
          placeholder={"## What I built\n\n## Decisions and trade-offs\n\n## What I learned"}
          className={`${inputClass} font-mono`}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={pending}
          className="cursor-pointer rounded-xl border border-brand-blue px-5 py-2.5 text-sm font-semibold text-brand-blue transition-colors hover:bg-brand-mist disabled:opacity-60"
        >
          Save draft
        </button>
        <button
          type="submit"
          name="intent"
          value="submit"
          disabled={pending}
          className="cursor-pointer rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy disabled:opacity-60"
        >
          {isRevision ? "Resubmit for review" : "Submit for review"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Submitting locks your evidence for review. Your PRD, README, user stories and acceptance criteria
        should live in the Git repository.
      </p>
    </form>
  );
}
