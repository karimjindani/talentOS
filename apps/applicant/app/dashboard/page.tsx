import Link from "next/link";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
  listProgramTasks,
  listCalendarEvents,
  listUserNotifications,
  getApplicantMissionProgress,
  listCompletedTaskIds,
  type SubmissionStatus,
} from "@talentos/db";

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
  const tasks = await listProgramTasks(tenant.id, program.id);
  const completedTaskIds = await listCompletedTaskIds(user.id, program.id);
  const events = await listCalendarEvents(tenant.id, program.id);
  const notifications = await listUserNotifications(user.id, tenant.id);
  // Mission-driven progress (v0.16.0, D-069): the SEM learning loop is the source of truth — only
  // ACCEPTED mission submissions move the bar. Tasks remain a supplementary checklist below.
  const missionProgress = await getApplicantMissionProgress(tenant.id, user.id, program.id);

  const totalTasks = tasks.length;
  const completedTasks = completedTaskIds.length;
  const overallPercentage = missionProgress.overall.percentage;

  const now = new Date();
  const daysRemaining = program.endsAt
    ? Math.max(0, Math.ceil((new Date(program.endsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const recentNotifications = notifications.slice(0, 3);
  const upcomingEvents = events.slice(0, 2);
  const currentWeekTasks = tasks.filter((t) => t.weekNumber === 1).slice(0, 4); // Week 1 tasks as "current"

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
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-brand-blue" style={{ width: `${overallPercentage}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">accepted missions</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Missions Accepted</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{missionProgress.overall.accepted}</p>
          <p className="mt-1 text-xs text-slate-500">of {missionProgress.overall.total} total</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Tasks Completed</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{completedTasks}</p>
          <p className="mt-1 text-xs text-slate-500">of {totalTasks} total</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Days Remaining</p>
          <p className="mt-2 text-2xl font-bold text-brand-navy">{daysRemaining ?? "—"}</p>
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
              <div key={week.weekNumber}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">Week {week.weekNumber}</span>
                  <span className="text-slate-500">
                    {week.acceptedMissions}/{week.totalMissions} missions · {week.percentage}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-brand-blue" style={{ width: `${week.percentage}%` }} />
                </div>
              </div>
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
                <SubmissionStatusChip status={missionProgress.currentMission.submissionStatus} />
              </div>
            </Link>
          ) : missionProgress.overall.total > 0 ? (
            <p className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
              All missions accepted — your portfolio evidence is complete. 🎉
            </p>
          ) : (
            <p className="text-sm text-slate-500">No assigned missions yet.</p>
          )}
        </div>

        {/* Current week tasks */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-navy">Current Tasks</h2>
            <Link href="/dashboard/tasks" className="text-sm font-medium text-brand-blue hover:underline">
              View all →
            </Link>
          </div>
          {currentWeekTasks.length === 0 ? (
            <p className="text-sm text-slate-500">No tasks for this week yet.</p>
          ) : (
            <div className="space-y-3">
              {currentWeekTasks.map((task) => {
                const done = completedTaskIds.includes(task.id);
                return (
                  <div key={task.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                    <div className={`mt-0.5 h-5 w-5 shrink-0 rounded ${done ? "bg-emerald-500" : "border-2 border-slate-300"}`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                        {task.title}
                      </p>
                      {task.dueAt ? (
                        <p className="mt-0.5 text-xs text-slate-500">Due: {formatDate(task.dueAt)}</p>
                      ) : null}
                    </div>
                  </div>
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

function SubmissionStatusChip({ status }: { status: SubmissionStatus | null }) {
  if (!status) {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Not started</span>
    );
  }
  const styles: Record<SubmissionStatus, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    SUBMITTED: "bg-blue-100 text-blue-700",
    REVIEWED: "bg-slate-100 text-slate-700",
    NEEDS_REVISION: "bg-amber-100 text-amber-800",
    ACCEPTED: "bg-emerald-100 text-emerald-700"
  };
  const labels: Record<SubmissionStatus, string> = {
    DRAFT: "Draft saved",
    SUBMITTED: "Submitted — awaiting review",
    REVIEWED: "Reviewed",
    NEEDS_REVISION: "Revision requested",
    ACCEPTED: "Accepted"
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}
