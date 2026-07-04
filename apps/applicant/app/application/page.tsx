import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalHeader } from "@/components/PortalHeader";
import { auth } from "@/auth";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import { getTenantBySlug, getUserByEmail, listApplicantApplications } from "@talentos/db";

function formatDate(value: Date | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default async function ApplicationPage() {
  const session = await auth();
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const email = session?.user?.email ?? null;
  const user = tenant && email ? await getUserByEmail(email) : null;
  const applications = tenant && user ? await listApplicantApplications(user.id, tenant.id) : [];

  // If the applicant has an accepted application, redirect to dashboard
  if (applications.some((a) => a.status === "ACCEPTED")) {
    redirect("/dashboard");
  }

  return (
    <main>
      <PortalHeader tenantSlug={tenantSlug} />
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
