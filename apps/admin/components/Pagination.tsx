import Link from "next/link";
import { PAGE_SIZE_OPTIONS, pageWindow } from "@/lib/pagination";

type PaginationProps = {
  pathname: string;
  /** Current search params (filters + page/pageSize) — preserved across navigation. */
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  start: number;
  end: number;
};

/** Server-rendered pagination footer: "showing X–Y of Z", a 10/20 rows-per-page toggle, and page
 * links that preserve the active filters. */
export function Pagination({ pathname, params, page, pageSize, total, totalPages, start, end }: PaginationProps) {
  function href(overrides: Record<string, string | number | undefined>) {
    const merged: Record<string, string> = {};
    for (const [key, value] of Object.entries({ ...params, ...overrides })) {
      if (value != null && value !== "") merged[key] = String(value);
    }
    const query = new URLSearchParams(merged).toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  const linkBase = "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";
  const active = "bg-brand-blue text-white";
  const inactive = "text-slate-700 hover:bg-slate-100";
  const disabled = "cursor-not-allowed text-slate-300";

  if (total === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{start + 1}</span>–
        <span className="font-medium text-slate-700">{end}</span> of{" "}
        <span className="font-medium text-slate-700">{total}</span>
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <span>Rows:</span>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <Link
              key={size}
              href={href({ pageSize: size, page: 1 })}
              className={`${linkBase} ${size === pageSize ? active : inactive}`}
            >
              {size}
            </Link>
          ))}
        </div>

        <nav aria-label="Pagination" className="flex items-center gap-1">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className={`${linkBase} ${inactive}`} aria-label="Previous page">
              ← Prev
            </Link>
          ) : (
            <span className={`${linkBase} ${disabled}`}>← Prev</span>
          )}

          {pageWindow(page, totalPages).map((entry, index) =>
            entry === "…" ? (
              <span key={`gap-${index}`} className="px-2 text-sm text-slate-400">
                …
              </span>
            ) : (
              <Link
                key={entry}
                href={href({ page: entry })}
                aria-current={entry === page ? "page" : undefined}
                className={`${linkBase} ${entry === page ? active : inactive}`}
              >
                {entry}
              </Link>
            )
          )}

          {page < totalPages ? (
            <Link href={href({ page: page + 1 })} className={`${linkBase} ${inactive}`} aria-label="Next page">
              Next →
            </Link>
          ) : (
            <span className={`${linkBase} ${disabled}`}>Next →</span>
          )}
        </nav>
      </div>
    </div>
  );
}
