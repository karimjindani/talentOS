import { PortalHeader } from "@/components/PortalHeader";
import { getTenantContext } from "@/lib/tenant";

export default async function ApplicationPage() {
  const tenant = await getTenantContext();

  return (
    <main>
      <PortalHeader tenantSlug={tenant.tenantSlug} />
      <section className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-3xl font-bold">Your application</h1>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="font-semibold">Status: Draft</p>
          <p className="mt-2 text-slate-600">
            The first implementation stores applications with statuses from draft through review,
            acceptance, rejection and waitlist.
          </p>
        </div>
      </section>
    </main>
  );
}
