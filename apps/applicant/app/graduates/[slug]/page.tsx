"use client";

import { useState, useEffect } from "react";
import { GraduateCard } from "@/components/GraduateCard";
import { AlertCircle, Mail, BriefcaseBusiness } from "lucide-react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ShareProfileButtons } from "@/components/ShareProfileButtons";

interface GraduateProfile {
  id: string;
  slug: string;
  name: string;
  photo: string | null;
  rating: number;
  bio: string;
  completionDate: string;
  country?: string;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
}

export default function GraduateProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<GraduateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/graduates/${slug}`);

        if (!response.ok) {
          throw new Error("Profile not found");
        }

        const data = await response.json();
        setProfile(data.profile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-xl font-bold text-brand-navy">TalentOS</div>
              <div className="text-sm text-slate-600">Graduate Profile</div>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-4xl px-6 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-64 rounded-lg bg-slate-200" />
            <div className="h-8 w-1/3 rounded bg-slate-200" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-slate-100" />
              <div className="h-4 w-full rounded bg-slate-100" />
              <div className="h-4 w-2/3 rounded bg-slate-100" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-xl font-bold text-brand-navy">TalentOS</div>
              <div className="text-sm text-slate-600">Graduate Profile</div>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-4xl px-6 py-12">
          <div className="flex gap-3 rounded-lg bg-red-50 p-6">
            <AlertCircle className="h-6 w-6 flex-shrink-0 text-red-600" />
            <div>
              <h2 className="font-semibold text-red-900">Profile Not Found</h2>
              <p className="mt-1 text-red-700">
                {error || "The graduate profile you're looking for doesn't exist."}
              </p>
              <a
                href="/graduates"
                className="mt-3 inline-block text-sm font-medium text-red-700 hover:text-red-800 underline"
              >
                Back to Directory
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <a href="/graduates" className="text-xl font-bold text-brand-navy">
              TalentOS
            </a>
            <div className="text-sm text-slate-600">{profile.name}</div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Profile Card - Main Column */}
          <div className="md:col-span-2">
            <GraduateCard {...profile} />

            {/* Profile Details */}
            <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">About</h2>
              <p className="mt-3 text-slate-600 leading-relaxed">{profile.bio}</p>
              <ShareProfileButtons name={profile.name} />

              {profile.country && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600">
                    <strong>Location:</strong> {profile.country}
                  </p>
                </div>
              )}
            </div>

            {/* Information Box */}
            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-2">
              <Mail className="h-5 w-5 flex-shrink-0 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p>
                  <strong>Full portfolio access:</strong> To see this graduate&apos;s complete portfolio,
                  missions, assignments, and engineering journal, use the &quot;Request Full Profile Access&quot;
                  button to submit a single access request for all graduates.
                </p>
              </div>
            </div>
          </div>

          {/* Access CTA - Sidebar */}
          <div>
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <BriefcaseBusiness className="h-8 w-8 text-brand-blue" />
              <h3 className="mt-3 text-lg font-semibold text-slate-900">Want full access?</h3>
              <p className="mt-1 text-sm text-slate-600">
                Request access to all graduate portfolios — missions, assignments, and engineering
                journals — with a single form. Our team reviews requests within 24 hours.
              </p>
              <Link
                href="/graduates"
                className="mt-4 inline-block w-full rounded-lg bg-brand-blue px-4 py-2.5 text-center font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Request Full Profile Access
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-600 mt-12">
        <p>© 2026 TalentOS. All rights reserved.</p>
      </footer>
    </div>
  );
}
