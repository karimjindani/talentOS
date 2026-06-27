import { createTotpEnrollment } from "@talentos/auth";
import { PortalHeader } from "@/components/PortalHeader";
import { getTenantContext } from "@talentos/ui";

export default async function TwoFactorSetupPage() {
  const tenant = await getTenantContext();
  const enrollment = createTotpEnrollment("applicant@example.com");

  return (
    <main>
      <PortalHeader tenantSlug={tenant.tenantSlug} />
      <section className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-3xl font-bold">Set up two-factor authentication</h1>
        <p className="mt-3 text-slate-600">
          Scan this authenticator URI with Google Authenticator or another TOTP-compatible app.
          In production this secret is generated per authenticated user and stored encrypted.
        </p>
        <div className="mt-8 break-all rounded-2xl border border-slate-200 bg-white p-6 text-sm shadow-sm">
          {enrollment.otpauthUrl}
        </div>
      </section>
    </main>
  );
}
