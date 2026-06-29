import Link from "next/link";
import { auth } from "@/auth";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import { can } from "@talentos/auth";
import { getTenantBySlug, listTenantPrograms } from "@talentos/db";

function formatDate(value: Date | null) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export default async function AdminProgramsPage() {
  const session = await auth();
  const canManage = can("managePrograms", {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  });
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const programs = tenant ? await listTenantPrograms(tenant.id) : [];

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Programs</h1>
        {canManage ? (
          <Link className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white" href="/programs/new">
            New program
          </Link>
        ) : null}
      </div>
      <p className="mt-2 text-slate-600">Programs that applicants can apply to for {tenantSlug}.</p>

      {programs.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          No programs yet.{canManage ? " Create the first one." : ""}
        </p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Starts</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {programs.map((program) => (
                <tr className="border-t border-slate-100" key={program.id}>
                  <td className="px-4 py-3 font-medium">{program.name}</td>
                  <td className="px-4 py-3 text-slate-500">{program.slug}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={program.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(program.startsAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {canManage ? (
                      <Link className="text-brand-blue" href={`/programs/${program.id}`}>
                        Edit
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
