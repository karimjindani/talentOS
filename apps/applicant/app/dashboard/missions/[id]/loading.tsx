// Skeleton shown while the Mission Workspace server component fetches. Mirrors the workspace layout
// (navy header + step rail + content) so the transition doesn't shift.
export default function MissionWorkspaceLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse" aria-hidden="true">
      <div className="h-4 w-32 rounded bg-slate-200" />
      <div className="mt-4 h-40 rounded-3xl bg-slate-200" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
        <div className="h-64 rounded-2xl border border-slate-200 bg-white" />
        <div className="grid gap-6">
          <div className="h-32 rounded-2xl border border-slate-200 bg-white" />
          <div className="h-32 rounded-2xl border border-slate-200 bg-white" />
          <div className="h-48 rounded-2xl border border-slate-200 bg-white" />
        </div>
      </div>
    </div>
  );
}
