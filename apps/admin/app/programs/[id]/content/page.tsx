import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import { can } from "@talentos/auth";
import {
  getTenantBySlug,
  getTenantProgram,
  listCalendarEvents,
  listProgramTasks,
  listVideoResources
} from "@talentos/db";
import {
  createCalendarEventAction,
  createProgramTaskAction,
  createVideoResourceAction,
  deleteCalendarEventAction,
  deleteProgramTaskAction,
  deleteVideoResourceAction,
  updateCalendarEventAction,
  updateProgramTaskAction,
  updateVideoResourceAction
} from "./actions";

type ProgramContentPageProps = {
  params: Promise<{ id: string }>;
};

function toDateInput(value: Date | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

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

  const [resources, tasks, events] = await Promise.all([
    listVideoResources(tenant.id, program.id),
    listProgramTasks(tenant.id, program.id),
    listCalendarEvents(tenant.id, program.id, true)
  ]);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{program.name} — Content</h1>
        <Link href={`/programs/${program.id}`} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">
          ← Back to program
        </Link>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Video resources, weekly tasks and calendar events shown on the applicant dashboard for this
        program. All changes are audited.
      </p>

      {/* ------------------------------------------------------------------ */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Video resources ({resources.length})</h2>
        <div className="mt-3 space-y-3">
          {resources.map((resource) => (
            <form
              key={resource.id}
              action={updateVideoResourceAction}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <input type="hidden" name="id" value={resource.id} />
              <input type="hidden" name="programId" value={program.id} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className={labelClass}>
                  Title
                  <input name="title" required defaultValue={resource.title} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Video URL
                  <input name="url" type="url" required defaultValue={resource.url} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Description
                  <input name="description" defaultValue={resource.description ?? ""} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Week (optional)
                  <input
                    name="weekNumber"
                    type="number"
                    min={1}
                    max={4}
                    defaultValue={resource.weekNumber ?? ""}
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="submit" className={saveButtonClass}>
                  Save
                </button>
                <button type="submit" formAction={deleteVideoResourceAction} className={deleteButtonClass}>
                  Delete
                </button>
              </div>
            </form>
          ))}
        </div>

        <form action={createVideoResourceAction} className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <input type="hidden" name="programId" value={program.id} />
          <h3 className="text-sm font-semibold text-slate-700">Add video resource</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={labelClass}>
              Title
              <input name="title" required className={inputClass} />
            </label>
            <label className={labelClass}>
              Video URL
              <input name="url" type="url" required placeholder="https://www.youtube.com/..." className={inputClass} />
            </label>
            <label className={labelClass}>
              Description
              <input name="description" className={inputClass} />
            </label>
            <label className={labelClass}>
              Week (optional)
              <input name="weekNumber" type="number" min={1} max={4} className={inputClass} />
            </label>
          </div>
          <button type="submit" className={`mt-3 ${addButtonClass}`}>
            Add resource
          </button>
        </form>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Weekly tasks ({tasks.length})</h2>
        <div className="mt-3 space-y-3">
          {tasks.map((task) => (
            <form
              key={task.id}
              action={updateProgramTaskAction}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="programId" value={program.id} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className={labelClass}>
                  Title
                  <input name="title" required defaultValue={task.title} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Description
                  <input name="description" defaultValue={task.description ?? ""} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Week
                  <input name="weekNumber" type="number" min={1} max={4} required defaultValue={task.weekNumber} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Order
                  <input name="order" type="number" min={0} defaultValue={task.order} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Due date
                  <input name="dueAt" type="date" defaultValue={toDateInput(task.dueAt)} className={inputClass} />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="submit" className={saveButtonClass}>
                  Save
                </button>
                <button type="submit" formAction={deleteProgramTaskAction} className={deleteButtonClass}>
                  Delete
                </button>
              </div>
            </form>
          ))}
        </div>

        <form action={createProgramTaskAction} className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <input type="hidden" name="programId" value={program.id} />
          <h3 className="text-sm font-semibold text-slate-700">Add weekly task</h3>
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
              Week
              <input name="weekNumber" type="number" min={1} max={4} required defaultValue={1} className={inputClass} />
            </label>
            <label className={labelClass}>
              Order
              <input name="order" type="number" min={0} defaultValue={0} className={inputClass} />
            </label>
            <label className={labelClass}>
              Due date
              <input name="dueAt" type="date" className={inputClass} />
            </label>
          </div>
          <button type="submit" className={`mt-3 ${addButtonClass}`}>
            Add task
          </button>
        </form>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="mt-10">
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
