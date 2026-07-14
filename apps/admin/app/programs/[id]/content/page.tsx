import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import { can } from "@talentos/auth";
import { getTenantBySlug, getTenantProgram, listCalendarEvents } from "@talentos/db";
import {
  createCalendarEventAction,
  deleteCalendarEventAction,
  updateCalendarEventAction
} from "./actions";

type ProgramContentPageProps = {
  params: Promise<{ id: string }>;
};

function toDateTimeInput(value: Date | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
const labelClass = "block text-xs font-medium text-slate-600";
const deleteButtonClass = "rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700";
const saveButtonClass = "rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white";
const addButtonClass = "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white";

// Program Content management (v0.16.0, D-069): the applicant dashboard's video resources, weekly
// tasks and calendar events, previously seed-script-only. Requires manageProgramContent
// (ORG_ADMIN / SUPER_ADMIN); other Back Office roles see a read-only notice.
export default async function ProgramContentPage({ params }: ProgramContentPageProps) {
  const { id } = await params;
  const session = await auth();
  const canManage = can("manageProgramContent", {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  });

  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const program = tenant ? await getTenantProgram(id, tenant.id) : null;
  if (!tenant || !program) {
    notFound();
  }

  if (!canManage) {
    return (
      <>
        <h1 className="text-3xl font-bold">{program.name} — Content</h1>
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          Your role can view program content on the applicant portal but cannot manage it.
        </p>
      </>
    );
  }

  const events = await listCalendarEvents(tenant.id, program.id, true);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{program.name} — Content</h1>
        <Link href={`/programs/${program.id}`} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">
          ← Back to program
        </Link>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Calendar events shown on the applicant dashboard for this program. Tasks and tutorial links
        are now managed per-mission (each mission has its own tutorial URL). All changes are audited.
      </p>

      {/* ------------------------------------------------------------------ */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Calendar events ({events.length})</h2>
        <div className="mt-3 space-y-3">
          {events.map((event) => (
            <form
              key={event.id}
              action={updateCalendarEventAction}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <input type="hidden" name="id" value={event.id} />
              <input type="hidden" name="programId" value={program.id} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className={labelClass}>
                  Title
                  <input name="title" required defaultValue={event.title} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Description
                  <input name="description" defaultValue={event.description ?? ""} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Starts
                  <input name="startsAt" type="datetime-local" required defaultValue={toDateTimeInput(event.startsAt)} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Ends (optional)
                  <input name="endsAt" type="datetime-local" defaultValue={toDateTimeInput(event.endsAt)} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Location
                  <input name="location" defaultValue={event.location ?? ""} className={inputClass} />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="submit" className={saveButtonClass}>
                  Save
                </button>
                <button type="submit" formAction={deleteCalendarEventAction} className={deleteButtonClass}>
                  Delete
                </button>
              </div>
            </form>
          ))}
        </div>

        <form action={createCalendarEventAction} className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <input type="hidden" name="programId" value={program.id} />
          <h3 className="text-sm font-semibold text-slate-700">Add calendar event</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className={labelClass}>
              Title
              <input name="title" required className={inputClass} />
            </label>
            <label className={labelClass}>
              Description
              <input name="description" className={inputClass} />
            </label>
            <label className={labelClass}>
              Starts
              <input name="startsAt" type="datetime-local" required className={inputClass} />
            </label>
            <label className={labelClass}>
              Ends (optional)
              <input name="endsAt" type="datetime-local" className={inputClass} />
            </label>
            <label className={labelClass}>
              Location
              <input name="location" placeholder="Zoom" className={inputClass} />
            </label>
          </div>
          <button type="submit" className={`mt-3 ${addButtonClass}`}>
            Add event
          </button>
        </form>
      </section>
    </>
  );
}
