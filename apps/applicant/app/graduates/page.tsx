import { PublicGraduateDirectory } from "@/components/PublicGraduateDirectory";
import Link from "next/link";

export const metadata = {
  title: "Graduate Talent Directory | TalentOS",
  description: "Discover verified graduates from our program. View profiles and connect with top talent.",
};

export default function GraduatesPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold leading-tight text-brand-navy">TalentOS</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Public Portal
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm"><span className="hidden text-slate-600 sm:inline">Public Talent Directory</span><Link href="/recruiter" className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700">Recruiter workspace</Link></div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-12">
        <PublicGraduateDirectory />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-600">
        <p>© 2026 TalentOS. All rights reserved.</p>
      </footer>
    </div>
  );
}
