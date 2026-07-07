import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import { can, nextProgramStatuses } from "@talentos/auth";
import { getTenantBySlug, getTenantProgram } from "@talentos/db";
import { setProgramStatusAction, updateProgramAction } from "../actions";

type ProgramDetailPageProps = {
  params: Promise<{ id: string }>;
};

function toDateInput(value: Date | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export default async function ProgramDetailPage({ params }: ProgramDetailPageProps) {
  const { id } = await params;
  const session = await auth();
  const canManage = can("managePrograms", {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  });

  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const program = tenant ? await getTenantProgram(id, tenant.id) : null;
  if (!program) {
    notFound();
  }

  if (!canManage) {
    return (
      <>
        <h1 className="text-3xl font-bold">{program.name}</h1>
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          Your role can view programs but cannot edit them.
        </p>
      </>
    );
  }

  const transitions = nextProgramStatuses(program.status);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{program.name}</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/programs/${program.id}/content`}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold"
          >
            Manage content →
          </Link>
          <StatusBadge status={program.status} />
        </div>
      </div>

      <form action={updateProgramAction} className="mt-8 max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <input type="hidden" name="programId" value={program.id} />
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input name="name" required defaultValue={program.name} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Slug</span>
          <input name="slug" defaultValue={program.slug} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea name="description" defaultValue={program.description} className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Starts</span>
            <input name="startsAt" type="date" defaultValue={toDateInput(program.startsAt)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Ends</span>
            <input name="endsAt" type="date" defaultValue={toDateInput(program.endsAt)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white">
            Save changes
          </button>
          <Link href="/programs" className="rounded-xl border border-slate-300 px-5 py-3 font-semibold">
            Back
          </Link>
        </div>
      </form>

      <section className="mt-6 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Status</h2>
        <p className="mt-1 text-sm text-slate-600">
          Current status: <span className="font-medium">{program.status}</span>. Published programs are
          visible on the applicant apply form.
        </p>
        {transitions.length === 0 ? (
          <p className="mt-3 text-slate-600">No status changes available.</p>
        ) : (
          <form action={setProgramStatusAction} className="mt-4 flex flex-wrap gap-3">
            <input type="hidden" name="programId" value={program.id} />
            {transitions.map((status) => (
              <button
                key={status}
                type="submit"
                name="toStatus"
                value={status}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  status === "PUBLISHED" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-800"
                }`}
              >
                {status === "PUBLISHED" ? "Publish" : status === "ARCHIVED" ? "Archive" : "Move to draft"}
              </button>
            ))}
          </form>
        )}
      </section>
    </>
  );
}
