"use client";

import { Star, Calendar, Award } from "lucide-react";

interface GraduateCardProps {
  id: string;
  slug: string;
  name: string;
  photo: string | null;
  rating: number;
  bio: string;
  completionDate: string;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  program?: { id: string; name: string } | null;
}

export function GraduateCard({
  slug,
  name,
  photo,
  rating,
  bio,
  completionDate,
  linkedinUrl,
  githubUrl,
  program,
}: GraduateCardProps) {
  const completionYear = new Date(completionDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const photoUrl = photo ?? `/api/graduates/${slug}/photo`;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-blue/30 hover:shadow-xl">
      {/* Accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-brand-blue via-brand-blue to-brand-purple" />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {/* Circular profile image / initials */}
            {photo ? (
              <img
                src={photoUrl}
                alt={name}
                className="h-12 w-12 flex-shrink-0 rounded-full border-2 border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-gradient-to-br from-brand-blue to-brand-purple text-sm font-bold text-white">
                {initials}
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900 transition-colors group-hover:text-brand-blue">
                {name}
              </h3>
              {program?.name && (
                <p className="mt-1 text-sm font-medium text-slate-500">{program.name}</p>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                <Calendar className="h-4 w-4 text-slate-400" />
                Graduated {completionYear}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-gradient-to-br from-yellow-50 to-amber-50 px-3 py-2">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-lg font-bold text-yellow-700">{rating.toFixed(1)}</span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-yellow-600">Rating</span>
          </div>
        </div>

        {/* Bio */}
        <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-slate-600">{bio}</p>

        {/* Verified badge */}
        <div className="mt-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Award className="h-3.5 w-3.5" />
            Verified Graduate
          </span>
        </div>

        {/* Social Links */}
        <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
          {linkedinUrl && (
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-slate-100 p-2.5 text-slate-600 transition-all hover:bg-blue-100 hover:text-blue-600"
              aria-label="LinkedIn"
            >
              <span className="text-sm font-bold">in</span>
            </a>
          )}
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-slate-100 p-2.5 text-slate-600 transition-all hover:bg-slate-900 hover:text-white"
              aria-label="GitHub"
            >
              <span className="text-sm font-bold">GH</span>
            </a>
          )}
          {!linkedinUrl && !githubUrl && (
            <span className="text-xs text-slate-400">No social links available</span>
          )}
        </div>
      </div>
    </div>
  );
}
