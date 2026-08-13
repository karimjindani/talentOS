"use client";

import { useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, GraduationCap } from "lucide-react";
import { RecruiterAccessModal } from "./RecruiterAccessModal";

export function PublicPortalNav() {
  const [accessModalOpen, setAccessModalOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-brand-purple text-white">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xl font-bold leading-tight text-brand-navy">TalentOS</div>
                <div className="mt-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Graduate Directory
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <button
                onClick={() => setAccessModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
              >
                <BriefcaseBusiness className="h-4 w-4" />
                Access Full Profiles
              </button>
              <Link
                href="/recruiter"
                className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                Recruiter Login
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <RecruiterAccessModal open={accessModalOpen} onClose={() => setAccessModalOpen(false)} />
    </>
  );
}
