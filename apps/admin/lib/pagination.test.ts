import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, pageWindow, paginate, parsePageParams } from "./pagination";

describe("parsePageParams", () => {
  it("defaults to page 1 and the default page size", () => {
    expect(parsePageParams({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it("accepts allowed page sizes and clamps everything else to the default", () => {
    expect(parsePageParams({ pageSize: "20" }).pageSize).toBe(20);
    expect(parsePageParams({ pageSize: "10" }).pageSize).toBe(10);
    expect(parsePageParams({ pageSize: "50" }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageParams({ pageSize: "abc" }).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("floors page at 1 for junk or non-positive input", () => {
    expect(parsePageParams({ page: "3" }).page).toBe(3);
    expect(parsePageParams({ page: "0" }).page).toBe(1);
    expect(parsePageParams({ page: "-4" }).page).toBe(1);
    expect(parsePageParams({ page: "xyz" }).page).toBe(1);
  });

  it("only offers 10 and 20 as page sizes", () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 20]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it("returns the requested slice and metadata", () => {
    const result = paginate(items, 1, 10);
    expect(result.slice).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result).toMatchObject({ total: 25, totalPages: 3, page: 1, start: 0, end: 10 });
  });

  it("returns the final partial page", () => {
    const result = paginate(items, 3, 10);
    expect(result.slice).toEqual([21, 22, 23, 24, 25]);
    expect(result).toMatchObject({ page: 3, start: 20, end: 25 });
  });

  it("clamps an out-of-range page to the last page", () => {
    const result = paginate(items, 99, 10);
    expect(result.page).toBe(3);
    expect(result.slice[0]).toBe(21);
  });

  it("handles an empty list without dividing by zero", () => {
    const result = paginate([], 1, 10);
    expect(result).toMatchObject({ total: 0, totalPages: 1, slice: [], start: 0, end: 0 });
  });
});

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("adds ellipsis gaps for large ranges, always keeping first and last", () => {
    const window = pageWindow(6, 12);
    expect(window[0]).toBe(1);
    expect(window[window.length - 1]).toBe(12);
    expect(window).toContain("…");
    expect(window).toContain(6);
  });
});
