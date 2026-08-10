"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle, Loader, Mail, X } from "lucide-react";

export function CandidateContactModal({ slug, candidateName }: { slug: string; candidateName: string }) {
  const [open, setOpen] = useState(false); const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle"); const [error, setError] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (open) setTimeout(() => textarea.current?.focus(), 0); }, [open]);
  function close() { if (status !== "sending") { setOpen(false); setStatus("idle"); setError(null); } }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setStatus("sending"); setError(null);
    try { const response = await fetch(`/api/graduates/${slug}/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to send message."); setStatus("success"); setMessage(""); }
    catch (sendError) { setStatus("error"); setError(sendError instanceof Error ? sendError.message : "Unable to send message."); }
  }
  return <>
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"><Mail className="h-4 w-4" />Contact candidate</button>
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="contact-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><h2 id="contact-title" className="text-xl font-bold text-slate-900">Contact {candidateName}</h2><p className="mt-1 text-sm text-slate-600">TalentOS will relay your message. The candidate&apos;s private email remains hidden.</p></div><button onClick={close} aria-label="Close contact dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
        {status === "success" ? <div className="mt-6 rounded-xl bg-green-50 p-5 text-green-900"><CheckCircle className="h-8 w-8 text-green-600" /><h3 className="mt-2 font-semibold">Message sent</h3><p className="mt-1 text-sm">The candidate can reply directly to your verified recruiter email.</p><button onClick={close} className="mt-4 rounded-lg bg-green-700 px-4 py-2 font-semibold text-white">Done</button></div> : <form onSubmit={submit} className="mt-6"><label className="block text-sm font-medium text-slate-700" htmlFor="candidate-message">Your message</label><textarea ref={textarea} id="candidate-message" required minLength={10} maxLength={2000} rows={7} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Introduce yourself, describe the opportunity, and suggest a next step…" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue" /><div className="mt-1 flex justify-between text-xs text-slate-500"><span>Minimum 10 characters</span><span>{message.length}/2000</span></div>{error ? <div className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div> : null}<div className="mt-5 flex justify-end gap-3"><button type="button" onClick={close} disabled={status === "sending"} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700">Cancel</button><button disabled={status === "sending" || message.trim().length < 10} className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 font-semibold text-white disabled:opacity-50">{status === "sending" ? <Loader className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{status === "sending" ? "Sending…" : "Send message"}</button></div></form>}
      </div>
    </div> : null}
  </>;
}
