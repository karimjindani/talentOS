import Link from "next/link";
import { auth } from "@/auth";
import { can } from "@talentos/auth";
import { createProgramAction } from "../actions";

export default async function NewProgramPage() {
  const session = await auth();
  const canManage = can("managePrograms", {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  });

  if (!canManage) {
    return (
      <>
        <h1 className="text-3xl font-bold">New program</h1>
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          Your role can view programs but cannot create or edit them.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold">New program</h1>
      <p className="mt-2 text-slate-600">Create a program applicants can apply to once it is published.</p>

      <form action={createProgramAction} className="mt-8 max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input name="name" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="AI-Native Software Engineering" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Slug (optional — derived from name if blank)</span>
          <input name="slug" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="ai-native-engineering" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea name="description" className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium">Status</span>
            <select name="status" defaultValue="DRAFT" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
              <option value="DRAFT">DRAFT</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Starts</span>
            <input name="startsAt" type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Ends</span>
            <input name="endsAt" type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white">
            Create program
          </button>
          <Link href="/programs" className="rounded-xl border border-slate-300 px-5 py-3 font-semibold">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
