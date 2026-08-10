"use client";
import { Copy, Mail, MessageCircle, Share2 } from "lucide-react";

export function ShareProfileButtons({ name }: { name: string }) {
  const url = typeof window === "undefined" ? "" : window.location.href;
  const text = `View ${name}'s verified TalentOS graduate profile`;
  const copy = async () => { await navigator.clipboard.writeText(url); window.alert("Profile link copied."); };
  return <div className="mt-5 flex flex-wrap gap-2">
    <button onClick={copy} className={buttonClass}><Copy className="h-4 w-4" />Copy link</button>
    <a className={buttonClass} target="_blank" rel="noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}><Share2 className="h-4 w-4" />LinkedIn</a>
    <a className={buttonClass} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}><MessageCircle className="h-4 w-4" />WhatsApp</a>
    <a className={buttonClass} href={`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`}><Mail className="h-4 w-4" />Email</a>
  </div>;
}
const buttonClass = "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";
