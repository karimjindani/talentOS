"use client";

import { useEffect, useState } from "react";

type HealthCheck = {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  detail: string;
};

type HealthResponse = {
  status: "healthy" | "degraded" | "unhealthy";
  checkedAt: string;
  checks: HealthCheck[];
};

const statusClass: Record<HealthCheck["status"], string> = {
  healthy: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  degraded: "bg-amber-50 text-amber-700 ring-amber-200",
  unhealthy: "bg-rose-50 text-rose-700 ring-rose-200"
};

export function HealthPanel() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadHealth() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/operations/health", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Health API returned HTTP ${response.status}`);
      }
      setHealth((await response.json()) as HealthResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load health checks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Container and service health</h2>
          <p className="mt-1 text-sm text-slate-600">
            App-visible checks for the local TalentOS stack. This does not access the Docker socket.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadHealth()}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
        >
          Refresh
        </button>
      </div>

      {loading ? <p className="mt-4 text-sm text-slate-500">Checking services...</p> : null}
      {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {health ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-slate-500">Last checked: {new Date(health.checkedAt).toLocaleString()}</p>
          {health.checks.map((check) => (
            <div className="rounded-xl border border-slate-100 p-4" key={check.name}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-slate-800">{check.name}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClass[check.status]}`}>
                  {check.status}
                </span>
              </div>
              <p className="mt-2 break-words text-sm text-slate-500">{check.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
