export const PAGE_SIZE_OPTIONS = [10, 20] as const;
export const DEFAULT_PAGE_SIZE = 10;

/** Resolve page + pageSize from raw search params, clamping to allowed values. */
export function parsePageParams(params: { page?: string; pageSize?: string }): { page: number; pageSize: number } {
  const requestedSize = Number(params.pageSize);
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(requestedSize) ? requestedSize : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  return { page, pageSize };
}

export type Paginated<T> = {
  slice: T[];
  total: number;
  totalPages: number;
  page: number;
  start: number;
  end: number;
};

/** Slice an in-memory list for the requested page (1-based), clamping the page to range. */
export function paginate<T>(items: T[], page: number, pageSize: number): Paginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return { slice, total, totalPages, page: safePage, start, end: start + slice.length };
}

/** Page numbers to render, with "…" gaps for large ranges. */
export function pageWindow(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pages: (number | "…")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(totalPages - 1, current + 1);
  if (left > 2) pages.push("…");
  for (let page = left; page <= right; page += 1) pages.push(page);
  if (right < totalPages - 1) pages.push("…");
  pages.push(totalPages);
  return pages;
}
