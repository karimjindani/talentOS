import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "TalentOS Admin",
  description: "Program administration portal for TalentOS tenant owners and admins"
};

const applicantUrl = process.env.NEXT_PUBLIC_APPLICANT_URL ?? "http://localhost:3100";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-slate-100">
          <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-6 md:block">
            <h1 className="text-xl font-bold">TalentOS Admin</h1>
            <nav className="mt-8 grid gap-3 text-sm text-slate-700">
              <Link href="/">Overview</Link>
              <Link href="/applications">Applications</Link>
              <Link href="/programs">Programs</Link>
              <Link href="/settings">Settings</Link>
              <a className="mt-4 text-brand-blue" href={applicantUrl}>
                Applicant portal
              </a>
            </nav>
          </aside>
          <main className="md:pl-64">
            <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
