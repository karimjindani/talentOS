import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import { getTenantBySlug, getUserByEmail, listApplicantApplications, countUnreadNotifications } from "@talentos/db";
import { ApplicantShell } from "@/components/ApplicantShell";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const email = session?.user?.email ?? null;

  if (!email || !tenant) {
    redirect("/login");
  }

  const user = await getUserByEmail(email);
  if (!user) {
    redirect("/login");
  }

  const applications = await listApplicantApplications(user.id, tenant.id);
  const acceptedApp = applications.find((a) => a.status === "ACCEPTED");

  if (!acceptedApp) {
    // No accepted application — send to application status page
    redirect("/application");
  }

  const unreadCount = await countUnreadNotifications(user.id, tenant.id);

  return (
    <ApplicantShell userName={user.name} userEmail={user.email} unreadCount={unreadCount}>
      {children}
    </ApplicantShell>
  );
}
