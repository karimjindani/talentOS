import Link from "next/link";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-6 md:block">
        <h1 className="text-xl font-bold">TalentOS Admin</h1>
        <nav className="mt-8 grid gap-3 text-sm text-slate-700">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/applications">Applications</Link>
          <Link href="/admin/programs">Programs</Link>
          <Link href="/admin/settings">Settings</Link>
        </nav>
      </aside>
      <main className="md:pl-64">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
