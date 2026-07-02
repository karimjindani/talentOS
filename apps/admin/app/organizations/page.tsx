import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@talentos/auth";
import { listTenants } from "@talentos/db";
import { CreateOrgForm } from "./CreateOrgForm";

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

      <CreateOrgForm />
    </>
  );
}
