import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
  listCalendarEvents,
} from "@talentos/db";

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(value: Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default async function CalendarPage() {
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
  const events = await listCalendarEvents(tenant.id, program.id, true); // include past

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.startsAt) >= now);
  const past = events.filter((e) => new Date(e.startsAt) < now).reverse();

  return (
    <div>
      <h1 className="text-3xl font-bold text-brand-navy">Calendar</h1>
      <p className="mt-2 text-slate-600">Upcoming events and deadlines for {program.name}.</p>

      {/* Upcoming events */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-brand-navy">Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-slate-500">No upcoming events.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((event) => (
              <div key={event.id} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-mist">
                  <span className="text-lg font-bold text-brand-blue">
                    {new Date(event.startsAt).getDate()}
                  </span>
                  <span className="text-xs text-brand-blue">
                    {new Date(event.startsAt).toLocaleDateString("en-US", { month: "short" })}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{event.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDateTime(event.startsAt)}
                    {event.endsAt ? ` – ${formatTime(event.endsAt)}` : ""}
                  </p>
                  {event.location ? (
                    <p className="mt-1 text-sm text-brand-blue">
                      📍 {event.location}
                    </p>
                  ) : null}
                  {event.description ? (
                    <p className="mt-2 text-sm text-slate-600">{event.description}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past events */}
      {past.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-400">Past Events</h2>
          <div className="space-y-3">
            {past.map((event) => (
              <div key={event.id} className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-200">
                  <span className="text-lg font-bold text-slate-400">
                    {new Date(event.startsAt).getDate()}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(event.startsAt).toLocaleDateString("en-US", { month: "short" })}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-500">{event.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(event.startsAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
