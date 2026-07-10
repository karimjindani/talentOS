import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { can, nextSubmissionStatuses } from "@talentos/auth";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import {
  getTenantBySlug,
  getTenantSubmission,
  listEngineeringJournalEntriesForSubmissionReview
} from "@talentos/db";
import { reviewSubmissionAction } from "../../../submission-actions";

type SubmissionReviewPageProps = {
  params: Promise<{ id: string; submissionId: string }>;
};

export default async function SubmissionReviewPage({ params }: SubmissionReviewPageProps) {
  const { id: missionId, submissionId } = await params;
  const session = await auth();
  const canReview = can("reviewSubmissions", {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  });
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const submission = tenant ? await getTenantSubmission(submissionId, tenant.id) : null;

  if (!submission || submission.missionId !== missionId) {
    notFound();
  }

  const journalEntries = await listEngineeringJournalEntriesForSubmissionReview({
    tenantId: submission.tenantId,
    applicantId: submission.applicantId,
    missionId: submission.missionId,
    missionAssignmentId: submission.missionAssignmentId
  });

  const evidence = [
    { label: "Git repository", href: submission.repositoryUrl },
    { label: "Deployed application", href: submission.deploymentUrl },
    { label: "Loom walkthrough", href: submission.loomUrl }
  ].filter((link): link is { label: string; href: string } => Boolean(link.href));

  const reviewable = canReview && nextSubmissionStatuses(submission.status).length > 0;

  return (
    <>
      <Link href={`/missions/${missionId}`} className="text-sm font-semibold text-brand-blue">
        ← Back to mission
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Submission review</h1>
          <p className="mt-2 text-slate-600">
            {submission.mission.title} • Week {submission.mission.weekNumber} •{" "}
            {submission.applicant.name ?? submission.applicant.email}
          </p>
        </div>
        <StatusBadge status={submission.status} />
      </div>

      <div className="mt-6 grid max-w-4xl gap-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Evidence</h2>
          {evidence.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No evidence links provided.</p>
          ) : (
            <ul className="mt-3 grid gap-2 text-sm">
              {evidence.map((link) => (
                <li key={link.label}>
                  <span className="font-medium text-slate-700">{link.label}: </span>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="break-all text-brand-blue underline"
                  >
                    {link.href}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-slate-500">
            Submitted {submission.submittedAt ? submission.submittedAt.toLocaleString() : "—"}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Engineering Journal</h2>
          {journalEntries.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              No Engineering Journal entries have been recorded for this assignment yet.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-200">
              {journalEntries.map((entry) => (
                <article key={entry.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">
                      {entry.entryDate.toLocaleDateString()}
                    </h3>
                    <p className="text-sm text-slate-500">
                      Week {entry.weekNumber} &bull; {submission.mission.title} &bull; {entry.language}
                      {submission.missionAssignment
                        ? ` \u2022 Attempt ${submission.missionAssignment.attemptNumber}`
                        : ""}
                    </p>
                  </div>

                  <dl className="mt-4 grid gap-4">
                    <JournalField label="What Did You Work On Today?" value={entry.workedOn} />
                    <JournalField label="What Challenge Did You Face?" value={entry.challenge} />
                    <JournalField label="How Did You Solve It?" value={entry.solution} />
                    <JournalField label="What Did You Learn?" value={entry.learned} />
                    <JournalField label="AI Usage" value={entry.aiUsage} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <JournalField label="Confidence Rating" value={`${entry.confidenceRating}/5`} />
                      <JournalField label="Time Spent" value={`${entry.timeSpentHours} hours`} />
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-slate-800">Evidence</dt>
                      {entry.evidenceLinks.length === 0 ? (
                        <dd className="mt-1 text-sm text-slate-600">No evidence links provided.</dd>
                      ) : (
                        <dd className="mt-1">
                          <ul className="grid gap-1 text-sm">
                            {entry.evidenceLinks.map((href) => (
                              <li key={href}>
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="break-all text-brand-blue underline"
                                >
                                  {href}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      )}
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Competencies evidenced when accepted</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {submission.mission.competencyTags.map((tag) => (
              <span key={tag} className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-blue">
                {tag}
              </span>
            ))}
          </div>
        </section>

        {submission.reviewedAt ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Previous review</h2>
            <p className="mt-2 text-sm text-slate-600">
              {submission.reviewer?.name ?? submission.reviewer?.email ?? "—"} •{" "}
              {submission.reviewedAt.toLocaleString()}
            </p>
            {submission.reviewerFeedback ? (
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {submission.reviewerFeedback}
              </p>
            ) : null}
          </section>
        ) : null}

        {reviewable ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Review decision</h2>
            <p className="mt-1 text-sm text-slate-600">
              Accepting is terminal: the submission becomes portfolio/graduation evidence for the
              mission&apos;s competencies. Requesting changes returns it to the applicant with your
              feedback. Repeating closes this attempt and creates a fresh attempt for the same week.
            </p>
            <form action={reviewSubmissionAction} className="mt-4 grid gap-4">
              <input type="hidden" name="submissionId" value={submission.id} />
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Feedback for the applicant
                <textarea
                  name="reviewerFeedback"
                  rows={5}
                  placeholder="What is strong, and what must change before acceptance?"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  name="decision"
                  value="ACCEPTED"
                  className="cursor-pointer rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  Accept submission
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="NEEDS_REVISION"
                  className="cursor-pointer rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
                >
                  Request changes
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="REPEAT"
                  className="cursor-pointer rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  Repeat week
                </button>
              </div>
            </form>
          </section>
        ) : !canReview ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            Your role can view submissions but cannot review them.
          </p>
        ) : null}
      </div>
    </>
  );
}

function JournalField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-slate-800">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</dd>
    </div>
  );
}
