"use client";

import { useState } from "react";
import { AlertCircle, Plus, Trash2, Upload } from "lucide-react";

type Artifact = { title: string; url: string; description: string };
type InitialData = { bio?: string; linkedinUrl?: string | null; githubUrl?: string | null; country?: string; profilePhotoUrl?: string | null; profilePhotoFileId?: string | null; skills?: string[]; interests?: string[]; emailPublic?: boolean; artifacts?: Artifact[] };

export function GraduateProfileForm({ onSuccess, initialData }: { onSuccess?: () => void; initialData?: InitialData }) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    bio: initialData?.bio || "", linkedinUrl: initialData?.linkedinUrl || "", githubUrl: initialData?.githubUrl || "", country: initialData?.country || "",
    profilePhotoUrl: initialData?.profilePhotoUrl || "", profilePhotoFileId: initialData?.profilePhotoFileId || "", skills: initialData?.skills?.join(", ") || "", interests: initialData?.interests?.join(", ") || "", emailPublic: initialData?.emailPublic || false
  });
  const [artifacts, setArtifacts] = useState<Artifact[]>(initialData?.artifacts || []);

  function change(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? (event.target as HTMLInputElement).checked : value }));
  }
  async function uploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const photo = event.target.files?.[0]; if (!photo) return;
    setUploading(true); setError(null);
    try {
      const data = new FormData(); data.append("photo", photo);
      const response = await fetch("/api/graduates/profile/photo", { method: "POST", body: data }); const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Photo upload failed.");
      setForm((current) => ({ ...current, profilePhotoFileId: body.fileId, profilePhotoUrl: "" }));
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Photo upload failed."); } finally { setUploading(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(null); setSuccess(false);
    try {
      const response = await fetch("/api/graduates/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, skills: form.skills.split(",").map((item) => item.trim()).filter(Boolean), interests: form.interests.split(",").map((item) => item.trim()).filter(Boolean), artifacts: artifacts.filter((item) => item.title || item.url) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Failed to save profile.");
      setSuccess(true); onSuccess?.();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Something went wrong."); } finally { setLoading(false); }
  }
  return <form onSubmit={submit} className="space-y-6 rounded-lg border border-slate-200 bg-white p-6">
    <div><h2 className="text-2xl font-bold text-slate-900">Graduate Profile</h2><p className="mt-1 text-slate-600">Control the information recruiters see in the public directory.</p></div>
    {error ? <div className="flex gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="h-5 w-5" />{error}</div> : null}
    {success ? <div className="rounded-lg bg-green-50 p-4 text-sm font-medium text-green-900">Profile published successfully.</div> : null}
    <Field label="Professional bio"><textarea required maxLength={500} rows={5} name="bio" value={form.bio} onChange={change} className={inputClass} /></Field>
    <div className="grid gap-4 md:grid-cols-2"><Field label="LinkedIn URL"><input type="url" name="linkedinUrl" value={form.linkedinUrl} onChange={change} className={inputClass} /></Field><Field label="GitHub URL"><input type="url" name="githubUrl" value={form.githubUrl} onChange={change} className={inputClass} /></Field></div>
    <div className="grid gap-4 md:grid-cols-2"><Field label="Country"><input name="country" value={form.country} onChange={change} className={inputClass} /></Field><Field label="Profile photo"><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-brand-blue"><Upload className="h-4 w-4" />{uploading ? "Uploading…" : form.profilePhotoFileId ? "Photo uploaded — replace" : "Upload JPG, PNG, or WebP"}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={uploading} /></label></Field></div>
    <div className="grid gap-4 md:grid-cols-2"><Field label="Skills (comma separated)"><input name="skills" value={form.skills} onChange={change} placeholder="React, TypeScript, Node.js" className={inputClass} /></Field><Field label="Interests (comma separated)"><input name="interests" value={form.interests} onChange={change} placeholder="Fintech, accessibility, AI" className={inputClass} /></Field></div>
    <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" name="emailPublic" checked={form.emailPublic} onChange={change} className="h-4 w-4" />Show my email to verified recruiters</label>
    <div><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">Additional artifacts</h3><button type="button" onClick={() => setArtifacts((items) => [...items, { title: "", url: "", description: "" }])} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue"><Plus className="h-4 w-4" />Add artifact</button></div><div className="mt-3 space-y-3">{artifacts.map((artifact, index) => <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_1.5fr_auto]"><input placeholder="Title" value={artifact.title} onChange={(e) => setArtifacts((items) => items.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} className={inputClass} /><input type="url" placeholder="https://…" value={artifact.url} onChange={(e) => setArtifacts((items) => items.map((item, i) => i === index ? { ...item, url: e.target.value } : item))} className={inputClass} /><button type="button" aria-label="Remove artifact" onClick={() => setArtifacts((items) => items.filter((_, i) => i !== index))} className="p-2 text-red-600"><Trash2 className="h-5 w-5" /></button><input placeholder="Short description (optional)" value={artifact.description} onChange={(e) => setArtifacts((items) => items.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} className={`${inputClass} md:col-span-2`} /></div>)}</div></div>
    <button disabled={loading || uploading} className="w-full rounded-lg bg-brand-blue py-3 font-semibold text-white disabled:opacity-50">{loading ? "Publishing…" : "Save and publish profile"}</button>
  </form>;
}

const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>; }
