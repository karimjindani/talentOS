import { PortalHeader } from "@/components/PortalHeader";
import { getTenantContext } from "@talentos/ui";

export default async function ApplyPage() {
  const tenant = await getTenantContext();

  return (
    <main>
      <PortalHeader tenantSlug={tenant.tenantSlug} />
      <section className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-bold">Apply to the TalentOS pilot</h1>
        <p className="mt-3 text-slate-600">
          This first vertical slice captures applicant intent and establishes the application
          workflow. Persistence is wired through the Prisma data model in the next implementation pass.
        </p>
        <form className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block">
            <span className="text-sm font-medium">Full name</span>
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" name="name" placeholder="Your name" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" name="email" type="email" placeholder="you@example.com" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Why do you want to join?</span>
            <textarea className="mt-1 min-h-32 w-full rounded-lg border border-slate-300 px-3 py-2" name="motivation" />
          </label>
          <button className="rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white" type="button">
            Save draft application
          </button>
        </form>
      </section>
    </main>
  );
}
