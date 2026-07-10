"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveJournalEntryAction, type JournalFormState } from "./actions";

const INITIAL_STATE: JournalFormState = { ok: false, error: null, existingEntryId: null };
const LANGUAGE_PRESETS = ["English", "Roman Urdu", "Roman Hindi"] as const;

type MissionOption = {
  id: string;
  title: string;
  weekNumber: number;
};

export type JournalEntryFormDefaults = {
  missionId: string;
  entryDate: string;
  language: string;
  workedOn: string;
  challenge: string;
  solution: string;
  learned: string;
  aiUsage: string;
  confidenceRating: number;
  timeSpentHours: number;
  evidenceLinks: string[];
};

type JournalEntryFormProps = {
  entryId?: string | null;
  missions: MissionOption[];
  lockedMission?: MissionOption | null;
  defaults: JournalEntryFormDefaults;
  submitLabel: string;
  missionHelpText?: string;
};

const inputClass =
  "w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 " +
  "focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30";

export function JournalEntryForm({
  entryId = null,
  missions,
  lockedMission = null,
  defaults,
  submitLabel,
  missionHelpText
}: JournalEntryFormProps) {
  const action = saveJournalEntryAction.bind(null, entryId);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const defaultPreset = LANGUAGE_PRESETS.includes(defaults.language as (typeof LANGUAGE_PRESETS)[number])
    ? defaults.language
    : "Other";
  const [languagePreset, setLanguagePreset] = useState(defaultPreset);

  return (
    <form action={formAction} className="mt-6 grid max-w-4xl gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {state.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p>{state.error}</p>
          {state.existingEntryId ? (
            <Link href={`/dashboard/journal/${state.existingEntryId}?mode=edit`} className="mt-2 inline-flex font-semibold text-rose-800 underline">
              Edit existing entry
            </Link>
          ) : null}
        </div>
      ) : null}
      {state.ok && !state.error ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Journal entry saved.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {lockedMission ? (
          <div className="grid gap-1.5 text-sm font-medium text-slate-700">
            Mission
            <input type="hidden" name="missionId" value={lockedMission.id} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900">
              Week {lockedMission.weekNumber} - {lockedMission.title}
            </div>
            {missionHelpText ? <p className="text-xs font-normal text-slate-500">{missionHelpText}</p> : null}
          </div>
        ) : (
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Assigned mission
            <select name="missionId" defaultValue={defaults.missionId} required className={inputClass}>
              <option value="">Select an assigned mission</option>
              {missions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  Week {mission.weekNumber} - {mission.title}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-slate-500">
              Only missions assigned to you are available.
            </span>
          </label>
        )}

        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Entry date
          <input type="date" name="entryDate" defaultValue={defaults.entryDate} required className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Journal language
          <select
            name="languagePreset"
            value={languagePreset}
            onChange={(event) => setLanguagePreset(event.target.value)}
            className={inputClass}
          >
            {LANGUAGE_PRESETS.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
            <option value="Other">Other / Custom</option>
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Custom language
          <input
            name="customLanguage"
            defaultValue={defaultPreset === "Other" ? defaults.language : ""}
            placeholder="Punjabi, Arabic, Spanish..."
            className={inputClass}
            disabled={languagePreset !== "Other"}
          />
        </label>
      </div>

      <TextArea
        name="workedOn"
        label="What did you work on today?"
        defaultValue={defaults.workedOn}
        placeholder="Describe the feature, bug, test, design, deployment, or document you worked on."
      />
      <TextArea
        name="challenge"
        label="What challenge did you face?"
        defaultValue={defaults.challenge}
        placeholder="Explain the blocker, confusion, bug, trade-off, or decision you ran into."
      />
      <TextArea
        name="solution"
        label="How did you solve it?"
        defaultValue={defaults.solution}
        placeholder="Describe your debugging steps, research, design decision, or support you used."
      />
      <TextArea
        name="learned"
        label="What did you learn?"
        defaultValue={defaults.learned}
        placeholder="Write the main takeaway you want your future self, mentor, or recruiter to see."
      />
      <TextArea
        name="aiUsage"
        label="AI usage"
        defaultValue={defaults.aiUsage}
        placeholder="Mention if and how you used AI. If you did not use AI, write 'No AI used today.'"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Confidence rating
          <select name="confidenceRating" defaultValue={defaults.confidenceRating} className={inputClass}>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Time spent (hours)
          <input
            type="number"
            name="timeSpentHours"
            min="0.25"
            max="24"
            step="0.25"
            defaultValue={defaults.timeSpentHours}
            className={inputClass}
          />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Evidence links
        <textarea
          name="evidenceLinks"
          defaultValue={defaults.evidenceLinks.join("\n")}
          rows={4}
          placeholder={"https://github.com/your/repo/pull/1\nhttps://your-demo.example.com"}
          className={inputClass}
        />
        <span className="text-xs font-normal text-slate-500">One URL per line. GitHub, PR, deployment, video, or other evidence links are fine.</span>
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending || (!lockedMission && missions.length === 0)}
          className="cursor-pointer rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function TextArea({
  name,
  label,
  defaultValue,
  placeholder
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <textarea name={name} defaultValue={defaultValue} rows={4} placeholder={placeholder} className={inputClass} />
    </label>
  );
}
