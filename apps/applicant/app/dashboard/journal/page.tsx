import Link from "next/link";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
  listApplicantJournalEntries
} from "@talentos/db";

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

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

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-navy">Engineering Journal</h1>
          <p className="mt-2 text-slate-600">
            Daily reflections for {acceptedApp.program.name}. Write in the language that helps you explain your thinking clearly.
          </p>
        </div>
        <Link
          href="/dashboard/journal/new"
          className="rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy"
        >
          New entry
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          <p className="font-medium text-slate-800">No journal entries yet.</p>
          <p className="mt-1 text-sm">Start with today&apos;s work, the challenge you faced, how you solved it, and what you learned.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {entries.map((entry) => (
            <Link
              key={entry.id}
              href={`/dashboard/journal/${entry.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-blue hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                    {formatDate(entry.entryDate)} {"\u2022"} Week {entry.weekNumber} {"\u2022"} {entry.language}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-brand-navy">{entry.mission.title}</h2>
                </div>
                <span className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-blue">
                  Confidence {entry.confidenceRating}/5
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{entry.workedOn}</p>
              <p className="mt-3 text-xs text-slate-500">
                {entry.timeSpentHours} hour{entry.timeSpentHours === 1 ? "" : "s"} logged
                {entry.evidenceLinks.length > 0
                  ? ` ${"\u2022"} ${entry.evidenceLinks.length} evidence link${entry.evidenceLinks.length === 1 ? "" : "s"}`
                  : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
