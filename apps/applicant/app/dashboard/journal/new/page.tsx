import Link from "next/link";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getTenantBySlug,
  getUserByEmail,
  isJournalMissionLockedForApplicant,
  listAssignedProgramMissions,
  listApplicantApplications,
} from "@talentos/db";
import { JournalEntryForm } from "../JournalEntryForm";
import { getDefaultNewJournalMission, toJournalDateInput } from "../view-model";

export default async function NewJournalEntryPage() {
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

  const missions = await listAssignedProgramMissions(tenant.id, user.id, acceptedApp.program.id);
  const availableMissions = (
    await Promise.all(
      missions.map(async (mission) => ({
        mission,
        locked: await isJournalMissionLockedForApplicant(tenant.id, user.id, mission.id)
      }))
    )
  )
    .filter(({ locked }) => !locked)
    .map(({ mission }) => mission);
  const missionOptions = availableMissions.map((mission) => ({
    id: mission.id,
    title: mission.title,
    weekNumber: mission.weekNumber
  }));
  const lockedMission = getDefaultNewJournalMission(missionOptions);

  return (
    <div>
      <Link href="/dashboard/journal" className="text-sm font-semibold text-brand-blue">
        Back to journal
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-brand-navy">New journal entry</h1>
      <p className="mt-2 text-slate-600">
        Capture what happened today: the work, the challenge, the solution, the learning, and your AI usage.
      </p>

      {missions.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          No assigned missions are available yet, so journal entries cannot be linked.
        </p>
      ) : availableMissions.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          Your assigned mission has already been submitted, so its journal entries are locked.
        </p>
      ) : (
        <JournalEntryForm
          missions={missionOptions}
          lockedMission={lockedMission}
          missionHelpText="This is your assigned mission."
          defaults={{
            missionId: lockedMission?.id ?? availableMissions[0]?.id ?? "",
            entryDate: toJournalDateInput(new Date()),
            language: user.preferredJournalLanguage,
            workedOn: "",
            challenge: "",
            solution: "",
            learned: "",
            aiUsage: "",
            confidenceRating: 3,
            timeSpentHours: 1,
            evidenceLinks: []
          }}
          submitLabel="Save journal entry"
        />
      )}
    </div>
  );
}
