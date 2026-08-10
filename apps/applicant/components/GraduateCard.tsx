"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, Calendar } from "lucide-react";

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
}: GraduateCardProps) {
  const completionYear = new Date(completionDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      {/* Photo Section */}
      <div className="relative h-48 w-full bg-gradient-to-br from-brand-blue to-brand-purple">
        {photo ? (
          <Image
            src={photo}
            alt={name}
            fill
            unoptimized
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-4xl font-bold text-white opacity-20">
              {name.charAt(0)}
            </div>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4">
        {/* Header with Name and Rating */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
              <Calendar className="h-3.5 w-3.5" />
              Graduated {completionYear}
            </p>
          </div>
          <div className="flex items-center gap-1 whitespace-nowrap rounded-full bg-yellow-50 px-3 py-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-700">{rating.toFixed(1)}</span>
          </div>
        </div>

        {/* Bio */}
        <p className="mt-3 line-clamp-2 text-sm text-slate-600">{bio}</p>

        {/* Social Links */}
        <div className="mt-3 flex gap-2">
          {linkedinUrl && (
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-blue-100 hover:text-blue-600"
              aria-label="LinkedIn"
            >
              <span className="text-xs font-bold">in</span>
            </a>
          )}
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-900 hover:text-white"
              aria-label="GitHub"
            >
              <span className="text-xs font-bold">GH</span>
            </a>
          )}
        </div>

        {/* View Profile Button */}
        <Link
          href={`/graduates/${slug}`}
          className="mt-4 block w-full rounded-lg bg-brand-blue py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          View Profile
        </Link>
      </div>
    </div>
  );
}
