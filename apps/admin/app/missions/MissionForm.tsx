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
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Title</span>
        <input
          name="title"
          required
          defaultValue={mission?.title}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Build a Public Product Landing Page"
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
        </label>
      </div>

      <TextArea name="objective" label="Objective" defaultValue={mission?.objective} rows={3} />
      <TextArea name="brief" label="Mission brief" defaultValue={mission?.brief} rows={6} />
      <TextArea name="deliverables" label="Deliverables" defaultValue={mission?.deliverables} rows={6} />
      <TextArea name="acceptanceCriteria" label="Acceptance criteria" defaultValue={mission?.acceptanceCriteria} rows={6} />
      <TextArea name="evaluationCriteria" label="Evaluation criteria" defaultValue={mission?.evaluationCriteria} rows={5} />

      <label className="block">
        <span className="text-sm font-medium">Competency tags</span>
        <input
          name="competencyTags"
          defaultValue={mission?.competencyTags.join(", ")}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Problem Discovery, Requirements Engineering, AI Collaboration"
        />
        <span className="mt-1 block text-xs text-slate-500">Comma-separated.</span>
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
  rows
}: {
  name: string;
  label: string;
  defaultValue?: string;
  rows: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
      />
    </label>
  );
}
