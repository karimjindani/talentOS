"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/logout-action";

export type ApplicantNavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

export const APPLICANT_NAV_ITEMS: ApplicantNavItem[] = [
  { href: "/dashboard", label: "Dashboard", exact: true },
  { href: "/dashboard/program", label: "My Program" },
  { href: "/dashboard/missions", label: "Missions" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/resources", label: "Resources" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/mentor", label: "AI Mentor" },
];

const baseLinkClass = "rounded-lg px-3 py-2 font-medium transition-colors";
const inactiveClass = "text-slate-700 hover:bg-slate-100 hover:text-brand-blue";
const activeClass = "bg-brand-blue text-white font-semibold shadow-sm";

export function isApplicantNavActive(pathname: string, item: ApplicantNavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ApplicantShell({
  userName,
  userEmail,
  unreadCount = 0,
  children,
}: {
  userName?: string | null;
  userEmail?: string | null;
  unreadCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="px-5 py-5">
          <Link href="/dashboard" className="text-xl font-bold text-brand-navy">
            TalentOS
          </Link>
          <p className="mt-1 text-xs text-slate-500">Applicant Portal</p>
        </div>
        <nav className="mt-2 grid gap-1 px-3 text-sm">
          {APPLICANT_NAV_ITEMS.map((item) => {
            const active = isApplicantNavActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${baseLinkClass} ${active ? activeClass : inactiveClass} flex items-center justify-between`}
              >
                <span>{item.label}</span>
                {item.href === "/dashboard/notifications" && unreadCount > 0 ? (
                  <span className="ml-1 rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        {/* User info + logout pinned to bottom. The dashboard replaces PortalHeader entirely, so
            the shell must carry its own sign-out affordance (v0.14.3 / D-066). */}
        <div className="mt-auto border-t border-slate-200 px-5 py-4">
          <p className="truncate text-sm font-medium text-slate-700">
            {userName ?? userEmail ?? "Applicant"}
          </p>
          {userEmail ? (
            <p className="truncate text-xs text-slate-500">{userEmail}</p>
          ) : null}
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="w-full cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              Logout
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="md:pl-64">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
