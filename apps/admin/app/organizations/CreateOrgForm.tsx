"use client";

import { useActionState } from "react";
import { createOrganizationAction, type OrgActionState } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue";

export function CreateOrgForm() {
  const [state, formAction, pending] = useActionState<OrgActionState | null, FormData>(
    createOrganizationAction,
    null
  );

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Create organization</h2>
      <p className="mt-1 text-sm text-slate-500">
        Creates the tenant, assigns its first Org Admin by email, and provisions their Keycloak account
        with the <code>ORG_ADMIN</code> role.
      </p>

      {state && !state.ok ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {state.error}
        </div>
      ) : null}

      {state && state.ok ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p>{state.message}</p>
          {state.tempPassword ? (
            <div className="mt-3">
              <p className="font-semibold">One-time password for {state.email} — copy it now, it is shown only once:</p>
              <code className="mt-1 block break-all rounded bg-white px-3 py-2 font-mono text-base text-slate-900 ring-1 ring-emerald-300">
                {state.tempPassword}
              </code>
            </div>
          ) : null}
        </div>
      ) : null}

      <form action={formAction} className="mt-6 grid max-w-xl gap-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            Organization name
          </label>
          <input id="name" name="name" type="text" required placeholder="Acme Corp" className={inputClass} />
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-slate-700">
            Slug (subdomain)
          </label>
          <input id="slug" name="slug" type="text" placeholder="acme" className={inputClass} />
          <p className="mt-1 text-xs text-slate-500">
            Lowercase letters, numbers and hyphens. Leave blank to derive from the name.
          </p>
        </div>

        <div className="flex flex-wrap gap-6">
          <div>
            <label htmlFor="primaryColor" className="block text-sm font-medium text-slate-700">
              Primary color
            </label>
            <input
              id="primaryColor"
              name="primaryColor"
              type="color"
              defaultValue="#2563eb"
              className="mt-1 h-9 w-14 cursor-pointer rounded border border-slate-300"
            />
          </div>
          <div>
            <label htmlFor="secondaryColor" className="block text-sm font-medium text-slate-700">
              Secondary color
            </label>
            <input
              id="secondaryColor"
              name="secondaryColor"
              type="color"
              defaultValue="#0f172a"
              className="mt-1 h-9 w-14 cursor-pointer rounded border border-slate-300"
            />
          </div>
        </div>

        <div>
          <label htmlFor="adminEmail" className="block text-sm font-medium text-slate-700">
            Org Admin email
          </label>
          <input
            id="adminEmail"
            name="adminEmail"
            type="email"
            required
            placeholder="orgadmin@acme.talentos.local"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="adminName" className="block text-sm font-medium text-slate-700">
            Org Admin name (optional)
          </label>
          <input id="adminName" name="adminName" type="text" placeholder="Acme Org Admin" className={inputClass} />
        </div>

        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create organization"}
          </button>
        </div>
      </form>
    </section>
  );
}
