export default function AdminSettingsPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Tenant settings</h1>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">White-label configuration</h2>
        <p className="mt-2 text-slate-600">
          Branding, logos, certificates, email templates, knowledge bases, programs and missions are tenant-scoped.
        </p>
      </section>
    </>
  );
}
