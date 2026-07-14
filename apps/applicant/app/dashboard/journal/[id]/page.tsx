import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getApplicantJournalEntry,
  getTenantBySlug,
  getUserByEmail,
  isJournalMissionLockedForApplicant,
  listAssignedProgramMissions,
  listApplicantApplications,
} from "@talentos/db";
import { JournalEntryForm } from "../JournalEntryForm";
import {
  findJournalMissionOption,
  formatJournalDate,
  getJournalEntryPageTitle,
  isJournalEditMode,
  toJournalDateInput
} from "../view-model";

type JournalEntryPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ mode?: string | string[] }>;
};

export default async function JournalEntryPage({ params, searchParams }: JournalEntryPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const editMode = isJournalEditMode(resolvedSearchParams);
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

  const entry = await getApplicantJournalEntry(id, tenant.id, user.id);
  if (!entry || entry.programId !== acceptedApp.program.id) {
    notFound();
  }
  const journalLocked =
    Boolean(entry.lockedAt) ||
    (!entry.missionAssignmentId &&
      (await isJournalMissionLockedForApplicant(tenant.id, user.id, entry.missionId)));
  const effectiveEditMode = editMode && !journalLocked;

  const missions = await listAssignedProgramMissions(tenant.id, user.id, acceptedApp.program.id);
  const missionOptions = missions.map((mission) => ({
    id: mission.id,
    title: mission.title,
    weekNumber: mission.weekNumber
  }));
  const lockedMission =
    findJournalMissionOption(missionOptions, entry.missionId) ?? {
      id: entry.missionId,
      title: entry.mission.title,
      weekNumber: entry.weekNumber
    };

  return (
    <div>
      <Link href="/dashboard/journal" className="text-sm font-semibold text-brand-blue">
        Back to journal
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-brand-navy">{getJournalEntryPageTitle(effectiveEditMode)}</h1>
          <p className="mt-2 text-slate-600">
            {entry.mission.title} {"\u2022"} Week {entry.weekNumber} {"\u2022"} {formatJournalDate(entry.entryDate)}
          </p>
        </div>
        {journalLocked ? (
          <span
            aria-disabled="true"
            className="rounded-xl bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-500"
          >
            Locked after submission
          </span>
        ) : effectiveEditMode ? (
          <Link
            href={`/dashboard/journal/${entry.id}`}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-blue hover:text-brand-blue"
          >
            Cancel edit
          </Link>
        ) : (
          <Link
            href={`/dashboard/journal/${entry.id}?mode=edit`}
            className="rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy"
          >
            Edit
          </Link>
        )}
      </div>

      {journalLocked ? (
        <p className="mt-4 max-w-4xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This journal entry is locked because it was submitted for review.
        </p>
      ) : null}

      <section className="mt-6 max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">AI review</h2>
        <p className="mt-1 text-sm text-slate-600">
          AI review and scoring fields exist in the data model, but real AI scoring is not active yet.
        </p>
      </section>

      {effectiveEditMode ? (
        <JournalEntryForm
          entryId={entry.id}
          missions={missionOptions}
          lockedMission={lockedMission}
          missionHelpText="Mission is fixed for saved journal entries."
          defaults={{
            missionId: entry.missionId,
            entryDate: toJournalDateInput(entry.entryDate),
            language: entry.language,
            workedOn: entry.workedOn,
            challenge: entry.challenge,
            solution: entry.solution,
            learned: entry.learned,
            aiUsage: entry.aiUsage,
            confidenceRating: entry.confidenceRating,
            timeSpentHours: entry.timeSpentHours,
            evidenceLinks: entry.evidenceLinks
          }}
          submitLabel="Save changes"
        />
      ) : (
        <JournalEntryReadOnlyView entry={entry} />
      )}
    </div>
  );
}

type JournalEntryReadOnlyViewProps = {
  entry: NonNullable<Awaited<ReturnType<typeof getApplicantJournalEntry>>>;
};

function JournalEntryReadOnlyView({ entry }: JournalEntryReadOnlyViewProps) {
  return (
    <section className="mt-6 grid max-w-4xl gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyField label="Mission" value={`Week ${entry.weekNumber} - ${entry.mission.title}`} />
        <ReadOnlyField label="Entry date" value={formatJournalDate(entry.entryDate)} />
        <ReadOnlyField label="Journal language" value={entry.language} />
        <ReadOnlyField label="Confidence rating" value={`${entry.confidenceRating}/5`} />
        <ReadOnlyField
          label="Time spent"
          value={`${entry.timeSpentHours} hour${entry.timeSpentHours === 1 ? "" : "s"}`}
        />
      </div>

      <ReadOnlyBlock label="What did you work on today?" value={entry.workedOn} />
      <ReadOnlyBlock label="What challenge did you face?" value={entry.challenge} />
      <ReadOnlyBlock label="How did you solve it?" value={entry.solution} />
      <ReadOnlyBlock label="What did you learn?" value={entry.learned} />
      <ReadOnlyBlock label="AI usage" value={entry.aiUsage} />

      <div>
        <p className="text-sm font-medium text-slate-700">Evidence links</p>
        {entry.evidenceLinks.length > 0 ? (
          <ul className="mt-2 grid gap-2 text-sm">
            {entry.evidenceLinks.map((link) => (
              <li key={link}>
                <a href={link} className="break-all font-medium text-brand-blue hover:underline" target="_blank" rel="noreferrer">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">No evidence links added.</p>
        )}
      </div>
    </section>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-1 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900">{value}</p>
    </div>
  );
}

function ReadOnlyBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900">
        {value}
      </p>
    </div>
  );
}
