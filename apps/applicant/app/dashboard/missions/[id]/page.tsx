import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import { isSubmissionEditable } from "@talentos/auth";
import {
  getApplicantSubmissionForAssignment,
  getApplicantMissionAssignmentForMission,
  getAssignedProgramMission,
  getMissionSubmissionReadiness,
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
  type Submission
} from "@talentos/db";
import { SubmissionForm } from "./SubmissionForm";

type MissionDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ApplicantMissionDetailPage({ params }: MissionDetailPageProps) {
  const { id } = await params;
  const session = await auth();
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const email = session?.user?.email ?? null;
  const user = email && tenant ? await getUserByEmail(email) : null;
  const applications = user && tenant ? await listApplicantApplications(user.id, tenant.id) : [];
  const acceptedApp = applications.find((application) => application.status === "ACCEPTED");

  if (!user || !tenant || !acceptedApp) {
    return null;
  }

  const mission = await getAssignedProgramMission(id, tenant.id, user.id, acceptedApp.program.id);
  if (!mission) {
    notFound();
  }

  const assignment = await getApplicantMissionAssignmentForMission(tenant.id, user.id, mission.id);
  const submission = assignment
    ? await getApplicantSubmissionForAssignment(assignment.id, user.id, tenant.id)
    : null;
  const readiness = assignment && (!submission || isSubmissionEditable(submission.status))
    ? await getMissionSubmissionReadiness({
        tenantId: tenant.id,
        applicantId: user.id,
        missionAssignmentId: submission?.missionAssignmentId ?? assignment.id
      })
    : null;

  return (
    <article className="max-w-4xl">
      <Link href="/dashboard/missions" className="text-sm font-semibold text-brand-blue">
        â† Back to missions
      </Link>
      <div className="mt-4 rounded-3xl bg-brand-navy p-8 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-mist">
          Week {mission.weekNumber} {"\u2022"} {mission.difficulty}
        </p>
        <h1 className="mt-3 text-3xl font-bold">{mission.title}</h1>
        <p className="mt-3 max-w-3xl text-brand-mist">{mission.objective}</p>
      </div>

      <div className="mt-6 grid gap-5">
        <Section title="Mission Brief" body={mission.brief} />
        <Section title="Required Deliverables" body={mission.deliverables} />
        <Section title="Acceptance Criteria" body={mission.acceptanceCriteria} />
        <Section title="Evaluation Criteria" body={mission.evaluationCriteria} />
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-navy">Competencies</h2>
          <p className="mt-2 text-xs text-slate-500">
            An accepted submission demonstrates these competencies as portfolio evidence.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {mission.competencyTags.map((tag) => (
              <span key={tag} className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-blue">
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* My Submission (v0.15.0, D-067): SEM loop — draft → submit → review → revise → accept. */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-brand-navy">My Submission</h2>
            <SubmissionStatusBadge status={submission?.status ?? null} />
          </div>

          {submission?.reviewerFeedback && submission.status !== "SUBMITTED" ? (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                submission.status === "ACCEPTED"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <p className="font-semibold">Reviewer feedback</p>
              <p className="mt-1 whitespace-pre-wrap">{submission.reviewerFeedback}</p>
            </div>
          ) : null}

          {!submission || isSubmissionEditable(submission.status) ? (
            <SubmissionForm
              missionId={mission.id}
              isRevision={submission?.status === "NEEDS_REVISION"}
              defaults={{
                repositoryUrl: submission?.repositoryUrl ?? "",
                deploymentUrl: submission?.deploymentUrl ?? "",
                loomUrl: submission?.loomUrl ?? ""
              }}
              readiness={readiness ? { tasks: readiness.tasks, journals: readiness.journals } : null}
            />
          ) : (
            <SubmittedEvidence submission={submission} />
          )}
        </section>
      </div>
    </article>
  );
}

function SubmissionStatusBadge({ status }: { status: Submission["status"] | null }) {
  const styles: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    SUBMITTED: "bg-blue-100 text-blue-700",
    NEEDS_REVISION: "bg-amber-100 text-amber-800",
    ACCEPTED: "bg-emerald-100 text-emerald-700",
    REVIEWED: "bg-slate-100 text-slate-700",
    REPEAT: "bg-rose-100 text-rose-700"
  };
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted — awaiting review",
    NEEDS_REVISION: "Revision requested",
    ACCEPTED: "Accepted",
    REVIEWED: "Reviewed",
    REPEAT: "Repeat assigned"
  };
  if (!status) {
    return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Not started</span>;
  }
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}

function SubmittedEvidence({ submission }: { submission: Submission }) {
  const links = [
    { label: "Git repository", href: submission.repositoryUrl },
    { label: "Deployed application", href: submission.deploymentUrl },
    { label: "Loom walkthrough", href: submission.loomUrl }
  ].filter((link): link is { label: string; href: string } => Boolean(link.href));

  return (
    <div className="mt-4 grid gap-4 text-sm">
      <ul className="grid gap-2">
        {links.map((link) => (
          <li key={link.label}>
            <span className="font-medium text-slate-700">{link.label}: </span>
            <a href={link.href} target="_blank" rel="noreferrer noopener" className="break-all text-brand-blue underline">
              {link.href}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-sm text-slate-600">
        Write your daily reflection in the{" "}
        <Link href="/dashboard/journal" className="font-semibold text-brand-blue underline">
          Engineering Journal
        </Link>
        .
      </p>
      {submission.submittedAt ? (
        <p className="text-xs text-slate-500">
          Submitted {submission.submittedAt.toLocaleString()} — evidence is locked while under review.
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{body || "Not specified."}</p>
    </section>
  );
}
