"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ProgramOption = { id: string; name: string; slug: string };

/** Searchable program selector for the Tasks page. Replaces the flat list of every program with a
 * combobox: click to open, type to filter by name/slug, select to load that program's tasks. On
 * select it navigates to `/tasks?programId=…`, so the server component re-fetches that program's
 * data. */
export function ProgramPicker({ programs, selectedId }: { programs: ProgramOption[]; selectedId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = programs.find((program) => program.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return programs;
    return programs.filter((program) => `${program.name} ${program.slug}`.toLowerCase().includes(q));
  }, [programs, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function choose(id: string) {
    setOpen(false);
    setQuery("");
    if (id !== selectedId) {
      router.push(`/tasks?programId=${id}`);
    }
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = filtered[activeIndex];
      if (target) choose(target.id);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative max-w-md">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
      >
        <span className={selected ? "" : "text-slate-400"}>{selected ? selected.name : "Select a program"}</span>
        <span aria-hidden="true" className="text-slate-400">
          ▾
        </span>
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search programs…"
              aria-label="Search programs"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </div>
          <ul role="listbox" aria-label="Programs" className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">No programs match “{query}”.</li>
            ) : (
              filtered.map((program, index) => {
                const isSelected = program.id === selectedId;
                const isActive = index === activeIndex;
                return (
                  <li key={program.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => choose(program.id)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-brand-mist font-semibold text-brand-navy"
                          : isActive
                            ? "bg-slate-50 text-slate-800"
                            : "text-slate-700"
                      }`}
                    >
                      <span className="truncate">{program.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">{program.slug}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
