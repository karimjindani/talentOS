import Link from "next/link";
import { auth } from "@/auth";
import { DeadlineCountdown } from "@/components/DeadlineCountdown";
import { LearningResourceList } from "@/components/LearningResourceList";
import { getTenantContext, ProgressBar } from "@talentos/ui";
import {
  getApplicantMissionProgress,
  getCurrentMissionAssignmentForApplicantProgram,
  getLatestMissionAssignmentForApplicantProgram,
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
  listAssignedMissionsWithTasks,
  listCompletedTaskIds,
  listTasksByWeek,
  type MissionTaskSummary
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

  const program = acceptedApp.program;
  const missionsWithTasks = await listAssignedMissionsWithTasks(tenant.id, user.id, program.id);
  const missionProgress = await getApplicantMissionProgress(tenant.id, user.id, program.id);
  const activeAssignment = await getCurrentMissionAssignmentForApplicantProgram(tenant.id, user.id, program.id);
  const latestAssignment = await getLatestMissionAssignmentForApplicantProgram(tenant.id, user.id, program.id);
  const weeklyAssignment = activeAssignment ?? latestAssignment;
  const weeklyTasks = weeklyAssignment
    ? await listTasksByWeek(tenant.id, program.id, weeklyAssignment.weekNumber)
    : [];
  const completedTaskIds = weeklyAssignment
    ? await listCompletedTaskIds(tenant.id, user.id, program.id, weeklyAssignment.weekNumber)
    : [];
  const completed = new Set(completedTaskIds);
  const requiredWeeklyTasks = weeklyTasks.filter((task) => task.required);
  const requiredWeeklyCompleted = requiredWeeklyTasks.filter((task) => completed.has(task.id)).length;

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-bold text-brand-navy">Tasks</h1>
      <p className="mt-2 text-slate-600">
        Mission steps guide each assignment attempt. Weekly learning tasks and resources prepare you for
        the program week and remain complete if the week is repeated.
      </p>

      <section className="mt-8" aria-labelledby="mission-steps-heading">
        <h2 id="mission-steps-heading" className="text-xl font-semibold text-brand-navy">Mission steps</h2>
        <p className="mt-1 text-sm text-slate-600">
          Complete Review Brief and Study Tutorial before submitting evidence for each mission attempt.
        </p>
        <div className="mt-4 space-y-6">
          {missionsWithTasks.length === 0 ? (
            <p className="text-sm text-slate-400">No missions assigned yet.</p>
          ) : (
            missionsWithTasks.map(({ assignment, mission, tasks }) => {
              const isCurrent = missionProgress.currentMission?.id === mission.id;
              const hasLiveDeadline =
                isCurrent &&
                ["ACCEPTED", "IN_PROGRESS", "OVERDUE"].includes(assignment.status) &&
                assignment.deadlineAt &&
                assignment.graceEndsAt;

              return (
                <div key={assignment.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-brand-navy">
                      Week {mission.weekNumber} - {mission.title}
                    </h3>
                    <Link href={`/dashboard/missions/${mission.id}`} className="text-sm font-medium text-brand-blue hover:underline">
                      Open mission
                    </Link>
                  </div>
                  {hasLiveDeadline && assignment.deadlineAt && assignment.graceEndsAt ? (
                    <div className="mt-3">
                      <DeadlineCountdown deadlineAt={assignment.deadlineAt} graceEndsAt={assignment.graceEndsAt} />
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {tasks.map((task) => (
                      <TaskCard key={task.index} assignmentId={assignment.id} missionId={mission.id} task={task} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="weekly-learning-heading">
        <h2 id="weekly-learning-heading" className="text-xl font-semibold text-brand-navy">
          {weeklyAssignment ? `Week ${weeklyAssignment.weekNumber} learning tasks` : "Weekly learning tasks"}
        </h2>
        {!weeklyAssignment ? (
          <p className="mt-4 rounded-xl border border-slate-200 bg-white p-5 text-slate-600">
            Weekly learning tasks will appear after a mission is assigned.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">
              Complete these required learning and setup tasks before submitting {weeklyAssignment.mission.title}.
            </p>
            <div className="mt-4 border-y border-slate-200 py-4" aria-label="Weekly task progress">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">
                  {requiredWeeklyCompleted} of {requiredWeeklyTasks.length} required tasks completed
                </p>
                <span className={`text-sm font-semibold ${requiredWeeklyCompleted === requiredWeeklyTasks.length ? "text-emerald-700" : "text-amber-700"}`}>
                  {requiredWeeklyCompleted === requiredWeeklyTasks.length ? "Ready" : "Blocking submission"}
                </span>
              </div>
              <ProgressBar
                className="mt-3"
                tone="emerald"
                value={requiredWeeklyTasks.length === 0 ? 1 : requiredWeeklyCompleted}
                max={requiredWeeklyTasks.length === 0 ? 1 : requiredWeeklyTasks.length}
                aria-label="Weekly required task progress"
              />
            </div>

            <div className="divide-y divide-slate-200">
              {weeklyTasks.map((task) => {
                const done = completed.has(task.id);
                return (
                  <section key={task.id} className="py-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold uppercase text-slate-500">Task {task.order + 1}</p>
                          {task.required ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Required</span>
                          ) : null}
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {done ? "Completed" : "Not completed"}
                          </span>
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-slate-900">{task.title}</h3>
                        {task.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p> : null}
                        <p className="mt-2 text-xs text-slate-500">Due: {formatDate(task.dueAt)}</p>
                      </div>
                      {!done && activeAssignment ? (
                        <TaskCompletionButton taskId={task.id} missionAssignmentId={activeAssignment.id} />
                      ) : null}
                    </div>

                    <div className="mt-5 border-l-2 border-slate-200 pl-4">
                      <LearningResourceList resources={task.resources} />
                    </div>
                  </section>
                );
              })}
              {weeklyTasks.length === 0 ? (
                <p className="py-8 text-sm text-slate-500">No published tasks are configured for this week.</p>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function TaskCard({
  assignmentId,
  missionId,
  task
}: {
  assignmentId: string;
  missionId: string;
  task: MissionTaskSummary;
}) {
  const href = task.index === 3 ? `/dashboard/missions/${missionId}` : `/dashboard/tasks/${assignmentId}/${task.index}`;

  return (
    <Link
      href={href}
      className={`h-full rounded-xl border p-4 transition hover:border-brand-blue ${
        task.complete ? "border-emerald-200 bg-emerald-50" : "border-slate-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 h-5 w-5 shrink-0 rounded ${task.complete ? "bg-emerald-500" : "border-2 border-slate-300"}`} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">Task {task.index}</p>
          <p className={`font-semibold ${task.complete ? "text-slate-500" : "text-slate-800"}`}>{task.title}</p>
        </div>
      </div>
      <span className={`mt-3 inline-block rounded-full px-2 py-1 text-xs font-medium ${task.complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
        {task.complete ? "Completed" : "Pending"}
      </span>
    </Link>
  );
}

