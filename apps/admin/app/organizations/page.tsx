import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@talentos/auth";
import { listTenants } from "@talentos/db";
import { createOrganizationAction } from "./actions";

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString();
}

export default async function OrganizationsPage() {
  const session = await auth();
  const actor = {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  };
  if (!can("createOrganization", actor)) {
    redirect("/forbidden");
  }

  const tenants = await listTenants();

  return (
    <>
      <h1 className="text-3xl font-bold">Organizations</h1>
      <p className="mt-2 text-slate-600">
        Platform-wide tenant management. Each organization is reachable at
        <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-sm">{"{slug}"}.localhost:3200</code>
        (admin) and <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-sm">{"{slug}"}.localhost:3100</code> (applicant).
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Colors</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Programs</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr className="border-t border-slate-100" key={tenant.id}>
                <td className="px-4 py-3 font-medium">{tenant.name}</td>
                <td className="px-4 py-3 text-slate-500">{tenant.slug}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block h-4 w-4 rounded border border-slate-200"
                      style={{ backgroundColor: tenant.primaryColor }}
                      title={tenant.primaryColor}
                    />
                    <span
                      className="inline-block h-4 w-4 rounded border border-slate-200"
                      style={{ backgroundColor: tenant.secondaryColor }}
                      title={tenant.secondaryColor}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{tenant._count.memberships}</td>
                <td className="px-4 py-3 text-slate-500">{tenant._count.programs}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(tenant.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Create organization</h2>
        <p className="mt-1 text-sm text-slate-500">
          Creates the tenant and assigns its first Org Admin by email.
        </p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          The assigned Org Admin can act only on <strong>this</strong> organization — the database
          membership now enforces their authority per tenant. They still need the <code>ORG_ADMIN</code>{" "}
          realm role on their Keycloak account to sign in to the admin portal (assign it in the Keycloak
          admin console until auto-provisioning lands).
        </div>

        <form action={createOrganizationAction} className="mt-6 grid max-w-xl gap-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">
              Organization name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Acme Corp"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-slate-700">
              Slug (subdomain)
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              placeholder="acme"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />
            <p className="mt-1 text-xs text-slate-500">
              Lowercase letters, numbers and hyphens. Leave blank to derive from the name.
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <label htmlFor="primaryColor" className="block text-sm font-medium text-slate-700">
                Primary color
              </label>
              <input
                id="primaryColor"
                name="primaryColor"
                type="color"
                defaultValue="#2563eb"
                className="mt-1 h-9 w-14 cursor-pointer rounded border border-slate-300"
              />
            </div>
            <div>
              <label htmlFor="secondaryColor" className="block text-sm font-medium text-slate-700">
                Secondary color
              </label>
              <input
                id="secondaryColor"
                name="secondaryColor"
                type="color"
                defaultValue="#0f172a"
                className="mt-1 h-9 w-14 cursor-pointer rounded border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label htmlFor="adminEmail" className="block text-sm font-medium text-slate-700">
              Org Admin email
            </label>
            <input
              id="adminEmail"
              name="adminEmail"
              type="email"
              required
              placeholder="orgadmin@acme.talentos.local"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />
          </div>

          <div>
            <label htmlFor="adminName" className="block text-sm font-medium text-slate-700">
              Org Admin name (optional)
            </label>
            <input
              id="adminName"
              name="adminName"
              type="text"
              placeholder="Acme Org Admin"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />
          </div>

          <div>
            <button
              type="submit"
              className="rounded-xl bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Create organization
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
