import { auth } from "@/auth";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { getTenantContext } from "@talentos/ui";
import {
  getCurrentMissionAssignmentForApplicantProgram,
  getLatestMissionAssignmentForApplicantProgram,
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
  listCompletedTaskIds,
  listTasksByWeek
} from "@talentos/db";
import { TaskCompletionButton } from "./TaskCompletionButton";

function formatDate(value: Date | null | undefined) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function TasksPage() {
  const session = await auth();
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const email = session?.user?.email ?? null;
  const user = email && tenant ? await getUserByEmail(email) : null;
  const applications = user && tenant ? await listApplicantApplications(user.id, tenant.id) : [];
  const acceptedApp = applications.find((application) => application.status === "ACCEPTED");

  if (!user || !tenant || !acceptedApp) {
    return null;
  }

  const activeAssignment = await getCurrentMissionAssignmentForApplicantProgram(
    tenant.id,
    user.id,
    acceptedApp.program.id
  );
  const assignment = activeAssignment ?? await getLatestMissionAssignmentForApplicantProgram(
    tenant.id,
    user.id,
    acceptedApp.program.id
  );

  if (!assignment) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-brand-navy">Weekly tasks</h1>
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-slate-600">
          Your weekly tasks will appear after a mission is assigned.
        </p>
      </div>
    );
  }

  const tasks = await listTasksByWeek(tenant.id, acceptedApp.program.id, assignment.weekNumber);
  const completedTaskIds = await listCompletedTaskIds(
    tenant.id,
    user.id,
    acceptedApp.program.id,
    assignment.weekNumber
  );
  const completed = new Set(completedTaskIds);
  const requiredTasks = tasks.filter((task) => task.required);
  const requiredCompleted = requiredTasks.filter((task) => completed.has(task.id)).length;

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-bold text-brand-navy">Week {assignment.weekNumber} tasks</h1>
      <p className="mt-2 text-slate-600">
        Complete the required learning and setup tasks before submitting {assignment.mission.title}.
      </p>

      <section className="mt-6 border-y border-slate-200 py-4" aria-label="Task progress">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-slate-900">
            {requiredCompleted} of {requiredTasks.length} required tasks completed
          </p>
          <span className={`text-sm font-semibold ${requiredCompleted === requiredTasks.length ? "text-emerald-700" : "text-amber-700"}`}>
            {requiredCompleted === requiredTasks.length ? "Ready" : "Blocking submission"}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-brand-blue"
            style={{ width: `${requiredTasks.length === 0 ? 100 : Math.round((requiredCompleted / requiredTasks.length) * 100)}%` }}
          />
        </div>
      </section>

      <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
        {tasks.map((task) => {
          const done = completed.has(task.id);
          return (
            <section key={task.id} className="py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-brand-navy">{task.title}</h2>
                    {task.required ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Required</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Optional</span>
                    )}
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {done ? "Completed" : "Not completed"}
                    </span>
                  </div>
                  {task.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p> : null}
                  <p className="mt-2 text-xs text-slate-500">Due: {formatDate(task.dueAt)}</p>
                </div>
                {!done && activeAssignment ? (
                  <TaskCompletionButton taskId={task.id} missionAssignmentId={activeAssignment.id} />
                ) : null}
              </div>

              <div className="mt-5 grid gap-5 border-l-2 border-slate-200 pl-4 sm:grid-cols-2">
                {task.resources.map((resource) => (
                  <div key={resource.id}>
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      {resource.type === "MARKDOWN" ? "Reading" : "Video"}
                    </p>
                    <h3 className="mt-1 font-semibold text-slate-900">{resource.title}</h3>
                    {resource.description ? <p className="mt-1 text-sm text-slate-600">{resource.description}</p> : null}
                    {resource.type === "MARKDOWN" && resource.markdownContent ? (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-semibold text-brand-blue">Open learning resource</summary>
                        <div className="mt-3"><SafeMarkdown markdown={resource.markdownContent} /></div>
                      </details>
                    ) : resource.type === "YOUTUBE" && isSafeYouTubeUrl(resource.url) ? (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex text-sm font-semibold text-brand-blue underline"
                      >
                        Open YouTube video
                      </a>
                    ) : (
                      <p className="mt-3 text-sm font-medium text-amber-700">Video URL pending.</p>
                    )}
                  </div>
                ))}
                {task.resources.length === 0 ? (
                  <p className="text-sm font-medium text-amber-700">Learning resources have not been attached yet.</p>
                ) : null}
              </div>
            </section>
          );
        })}
        {tasks.length === 0 ? (
          <p className="py-8 text-sm text-slate-500">No published tasks are configured for this week.</p>
        ) : null}
      </div>
    </div>
  );
}

function isSafeYouTubeUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "youtube.com" || host === "www.youtube.com" || host === "youtu.be");
  } catch {
    return false;
  }
}
