"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, Bookmark, Download, ExternalLink, Loader, Star } from "lucide-react";
import { CandidateContactModal } from "@/components/CandidateContactModal";
import Link from "next/link";

type JournalEntry = {
  id: string;
  entryDate: string;
  workedOn: string;
  challenge: string;
  solution: string;
  learned: string;
};

type Assignment = {
  id: string;
  missionTitle: string;
  weekNumber: number;
  rating: number;
  completionDate: string | null;
  reviewerFeedback: string | null;
  repositoryUrl: string | null;
  deploymentUrl: string | null;
  loomUrl: string | null;
  journalEntries: JournalEntry[];
};

type Portfolio = {
  overview: {
    name: string;
    email: string | null;
    photo: string | null;
    bio: string | null;
    country: string | null;
    skills: string[];
    interests: string[];
    linkedinUrl: string | null;
    githubUrl: string | null;
  };
  rating: number;
  completionDate: string;
  assignments: Assignment[];
  saved: boolean;
  artifacts: { id: string; title: string; url: string; description: string | null }[];
  aiEvaluation: null | { technicalSkills: number; problemSolving: number; communication: number; ownership: number; teamCollaboration: number; summary: string };
};

export default function GraduatePortfolioPage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/graduates/${slug}/portfolio`, {
      signal: controller.signal,
      cache: "no-store"
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to open this portfolio.");
        setProfile(body.profile);
      })
      .catch((requestError) => {
        if (requestError instanceof Error && requestError.name !== "AbortError") {
          setError(requestError.message);
        }
      });

    return () => controller.abort();
  }, [slug]);

  async function toggleSave() {
    const response = await fetch(`/api/graduates/${slug}/save`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) return setError(body.error || "Unable to save candidate.");
    setProfile((current) => current ? { ...current, saved: body.saved } : current);
  }


  if (error) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 py-20">
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <div><h1 className="font-semibold">Portfolio unavailable</h1><p className="mt-1 text-sm">{error}</p></div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return <main className="flex min-h-screen items-center justify-center"><Loader className="h-10 w-10 animate-spin text-brand-blue" /></main>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5"><span className="text-xl font-bold text-brand-navy">TalentOS verified portfolio</span><Link href="/recruiter" className="text-sm font-semibold text-brand-blue">Recruiter workspace</Link></div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <div className="flex flex-wrap justify-end gap-3">
          <button onClick={toggleSave} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"><Bookmark className={`h-4 w-4 ${profile.saved ? "fill-brand-blue text-brand-blue" : ""}`} />{profile.saved ? "Saved" : "Save candidate"}</button>
          <CandidateContactModal slug={slug} candidateName={profile.overview.name} />
          <a href={`/api/graduates/${slug}/report`} className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 font-semibold text-white"><Download className="h-4 w-4" />Download report</a>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-blue">Program graduate</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">{profile.overview.name}</h1>
              <p className="mt-3 max-w-2xl text-slate-600">{profile.overview.bio}</p>
              <p className="mt-3 text-sm text-slate-500">
                Completed {new Date(profile.completionDate).toLocaleDateString()}
                {profile.overview.country ? ` · ${profile.overview.country}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-amber-800">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              <span className="text-xl font-bold">{profile.rating.toFixed(2)}</span><span>/ 5</span>
            </div>
          </div>
          {profile.overview.skills.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2">{profile.overview.skills.map((skill) => <span key={skill} className="rounded-full bg-brand-mist px-3 py-1 text-sm font-medium text-brand-blue">{skill}</span>)}</div>
          ) : null}
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">AI evaluation summary</h2>{profile.aiEvaluation ? <><p className="mt-3 text-slate-600">{profile.aiEvaluation.summary}</p><div className="mt-4 grid grid-cols-2 gap-2 text-sm">{Object.entries(profile.aiEvaluation).filter(([key]) => key !== "summary").map(([key, value]) => <p key={key} className="rounded-lg bg-slate-50 p-2"><span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>: <strong>{Number(value).toFixed(1)}/5</strong></p>)}</div></> : <p className="mt-3 text-slate-600">Evaluation will appear after evidence has been processed.</p>}</div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">Additional artifacts</h2>{profile.artifacts.length ? <div className="mt-3 space-y-3">{profile.artifacts.map((artifact) => <a key={artifact.id} href={artifact.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-200 p-3 font-semibold text-brand-blue">{artifact.title}<span className="block text-sm font-normal text-slate-500">{artifact.description}</span></a>)}</div> : <p className="mt-3 text-slate-600">No additional artifacts provided.</p>}</div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">Mission results and evidence</h2>
          <div className="mt-4 grid gap-5">
            {profile.assignments.map((assignment) => (
              <article key={assignment.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-sm text-slate-500">Week {assignment.weekNumber}</p><h3 className="text-lg font-semibold text-slate-900">{assignment.missionTitle}</h3></div>
                  <div className="font-semibold text-amber-700">{assignment.rating.toFixed(1)} / 5</div>
                </div>
                {assignment.reviewerFeedback ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{assignment.reviewerFeedback}</p> : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  <EvidenceLink href={assignment.repositoryUrl} label="GitHub repository" />
                  <EvidenceLink href={assignment.deploymentUrl} label="Live deployment" />
                  <EvidenceLink href={assignment.loomUrl} label="Loom walkthrough" />
                </div>
                {assignment.journalEntries.length > 0 ? (
                  <details className="mt-5 rounded-xl border border-slate-200 p-4">
                    <summary className="cursor-pointer font-semibold text-slate-800">Engineering journal ({assignment.journalEntries.length})</summary>
                    <div className="mt-4 divide-y divide-slate-200">
                      {assignment.journalEntries.map((entry) => (
                        <div key={entry.id} className="py-4 first:pt-0 last:pb-0">
                          <p className="text-sm font-semibold text-slate-900">{new Date(entry.entryDate).toLocaleDateString()}</p>
                          <p className="mt-2 text-sm text-slate-700"><strong>Worked on:</strong> {entry.workedOn}</p>
                          <p className="mt-1 text-sm text-slate-700"><strong>Challenge:</strong> {entry.challenge}</p>
                          <p className="mt-1 text-sm text-slate-700"><strong>Solution:</strong> {entry.solution}</p>
                          <p className="mt-1 text-sm text-slate-700"><strong>Learned:</strong> {entry.learned}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function EvidenceLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return <a href={href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue underline"><ExternalLink className="h-4 w-4" />{label}</a>;
}
