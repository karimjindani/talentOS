import Link from "next/link";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
  listAssignedMissionsWithTasks,
  getApplicantMissionProgress
} from "@talentos/db";
import { DeadlineCountdown } from "@/components/DeadlineCountdown";

const PROGRAM_WEEKS = 4;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
  // Mission-driven progress (v0.19.1): the SEM loop is the single source of truth for both
  // per-week completion and the task checklist, replacing the old ProgramTask/VideoResource system.
  const missionProgress = await getApplicantMissionProgress(tenant.id, user.id, program.id);
  const missionsWithTasks = await listAssignedMissionsWithTasks(tenant.id, user.id, program.id);
  const missionsByWeek = new Map(missionsWithTasks.map((entry) => [entry.mission.weekNumber, entry]));

  // The program's timeline is driven by the applicant's own pace, not a fixed calendar date: it
  // starts the moment they accept the Week 1 mission, and runs for a fixed 4-week arc from there.
  const week1AcceptedAt = missionsByWeek.get(1)?.assignment.acceptedAt ?? null;
  const startDate = week1AcceptedAt;
  const endDate = startDate ? new Date(startDate.getTime() + PROGRAM_WEEKS * WEEK_MS) : null;

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
            <p className="mt-1 font-semibold text-slate-800">
              {startDate ? formatDate(startDate) : "Not started — accept your Week 1 mission"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">End Date</p>
            <p className="mt-1 font-semibold text-slate-800">{endDate ? formatDate(endDate) : "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Overall Progress</p>
            <p className="mt-1 font-semibold text-brand-blue">{missionProgress.overall.percentage}%</p>
          </div>
        </div>
      </div>

      {/* 4-week breakdown, mission-driven */}
      <div className="mt-6 space-y-4">
        {missionProgress.weeks.map((week) => {
          const entry = missionsByWeek.get(week.weekNumber);
          const allDone = week.totalMissions > 0 && week.acceptedMissions === week.totalMissions;
          const isCurrent = missionProgress.currentMission?.weekNumber === week.weekNumber;

          return (
            <div key={week.weekNumber} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-brand-navy">
                  Week {week.weekNumber}
                  {entry ? <span className="ml-2 font-normal text-slate-500">· {entry.mission.title}</span> : null}
                </h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    allDone
                      ? "bg-emerald-100 text-emerald-700"
                      : week.totalMissions === 0
                        ? "bg-slate-100 text-slate-500"
                        : isCurrent
                          ? "bg-brand-mist text-brand-blue"
                          : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {allDone ? "Completed" : week.totalMissions === 0 ? "Not assigned yet" : isCurrent ? "Current" : `${week.percentage}%`}
                </span>
              </div>

              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-brand-blue" style={{ width: `${week.percentage}%` }} />
              </div>

              {isCurrent &&
              entry &&
              ["ACCEPTED", "IN_PROGRESS", "OVERDUE"].includes(entry.assignment.status) &&
              entry.assignment.deadlineAt &&
              entry.assignment.graceEndsAt ? (
                <div className="mt-4">
                  <DeadlineCountdown deadlineAt={entry.assignment.deadlineAt} graceEndsAt={entry.assignment.graceEndsAt} />
                </div>
              ) : null}

              {entry ? (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-500">Tasks</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {entry.tasks.map((task) => {
                      const href =
                        task.index === 3
                          ? `/dashboard/missions/${entry.mission.id}`
                          : `/dashboard/tasks/${entry.assignment.id}/${task.index}`;
                      return (
                        <Link
                          key={task.index}
                          href={href}
                          className="flex items-center gap-2 rounded-xl border border-slate-100 p-3 text-sm transition hover:border-brand-blue"
                        >
                          <div className={`h-4 w-4 shrink-0 rounded ${task.complete ? "bg-emerald-500" : "border-2 border-slate-300"}`} />
                          <span className={task.complete ? "text-slate-400 line-through" : "text-slate-700"}>{task.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-400">No mission assigned for this week yet.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
