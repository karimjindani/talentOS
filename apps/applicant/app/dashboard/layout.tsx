import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserByEmail, listApplicantApplications, countUnreadNotifications } from "@talentos/db";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { ApplicantShell } from "@/components/ApplicantShell";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Bind the session to the tenant resolved from the Host header via DB membership. Non-members
  // are redirected to /access-denied; unauthenticated users to /login.
  const { tenant } = await requireTenantAccess("accessApplicantPortal");

  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) {
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
