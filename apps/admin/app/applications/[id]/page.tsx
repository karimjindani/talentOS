import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import {
  assertApplicationStatusTransition,
  assertTenantScopedAccess,
  can,
  nextStatusesFor,
  type ApplicationStatus
} from "@talentos/auth";
import {
  applyStatusTransition,
  getTenantApplication,
  getTenantBySlug,
  getUserByEmail
} from "@talentos/db";

type ApplicationDetailPageProps = {
  params: Promise<{ id: string }>;
};

// Accept is emphasised; rejection is destructive; the rest are neutral.
const ACTION_STYLES: Record<string, string> = {
  ACCEPTED: "bg-emerald-600 text-white",
  REJECTED: "bg-rose-600 text-white"
};

function formatDate(value: Date | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

async function reviewApplication(formData: FormData) {
  "use server";

  const session = await auth();
  const actor = {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  };
  // Middleware lets any admin-capable role enter the portal; reviewing needs the finer capability
  // (ORG_ADMIN / HR / SUPER_ADMIN). TECH_LEAD can view but not decide.
  if (!can("reviewApplications", actor)) {
    redirect("/forbidden");
  }

  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    throw new Error(`Unknown tenant "${tenantSlug}".`);
  }

  const id = String(formData.get("applicationId") ?? "");
  const toStatus = String(formData.get("toStatus") ?? "") as ApplicationStatus;
  const reviewerNotes = String(formData.get("reviewerNotes") ?? "").trim();

  const application = await getTenantApplication(id, tenant.id);
  if (!application) {
    notFound();
  }
  assertTenantScopedAccess(application.tenantId, tenant.id);
  assertApplicationStatusTransition(application.status, toStatus);

  const reviewer = session?.user?.email ? await getUserByEmail(session.user.email) : null;
  await applyStatusTransition({
    id,
    toStatus,
    reviewerNotes: reviewerNotes.length > 0 ? reviewerNotes : null,
    actorUserId: reviewer?.id ?? null,
    tenantId: tenant.id
  });

  revalidatePath("/applications");
  revalidatePath(`/applications/${id}`);
}

export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const { id } = await params;
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const application = tenant ? await getTenantApplication(id, tenant.id) : null;
  if (!application) {
    notFound();
  }

  const transitions = nextStatusesFor(application.status);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {application.applicant.name ?? application.applicant.email}
        </h1>
        <StatusBadge status={application.status} />
      </div>
      <p className="mt-2 text-slate-600">{application.program.name}</p>

      <section className="mt-8 grid gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm shadow-sm sm:grid-cols-2">
        <div>
          <p className="font-medium text-slate-700">Applicant email</p>
          <p className="text-slate-600">{application.applicant.email}</p>
        </div>
        <div>
          <p className="font-medium text-slate-700">Submitted</p>
          <p className="text-slate-600">{formatDate(application.submittedAt)}</p>
        </div>
        <div>
          <p className="font-medium text-slate-700">Last reviewed</p>
          <p className="text-slate-600">{formatDate(application.reviewedAt)}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 text-sm shadow-sm sm:grid-cols-3">
        <div>
          <p className="font-medium text-slate-700">CV</p>
          {application.cvFile ? (
            <a
              className="text-brand-blue underline"
              href={`/api/files/${application.cvFile.id}/download`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download CV ({application.cvFile.originalName})
            </a>
          ) : (
            <p className="text-slate-600">—</p>
          )}
        </div>
        <div>
          <p className="font-medium text-slate-700">GitHub</p>
          {application.githubUrl ? (
            <a
              className="break-all text-brand-blue underline"
              href={application.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {application.githubUrl}
            </a>
          ) : (
            <p className="text-slate-600">—</p>
          )}
        </div>
        <div>
          <p className="font-medium text-slate-700">LinkedIn</p>
          {application.linkedinUrl ? (
            <a
              className="break-all text-brand-blue underline"
              href={application.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {application.linkedinUrl}
            </a>
          ) : (
            <p className="text-slate-600">—</p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Application answers</h2>
        {application.answers.length === 0 ? (
          <p className="mt-2 text-slate-600">No answers were submitted.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {application.answers.map((answer) => (
              <div key={answer.id}>
                <p className="text-sm font-medium text-slate-700">{answer.questionLabel}</p>
                <p className="mt-1 text-sm text-slate-600">{answer.answer}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Review decision</h2>
        {application.reviewerNotes ? (
          <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm">
            <p className="font-medium text-slate-700">Current reviewer notes</p>
            <p className="mt-1 text-slate-600">{application.reviewerNotes}</p>
          </div>
        ) : null}

        {transitions.length === 0 ? (
          <p className="mt-3 text-slate-600">
            This application is {application.status.replace(/_/g, " ").toLowerCase()} and has no further
            actions.
          </p>
        ) : (
          <form action={reviewApplication} className="mt-4 space-y-4">
            <input type="hidden" name="applicationId" value={application.id} />
            <label className="block">
              <span className="text-sm font-medium">Reviewer notes (optional)</span>
              <textarea
                name="reviewerNotes"
                defaultValue={application.reviewerNotes ?? ""}
                className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Notes shared with the applicant on decision."
              />
            </label>
            <div className="flex flex-wrap gap-3">
              {transitions.map((status) => (
                <button
                  key={status}
                  type="submit"
                  name="toStatus"
                  value={status}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                    ACTION_STYLES[status] ?? "bg-slate-200 text-slate-800"
                  }`}
                >
                  {status.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </form>
        )}
      </section>
    </>
  );
}
