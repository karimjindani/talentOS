import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
  listProgramTasks,
  listCompletedTaskIds,
} from "@talentos/db";

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
  const acceptedApp = applications.find((a) => a.status === "ACCEPTED");

  if (!user || !tenant || !acceptedApp) {
    return null;
  }

  const program = acceptedApp.program;
  const tasks = await listProgramTasks(tenant.id, program.id);
  const completedTaskIds = await listCompletedTaskIds(user.id, program.id);

  const now = new Date();

  return (
    <div>
      <h1 className="text-3xl font-bold text-brand-navy">Tasks</h1>
      <p className="mt-2 text-slate-600">All tasks for {program.name}, grouped by week.</p>

      <div className="mt-6 space-y-6">
        {[1, 2, 3, 4].map((weekNum) => {
          const weekTasks = tasks.filter((t) => t.weekNumber === weekNum);
          return (
            <div key={weekNum}>
              <h2 className="mb-3 text-lg font-semibold text-brand-navy">Week {weekNum}</h2>
              {weekTasks.length === 0 ? (
                <p className="text-sm text-slate-400">No tasks for this week.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {weekTasks.map((task) => {
                    const done = completedTaskIds.includes(task.id);
                    const overdue = !done && task.dueAt && new Date(task.dueAt) < now;
                    return (
                      <div
                        key={task.id}
                        className={`rounded-2xl border bg-white p-5 shadow-sm ${
                          overdue ? "border-rose-200" : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 h-5 w-5 shrink-0 rounded ${done ? "bg-emerald-500" : "border-2 border-slate-300"}`} />
                            <div>
                              <p className={`font-semibold ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                                {task.title}
                              </p>
                              {task.description ? (
                                <p className="mt-1 text-sm text-slate-600">{task.description}</p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-3 text-xs">
                          <span className={`rounded-full px-2 py-1 font-medium ${
                            done
                              ? "bg-emerald-100 text-emerald-700"
                              : overdue
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                          }`}>
                            {done ? "Completed" : overdue ? "Overdue" : "Pending"}
                          </span>
                          <span className="text-slate-500">Due: {formatDate(task.dueAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
