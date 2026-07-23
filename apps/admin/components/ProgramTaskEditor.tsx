import { listProgramTasks, listVideoResources } from "@talentos/db";
import { ResourceForm } from "./ResourceForm";
import { CollapsibleTask } from "./CollapsibleTask";

// Shared "weekly tasks + their learning resources" editor, used by both the per-program Content page
// and the top-level Tasks page. Resources are managed inline under each task (add multiple, pick the
// type), so an organizer builds a task and its Markdown/YouTube resources in one place. Server
// actions are passed in as props so this component doesn't couple to any one route's actions module.
type ProgramTask = Awaited<ReturnType<typeof listProgramTasks>>[number];
type VideoResource = Awaited<ReturnType<typeof listVideoResources>>[number];

type ServerAction = (formData: FormData) => Promise<void>;

export type ProgramTaskEditorActions = {
  createTask: ServerAction;
  updateTask: ServerAction;
  deleteTask: ServerAction;
  createResource: ServerAction;
  updateResource: ServerAction;
  deleteResource: ServerAction;
};

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
const labelClass = "block text-xs font-medium text-slate-600";
const deleteButtonClass = "rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700";
const saveButtonClass = "rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white";
const addButtonClass = "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white";

function toDateInput(value: Date | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

// The subset of resource fields these inputs render — shared by `VideoResource` (which also carries
// a `task` relation) and a task's own `resources` (which don't), so both can be passed in.
type ResourceFieldValues = {
  type: VideoResource["type"];
  title: string;
  url: string | null;
  description: string | null;
  order: number;
  durationSeconds: number | null;
  markdownContent: string | null;
};

// Shared resource input fields, used by both the inline edit and add forms. `weekNumber` is not
// surfaced here — resources inherit their week from the task they belong to.
function ResourceFormFields({ resource }: { resource?: ResourceFieldValues }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className={labelClass}>
          Type
          <select name="type" defaultValue={resource?.type ?? "MARKDOWN"} className={inputClass}>
            <option value="MARKDOWN">Markdown (reading)</option>
            <option value="YOUTUBE">YouTube (video)</option>
          </select>
        </label>
        <label className={labelClass}>
          Title
          <input name="title" required defaultValue={resource?.title ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          YouTube URL (for video type)
          <input name="url" type="url" defaultValue={resource?.url ?? ""} placeholder="https://www.youtube.com/..." className={inputClass} />
        </label>
        <label className={labelClass}>
          Description
          <input name="description" defaultValue={resource?.description ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Order
          <input name="order" type="number" min={0} defaultValue={resource?.order ?? 0} className={inputClass} />
        </label>
        <label className={labelClass}>
          Duration (seconds)
          <input name="durationSeconds" type="number" min={1} defaultValue={resource?.durationSeconds ?? ""} className={inputClass} />
        </label>
      </div>
      <label className={`${labelClass} mt-3`}>
        Markdown content (for reading type)
        <textarea name="markdownContent" rows={5} defaultValue={resource?.markdownContent ?? ""} className={inputClass} />
      </label>
    </>
  );
}

// A single task's inline learning-resource manager: existing resources (edit/delete/upload) plus an
// "Add learning resource" button that can be used repeatedly to add multiple (and auto-collapses
// after each save).
function TaskResources({
  programId,
  task,
  actions
}: {
  programId: string;
  task: ProgramTask;
  actions: ProgramTaskEditorActions;
}) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <h4 className="text-sm font-semibold text-slate-700">Learning resources ({task.resources.length})</h4>

      {task.resources.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No resources yet. Add a reading, video or document below.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {task.resources.map((resource) => (
            <ResourceForm
              key={resource.id}
              mode="edit"
              programId={programId}
              taskId={task.id}
              defaults={{
                id: resource.id,
                type: resource.type,
                title: resource.title,
                url: resource.url,
                markdownContent: resource.markdownContent,
                description: resource.description,
                order: resource.order,
                durationSeconds: resource.durationSeconds,
                fileId: resource.fileId,
                file: resource.file
              }}
              updateResource={actions.updateResource}
              deleteResource={actions.deleteResource}
            />
          ))}
        </div>
      )}

      <ResourceForm mode="add" programId={programId} taskId={task.id} createResource={actions.createResource} />
    </div>
  );
}

