import { PublicGraduateDirectory } from "@/components/PublicGraduateDirectory";
import { PublicPortalNav } from "@/components/PublicPortalNav";

export const metadata = {
  title: "Graduate Talent Directory | TalentOS",
  description: "Discover verified graduates from our program. View profiles and connect with top talent.",
};

export default function GraduatesPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <PublicPortalNav />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-12">
        <PublicGraduateDirectory />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
        <div className="mx-auto max-w-7xl px-6">
          <p className="font-semibold text-slate-700">TalentOS — Verified Graduate Talent Directory</p>
          <p className="mt-1">© 2026 TalentOS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
