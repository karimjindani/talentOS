import Link from "next/link";
import { auth } from "@/auth";
import { can } from "@talentos/auth";
import { getTenantContext } from "@talentos/ui";
import { getTenantBySlug, listTenantPrograms } from "@talentos/db";
import { createMissionAction, importMissionSpecAction } from "../actions";
import { MissionForm } from "../MissionForm";

type NewMissionPageProps = {
  searchParams: Promise<{ importError?: string }>;
};

export default async function NewMissionPage({ searchParams }: NewMissionPageProps) {
  const { importError } = await searchParams;
  const session = await auth();
  const canManage = can("manageMissions", {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  });
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const programs = tenant ? await listTenantPrograms(tenant.id) : [];

  if (!canManage) {
    return (
      <>
        <h1 className="text-3xl font-bold">New mission</h1>
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          Your role can view missions but cannot create or edit them.
        </p>
      </>
    );
  }

  if (programs.length === 0) {
    return (
      <>
        <h1 className="text-3xl font-bold">New mission</h1>
        <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
          Create a program before adding missions.
        </p>
        <Link href="/programs/new" className="mt-4 inline-flex rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white">
          Create program
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold">New mission</h1>
      <p className="mt-2 text-slate-600">
        Create a SEM-aligned engineering assignment that helps applicants discover, specify, build,
        test, deploy, and reflect inside one practical mission.
      </p>
      {/*
        Import path (v0.20.0): the five long-form fields are the slow part of this form, and mission
        specs are normally written as documents anyway. Same section convention as the seed corpus,
        so those files upload unchanged. Imports land as DRAFT for review on the mission page.
      */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Import from Markdown</h2>
        <p className="mt-1 text-sm text-slate-600">
          Upload one Markdown file and the title, objective, brief, deliverables, acceptance
          criteria, evaluation criteria and competency tags are filled in for you. The mission is
          created as a <span className="font-semibold">draft</span> so you can review it before
          publishing.
        </p>

        {importError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p className="font-semibold">That file could not be imported.</p>
            <p className="mt-1">{importError}</p>
          </div>
        ) : null}

        <form action={importMissionSpecAction} className="mt-4 grid gap-4" encType="multipart/form-data">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium text-slate-700">
              Program
              <select name="programId" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Select a program
                </option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Week number
              <input name="weekNumber" type="number" min={1} max={4} defaultValue={1} className={inputClass} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Order
              <input name="order" type="number" min={0} defaultValue={0} className={inputClass} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Difficulty
              <select name="difficulty" defaultValue="BEGINNER" className={inputClass}>
                {["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"].map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-sm font-medium text-slate-700">
            Mission spec (.md)
            <input
              name="spec"
              type="file"
              accept=".md,.markdown"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-mist file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-blue"
            />
          </label>

          <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <summary className="cursor-pointer font-semibold text-slate-700">Required format</summary>
            <p className="mt-2">
              A level-1 title line, then these sections. Anything else in the file is ignored.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 text-xs leading-5 text-slate-700">
{`# Mission title

## Objective
## Mission Brief
## Deliverables
## Acceptance Criteria
## Evaluation Criteria
## Competency Tags
- Problem Discovery
- Communication`}
            </pre>
            <a href="/mission-spec-template.md" download className="mt-3 inline-flex font-semibold text-brand-blue hover:underline">
              Download a template
            </a>
          </details>

          <div>
            <button type="submit" className="rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white">
              Import as draft
            </button>
          </div>
        </form>
      </section>

      <div className="mt-10 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">or fill in manually</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <MissionForm action={createMissionAction} programs={programs} submitLabel="Create mission" />
    </>
  );
}

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
