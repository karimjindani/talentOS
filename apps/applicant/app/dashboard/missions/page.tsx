import Link from "next/link";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getApplicantMissionProgress,
  getTenantBySlug,
  getUserByEmail,
  listAssignedMissionsWithTasks,
  listApplicantApplications,
  type MissionAssignmentStatus
} from "@talentos/db";
import { DeadlineCountdown } from "@/components/DeadlineCountdown";

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
  const missionsWithTasks = await listAssignedMissionsWithTasks(tenant.id, user.id, program.id);
  const missionProgress = await getApplicantMissionProgress(tenant.id, user.id, program.id);

  return (
    <div>
      <h1 className="text-3xl font-bold text-brand-navy">Missions</h1>
      <p className="mt-2 text-slate-600">
        Real-world engineering assignments for {program.name}. Complete the full SEM lifecycle each time.
      </p>

      {missionsWithTasks.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          No assigned missions are available yet.
        </p>
      ) : (
        <div className="mt-8 grid gap-4">
          {missionsWithTasks.map(({ mission, assignment }) => {
            const isCurrent = missionProgress.currentMission?.id === mission.id;
            const hasLiveDeadline =
              isCurrent &&
              ["ACCEPTED", "IN_PROGRESS", "OVERDUE"].includes(assignment.status) &&
              assignment.deadlineAt &&
              assignment.graceEndsAt;

            return (
              <Link
                key={mission.id}
                href={`/dashboard/missions/${mission.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-blue hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                      Week {mission.weekNumber} • {mission.difficulty}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-brand-navy">{mission.title}</h2>
                  </div>
                  <MissionSubmissionChip status={assignment.status} />
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{mission.objective || mission.brief}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {mission.competencyTags.slice(0, 5).map((tag) => (
                    <span key={tag} className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-blue">
                      {tag}
                    </span>
                  ))}
                </div>
                {hasLiveDeadline && assignment.deadlineAt && assignment.graceEndsAt ? (
                  <div className="mt-4">
                    <DeadlineCountdown deadlineAt={assignment.deadlineAt} graceEndsAt={assignment.graceEndsAt} />
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MissionSubmissionChip({ status }: { status: MissionAssignmentStatus | null }) {
  if (!status) {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Not started</span>
    );
  }
  const styles: Record<MissionAssignmentStatus, string> = {
    NOT_STARTED: "bg-slate-100 text-slate-700",
    ACCEPTED: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    PENDING_EVALUATION: "bg-indigo-100 text-indigo-700",
    LATE_SUBMITTED: "bg-amber-100 text-amber-800",
    OVERDUE: "bg-amber-100 text-amber-800",
    FAILED: "bg-rose-100 text-rose-700",
    PASSED: "bg-emerald-100 text-emerald-700",
    REPEAT: "bg-rose-100 text-rose-700"
  };
  const labels: Record<MissionAssignmentStatus, string> = {
    NOT_STARTED: "Not started",
    ACCEPTED: "Accepted",
    IN_PROGRESS: "In progress",
    PENDING_EVALUATION: "Submitted",
    LATE_SUBMITTED: "Submitted (late)",
    OVERDUE: "Overdue — grace period",
    FAILED: "Failed",
    PASSED: "Accepted",
    REPEAT: "Repeat assigned"
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}
