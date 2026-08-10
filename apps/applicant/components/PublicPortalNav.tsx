"use client";

import { useState } from "react";
import Link from "next/link";
import { RecruiterAccessModal } from "./RecruiterAccessModal";

export function PublicPortalNav() {
  const [accessModalOpen, setAccessModalOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold leading-tight text-brand-navy">TalentOS</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Public Portal
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-slate-600 sm:inline">Public Talent Directory</span>
              <button
                onClick={() => setAccessModalOpen(true)}
                className="rounded-lg bg-brand-blue px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Access Full Profiles
              </button>
              <Link
                href="/recruiter"
                className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700"
              >
                Recruiter workspace
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <RecruiterAccessModal open={accessModalOpen} onClose={() => setAccessModalOpen(false)} />
    </>
  );
}
