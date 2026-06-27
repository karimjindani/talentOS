import { PortalHeader } from "@/components/PortalHeader";
import { getTenantContext } from "@talentos/ui";

export default async function SignupPage() {
  const tenant = await getTenantContext();

  return (
    <main>
      <PortalHeader tenantSlug={tenant.tenantSlug} />
      <section className="mx-auto max-w-xl px-6 py-14">
        <h1 className="text-3xl font-bold">Create your applicant account</h1>
        <p className="mt-3 text-slate-600">
          TalentOS teaches secure habits from the beginning. After email signup, applicants are
          guided to configure authenticator-app 2FA.
        </p>
        <form className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" name="email" type="email" placeholder="Email" />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" name="password" type="password" placeholder="Strong password" />
          <button className="w-full rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white" type="button">
            Continue to 2FA setup
          </button>
        </form>
      </section>
    </main>
  );
}
