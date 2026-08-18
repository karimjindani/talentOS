"use client";

import { useState, useEffect } from "react";
import { GraduateCard } from "./GraduateCard";
import { Search, Filter } from "lucide-react";

interface Graduate {
  id: string;
  slug: string;
  name: string;
  photo: string | null;
  rating: number;
  bio: string;
  completionDate: string;
  country?: string;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  program?: { id: string; name: string } | null;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function PublicGraduateDirectory() {
  const [graduates, setGraduates] = useState<Graduate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 6,
    total: 0,
    pages: 0,
  });
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);

  const [filters, setFilters] = useState({
    search: "",
    sort: "rating" as "rating" | "date" | "name",
    country: "",
    month: "",
    programId: "",
    page: 1,
  });

  const fetchGraduates = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: filters.page.toString(),
        limit: "6",
        sort: filters.sort,
        ...(filters.search && { search: filters.search }),
        ...(filters.country && { country: filters.country }),
        ...(filters.programId && { programId: filters.programId }),
      });
      if (filters.month) {
        const [year, month] = filters.month.split("-").map(Number);
        params.set("monthFrom", new Date(Date.UTC(year, month - 1, 1)).toISOString());
        params.set("monthTo", new Date(Date.UTC(year, month, 1)).toISOString());
      }

      const response = await fetch(`/api/graduates?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch graduates");
      }

      const data = await response.json();
      setGraduates(data.data || []);
      setPagination(data.pagination || {});
      setPrograms(data.filters?.programs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraduates();
  }, [filters.page, filters.sort, filters.search, filters.country, filters.month, filters.programId]);

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value, page: 1 }));
  };

  const handleSortChange = (value: "rating" | "date" | "name") => {
    setFilters((prev) => ({ ...prev, sort: value, page: 1 }));
  };

  const handleCountryChange = (value: string) => {
    setFilters((prev) => ({ ...prev, country: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-navy via-brand-blue to-brand-purple px-8 py-12 text-white shadow-lg">
        <div className="relative z-10">
          <h1 className="text-4xl font-bold tracking-tight">Graduate Talent Directory</h1>
          <p className="mt-3 max-w-2xl text-lg text-blue-100">
            Discover verified graduates from our program.
            Browse profiles, skills, and connect with top talent.
          </p>
        </div>
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      </div>

      {/* Search and Filters */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Search */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or skills..."
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Sort */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Sort By</label>
            <select
              value={filters.sort}
              onChange={(e) => handleSortChange(e.target.value as "rating" | "date" | "name")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            >
              <option value="rating">Highest Rating</option>
              <option value="date">Most Recent</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Graduation month</label>
            <input type="month" value={filters.month} onChange={(e) => setFilters((previous) => ({ ...previous, month: e.target.value, page: 1 }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Program</label>
            <select value={filters.programId} onChange={(e) => setFilters((previous) => ({ ...previous, programId: e.target.value, page: 1 }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900">
              <option value="">All programs</option>
              {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select>
          </div>

          {/* Country - Placeholder */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Country</label>
            <input
              type="text"
              placeholder="Filter by country"
              value={filters.country}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
            >
              <div className="mb-4 h-6 w-3/4 rounded bg-slate-200" />
              <div className="mb-3 h-4 w-1/2 rounded bg-slate-100" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="h-3 w-2/3 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : graduates.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-16 text-center">
          <Filter className="mx-auto h-16 w-16 text-slate-300" />
          <h3 className="mt-4 text-xl font-semibold text-slate-900">No graduates found</h3>
          <p className="mt-2 text-slate-600">
            {pagination.total === 0
              ? "There are no public graduate profiles yet. Profiles will appear here once graduates complete their training and give consent."
              : "Try adjusting your search filters"}
          </p>
        </div>
      ) : (
        <>
          {/* Graduate Cards Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {graduates.map((grad) => (
              <GraduateCard
                key={grad.id}
                {...grad}
              />
            ))}
          </div>

          {/* Pagination Controls — always show < page > format */}
          {pagination.total > 0 && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                &lt;
              </button>

              <span className="text-sm font-medium text-slate-700">
                Page {pagination.page} of {pagination.pages}
              </span>

              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                &gt;
              </button>
            </div>
          )}

          {/* Results Info */}
          <div className="text-center text-sm text-slate-600">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} graduates
          </div>

          {/* Consent note */}
          <div className="text-center text-xs text-slate-500">
            🛡️ profiles are published with explicit consent from our graduates
          </div>
        </>
      )}
    </div>
  );
}
