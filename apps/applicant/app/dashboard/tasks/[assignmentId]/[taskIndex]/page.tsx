import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Card, ProseText, SectionCard, getTenantContext } from "@talentos/ui";
import { getMissionTasksForAssignment, getTenantBySlug, getUserByEmail, type MissionTaskIndex } from "@talentos/db";
import { parseYouTubeVideoId } from "@/lib/youtube";
import { ToggleTaskComplete } from "./ToggleTaskComplete";
import { TutorialTaskGate } from "./TutorialTaskGate";

type TaskResourcePageProps = {
  params: Promise<{ assignmentId: string; taskIndex: string }>;
};

export default async function TaskResourcePage({ params }: TaskResourcePageProps) {
  const { assignmentId, taskIndex: taskIndexParam } = await params;
  const taskIndex = Number(taskIndexParam);
  if (taskIndex !== 1 && taskIndex !== 2) {
    // Task 3 has no resource page of its own — it's completed by submitting the mission.
    notFound();
  }

  const session = await auth();
  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const email = session?.user?.email ?? null;
  const user = email && tenant ? await getUserByEmail(email) : null;
  if (!user || !tenant) {
    return null;
  }

  const result = await getMissionTasksForAssignment(tenant.id, user.id, assignmentId);
  if (!result) {
    notFound();
  }
  const { mission, tasks } = result;
  const task = tasks.find((t) => t.index === (taskIndex as MissionTaskIndex));
  if (!task) {
    notFound();
  }

  // Defense in depth: the write side (admin action) already rejects non-http(s) schemes, but this
  // URL is rendered/embedded for applicants, so re-check here too.
  const tutorialUrl = mission.tutorialUrl && /^https?:\/\//i.test(mission.tutorialUrl) ? mission.tutorialUrl : null;
  const youtubeVideoId = tutorialUrl ? parseYouTubeVideoId(tutorialUrl) : null;

  return (
    <article className="max-w-3xl">
      <Link href="/dashboard/tasks" className="text-sm font-semibold text-brand-blue">
        ← Back to tasks
      </Link>

      <div className="mt-4 rounded-3xl bg-brand-navy p-8 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-mist">
          Week {mission.weekNumber} · Task {task.index}
        </p>
        <h1 className="mt-3 text-3xl font-bold">{task.title}</h1>
        <p className="mt-2 text-brand-mist">{mission.title}</p>
      </div>

      <div className="mt-6 grid gap-5">
        {taskIndex === 1 ? (
          <>
            <SectionCard title="Objective">
              <ProseText>{mission.objective}</ProseText>
            </SectionCard>
            <SectionCard title="Mission Brief">
              <ProseText>{mission.brief}</ProseText>
            </SectionCard>
            {mission.competencyTags.length > 0 ? (
              <SectionCard title="Competencies">
                <div className="flex flex-wrap gap-2">
                  {mission.competencyTags.map((tag) => (
                    <span key={tag} className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-blue">
                      {tag}
                    </span>
                  ))}
                </div>
              </SectionCard>
            ) : null}
          </>
        ) : (
          <>
            <SectionCard title="Tutorial">
              {youtubeVideoId ? (
                <TutorialTaskGate
                  videoId={youtubeVideoId}
                  tutorialUrl={tutorialUrl}
                  assignmentId={assignmentId}
                  taskIndex={taskIndex as MissionTaskIndex}
                  complete={task.complete}
                />
              ) : tutorialUrl ? (
                <a
                  href={tutorialUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-block break-all text-brand-blue underline"
                >
                  {tutorialUrl}
                </a>
              ) : (
                <p className="text-sm text-slate-500">No tutorial link has been added for this mission yet.</p>
              )}
            </SectionCard>
            <SectionCard title="Required Deliverables">
              <ProseText>{mission.deliverables}</ProseText>
            </SectionCard>
          </>
        )}
      </div>

      {taskIndex === 1 || !youtubeVideoId ? (
        <Card className="mt-6">
          <ToggleTaskComplete assignmentId={assignmentId} taskIndex={taskIndex as MissionTaskIndex} complete={task.complete} />
        </Card>
      ) : null}
    </article>
  );
}
