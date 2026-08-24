import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { can, nextReviewerDecisions } from "@talentos/auth";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import {
  buildSubmissionEvidenceLinks,
  getTenantBySlug,
  getTenantSubmission,
  listEngineeringJournalEntriesForSubmissionReview,
  listPreviousMissionAttemptHistoryForSubmissionReview,
  listSubmissionReviewHistory
} from "@talentos/db";
import { reviewSubmissionAction } from "../../../submission-actions";

// Reviewer-facing wording: the enum value CHANGES_REQUESTED is shown as "Changes requested" to match
// the "Request changes" button that produces it.
const REVIEW_DECISION_LABEL: Record<string, string> = {
  ACCEPTED: "Accepted",
  CHANGES_REQUESTED: "Changes requested",
  REPEAT: "Week repeated"
};

const REVIEW_DECISION_CLASS: Record<string, string> = {
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  CHANGES_REQUESTED: "bg-amber-100 text-amber-800",
  REPEAT: "bg-slate-200 text-slate-800"
};

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
  const previousAttemptHistory = submission.missionAssignmentId
    ? await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: submission.tenantId,
        missionAssignmentId: submission.missionAssignmentId
      })
    : [];

  const reviewHistory = submission.missionAssignmentId
    ? await listSubmissionReviewHistory({
        tenantId: submission.tenantId,
        missionAssignmentId: submission.missionAssignmentId
      })
    : [];

  const evidence = buildSubmissionEvidenceLinks(submission);

  const reviewable = canReview && nextReviewerDecisions(submission.status).length > 0;

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

        {/*
          Full review history (v0.20.0) rather than just the latest decision. One Submission row is
          reused across the revision loop, so reviewerFeedback is overwritten every round -- a
          reviewer picking up an attempt could not previously see what had already been asked for.
          Falls back to the submission's own fields for attempts reviewed before the history table
          existed, whose earlier rounds were not recoverable.
        */}
        {reviewHistory.length > 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Review history</h2>
              <span className="text-sm text-slate-500">
                {reviewHistory.length} {reviewHistory.length === 1 ? "round" : "rounds"} on this attempt
              </span>
            </div>
            <ol className="mt-4 space-y-3">
              {reviewHistory.map((review) => (
                <li
                  key={review.round}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-300">
                      Round {review.round}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${REVIEW_DECISION_CLASS[review.decision]}`}
                    >
                      {REVIEW_DECISION_LABEL[review.decision]}
                    </span>
                    <span className="text-xs text-slate-500">
                      {review.reviewerName ?? "Unknown reviewer"} • {review.reviewedAt.toLocaleString()}
                    </span>
                  </div>
                  {review.feedback ? (
                    <p className="mt-2.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {review.feedback}
                    </p>
                  ) : (
                    <p className="mt-2.5 text-sm italic text-slate-500">No feedback recorded.</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ) : submission.reviewedAt ? (
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

        {/*
          Collapsible like the applicant's Journal tab: the section stays open (it is the primary
          evidence) but each entry is a disclosure, so four entries no longer bury the review
          controls under thousands of pixels. The newest entry starts expanded.
        */}
        <details open className="group/section rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer list-none px-6 py-5 hover:bg-slate-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <span
                  aria-hidden
                  className="text-slate-400 transition-transform group-open/section:rotate-90"
                >
                  ▶
                </span>
                Engineering Journal
              </h2>
              <span className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-blue">
                {journalEntries.length} {journalEntries.length === 1 ? "entry" : "entries"}
              </span>
            </div>
          </summary>

          <div className="border-t border-slate-200 px-6 py-4">
            {journalEntries.length === 0 ? (
              <p className="text-sm text-slate-600">
                No Engineering Journal entries have been recorded for this assignment yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-200">
                {journalEntries.map((entry, index) => (
                  <JournalEntryDisclosure
                    key={entry.id}
                    entry={entry}
                    missionTitle={submission.mission.title}
                    attemptNumber={submission.missionAssignment?.attemptNumber ?? null}
                    defaultOpen={index === 0}
                  />
                ))}
              </div>
            )}
          </div>
        </details>

        {previousAttemptHistory.length > 0 ? (
          <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-6 py-5 text-slate-900">
              <span className="ml-1 text-lg font-semibold">Previous Attempt History</span>
              <span className="mt-1 block pl-5 text-sm font-normal text-slate-600">
                Optional read-only context from earlier attempts for this week.
              </span>
            </summary>

            <div className="divide-y divide-slate-200 border-t border-slate-200">
              {previousAttemptHistory.map((attempt) => (
                <article key={attempt.missionAssignmentId} className="p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">
                      Attempt {attempt.attemptNumber}: {attempt.mission.title}
                    </h3>
                    <span className="text-sm text-slate-500">Week {attempt.weekNumber}</span>
                  </div>

                  <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                    <ReviewMeta label="Assignment result" value={formatStatus(attempt.assignmentStatus)} />
                    <ReviewMeta
                      label="Submission result"
                      value={attempt.submission ? formatStatus(attempt.submission.status) : "No submission"}
                    />
                    <ReviewMeta
                      label="Submitted"
                      value={attempt.submission?.submittedAt?.toLocaleString() ?? "Not submitted"}
                    />
                    <ReviewMeta
                      label="Reviewed"
                      value={attempt.submission?.reviewedAt?.toLocaleString() ?? "Not reviewed"}
                    />
                  </dl>

                  {attempt.reviews.length > 0 ? (
                    <div className="mt-5">
                      <h4 className="text-sm font-semibold text-slate-800">
                        Review history ({attempt.reviews.length}{" "}
                        {attempt.reviews.length === 1 ? "round" : "rounds"})
                      </h4>
                      <ol className="mt-2 space-y-2">
                        {attempt.reviews.map((review) => (
                          <li key={review.round} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-slate-600">Round {review.round}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${REVIEW_DECISION_CLASS[review.decision]}`}
                              >
                                {REVIEW_DECISION_LABEL[review.decision]}
                              </span>
                              <span className="text-xs text-slate-500">
                                {review.reviewer?.name ?? review.reviewer?.email ?? "Unknown reviewer"} •{" "}
                                {review.createdAt.toLocaleString()}
                              </span>
                            </div>
                            {review.feedback ? (
                              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                {review.feedback}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : attempt.submission?.reviewerFeedback ? (
                    <div className="mt-5">
                      <h4 className="text-sm font-semibold text-slate-800">Previous reviewer feedback</h4>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {attempt.submission.reviewerFeedback}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-6">
                    <h4 className="font-semibold text-slate-900">
                      Engineering Journal ({attempt.journalEntries.length})
                    </h4>
                    {attempt.journalEntries.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-600">
                        No linked Engineering Journal entries were recorded for this attempt.
                      </p>
                    ) : (
                      // All collapsed here: this is older context behind an already-collapsed block.
                      <div className="mt-3 divide-y divide-slate-200">
                        {attempt.journalEntries.map((entry) => (
                          <JournalEntryDisclosure
                            key={entry.id}
                            entry={entry}
                            missionTitle={attempt.mission.title}
                            attemptNumber={attempt.attemptNumber}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </details>
        ) : null}

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
              <label className="grid max-w-xs gap-1.5 text-sm font-medium text-slate-700">
                Rating when accepted (1-5)
                <input
                  name="rating"
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  defaultValue={submission.rating ?? ""}
                  placeholder="4.5"
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
                <span className="text-xs font-normal text-slate-500">
                  Required only when you accept the submission.
                </span>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Feedback for the applicant
                <span className="text-xs font-normal text-slate-500">
                  Required for &ldquo;Request changes&rdquo; and &ldquo;Repeat week&rdquo;; optional when accepting.
                </span>
                {/* `required` + `formNoValidate` on Accept keeps the browser from submitting the two
                    feedback-bound decisions empty. Without it the server action's guard threw, which
                    Next.js surfaces in production as an opaque digest-only error page. */}
                <textarea
                  name="reviewerFeedback"
                  rows={5}
                  required
                  placeholder="What is strong, and what must change before acceptance?"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  name="decision"
                  value="ACCEPTED"
                  formNoValidate
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
        ) : submission.status === "NEEDS_REVISION" ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            Changes were requested. This section reopens once the applicant resubmits their evidence.
          </p>
        ) : !canReview ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            Your role can view submissions but cannot review them.
          </p>
        ) : null}
      </div>
    </>
  );
}

type JournalDisclosureEntry = {
  id: string;
  entryDate: Date;
  weekNumber: number;
  language: string;
  workedOn: string;
  challenge: string;
  solution: string;
  learned: string;
  aiUsage: string;
  confidenceRating: number;
  timeSpentHours: number;
  evidenceLinks: string[];
};

/**
 * One journal entry as a disclosure (v0.20.0). A four-entry attempt previously rendered every field
 * of every entry inline, pushing the review controls thousands of pixels down the page; the summary
 * row carries enough (date, week, mission, confidence, time) to decide what is worth opening.
 *
 * Shared by the current attempt and the previous-attempt history, which rendered identical markup.
 */
function JournalEntryDisclosure({
  entry,
  missionTitle,
  attemptNumber = null,
  defaultOpen = false
}: {
  entry: JournalDisclosureEntry;
  missionTitle: string;
  attemptNumber?: number | null;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group py-3 first:pt-0 last:pb-0">
      <summary className="cursor-pointer list-none rounded-lg px-2 py-2 hover:bg-slate-50">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            <span aria-hidden className="text-slate-400 transition-transform group-open:rotate-90">
              ▶
            </span>
            {entry.entryDate.toLocaleDateString()}
          </span>
          <span className="text-sm text-slate-500">
            Week {entry.weekNumber} &bull; {missionTitle} &bull; {entry.language}
            {attemptNumber !== null ? ` • Attempt ${attemptNumber}` : ""} &bull; Confidence{" "}
            {entry.confidenceRating}/5 &bull; {entry.timeSpentHours}h
          </span>
        </div>
      </summary>

      <dl className="mt-4 grid gap-4 px-2">
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
    </details>
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

function ReviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-slate-800">{label}</dt>
      <dd className="mt-1 text-slate-700">{value}</dd>
    </div>
  );
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ").toLowerCase().replace(/^./, (character) => character.toUpperCase());
}
