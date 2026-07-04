"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  /** Exact match for `/`, startsWith for all others. */
  exact?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", exact: true },
  { href: "/applications", label: "Applications" },
  { href: "/programs", label: "Programs" },
  { href: "/missions", label: "Missions" },
  { href: "/operations", label: "Operations" },
  { href: "/settings", label: "Settings" }
];

const baseLinkClass =
  "rounded-lg px-3 py-2 font-medium transition-colors";
const inactiveClass =
  "text-slate-700 hover:bg-slate-100 hover:text-brand-blue";
const activeClass =
  "bg-brand-blue text-white font-semibold shadow-sm";

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SidebarNav({
  isSuperAdmin,
  applicantUrl
}: {
  isSuperAdmin: boolean;
  applicantUrl: string;
}) {
  const pathname = usePathname();

  const items = isSuperAdmin
    ? [...NAV_ITEMS, { href: "/organizations", label: "Organizations" }]
    : NAV_ITEMS;

  return (
    <nav className="mt-8 grid gap-1 text-sm">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${baseLinkClass} ${active ? activeClass : inactiveClass}`}
          >
            {item.label}
          </Link>
        );
      })}
      <a
        className="mt-2 rounded-lg px-3 py-2 font-medium text-brand-blue transition-colors hover:bg-brand-mist"
        href={applicantUrl}
      >
        Applicant portal
      </a>
    </nav>
  );
}
