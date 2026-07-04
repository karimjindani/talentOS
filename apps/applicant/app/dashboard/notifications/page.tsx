import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getTenantBySlug,
  getUserByEmail,
  listUserNotifications,
  markNotificationRead,
} from "@talentos/db";

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const typeStyles: Record<string, { icon: string; bg: string; text: string }> = {
  INFO: { icon: "ℹ️", bg: "bg-blue-50", text: "text-blue-700" },
  WARNING: { icon: "⚠️", bg: "bg-amber-50", text: "text-amber-700" },
  SUCCESS: { icon: "✅", bg: "bg-emerald-50", text: "text-emerald-700" },
  TASK_DUE: { icon: "⏰", bg: "bg-rose-50", text: "text-rose-700" },
};

export default async function NotificationsPage() {
  const session = await auth();
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const email = session?.user?.email ?? null;
  const user = email && tenant ? await getUserByEmail(email) : null;

  if (!user || !tenant) {
    return null;
  }

  const notifications = await listUserNotifications(user.id, tenant.id);

  async function handleMarkRead(formData: FormData) {
    "use server";
    const id = formData.get("notificationId") as string;
    if (id) {
      await markNotificationRead(id, user!.id);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-brand-navy">Notifications</h1>
      <p className="mt-2 text-slate-600">Stay updated on tasks, deadlines, and program announcements.</p>

      <div className="mt-6 space-y-3">
        {notifications.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-slate-500">No notifications yet.</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const style = typeStyles[notif.type] ?? typeStyles.INFO;
            return (
              <div
                key={notif.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm ${
                  notif.readAt ? "border-slate-200" : "border-brand-blue/30 ring-1 ring-brand-blue/10"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.bg} ${style.text}`}>
                    <span className="text-lg">{style.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-800">{notif.title}</p>
                      {!notif.readAt ? (
                        <span className="rounded-full bg-brand-blue px-2 py-0.5 text-xs font-semibold text-white">
                          New
                        </span>
                      ) : null}
                    </div>
                    {notif.body ? (
                      <p className="mt-1 text-sm text-slate-600">{notif.body}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-400">{formatDateTime(notif.createdAt)}</p>
                  </div>
                  {!notif.readAt ? (
                    <form action={handleMarkRead}>
                      <input type="hidden" name="notificationId" value={notif.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-brand-blue hover:text-brand-blue"
                      >
                        Mark as read
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
