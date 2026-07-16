import Link from "next/link";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getApplicantMissionProgress,
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
  listAssignedMissionsWithTasks,
  type MissionTaskSummary
} from "@talentos/db";
import { DeadlineCountdown } from "@/components/DeadlineCountdown";

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
  const missionsWithTasks = await listAssignedMissionsWithTasks(tenant.id, user.id, program.id);
  const missionProgress = await getApplicantMissionProgress(tenant.id, user.id, program.id);

  return (
    <div>
      <h1 className="text-3xl font-bold text-brand-navy">Tasks</h1>
      <p className="mt-2 text-slate-600">
        Every mission breaks into the same 3 steps. Complete Review Brief and Study Tutorial before you can
        submit a mission for review.
      </p>

      <div className="mt-6 space-y-6">
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
                  <h2 className="text-lg font-semibold text-brand-navy">
                    Week {mission.weekNumber} · {mission.title}
                  </h2>
                  <Link
                    href={`/dashboard/missions/${mission.id}`}
                    className="text-sm font-medium text-brand-blue hover:underline"
                  >
                    Open mission →
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
  // Tasks 1 & 2 open the per-task resource page; Task 3 has no checkbox of its own — it's
  // completed by submitting, so it links straight to the mission detail page instead.
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
      <span
        className={`mt-3 inline-block rounded-full px-2 py-1 text-xs font-medium ${
          task.complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        {task.complete ? "Completed" : "Pending"}
      </span>
    </Link>
  );
}
