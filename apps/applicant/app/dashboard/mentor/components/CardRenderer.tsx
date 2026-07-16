"use client";

import type { MentorCard } from "@/lib/ai";
import {
  CheckCircle,
  Clock,
  Calendar,
  TrendingUp,
  Target,
  Lightbulb,
  AlertTriangle,
  Code,
  BookOpen,
  FileText,
} from "lucide-react";

interface CardRendererProps {
  card: MentorCard;
}

export function CardRenderer({ card }: CardRendererProps) {
  switch (card.kind) {
    case "task":
      return <TaskCard card={card} />;
    case "progress":
      return <ProgressCard card={card} />;
    case "timeline":
      return <TimelineCard card={card} />;
    case "tips":
      return <TipsCard card={card} />;
    case "badge":
      return <BadgeCard card={card} />;
    default:
      return null;
  }
}

function TaskCard({ card }: { card: Extract<MentorCard, { kind: "task" }> }) {
  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date();
  
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-blue-50 shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-brand-blue" />
          <h3 className="text-sm font-semibold text-brand-navy">{card.title}</h3>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm text-slate-700">{card.description}</p>
        
        <div className="mt-4 flex flex-wrap gap-2">
          {card.dueDate && (
            <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              isOverdue 
                ? "bg-red-100 text-red-700" 
                : "bg-amber-100 text-amber-700"
            }`}>
              <Calendar className="h-3 w-3" />
              <span>Due: {card.dueDate}</span>
              {isOverdue && (
                <span className="ml-1 rounded-full bg-red-200 px-1.5 py-0.5 text-[10px] font-bold">
                  OVERDUE
                </span>
              )}
            </div>
          )}
          
          {card.estimatedTime && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700">
              <Clock className="h-3 w-3" />
              <span>{card.estimatedTime}</span>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-500">Task assigned</span>
          <button className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors">
            Start Task
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ card }: { card: Extract<MentorCard, { kind: "progress" }> }) {
  const percentage = Math.min(100, Math.max(0, card.percentage));
  
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-green-50 shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-green-50 to-white px-4 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <h3 className="text-sm font-semibold text-brand-navy">{card.title}</h3>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl font-bold text-green-700">{percentage}%</span>
          <div className="text-xs">
            <span className="text-slate-500">Completion</span>
          </div>
        </div>
        
        <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-1000 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            On track
          </span>
          <span className="font-medium">
            {percentage < 30 ? "Getting started" : 
             percentage < 70 ? "Good progress" : 
             percentage < 90 ? "Almost there" : 
             "Excellent work!"}
          </span>
        </div>
      </div>
    </div>
  );
}

function TimelineCard({ card }: { card: Extract<MentorCard, { kind: "timeline" }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-purple-50 shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-purple-50 to-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-purple-600" />
          <h3 className="text-sm font-semibold text-brand-navy">{card.title}</h3>
        </div>
      </div>
      <div className="p-4">
        <div className="space-y-3">
          {card.items.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-xs font-bold text-white">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-700">{item}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 w-8 rounded-full bg-purple-200"></div>
                  <span className="text-xs text-slate-400">
                    Step {i + 1} of {card.items.length}
                  </span>
                </div>
              </div>
              {i === 0 && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Current
                </span>
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-500">{card.items.length} steps total</span>
          <button className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 transition-colors">
            View Timeline
          </button>
        </div>
      </div>
    </div>
  );
}

function TipsCard({ card }: { card: Extract<MentorCard, { kind: "tips" }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-amber-50 shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-amber-50 to-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-brand-navy">{card.title}</h3>
        </div>
      </div>
      <div className="p-4">
        <ul className="space-y-2.5">
          {card.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <span className="text-xs font-bold text-amber-700">{i + 1}</span>
              </div>
              <p className="text-sm text-slate-700">{item}</p>
            </li>
          ))}
        </ul>
        
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-500">{card.items.length} tips</span>
          <button className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors">
            Save Tips
          </button>
        </div>
      </div>
    </div>
  );
}

function BadgeCard({ card }: { card: Extract<MentorCard, { kind: "badge" }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-slate-600 to-slate-700">
            <span className="text-xs font-bold text-white">✓</span>
          </div>
          <h3 className="text-sm font-semibold text-brand-navy">Achievement</h3>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">{card.label}</span>
            <p className="mt-1 text-lg font-bold text-slate-800">{card.value}</p>
          </div>
          <div className="rounded-full bg-gradient-to-r from-blue-500 to-purple-500 p-3">
            <CheckCircle className="h-6 w-6 text-white" />
          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-500">Verified achievement</span>
          <button className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 transition-colors">
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

// Additional card types for enhanced UI
export function WarningCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm">
      <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-white px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-amber-800">{title}</h3>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm text-amber-700">{message}</p>
      </div>
    </div>
  );
}

export function CodeCard({ 
  title, 
  code, 
  language = "typescript" 
}: { 
  title: string; 
  code: string; 
  language?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 shadow-sm">
      <div className="border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-slate-300" />
            <h3 className="text-sm font-semibold text-white">{title}</h3>
          </div>
          <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs font-mono text-slate-300">
            {language}
          </span>
        </div>
      </div>
      <div className="p-4">
        <pre className="overflow-x-auto text-sm text-slate-200">
          <code>{code}</code>
        </pre>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-400">Code example</span>
          <button
            onClick={() => navigator.clipboard.writeText(code)}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 transition-colors"
          >
            Copy Code
          </button>
        </div>
      </div>
    </div>
  );
}

export function ResourceCard({ 
  title, 
  description, 
  type = "document",
  link 
}: { 
  title: string; 
  description: string; 
  type?: "document" | "video" | "guide" | "example";
  link?: string;
}) {
  const icons = {
    document: FileText,
    video: "▶️",
    guide: BookOpen,
    example: Code,
  };
  
  const Icon = type === "document" || type === "guide" || type === "example" 
    ? icons[type] 
    : null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-blue-50 shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white px-4 py-3">
        <div className="flex items-center gap-2">
          {typeof Icon === "string" ? (
            <span className="text-lg">{Icon}</span>
          ) : Icon ? (
            <Icon className="h-4 w-4 text-brand-blue" />
          ) : null}
          <h3 className="text-sm font-semibold text-brand-navy">{title}</h3>
          <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm text-slate-700">{description}</p>
        {link && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-500">External resource</span>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
            >
              Open Link
            </a>
          </div>
        )}
      </div>
    </div>
  );
}