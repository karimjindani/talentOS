"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { WorkspaceStepStatus } from "./view-model";

export type WorkspaceTab = {
  /** Anchor id, e.g. "overview" or "step-2". */
  id: string;
  label: string;
  /** Number, ✓, or • for the overview entry. */
  marker: string;
  /** Step status, or "overview" for the non-step entry. */
  status: WorkspaceStepStatus | "overview";
};

type WorkspaceTabsProps = {
  tabs: WorkspaceTab[];
  /** Server-rendered panel per tab, in the same order as `tabs`. */
  panels: ReactNode[];
  completedStepCount: number;
  totalStepCount: number;
  progressPercent: number;
};

/** Tabbed Mission Workspace: a sticky step rail on the left, one visible panel on the right. Panels
 * stay mounted (hidden, not unmounted) so client state like the submission draft survives tab
 * switches. The header "Continue" button and in-panel checklist links drive tab changes through the
 * URL hash, so they keep working as plain server-rendered anchors. */
export function WorkspaceTabs({ tabs, panels, completedStepCount, totalStepCount, progressPercent }: WorkspaceTabsProps) {
  const [active, setActive] = useState<string>(tabs[0]?.id ?? "overview");
  const contentRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const didMount = useRef(false);

  const activate = useCallback(
    (id: string, opts: { scroll?: boolean; focus?: boolean } = {}) => {
      if (!tabs.some((tab) => tab.id === id)) return;
      setActive(id);
      if (typeof history !== "undefined" && history.replaceState) {
        history.replaceState(null, "", `#${id}`);
      }
      if (opts.focus) tabRefs.current[id]?.focus();
      if (opts.scroll && contentRef.current) {
        contentRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [tabs]
  );

  // Honor deep links and cross-panel anchor navigation (Continue button, checklist links).
  useEffect(() => {
    function syncFromHash() {
      const id = window.location.hash.replace("#", "");
      if (id && tabs.some((tab) => tab.id === id)) {
        setActive(id);
        if (didMount.current) contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    syncFromHash();
    didMount.current = true;
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [tabs]);

  function onTabKeyDown(event: React.KeyboardEvent, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    activate(tabs[nextIndex].id, { focus: true });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
      <div>
        <nav aria-label="Mission steps" className="lg:sticky lg:top-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your progress</p>
            <p className="mt-1 text-sm font-semibold text-brand-navy">
              {completedStepCount} of {totalStepCount} steps complete
            </p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Mission step progress"
            >
              <div
                className={`h-full rounded-full transition-all ${progressPercent === 100 ? "bg-emerald-500" : "bg-brand-blue"}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div
              role="tablist"
              aria-orientation="vertical"
              className="mt-4 flex gap-2 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible"
            >
              {tabs.map((tab, index) => {
                const selected = active === tab.id;
                const complete = tab.status === "complete";
                const current = tab.status === "current";
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={selected}
                    aria-controls={`panel-${tab.id}`}
                    tabIndex={selected ? 0 : -1}
                    ref={(node) => {
                      tabRefs.current[tab.id] = node;
                    }}
                    onClick={() => activate(tab.id, { scroll: true })}
                    onKeyDown={(event) => onTabKeyDown(event, index)}
                    className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors lg:shrink ${
                      selected ? "bg-brand-mist text-brand-navy" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        complete
                          ? "bg-emerald-500 text-white"
                          : current
                            ? "bg-brand-blue text-white"
                            : selected
                              ? "border border-brand-blue text-brand-blue"
                              : "border border-slate-300 text-slate-500"
                      }`}
                    >
                      {tab.marker}
                    </span>
                    <span className="whitespace-nowrap font-medium lg:whitespace-normal">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </div>

      <div ref={contentRef}>
        {panels.map((panel, index) => {
          const tab = tabs[index];
          if (!tab) return null;
          const selected = active === tab.id;
          return (
            <div
              key={tab.id}
              id={`panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab.id}`}
              hidden={!selected}
            >
              {panel}
            </div>
          );
        })}
      </div>
    </div>
  );
}
