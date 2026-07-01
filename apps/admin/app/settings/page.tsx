import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import { can } from "@talentos/auth";
import { getTenantBySlug } from "@talentos/db";
import { saveTenantBranding } from "./actions";

export default async function AdminSettingsPage() {
  const session = await auth();
  const actor = {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  };
  const canManage = can("manageTenantSettings", actor);

  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);

  return (
    <>
      <h1 className="text-3xl font-bold">Tenant settings</h1>

      {!canManage ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-slate-600 shadow-sm">
          You do not have permission to edit tenant settings. Contact an Org Admin.
        </p>
      ) : null}

      <form action={saveTenantBranding} encType="multipart/form-data" className="mt-8 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Organisation name</h2>
          <div className="mt-4">
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">
              Display name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={tenant?.name ?? ""}
              disabled={!canManage}
              className="mt-1 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Brand colors</h2>
          <p className="mt-1 text-sm text-slate-500">
            These colors are applied across both the admin and applicant portals.
          </p>
          <div className="mt-4 flex flex-wrap gap-6">
            <div>
              <label htmlFor="primaryColor" className="block text-sm font-medium text-slate-700">
                Primary color
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="primaryColor"
                  name="primaryColor"
                  type="color"
                  defaultValue={tenant?.primaryColor ?? "#2563eb"}
                  disabled={!canManage}
                  className="h-9 w-14 cursor-pointer rounded border border-slate-300 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-slate-500">{tenant?.primaryColor ?? "#2563eb"}</span>
              </div>
            </div>
            <div>
              <label htmlFor="secondaryColor" className="block text-sm font-medium text-slate-700">
                Secondary color
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="secondaryColor"
                  name="secondaryColor"
                  type="color"
                  defaultValue={tenant?.secondaryColor ?? "#0f172a"}
                  disabled={!canManage}
                  className="h-9 w-14 cursor-pointer rounded border border-slate-300 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-slate-500">{tenant?.secondaryColor ?? "#0f172a"}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Logo</h2>
          <p className="mt-1 text-sm text-slate-500">PNG, JPEG or WebP — max 2 MB.</p>
          {tenant?.logoFileId ? (
            <div className="mt-3">
              <img
                src={`/api/files/${tenant.logoFileId}/download`}
                alt="Current logo"
                className="h-12 w-auto rounded border border-slate-200"
              />
            </div>
          ) : null}
          <input
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={!canManage}
            className="mt-3 block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-mist file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-blue disabled:cursor-not-allowed"
          />
        </section>

        {canManage ? (
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Save settings
            </button>
          </div>
        ) : null}
      </form>
    </>
  );
}
