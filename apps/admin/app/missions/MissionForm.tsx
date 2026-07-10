import Link from "next/link";
import type { Mission, Program } from "@talentos/db";

export function MissionForm({
  action,
  programs,
  mission,
  submitLabel
}: {
  action: (formData: FormData) => Promise<void>;
  programs: Program[];
  mission?: Mission;
  submitLabel: string;
}) {
  return (
    <form action={action} className="mt-8 max-w-4xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {mission ? <input type="hidden" name="missionId" value={mission.id} /> : null}

      <div className="border-l-4 border-brand-blue bg-brand-mist px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">SEM authoring guide</p>
        <p className="mt-1">
          Use this mission to guide applicants through the full SEM loop: discover, specify, design,
          build, test, deploy, present, reflect.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Program</span>
          <select
            name="programId"
            required
            defaultValue={mission?.programId ?? programs[0]?.id ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500">
            Applicants only see published missions for their accepted program.
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Difficulty</span>
          <select
            name="difficulty"
            defaultValue={mission?.difficulty ?? "BEGINNER"}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="BEGINNER">BEGINNER</option>
            <option value="INTERMEDIATE">INTERMEDIATE</option>
            <option value="ADVANCED">ADVANCED</option>
            <option value="EXPERT">EXPERT</option>
          </select>
          <span className="mt-1 block text-xs text-slate-500">
            Sets expected complexity only; it does not change access, grading, or workflow.
          </span>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Title</span>
        <input
          name="title"
          required
          defaultValue={mission?.title}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Build and ship a scoped customer-support triage tool"
        />
      </label>

      {!mission ? (
        <label className="block max-w-xs">
          <span className="text-sm font-medium">Status</span>
          <select name="status" defaultValue="DRAFT" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="DRAFT">DRAFT</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
          <span className="mt-1 block text-xs text-slate-500">
            Draft stays staff-only. Published appears to accepted applicants in this program. Archived is hidden from
            applicant mission lists.
          </span>
        </label>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Week number</span>
          <input
            name="weekNumber"
            type="number"
            min="1"
            defaultValue={mission?.weekNumber ?? 1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-slate-500">Used to sequence missions in the program.</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Display order</span>
          <input
            name="order"
            type="number"
            min="0"
            defaultValue={mission?.order ?? 0}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-slate-500">Sorts missions within the same week.</span>
        </label>
      </div>

      <TextArea
        name="objective"
        label="Objective"
        defaultValue={mission?.objective}
        rows={3}
        placeholder="By the end, applicants can turn an ambiguous product request into a working deployed feature."
        helpText="State the learning outcome, not just the task."
      />
      <TextArea
        name="brief"
        label="Mission brief"
        defaultValue={mission?.brief}
        rows={6}
        placeholder="Describe the customer/problem context, constraints, expected outcome, and available resources."
        helpText="Frame the real-world situation applicants are solving."
      />
      <TextArea
        name="deliverables"
        label="Deliverables"
        defaultValue={mission?.deliverables}
        rows={6}
        placeholder="GitHub repository, deployed URL, Loom walkthrough, Engineering Journal, README."
        helpText="List the evidence applicants must submit or maintain."
      />
      <TextArea
        name="acceptanceCriteria"
        label="Acceptance criteria"
        defaultValue={mission?.acceptanceCriteria}
        rows={6}
        placeholder="The deployed app supports the core flow; README has setup steps; journal explains tradeoffs."
        helpText="Define the minimum bar for acceptance."
      />
      <TextArea
        name="evaluationCriteria"
        label="Evaluation criteria"
        defaultValue={mission?.evaluationCriteria}
        rows={5}
        placeholder="Requirements clarity, product correctness, code quality, testing evidence, deployment readiness, communication."
        helpText="Describe how staff should judge quality during review."
      />

      <label className="block">
        <span className="text-sm font-medium">Competency tags</span>
        <input
          name="competencyTags"
          defaultValue={mission?.competencyTags.join(", ")}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Requirements Engineering, AI Collaboration, Production Readiness"
        />
        <span className="mt-1 block text-xs text-slate-500">
          Comma-separated. Accepted submissions become evidence for these competencies, so keep tag names consistent.
        </span>
      </label>

      <div className="flex gap-3">
        <button type="submit" className="rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white">
          {submitLabel}
        </button>
        <Link href="/missions" className="rounded-xl border border-slate-300 px-5 py-3 font-semibold">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function TextArea({
  name,
  label,
  defaultValue,
  rows,
  placeholder,
  helpText
}: {
  name: string;
  label: string;
  defaultValue?: string;
  rows: number;
  placeholder?: string;
  helpText?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
      />
      {helpText ? <span className="mt-1 block text-xs text-slate-500">{helpText}</span> : null}
    </label>
  );
}