export function ProgramTaskEditor({
  programId,
  tasks,
  resources,
  actions
}: {
  programId: string;
  tasks: ProgramTask[];
  resources: VideoResource[];
  actions: ProgramTaskEditorActions;
}) {
  const unattached = resources.filter((resource) => !resource.taskId);

  return (
    <>
      <section>
        <h2 className="text-xl font-semibold">Weekly tasks ({tasks.length})</h2>
        <p className="mt-1 text-sm text-slate-600">
          Required tasks gate mission submission and appear on the applicant Tasks page for the matching week. Add each
          task&apos;s learning resources inline below it.
        </p>
        <div className="mt-3 space-y-3">
          {tasks.map((task, index) => (
            <CollapsibleTask key={task.id} taskNumber={index + 1} title={task.title} weekNumber={task.weekNumber}>
              {/* Task fields live in their own form; resource forms are siblings (no nested forms). */}
              <form action={actions.updateTask}>
                <input type="hidden" name="id" value={task.id} />
                <input type="hidden" name="programId" value={programId} />
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
                <div className="mt-3 flex flex-wrap gap-5 text-sm text-slate-700">
                  <label className="flex items-center gap-2">
                    <input name="required" type="checkbox" defaultChecked={task.required} />
                    Required for submission
                  </label>
                  <label className="flex items-center gap-2">
                    <input name="isPrerequisite" type="checkbox" defaultChecked={task.isPrerequisite} />
                    Prerequisite (blocks mission start)
                  </label>
                  <label className="flex items-center gap-2">
                    <input name="published" type="checkbox" defaultChecked={task.published} />
                    Published to applicants
                  </label>
                </div>
                {task.required && (!task.resources.some((resource) => resource.type === "MARKDOWN") || !task.resources.some((resource) => resource.type === "YOUTUBE")) ? (
                  <p className="mt-3 text-sm font-medium text-amber-700">
                    Required resource missing: each required task needs Markdown and YouTube resources.
                  </p>
                ) : null}
                {task.required && task.resources.some((resource) => resource.type === "YOUTUBE" && !resource.url) ? (
                  <p className="mt-3 text-sm font-medium text-amber-700">
                    YouTube resource is configured, but its final public URL is still pending.
                  </p>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <button type="submit" className={saveButtonClass}>
                    Save task
                  </button>
                  <button type="submit" formAction={actions.deleteTask} className={deleteButtonClass}>
                    Delete task
                  </button>
                </div>
              </form>

              <TaskResources programId={programId} task={task} actions={actions} />
            </CollapsibleTask>
          ))}
          {tasks.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
              No weekly tasks yet. Add the first one below.
            </p>
          ) : null}
        </div>

        <form action={actions.createTask} className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <input type="hidden" name="programId" value={programId} />
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
          <div className="mt-3 flex flex-wrap gap-5 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input name="required" type="checkbox" defaultChecked />
              Required for submission
            </label>
            <label className="flex items-center gap-2">
              <input name="isPrerequisite" type="checkbox" />
              Prerequisite (blocks mission start)
            </label>
            <label className="flex items-center gap-2">
              <input name="published" type="checkbox" defaultChecked />
              Published to applicants
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">Save the task first, then add its learning resources inline.</p>
          <button type="submit" className={`mt-3 ${addButtonClass}`}>
            Add task
          </button>
        </form>
      </section>

      {/* Legacy/general resources not attached to any task remain editable so they aren't orphaned. */}
      {unattached.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Unattached resources ({unattached.length})</h2>
          <p className="mt-1 text-sm text-slate-600">
            These resources aren&apos;t linked to a weekly task. Assign each to a task so it appears for applicants.
          </p>
          <div className="mt-3 space-y-3">
            {unattached.map((resource) => (
              <form key={resource.id} action={actions.updateResource} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <input type="hidden" name="id" value={resource.id} />
                <input type="hidden" name="programId" value={programId} />
                <label className={labelClass}>
                  Attach to weekly task
                  <select name="taskId" defaultValue="" className={inputClass}>
                    <option value="">Leave unattached</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>Week {task.weekNumber} - {task.title}</option>
                    ))}
                  </select>
                </label>
                <input type="hidden" name="weekNumber" value={resource.weekNumber ?? ""} />
                <div className="mt-3">
                  <ResourceFormFields resource={resource} />
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="submit" className={saveButtonClass}>
                    Save
                  </button>
                  <button type="submit" formAction={actions.deleteResource} className={deleteButtonClass}>
                    Delete
                  </button>
                </div>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
