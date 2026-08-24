"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { AlertCircle, Bookmark, Download, ExternalLink, Loader, Star, Clock, LogOut, FileText, CheckCircle2, FolderGit2, Link as LinkIcon } from "lucide-react";
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

type ReviewHistoryEntry = {
  round: number;
  decision: "ACCEPTED" | "CHANGES_REQUESTED" | "REPEAT";
  feedback: string | null;
  createdAt: string;
};

type Assignment = {
  id: string;
  missionTitle: string;
  weekNumber: number;
  competencyTags: string[];
  rating: number;
  completionDate: string | null;
  reviewerFeedback: string | null;
  repositoryUrl: string | null;
  deploymentUrl: string | null;
  loomUrl: string | null;
  journalEntries: JournalEntry[];
  revisionCount: number;
  reviewOutcome: string | null;
  reviewHistory: ReviewHistoryEntry[];
};

type Portfolio = {
  accessExpiresAt?: string | null;
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
    program?: { id: string; name: string } | null;
  };
  rating: number;
  completionDate: string;
  assignments: Assignment[];
  saved: boolean;
  artifacts: { id: string; title: string; url: string; description: string | null }[];
  aiEvaluation: null | { technicalSkills: number; problemSolving: number; communication: number; ownership: number; teamCollaboration: number; summary: string };
};

type SidebarGraduate = {
  id: string;
  slug: string;
  name: string;
  photo: string | null;
  rating: number;
  bio: string;
  program: { id: string; name: string } | null;
  skills: string[];
};

