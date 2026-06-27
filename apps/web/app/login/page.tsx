import { PortalHeader } from "@/components/PortalHeader";
import { getTenantContext } from "@/lib/tenant";

export default async function LoginPage() {
  const tenant = await getTenantContext();

  return (
    <main>
      <PortalHeader tenantSlug={tenant.tenantSlug} />
      <section className="mx-auto max-w-xl px-6 py-14">
        <h1 className="text-3xl font-bold">Login</h1>
        <p className="mt-3 text-slate-600">Email/password login with TOTP verification is the first supported authentication model.</p>
        <form className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" name="email" type="email" placeholder="Email" />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" name="password" type="password" placeholder="Password" />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" name="totp" inputMode="numeric" placeholder="Authenticator code" />
          <button className="w-full rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white" type="button">
            Login
          </button>
        </form>
      </section>
    </main>
  );
}
