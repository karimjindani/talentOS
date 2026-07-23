"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/** Collapsible task card for the admin editor: shows just the "Task N — title — Week" header until
 * expanded, so a program with many tasks stays easy to scan. The task form + its resources (passed
 * as children) render only while expanded. */
export function CollapsibleTask({
  taskNumber,
  title,
  weekNumber,
  defaultOpen = false,
  children
}: {
  taskNumber: number;
  title: string;
  weekNumber: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <span className="inline-flex shrink-0 items-center rounded-full bg-brand-mist px-2.5 py-1 text-xs font-bold text-brand-blue">
          Task {taskNumber}
        </span>
        <span className="truncate text-sm font-semibold text-slate-800">{title || "Untitled task"}</span>
        <span className="ml-auto shrink-0 text-xs text-slate-400">Week {weekNumber}</span>
        <span aria-hidden="true" className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open ? <div className="border-t border-slate-100 p-4">{children}</div> : null}
    </div>
  );
}
