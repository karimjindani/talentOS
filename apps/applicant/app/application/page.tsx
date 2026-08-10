import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalHeader } from "@/components/PortalHeader";
import { auth } from "@/auth";
import { StatusBadge } from "@talentos/ui";
import { getUserByEmail, listApplicantApplications } from "@talentos/db";
import { requireTenantAccess } from "@/lib/tenant-guard";

function formatDate(value: Date | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default async function ApplicationPage() {
  // Membership-gated: a user with no membership in the host-resolved tenant is redirected to
  // /access-denied rather than seeing another tenant's application area.
  const { tenant } = await requireTenantAccess("accessApplicantPortal");
  const session = await auth();
  const email = session?.user?.email ?? null;
  const user = email ? await getUserByEmail(email) : null;
  const applications = user ? await listApplicantApplications(user.id, tenant.id) : [];

  // If the applicant has an accepted application, redirect to dashboard
  if (applications.some((a) => a.status === "ACCEPTED")) {
    redirect("/dashboard");
  }

  return (
    <main>
      <PortalHeader tenantSlug={tenant.slug} />
      <section className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-3xl font-bold">Your application</h1>

        {applications.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="font-semibold">No application yet</p>
            <p className="mt-2 text-slate-600">
              You have not submitted an application for this program.{" "}
              <Link className="text-brand-blue" href="/apply">Apply now</Link>.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {applications.map((application) => (
              <article key={application.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{application.program.name}</h2>
                  <StatusBadge status={application.status} />
                </div>
                <dl className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-slate-700">Submitted</dt>
                    <dd>{formatDate(application.submittedAt)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-700">Last reviewed</dt>
                    <dd>{formatDate(application.reviewedAt)}</dd>
                  </div>
                </dl>
                {application.reviewerNotes ? (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
                    <p className="font-medium text-slate-700">Reviewer notes</p>
                    <p className="mt-1 text-slate-600">{application.reviewerNotes}</p>
                  </div>
                ) : null}
                {application.status === "DISQUALIFIED" ? (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                    A mission deadline and its grace period both passed without a submission, so this program has
                    ended for this application.
                  </div>
                ) : null}
                {application.status === "AWAITING_MISSION_ASSIGNMENT" ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    A new Week 1 mission needs to be assigned before you can continue. An admin or tech lead has
                    been notified.
                  </div>
                ) : null}
                {application.answers.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {application.answers.map((answer) => (
                      <div key={answer.id}>
                        <p className="text-sm font-medium text-slate-700">{answer.questionLabel}</p>
                        <p className="mt-1 text-sm text-slate-600">{answer.answer}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
