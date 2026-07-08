import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { can, nextMissionStatuses } from "@talentos/auth";
import { getTenantContext, StatusBadge } from "@talentos/ui";
import { getTenantBySlug, getTenantMission, listTenantPrograms } from "@talentos/db";
import { MissionForm } from "../MissionForm";
import { setMissionStatusAction, updateMissionAction } from "../actions";

type MissionDetailPageProps = {
  params: Promise<{ id: string }>;
};

type TenantMission = NonNullable<Awaited<ReturnType<typeof getTenantMission>>>;

export default async function MissionDetailPage({ params }: MissionDetailPageProps) {
  const { id } = await params;
  const session = await auth();
  const canManage = can("manageMissions", {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  });
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const mission = tenant ? await getTenantMission(id, tenant.id) : null;
  const programs = tenant ? await listTenantPrograms(tenant.id) : [];

  if (!mission) {
    notFound();
  }

  if (!canManage) {
    return (
      <>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{mission.title}</h1>
          <StatusBadge status={mission.status} />
        </div>
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          Your role can view missions but cannot edit them.
        </p>
        <MissionReadOnly mission={mission} />
      </>
    );
  }

  const transitions = nextMissionStatuses(mission.status);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{mission.title}</h1>
          <p className="mt-2 text-slate-600">
            {mission.program.name} â€¢ Week {mission.weekNumber} â€¢ {mission.difficulty}
          </p>
        </div>
        <StatusBadge status={mission.status} />
      </div>

      <MissionForm action={updateMissionAction} programs={programs} mission={mission} submitLabel="Save changes" />

      <section className="mt-6 max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Status</h2>
        <p className="mt-1 text-sm text-slate-600">
          Published missions are visible to accepted applicants in the matching program.
        </p>
        <form action={setMissionStatusAction} className="mt-4 flex flex-wrap gap-3">
          <input type="hidden" name="missionId" value={mission.id} />
          {transitions.map((status) => (
            <button
              key={status}
              type="submit"
              name="toStatus"
              value={status}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                status === "PUBLISHED" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-800"
              }`}
            >
              {status === "PUBLISHED" ? "Publish" : status === "ARCHIVED" ? "Archive" : "Move to draft"}
            </button>
          ))}
        </form>
      </section>
    </>
  );
}

function MissionReadOnly({ mission }: { mission: TenantMission }) {
  return (
    <div className="mt-6 max-w-4xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <Section title="Objective" body={mission.objective} />
      <Section title="Brief" body={mission.brief} />
      <Section title="Deliverables" body={mission.deliverables} />
      <Section title="Acceptance Criteria" body={mission.acceptanceCriteria} />
      <Section title="Evaluation Criteria" body={mission.evaluationCriteria} />
      <div>
        <h2 className="font-semibold">Competencies</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {mission.competencyTags.map((tag) => (
            <span key={tag} className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-blue">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <Link href="/missions" className="inline-flex rounded-xl border border-slate-300 px-5 py-3 font-semibold">
        Back to missions
      </Link>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{body || "â€”"}</p>
    </section>
  );
}
