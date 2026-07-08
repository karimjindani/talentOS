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
  getApplicantProgramProgress,
  listCompletedTaskIds,
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
  const weekProgress = await getApplicantProgramProgress(user.id, tenant.id, program.id);

  const totalTasks = tasks.length;
  const completedTasks = completedTaskIds.length;
  const pendingTasks = totalTasks - completedTasks;
  const overallPercentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

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
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Tasks Completed</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{completedTasks}</p>
          <p className="mt-1 text-xs text-slate-500">of {totalTasks} total</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Tasks Pending</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{pendingTasks}</p>
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
            {weekProgress.map((week) => (
              <div key={week.weekNumber}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">Week {week.weekNumber}</span>
                  <span className="text-slate-500">
                    {week.completedTasks}/{week.totalTasks} tasks · {week.percentage}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-brand-blue" style={{ width: `${week.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
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
