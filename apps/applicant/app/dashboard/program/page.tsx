import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
  listPublishedProgramTasks,
  listVideoResources,
  getApplicantProgramProgress,
  listCompletedTaskIds,
} from "@talentos/db";

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function ProgramPage() {
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
  const tasks = await listPublishedProgramTasks(tenant.id, program.id);
  const videos = await listVideoResources(tenant.id, program.id);
  const completedTaskIds = await listCompletedTaskIds(tenant.id, user.id, program.id);
  const weekProgress = await getApplicantProgramProgress(user.id, tenant.id, program.id);

  const overallPercentage =
    weekProgress.reduce((sum, w) => sum + w.percentage, 0) / weekProgress.length;

  return (
    <div>
      <h1 className="text-3xl font-bold text-brand-navy">My Program</h1>

      {/* Program details */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-brand-navy">{program.name}</h2>
        <p className="mt-2 text-slate-600">{program.description}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-slate-500">Start Date</p>
            <p className="mt-1 font-semibold text-slate-800">{formatDate(program.startsAt)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">End Date</p>
            <p className="mt-1 font-semibold text-slate-800">{formatDate(program.endsAt)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Overall Progress</p>
            <p className="mt-1 font-semibold text-brand-blue">{Math.round(overallPercentage)}%</p>
          </div>
        </div>
      </div>

      {/* 4-week breakdown */}
      <div className="mt-6 space-y-4">
        {weekProgress.map((week) => {
          const weekTasks = tasks.filter((t) => t.weekNumber === week.weekNumber);
          const weekVideos = videos.filter((v) => v.weekNumber === week.weekNumber);
          const allDone = week.totalTasks > 0 && week.completedTasks === week.totalTasks;

          return (
            <div key={week.weekNumber} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-brand-navy">Week {week.weekNumber}</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    allDone
                      ? "bg-emerald-100 text-emerald-700"
                      : week.totalTasks === 0
                        ? "bg-slate-100 text-slate-500"
                        : "bg-brand-mist text-brand-blue"
                  }`}
                >
                  {allDone ? "Completed" : week.totalTasks === 0 ? "No tasks" : `${week.percentage}% done`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-brand-blue" style={{ width: `${week.percentage}%` }} />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {/* Tasks */}
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Tasks ({weekTasks.length})
                  </p>
                  <div className="mt-2 space-y-2">
                    {weekTasks.length === 0 ? (
                      <p className="text-xs text-slate-400">No tasks for this week</p>
                    ) : (
                      weekTasks.map((task) => {
                        const done = completedTaskIds.includes(task.id);
                        return (
                          <div key={task.id} className="flex items-center gap-2 text-sm">
                            <div className={`h-4 w-4 shrink-0 rounded ${done ? "bg-emerald-500" : "border-2 border-slate-300"}`} />
                            <span className={done ? "text-slate-400 line-through" : "text-slate-700"}>
                              {task.title}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Videos */}
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Resources ({weekVideos.length})
                  </p>
                  <div className="mt-2 space-y-2">
                    {weekVideos.length === 0 ? (
                      <p className="text-xs text-slate-400">No resources for this week</p>
                    ) : (
                      weekVideos.map((video) => (
                        <div key={video.id} className="text-sm text-slate-700">
                          🎬 {video.title}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
