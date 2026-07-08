import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import {
  getPublishedProgramMission,
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications
} from "@talentos/db";

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

  const mission = await getPublishedProgramMission(id, tenant.id, acceptedApp.program.id);
  if (!mission) {
    notFound();
  }

  return (
    <article className="max-w-4xl">
      <Link href="/dashboard/missions" className="text-sm font-semibold text-brand-blue">
        â† Back to missions
      </Link>
      <div className="mt-4 rounded-3xl bg-brand-navy p-8 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-mist">
          Week {mission.weekNumber} â€¢ {mission.difficulty}
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
          <div className="mt-3 flex flex-wrap gap-2">
            {mission.competencyTags.map((tag) => (
              <span key={tag} className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-blue">
                {tag}
              </span>
            ))}
          </div>
        </section>
      </div>
    </article>
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
