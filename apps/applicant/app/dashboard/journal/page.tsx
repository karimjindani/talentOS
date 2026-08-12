import Link from "next/link";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getTenantBySlug,
  getUserByEmail,
  isJournalMissionLockedForApplicant,
  listApplicantApplications,
  listApplicantJournalEntries
} from "@talentos/db";
import { formatJournalDate, groupJournalEntriesByMission } from "./view-model";

export default async function JournalPage() {
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

  const entries = await listApplicantJournalEntries(tenant.id, user.id, acceptedApp.program.id);

  // Only legacy entries written before assignment linking need the mission-level lock check, so this
  // is normally zero extra queries.
  const unlinkedMissionIds = [
    ...new Set(entries.filter((entry) => !entry.missionAssignmentId).map((entry) => entry.missionId))
  ];
  const lockedMissionIds = new Set(
    (
      await Promise.all(
        unlinkedMissionIds.map(async (missionId) =>
          (await isJournalMissionLockedForApplicant(tenant.id, user.id, missionId)) ? missionId : null
        )
      )
    ).filter((missionId): missionId is string => missionId !== null)
  );

  const groups = groupJournalEntriesByMission(entries, lockedMissionIds);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-navy">Engineering Journal</h1>
          <p className="mt-2 text-slate-600">
            Daily reflections for {acceptedApp.program.name}, grouped by mission. Write in the language that helps you explain your thinking clearly.
          </p>
        </div>
        <Link
          href="/dashboard/journal/new"
          className="rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy"
        >
          New entry
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          <p className="font-medium text-slate-800">No journal entries yet.</p>
          <p className="mt-1 text-sm">Start with today&apos;s work, the challenge you faced, how you solved it, and what you learned.</p>
        </div>
      ) : (
        /*
          One collapsible section per mission, only the newest expanded. Native <details> keeps this a
          server component -- the same pattern the admin submission page uses for previous attempts.
        */
        <div className="mt-8 grid gap-4">
          {groups.map((group, index) => (
            <details
              key={group.missionId}
              open={index === 0}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <summary className="cursor-pointer list-none px-6 py-5 hover:bg-slate-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="text-slate-400 transition-transform group-open:rotate-90">
                      ▶
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                        Week {group.weekNumber}
                        {group.showAttempt ? ` • Attempt ${group.attemptNumber}` : ""}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-brand-navy">{group.missionTitle}</h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {group.locked ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        Locked
                      </span>
                    ) : null}
                    <span className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-blue">
                      {group.entryCount} {group.entryCount === 1 ? "entry" : "entries"}
                    </span>
                  </div>
                </div>
              </summary>

              <ul className="divide-y divide-slate-200 border-t border-slate-200">
                {group.entries.map((entry) => (
                  <li key={entry.id} className="px-6 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-brand-navy">
                          {formatJournalDate(entry.entryDate)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {entry.language} {"•"} Confidence {entry.confidenceRating}/5 {"•"}{" "}
                          {entry.timeSpentHours} hour{entry.timeSpentHours === 1 ? "" : "s"}
                          {entry.evidenceLinks.length > 0
                            ? ` • ${entry.evidenceLinks.length} evidence link${entry.evidenceLinks.length === 1 ? "" : "s"}`
                            : ""}
                        </p>
                        <p className="mt-2 line-clamp-1 max-w-2xl text-sm text-slate-600">{entry.workedOn}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Link
                          href={`/dashboard/journal/${entry.id}`}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-brand-blue hover:text-brand-blue"
                        >
                          View
                        </Link>
                        {/* The ?mode=edit route enforces this too; the list only reflects it. */}
                        {entry.locked ? (
                          <span
                            aria-disabled="true"
                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500"
                          >
                            Locked
                          </span>
                        ) : (
                          <Link
                            href={`/dashboard/journal/${entry.id}?mode=edit`}
                            className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-navy"
                          >
                            Edit
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