export default function GraduatePortfolioPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Portfolio | null>(null);
  const [graduates, setGraduates] = useState<SidebarGraduate[]>([]);
  const [accessExpiresAt, setAccessExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  // Load the sidebar list of all accessible graduates
  useEffect(() => {
    fetch("/api/recruiter/graduates", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return;
        const body = await r.json();
        if (body.success) {
          setGraduates(body.graduates || []);
          setAccessExpiresAt(body.accessExpiresAt || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, []);

  // Load the selected graduate's full profile
  useEffect(() => {
    const controller = new AbortController();
    setProfile(null);
    setError(null);
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

  async function logout() {
    await fetch("/api/recruiter/logout", { method: "POST" });
    router.push("/graduates");
  }

  // -- Loading state --
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

  const daysLeft = accessExpiresAt ? Math.ceil((new Date(accessExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href="/graduates" className="text-xl font-bold text-brand-navy">
            TalentOS
            <span className="ml-2 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-700">Full Access Granted</span>
          </Link>
          <div className="flex items-center gap-4">
            {daysLeft !== null && (
              <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${daysLeft <= 1 ? "border-rose-200 bg-rose-50 text-rose-700" : daysLeft <= 3 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                <Clock className="h-3.5 w-3.5" />
                Access expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
              </div>
            )}
            <button onClick={logout} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900">
              <LogOut className="h-4 w-4" />Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left sidebar — all accessible graduates */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
          <div className="px-4 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">All Graduates</h2>
            <p className="mt-0.5 text-xs text-slate-400">{graduates.length} available</p>
          </div>
          <nav className="px-2 pb-4">
            {loadingList ? (
              <div className="flex justify-center py-8"><Loader className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : graduates.length === 0 ? (
              <p className="px-2 py-4 text-sm text-slate-400">No graduates available.</p>
            ) : (
              graduates.map((g) => (
                <button
                  key={g.id}
                  onClick={() => router.push(`/graduates/${g.slug}/portfolio`)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${g.slug === slug ? "bg-brand-mist text-brand-blue" : "hover:bg-slate-50"}`}
                >
                  {g.photo ? (
                    <Image src={g.photo} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-bold text-white">{g.name[0]}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{g.name}</p>
                    <p className="flex items-center gap-1 text-xs text-amber-600">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {g.rating.toFixed(1)}
                    </p>
                  </div>
                  {g.slug === slug && <div className="h-2 w-2 rounded-full bg-brand-blue" />}
                </button>
              ))
            )}
          </nav>
        </aside>

        {/* Main content — comprehensive profile */}
        <main className="flex-1 overflow-y-auto">
          {!profile ? (
            <div className="flex h-full items-center justify-center"><Loader className="h-10 w-10 animate-spin text-brand-blue" /></div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
              {/* Actions bar */}
              <div className="flex flex-wrap justify-end gap-3">
                <button onClick={toggleSave} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">
                  <Bookmark className={`h-4 w-4 ${profile.saved ? "fill-brand-blue text-brand-blue" : ""}`} />
                  {profile.saved ? "Saved" : "Save candidate"}
                </button>
                <CandidateContactModal slug={slug} candidateName={profile.overview.name} />
                <a href={`/api/graduates/${slug}/report`} className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 font-semibold text-white hover:bg-brand-navy">
                  <Download className="h-4 w-4" />Download report
                </a>
              </div>

              {/* Applicant Header */}
              <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex flex-wrap items-start gap-6">
                  {profile.overview.photo ? (
                    <Image src={profile.overview.photo} alt={profile.overview.name} width={120} height={120} unoptimized className="h-28 w-28 rounded-2xl border border-slate-200 object-cover" />
                  ) : (
                    <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-brand-blue text-4xl font-bold text-white">{profile.overview.name[0]}</div>
                  )}
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-slate-900">{profile.overview.name}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                      {profile.overview.program?.name && <span className="font-medium">{profile.overview.program.name}</span>}
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        Program Graduate
                      </span>
                      <span>Completed {new Date(profile.completionDate).toLocaleDateString()}</span>
                      {profile.overview.country && <span>· {profile.overview.country}</span>}
                    </div>
                    {profile.overview.bio && <p className="mt-4 max-w-2xl leading-6 text-slate-600">{profile.overview.bio}</p>}
                    <div className="mt-4 flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-2 text-amber-800">
                        <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                        <span className="text-xl font-bold">{profile.rating.toFixed(2)}</span><span>/ 5</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Professional Information */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Professional Information</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {profile.overview.skills.length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="text-sm font-medium text-slate-500">Skills</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profile.overview.skills.map((skill) => <span key={skill} className="rounded-full bg-brand-mist px-3 py-1 text-sm font-medium text-brand-blue">{skill}</span>)}
                      </div>
                    </div>
                  )}
                  {profile.overview.interests.length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="text-sm font-medium text-slate-500">Interests</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profile.overview.interests.map((interest) => <span key={interest} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">{interest}</span>)}
                      </div>
                    </div>
                  )}
                  {profile.overview.linkedinUrl && (
                    <a href={profile.overview.linkedinUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <LinkIcon className="h-4 w-4 text-[#0A66C2]" />LinkedIn Profile
                    </a>
                  )}
                  {profile.overview.githubUrl && (
                    <a href={profile.overview.githubUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <LinkIcon className="h-4 w-4 text-slate-700" />GitHub Profile
                    </a>
                  )}
                </div>
              </section>

              {/* Training Summary */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Training Summary</h2>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <SummaryCard label="Program" value={profile.overview.program?.name || "TalentOS"} />
                  <SummaryCard label="Missions Completed" value={String(profile.assignments.length)} />
                  <SummaryCard label="Overall Rating" value={`${profile.rating.toFixed(1)} / 5`} />
                  <SummaryCard label="Graduation Date" value={new Date(profile.completionDate).toLocaleDateString()} />
                </div>
              </section>

              {/* 4-Week Mission Journey */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Training Journey — Mission Evidence</h2>
                <div className="mt-4 space-y-4">
                  {profile.assignments.length === 0 ? (
                    <p className="text-slate-500">No mission evidence available.</p>
                  ) : (
                    profile.assignments
                      .slice()
                      .sort((a, b) => a.weekNumber - b.weekNumber)
                      .map((assignment) => (
                        <article key={assignment.id} className="rounded-xl border border-slate-200 p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">Week {assignment.weekNumber}</p>
                              <h3 className="mt-1 text-base font-semibold text-slate-900">{assignment.missionTitle}</h3>
                              {assignment.competencyTags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {assignment.competencyTags.map((tag) => (
                                    <span key={tag} className="rounded-full bg-brand-mist px-2.5 py-0.5 text-xs font-semibold text-brand-blue">{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Accepted
                              </span>
                              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                {assignment.rating.toFixed(1)} / 5
                              </span>
                            </div>
                          </div>
                          <p className="mt-3 text-xs font-medium text-slate-500">
                            {assignment.revisionCount > 0
                              ? `Accepted after ${assignment.revisionCount} round${assignment.revisionCount === 1 ? "" : "s"} of feedback`
                              : "Accepted on the first submission"}
                          </p>
                          {assignment.reviewerFeedback && (
                            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-5 text-slate-600">{assignment.reviewerFeedback}</p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-3">
                            <EvidenceLink href={assignment.repositoryUrl} label="GitHub Repository" icon="github" />
                            <EvidenceLink href={assignment.deploymentUrl} label="Live Deployment" icon="external" />
                            <EvidenceLink href={assignment.loomUrl} label="Loom Walkthrough" icon="external" />
                          </div>
                          {assignment.reviewHistory.length > 1 && (
                            <details className="mt-4 rounded-lg border border-slate-100 p-3">
                              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                                Review history ({assignment.reviewHistory.length} rounds)
                              </summary>
                              <div className="mt-3 divide-y divide-slate-100">
                                {assignment.reviewHistory.map((review) => (
                                  <div key={review.round} className="py-3 first:pt-0 last:pb-0">
                                    <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                      Round {review.round} · {review.decision === "ACCEPTED" ? "Accepted" : review.decision === "CHANGES_REQUESTED" ? "Changes requested" : "Week repeated"}
                                      <span className="font-normal text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                                    </p>
                                    {review.feedback && <p className="mt-1 text-sm text-slate-700">{review.feedback}</p>}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                          {assignment.journalEntries.length > 0 && (
                            <details className="mt-4 rounded-lg border border-slate-100 p-3">
                              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                                Engineering journal ({assignment.journalEntries.length} entries)
                              </summary>
                              <div className="mt-3 divide-y divide-slate-100">
                                {assignment.journalEntries.map((entry) => (
                                  <div key={entry.id} className="py-3 first:pt-0 last:pb-0">
                                    <p className="text-xs font-semibold text-slate-500">{new Date(entry.entryDate).toLocaleDateString()}</p>
                                    <p className="mt-1 text-sm text-slate-700"><strong>Worked on:</strong> {entry.workedOn}</p>
                                    <p className="mt-1 text-sm text-slate-700"><strong>Challenge:</strong> {entry.challenge}</p>
                                    <p className="mt-1 text-sm text-slate-700"><strong>Solution:</strong> {entry.solution}</p>
                                    <p className="mt-1 text-sm text-slate-700"><strong>Learned:</strong> {entry.learned}</p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </article>
                      ))
                  )}
                </div>
              </section>

              {/* Projects / Artifacts */}
              {profile.artifacts.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900">Projects & Artifacts</h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {profile.artifacts.map((artifact) => (
                      <a key={artifact.id} href={artifact.url} target="_blank" rel="noreferrer noopener" className="block rounded-xl border border-slate-200 p-4 hover:border-brand-blue hover:bg-brand-mist/30">
                        <div className="flex items-start gap-3">
                          <FolderGit2 className="h-5 w-5 shrink-0 text-brand-blue" />
                          <div>
                            <p className="font-semibold text-slate-900">{artifact.title}</p>
                            {artifact.description && <p className="mt-1 text-sm text-slate-500">{artifact.description}</p>}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* AI Evaluation */}
              {profile.aiEvaluation && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900">AI Evaluation Summary</h2>
                  <p className="mt-3 text-slate-600">{profile.aiEvaluation.summary}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <EvalScore label="Tech Skills" value={profile.aiEvaluation.technicalSkills} />
                    <EvalScore label="Problem Solving" value={profile.aiEvaluation.problemSolving} />
                    <EvalScore label="Communication" value={profile.aiEvaluation.communication} />
                    <EvalScore label="Ownership" value={profile.aiEvaluation.ownership} />
                    <EvalScore label="Teamwork" value={profile.aiEvaluation.teamCollaboration} />
                  </div>
                </section>
              )}

              {/* Documents & Links */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Documents & Professional Links</h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  {profile.overview.linkedinUrl && (
                    <a href={profile.overview.linkedinUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <LinkIcon className="h-4 w-4 text-[#0A66C2]" />LinkedIn
                    </a>
                  )}
                  {profile.overview.githubUrl && (
                    <a href={profile.overview.githubUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <LinkIcon className="h-4 w-4 text-slate-700" />GitHub
                    </a>
                  )}
                  <a href={`/api/graduates/${slug}/report`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <FileText className="h-4 w-4 text-brand-blue" />Download Full Report
                  </a>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function EvalScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-brand-blue">{value.toFixed(1)}</p>
    </div>
  );
}

function EvidenceLink({ href, label, icon }: { href: string | null; label: string; icon: "github" | "external" }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-brand-blue hover:bg-brand-mint/30">
      {icon === "github" ? <LinkIcon className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
      {label}
    </a>
  );
}
