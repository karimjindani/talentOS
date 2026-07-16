"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveSubmissionAction, type SubmissionFormState } from "./actions";

const INITIAL_STATE: SubmissionFormState = { ok: false, error: null };

type SubmissionFormProps = {
  missionId: string;
  defaults: {
    repositoryUrl: string;
    deploymentUrl: string;
    loomUrl: string;
  };
  readiness: {
    tasks: { required: number; completed: number; incomplete: Array<{ id: string; title: string }> };
    journals: { required: number; completed: number };
  } | null;
  /** True when this is a resubmission after NEEDS_REVISION. */
  isRevision: boolean;
  /** False until Tasks 1 & 2 (Review Brief, Study Tutorial) are checked off. */
  canSubmit: boolean;
};

const inputClass =
  "w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 " +
  "focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30";

export function SubmissionForm({ missionId, defaults, isRevision, readiness, canSubmit }: SubmissionFormProps) {
  const action = saveSubmissionAction.bind(null, missionId);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const [repositoryUrl, setRepositoryUrl] = useState(defaults.repositoryUrl);
  const [deploymentUrl, setDeploymentUrl] = useState(defaults.deploymentUrl);
  const [loomUrl, setLoomUrl] = useState(defaults.loomUrl);
  const tasksReady = Boolean(readiness && readiness.tasks.completed === readiness.tasks.required);
  const journalsReady = Boolean(readiness && readiness.journals.completed >= readiness.journals.required);
  const urlsPresent = Boolean(repositoryUrl.trim() && deploymentUrl.trim() && loomUrl.trim());
  const knownRequirementsReady = canSubmit && tasksReady && journalsReady && urlsPresent;

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
          value={repositoryUrl}
          onChange={(event) => setRepositoryUrl(event.target.value)}
          placeholder="https://github.com/your-username/your-mission-repo"
          className={inputClass}
        />
      </label>

      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Deployed application URL(s)
        <input
          type="text"
          name="deploymentUrl"
          value={deploymentUrl}
          onChange={(event) => setDeploymentUrl(event.target.value)}
          placeholder="https://app.example.com; https://api.example.com"
          className={inputClass}
        />
        <span className="text-xs font-normal text-slate-500">
          Enter one or more public URLs. Separate multiple URLs with a semicolon (;).
        </span>
      </label>

      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Loom walkthrough URL
        <input
          type="url"
          name="loomUrl"
          value={loomUrl}
          onChange={(event) => setLoomUrl(event.target.value)}
          placeholder="https://www.loom.com/share/your-demo"
          className={inputClass}
        />
      </label>

      <p className="rounded-xl border border-brand-mist bg-brand-mist/40 px-4 py-3 text-sm text-slate-700">
        Write your daily reflection in the{" "}
        <Link href="/dashboard/journal" className="font-semibold text-brand-blue underline">
          Engineering Journal
        </Link>
        .
      </p>

      <section className="border-y border-slate-200 py-4" aria-labelledby="submission-checklist-heading">
        <h3 id="submission-checklist-heading" className="font-semibold text-slate-900">Submission checklist</h3>
        <div className="mt-3 grid gap-2 text-sm">
          <ChecklistItem complete={canSubmit} text="Mission steps Review Brief and Study Tutorial completed" />
          <ChecklistItem
            complete={tasksReady}
            text={`${readiness?.tasks.completed ?? 0} of ${readiness?.tasks.required ?? 0} required weekly tasks completed`}
          />
          <ChecklistItem
            complete={journalsReady}
            text={`${readiness?.journals.completed ?? 0} of ${readiness?.journals.required ?? 4} Engineering Journal entries completed`}
          />
          <ChecklistItem complete={Boolean(repositoryUrl.trim())} text="GitHub repository URL provided" />
          <ChecklistItem complete={false} status="Checked on submit" text="GitHub repository is publicly accessible" />
          <ChecklistItem complete={Boolean(deploymentUrl.trim())} text="Deployed application URL(s) provided" />
          <ChecklistItem complete={false} status="Checked on submit" text="Every deployed application URL is publicly accessible" />
          <ChecklistItem complete={Boolean(loomUrl.trim())} text="Loom walkthrough URL provided" />
          <ChecklistItem complete={false} status="Checked on submit" text="Loom walkthrough is publicly accessible" />
        </div>
        {readiness?.tasks.incomplete.length ? (
          <p className="mt-3 text-xs text-amber-800">
            Blocking tasks: {readiness.tasks.incomplete.map((task) => task.title).join(", ")}.
          </p>
        ) : null}
        <p className="mt-3 text-xs text-slate-500">
          Public access to the repository, every deployed application URL and the Loom walkthrough is checked when you submit for review.
        </p>
      </section>

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
          disabled={pending || !knownRequirementsReady}
          title={
            canSubmit
              ? undefined
              : "Complete the Review Brief and Study Tutorial mission steps before submitting for review."
          }
          className="cursor-pointer rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy disabled:cursor-not-allowed disabled:opacity-60"
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

function ChecklistItem({ complete, text, status }: { complete: boolean; text: string; status?: string }) {
  const pendingCheck = Boolean(status);
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-700">{text}</span>
      <span
        className={`shrink-0 text-xs font-semibold ${
          complete ? "text-emerald-700" : pendingCheck ? "text-slate-500" : "text-amber-700"
        }`}
      >
        {status ?? (complete ? "Complete" : "Required")}
      </span>
    </div>
  );
}
