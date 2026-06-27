import Link from "next/link";
import { PortalHeader } from "@/components/PortalHeader";
import { StatusCard, getTenantContext } from "@talentos/ui";

export default async function HomePage() {
  const tenant = await getTenantContext();

  return (
    <main>
      <PortalHeader tenantSlug={tenant.tenantSlug} />
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-blue">
          Applications-first pilot
        </p>
        <h1 className="mt-4 max-w-4xl text-5xl font-bold tracking-tight text-brand-navy">
          Build AI-native engineers through real missions, deployment and production readiness.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          TalentOS bridges AI-assisted coding and production-grade engineering through a secure,
          white-label SaaS platform for companies, universities and training academies.
        </p>
        <div className="mt-8 flex gap-4">
          <Link className="rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white" href="/apply">
            Start application
          </Link>
          <Link className="rounded-xl border border-slate-300 px-5 py-3 font-semibold" href="/login">
            Applicant login
          </Link>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          <StatusCard title="Secure from day one" description="Email signup, guided authenticator 2FA and tenant-scoped access are architectural foundations." />
          <StatusCard title="Multi-company SaaS" description="Subdomain tenant routing and shared database tenancy are designed into the first iteration." />
          <StatusCard title="Production readiness" description="Every iteration preserves tests, documentation, Docker deployment and data dictionary updates." />
        </div>
      </section>
    </main>
  );
}
