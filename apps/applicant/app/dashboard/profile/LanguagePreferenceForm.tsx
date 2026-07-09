"use client";

import { useActionState, useState } from "react";
import { updateLanguagePreferenceAction, type LanguagePreferenceState } from "./actions";

const INITIAL_STATE: LanguagePreferenceState = { ok: false, error: null };
const LANGUAGE_PRESETS = ["English", "Roman Urdu", "Roman Hindi"] as const;

export function LanguagePreferenceForm({ defaultLanguage }: { defaultLanguage: string }) {
  const defaultPreset = LANGUAGE_PRESETS.includes(defaultLanguage as (typeof LANGUAGE_PRESETS)[number])
    ? defaultLanguage
    : "Other";
  const [languagePreset, setLanguagePreset] = useState(defaultPreset);
  const [state, formAction, pending] = useActionState(updateLanguagePreferenceAction, INITIAL_STATE);

  return (
    <form action={formAction} className="mt-4 grid gap-4">
      {state.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.error}</p>
      ) : null}
      {state.ok && !state.error ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Preferred journal language saved.
        </p>
      ) : null}

      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Preferred Journal Language
        <select
          name="languagePreset"
          value={languagePreset}
          onChange={(event) => setLanguagePreset(event.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
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
          defaultValue={defaultPreset === "Other" ? defaultLanguage : ""}
          disabled={languagePreset !== "Other"}
          placeholder="Punjabi, Arabic, Spanish..."
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30 disabled:bg-slate-50"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-fit cursor-pointer rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy disabled:opacity-60"
      >
        Save language
      </button>
    </form>
  );
}
