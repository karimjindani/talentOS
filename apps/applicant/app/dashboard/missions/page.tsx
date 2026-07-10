import Link from "next/link";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getTenantBySlug,
  getUserByEmail,
  listAssignedProgramMissions,
  listApplicantApplications,
  listApplicantProgramSubmissions,
  type SubmissionStatus
} from "@talentos/db";

export default async function ApplicantMissionsPage() {
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

  const program = acceptedApp.program;
  const missions = await listAssignedProgramMissions(tenant.id, user.id, program.id);
  // Per-mission submission status chips (v0.15.0, D-067).
  const submissions = await listApplicantProgramSubmissions(tenant.id, user.id, program.id);
  const statusByMission = new Map(submissions.map((submission) => [submission.missionId, submission.status]));

  return (
    <div>
      <h1 className="text-3xl font-bold text-brand-navy">Missions</h1>
      <p className="mt-2 text-slate-600">
        Real-world engineering assignments for {program.name}. Complete the full SEM lifecycle each time.
      </p>

      {missions.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          No assigned missions are available yet.
        </p>
      ) : (
        <div className="mt-8 grid gap-4">
          {missions.map((mission) => (
            <Link
              key={mission.id}
              href={`/dashboard/missions/${mission.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-blue hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                    Week {mission.weekNumber} {"\u2022"} {mission.difficulty}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-brand-navy">{mission.title}</h2>
                </div>
                <MissionSubmissionChip status={statusByMission.get(mission.id) ?? null} />
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{mission.objective || mission.brief}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {mission.competencyTags.slice(0, 5).map((tag) => (
                  <span key={tag} className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-blue">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MissionSubmissionChip({ status }: { status: SubmissionStatus | null }) {
  if (!status) {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Not started</span>
    );
  }
  const styles: Record<SubmissionStatus, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    SUBMITTED: "bg-blue-100 text-blue-700",
    REVIEWED: "bg-slate-100 text-slate-700",
    NEEDS_REVISION: "bg-amber-100 text-amber-800",
    ACCEPTED: "bg-emerald-100 text-emerald-700",
    REPEAT: "bg-rose-100 text-rose-700"
  };
  const labels: Record<SubmissionStatus, string> = {
    DRAFT: "Draft saved",
    SUBMITTED: "Submitted",
    REVIEWED: "Reviewed",
    NEEDS_REVISION: "Revision requested",
    ACCEPTED: "Accepted",
    REPEAT: "Repeat assigned"
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}
