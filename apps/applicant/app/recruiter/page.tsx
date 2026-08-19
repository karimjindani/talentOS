"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, Bookmark, BriefcaseBusiness, Loader, LogOut, Save, Star } from "lucide-react";

type Account = { email: string; name: string; organization: string; designation: string; phone: string | null; verifiedAt: string | null };
type Candidate = { id: string; slug: string; name: string; photo: string | null; rating: number; bio: string; program: { id: string; name: string } | null; skills: string[]; savedAt: string; portfolioAccessExpiresAt: string | null };
type Dashboard = { account: Account; savedCandidates: Candidate[] };

export default function RecruiterDashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "signed-out" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function load() {
    const response = await fetch("/api/recruiter", { cache: "no-store" });
    if (response.status === 401) return setStatus("signed-out");
    const body = await response.json();
    if (!response.ok) { setMessage(body.error || "Unable to load recruiter dashboard."); return setStatus("error"); }
    setDashboard(body.dashboard); setStatus("ready");
  }
  useEffect(() => { void load(); }, []);

  async function logout() { await fetch("/api/recruiter/logout", { method: "POST" }); setDashboard(null); setStatus("signed-out"); }
  async function unsave(slug: string) {
    const response = await fetch(`/api/graduates/${slug}/save`, { method: "POST" }); const body = await response.json();
    if (!response.ok) return setMessage(body.error || "Unable to remove candidate.");
    setDashboard((current) => current ? { ...current, savedCandidates: current.savedCandidates.filter((candidate) => candidate.slug !== slug) } : current);
  }
  async function saveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const response = await fetch("/api/recruiter", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)) }); const body = await response.json();
    if (!response.ok) return setMessage(body.error || "Unable to update account.");
    setDashboard((current) => current ? { ...current, account: { ...current.account, ...body.account } } : current); setEditing(false); setMessage("Account details updated.");
  }

  if (status === "loading") return <main className="flex min-h-screen items-center justify-center"><Loader className="h-10 w-10 animate-spin text-brand-blue" /></main>;
  if (status === "signed-out") return <main className="mx-auto min-h-screen max-w-xl px-6 py-24"><div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><BriefcaseBusiness className="mx-auto h-12 w-12 text-brand-blue" /><h1 className="mt-4 text-2xl font-bold">Recruiter sign-in required</h1><p className="mt-2 text-slate-600">Request access to a graduate portfolio. Your one-time email link creates a secure recruiter session automatically.</p><Link href="/graduates" className="mt-6 inline-block rounded-lg bg-brand-blue px-5 py-3 font-semibold text-white">Browse graduates</Link></div></main>;
  if (!dashboard || status === "error") return <main className="mx-auto max-w-xl px-6 py-24"><div className="flex gap-3 rounded-xl bg-red-50 p-5 text-red-800"><AlertCircle className="h-5 w-5" />{message}</div></main>;

  return <div className="min-h-screen bg-slate-50">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><Link href="/graduates" className="text-xl font-bold text-brand-navy">TalentOS <span className="block text-xs font-semibold uppercase tracking-widest text-brand-blue">Recruiter workspace</span></Link><button onClick={logout} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><LogOut className="h-4 w-4" />Sign out</button></div></header>
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      {message ? <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{message}</div> : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wide text-brand-blue">Verified recruiter</p><h1 className="mt-1 text-3xl font-bold text-slate-900">{dashboard.account.name}</h1><p className="mt-1 text-slate-600">{dashboard.account.designation} at {dashboard.account.organization}</p><p className="text-sm text-slate-500">{dashboard.account.email}</p></div><button onClick={() => setEditing((value) => !value)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{editing ? "Cancel" : "Edit account"}</button></div>
        {editing ? <form onSubmit={saveAccount} className="mt-6 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2"><AccountInput name="name" label="Name" value={dashboard.account.name} /><AccountInput name="organization" label="Organization" value={dashboard.account.organization} /><AccountInput name="designation" label="Designation" value={dashboard.account.designation} /><AccountInput name="phone" label="Phone" value={dashboard.account.phone || ""} /><button className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 font-semibold text-white sm:col-span-2"><Save className="h-4 w-4" />Save account</button></form> : null}
      </section>
      <section><div className="flex items-end justify-between"><div><h2 className="text-2xl font-bold text-slate-900">Saved candidates</h2><p className="mt-1 text-slate-600">{dashboard.savedCandidates.length} candidate{dashboard.savedCandidates.length === 1 ? "" : "s"} in your shortlist</p></div><Link href="/graduates" className="font-semibold text-brand-blue">Browse directory</Link></div>
        {dashboard.savedCandidates.length ? <div className="mt-5 grid gap-5 md:grid-cols-2">{dashboard.savedCandidates.map((candidate) => <article key={candidate.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex gap-4 p-5">{candidate.photo ? <Image src={candidate.photo} alt="" width={88} height={88} unoptimized className="h-22 w-22 rounded-xl object-cover" /> : <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-xl bg-brand-blue text-2xl font-bold text-white">{candidate.name[0]}</div>}<div className="min-w-0"><h3 className="text-lg font-bold text-slate-900">{candidate.name}</h3><p className="text-sm text-slate-500">{candidate.program?.name || "TalentOS graduate"}</p><p className="mt-1 flex items-center gap-1 font-semibold text-amber-700"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{candidate.rating.toFixed(1)}/5</p><p className="mt-2 line-clamp-2 text-sm text-slate-600">{candidate.bio}</p></div></div><div className="flex flex-wrap gap-2 border-t border-slate-100 p-4"><Link href={`/graduates/${candidate.slug}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Public profile</Link>{candidate.portfolioAccessExpiresAt ? <Link href={`/graduates/${candidate.slug}/portfolio`} className="rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white">Open portfolio</Link> : <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Portfolio access expired</span>}<button onClick={() => unsave(candidate.slug)} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-red-600"><Bookmark className="h-4 w-4 fill-current" />Remove</button></div></article>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><Bookmark className="mx-auto h-10 w-10 text-slate-400" /><h3 className="mt-3 font-semibold text-slate-900">No saved candidates yet</h3><p className="mt-1 text-sm text-slate-600">Open a verified portfolio and choose Save candidate.</p></div>}
      </section>
    </main>
  </div>;
}

function AccountInput({ name, label, value }: { name: string; label: string; value: string }) { return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span><input name={name} defaultValue={value} required={name !== "phone"} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>; }
