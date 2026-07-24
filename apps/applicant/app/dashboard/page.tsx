import Link from "next/link";
import { auth } from "@/auth";
import { getTenantContext, ProgressBar, SubmissionStatusBadge } from "@talentos/ui";
import {
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
  listPublishedProgramTasks,
  listAssignedMissionsWithTasks,
  listCalendarEvents,
  listUserNotifications,
  getApplicantMissionProgress,
  listCompletedTaskIds,
} from "@talentos/db";
import { DeadlineCountdown } from "@/components/DeadlineCountdown";
import { CountdownTimer } from "@/components/CountdownTimer";

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function DashboardPage() {
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
  const weeklyTasks = await listPublishedProgramTasks(tenant.id, program.id);
  const completedTaskIds = await listCompletedTaskIds(tenant.id, user.id, program.id);
  const events = await listCalendarEvents(tenant.id, program.id);
  const notifications = await listUserNotifications(user.id, tenant.id);
  // Mission-driven progress (v0.16.0, D-069): the SEM learning loop is the source of truth — only
  // ACCEPTED mission submissions move the bar.
  const missionProgress = await getApplicantMissionProgress(tenant.id, user.id, program.id);
  // Tasks are mission-derived (v0.19.0): the same fixed 3-step checklist per assigned mission.
  const missionsWithTasks = await listAssignedMissionsWithTasks(tenant.id, user.id, program.id);

  const totalMissionSteps = missionsWithTasks.length * 3;
  const completedMissionSteps = missionsWithTasks.reduce(
    (sum, { tasks }) => sum + tasks.filter((task) => task.complete).length,
    0
  );
  const requiredWeeklyTasks = weeklyTasks.filter((task) => task.required);
  const completedWeeklyTasks = requiredWeeklyTasks.filter((task) => completedTaskIds.includes(task.id)).length;
  const overallPercentage = missionProgress.overall.percentage;

  const recentNotifications = notifications.slice(0, 3);
  const upcomingEvents = events.slice(0, 2);
  // The current mission's tasks (falls back to the first assigned mission if everything's accepted).
  const currentMissionTasks =
    missionsWithTasks.find(({ mission }) => mission.id === missionProgress.currentMission?.id) ??
    missionsWithTasks[0] ??
    null;
  const currentAssignment = currentMissionTasks?.assignment ?? null;
  const currentDeadlineIsLive =
    currentAssignment && ["ACCEPTED", "IN_PROGRESS", "OVERDUE"].includes(currentAssignment.status) && currentAssignment.deadlineAt;

  // Time Remaining is wired to the current mission's own deadline (v0.19.1), not a static program
  // end date — it only ticks once that mission has been accepted (see the live countdown below).

  return (
    <div>
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-navy">
          Welcome back, {user.name ?? user.email.split("@")[0]}!
        </h1>
        <p className="mt-2 text-slate-600">
          You&apos;re enrolled in <span className="font-semibold text-brand-blue">{program.name}</span>
          {program.startsAt ? ` · Started ${formatDate(program.startsAt)}` : ""}
        </p>
      </div>

      {/* Quick stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Overall Progress</p>
          <p className="mt-2 text-2xl font-bold text-brand-blue">{overallPercentage}%</p>
          <ProgressBar className="mt-2" value={overallPercentage} aria-label="Overall progress" />
          <p className="mt-1 text-xs text-slate-500">accepted missions</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Missions Accepted</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{missionProgress.overall.accepted}</p>
          <p className="mt-1 text-xs text-slate-500">of {missionProgress.overall.total} total</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Weekly Tasks</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{completedWeeklyTasks}</p>
          <p className="mt-1 text-xs text-slate-500">
            of {requiredWeeklyTasks.length} required · {completedMissionSteps}/{totalMissionSteps} mission steps
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Time Remaining</p>
          <p className="mt-2 text-xl font-bold text-brand-navy">
            {currentDeadlineIsLive && currentAssignment?.deadlineAt ? (
              <CountdownTimer
                deadlineAt={currentAssignment.deadlineAt}
                graceEndsAt={currentAssignment.graceEndsAt}
                variant="plain"
              />
            ) : (
              "—"
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {currentAssignment?.status === "NOT_STARTED" || !currentAssignment
              ? "accept your current mission to start the clock"
              : "on your current mission"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 4-week progress */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-navy">Program Progress</h2>
            <Link href="/dashboard/program" className="text-sm font-medium text-brand-blue hover:underline">
              View details →
            </Link>
          </div>
          <div className="space-y-3">
            {missionProgress.weeks.map((week) => (
              <ProgressBar
                key={week.weekNumber}
                value={week.percentage}
                label={`Week ${week.weekNumber}`}
                valueText={`${week.acceptedMissions}/${week.totalMissions} missions · ${week.percentage}%`}
                aria-label={`Week ${week.weekNumber} progress`}
              />
            ))}
          </div>
        </div>

        {/* Current mission (v0.16.0, D-069) — the next step in the SEM loop */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-navy">Current Mission</h2>
            <Link href="/dashboard/missions" className="text-sm font-medium text-brand-blue hover:underline">
              View all →
            </Link>
          </div>
          {missionProgress.currentMission ? (
            <Link
              href={`/dashboard/missions/${missionProgress.currentMission.id}`}
              className="block rounded-xl border border-slate-100 p-4 transition hover:border-brand-blue"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                Week {missionProgress.currentMission.weekNumber}
              </p>
              <p className="mt-1 text-base font-semibold text-slate-800">{missionProgress.currentMission.title}</p>
              <div className="mt-3">
                <SubmissionStatusBadge status={missionProgress.currentMission.submissionStatus} />
              </div>
              {currentDeadlineIsLive && currentAssignment?.deadlineAt && currentAssignment.graceEndsAt ? (
                <div className="mt-3">
                  <DeadlineCountdown deadlineAt={currentAssignment.deadlineAt} graceEndsAt={currentAssignment.graceEndsAt} />
                </div>
              ) : null}
            </Link>
          ) : missionProgress.overall.total > 0 ? (
            <p className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
              All missions accepted — your portfolio evidence is complete. 🎉
            </p>
          ) : (
            <p className="text-sm text-slate-500">No assigned missions yet.</p>
          )}
        </div>

        {/* Current mission's tasks (v0.19.0) — the fixed 3-step checklist for the mission in progress */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-navy">Current Tasks</h2>
            <Link href="/dashboard/tasks" className="text-sm font-medium text-brand-blue hover:underline">
              View all →
            </Link>
          </div>
          {!currentMissionTasks ? (
            <p className="text-sm text-slate-500">No tasks yet — missions haven&apos;t been assigned.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                Week {currentMissionTasks.mission.weekNumber} · {currentMissionTasks.mission.title}
              </p>
              {currentMissionTasks.tasks.map((task) => {
                const href =
                  task.index === 3
                    ? `/dashboard/missions/${currentMissionTasks.mission.id}`
                    : `/dashboard/tasks/${currentMissionTasks.assignment.id}/${task.index}`;
                return (
                  <Link
                    key={task.index}
                    href={href}
                    className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-brand-blue"
                  >
                    <div className={`mt-0.5 h-5 w-5 shrink-0 rounded ${task.complete ? "bg-emerald-500" : "border-2 border-slate-300"}`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${task.complete ? "text-slate-400 line-through" : "text-slate-800"}`}>
                        Task {task.index}: {task.title}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent notifications */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-navy">Recent Notifications</h2>
            <Link href="/dashboard/notifications" className="text-sm font-medium text-brand-blue hover:underline">
              View all →
            </Link>
          </div>
          {recentNotifications.length === 0 ? (
            <p className="text-sm text-slate-500">No notifications yet.</p>
          ) : (
            <div className="space-y-3">
              {recentNotifications.map((notif) => (
                <div key={notif.id} className={`rounded-xl p-3 ${notif.readAt ? "bg-slate-50" : "bg-brand-mist"}`}>
                  <p className="text-sm font-medium text-slate-800">{notif.title}</p>
                  {notif.body ? <p className="mt-0.5 text-xs text-slate-500">{notif.body}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming events */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-navy">Upcoming Events</h2>
            <Link href="/dashboard/calendar" className="text-sm font-medium text-brand-blue hover:underline">
              View calendar →
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming events.</p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="rounded-xl border border-slate-100 p-3">
                  <p className="text-sm font-medium text-slate-800">{event.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDateTime(event.startsAt)}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
