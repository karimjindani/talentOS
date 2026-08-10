import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Card, MissionStatusBadge, ProseText, SectionCard, SubmissionStatusBadge, getTenantContext } from "@talentos/ui";
import {
  buildSubmissionEvidenceLinks,
  getApplicantSubmissionForAssignment,
  getApplicantMissionAssignmentForMission,
  getAssignedProgramMission,
  getMissionSubmissionReadiness,
  getMissionTasksForAssignment,
  getTenantBySlug,
  getUserByEmail,
  listApplicantApplications,
  listCompletedTaskIds,
  listTasksByWeek,
  type MissionTaskSummary,
  type Submission
} from "@talentos/db";
import { parseYouTubeVideoId } from "@/lib/youtube";
import { CountdownTimer } from "@/components/CountdownTimer";
import { LearningTaskPanel } from "@/components/LearningTaskPanel";
import { SubmissionForm } from "./SubmissionForm";
import { AcceptMissionButton } from "./AcceptMissionButton";
import { WorkspaceTabs, type WorkspaceTab } from "./WorkspaceTabs";
import { buildMissionWorkspaceModel, type WorkspaceStepStatus } from "./view-model";
import { ToggleTaskComplete } from "../../tasks/[assignmentId]/[taskIndex]/ToggleTaskComplete";
import { TutorialTaskGate } from "../../tasks/[assignmentId]/[taskIndex]/TutorialTaskGate";

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

  const mission = await getAssignedProgramMission(id, tenant.id, user.id, acceptedApp.program.id);
  if (!mission) {
    notFound();
  }

  const assignment = await getApplicantMissionAssignmentForMission(tenant.id, user.id, mission.id);
  const submission = assignment
    ? await getApplicantSubmissionForAssignment(assignment.id, user.id, tenant.id)
    : null;
  const taskResult = assignment ? await getMissionTasksForAssignment(tenant.id, user.id, assignment.id) : null;
  const tasks = taskResult?.tasks ?? [];
  const requiredTasks = tasks.filter((task) => task.index === 1 || task.index === 2);

  const model = buildMissionWorkspaceModel({ assignment, submission, tasks });

  // Readiness is only needed while the submission is still editable (unchanged gating).
  const readiness =
    assignment && model.submissionMode === "editable"
      ? await getMissionSubmissionReadiness({
          tenantId: tenant.id,
          applicantId: user.id,
          missionAssignmentId: submission?.missionAssignmentId ?? assignment.id
        })
      : null;

  // Defense in depth: only embed/render http(s) tutorial URLs (the admin write side already rejects
  // other schemes).
  const tutorialUrl = mission.tutorialUrl && /^https?:\/\//i.test(mission.tutorialUrl) ? mission.tutorialUrl : null;
  const youtubeVideoId = tutorialUrl ? parseYouTubeVideoId(tutorialUrl) : null;

  const step1 = tasks.find((task) => task.index === 1) ?? null;
  const step2 = tasks.find((task) => task.index === 2) ?? null;
  const step3 = tasks.find((task) => task.index === 3) ?? null;

  // Weekly learning tasks for this mission's week (v0.20.0) — surfaced as tabs in the workspace with
  // their resources shown under each task. Completion is only writable while the assignment is open.
  const program = acceptedApp.program;
  const weeklyTasks = await listTasksByWeek(tenant.id, program.id, mission.weekNumber);
  const completedWeeklyTaskIds = new Set(await listCompletedTaskIds(tenant.id, user.id, program.id, mission.weekNumber));
  const assignmentOpen = Boolean(assignment && ["ACCEPTED", "IN_PROGRESS", "OVERDUE"].includes(assignment.status));

  // Prerequisite learning tasks gate the mission's own steps (v0.20.0): until every prerequisite is
  // complete, Review Brief / Study Tutorial / Submission stay locked.
  const prerequisiteTasks = weeklyTasks.filter((task) => task.isPrerequisite);
  const prerequisitesMet = prerequisiteTasks.every((task) => completedWeeklyTaskIds.has(task.id));
  const firstIncompletePrereqId = prerequisiteTasks.find((task) => !completedWeeklyTaskIds.has(task.id))?.id ?? null;
  const stepsLocked = assignmentOpen && !prerequisitesMet;
  const continueAnchor = stepsLocked && firstIncompletePrereqId ? `task-${firstIncompletePrereqId}` : model.nextIncompleteAnchorId;

  const lockedStepPanel = (stepIndex: number, stepTitle: string) => (
    <StepSection
      index={stepIndex}
      title={stepTitle}
      status="upcoming"
      badge={
        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          🔒 Locked
        </span>
      }
    >
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Complete the prerequisite learning task{prerequisiteTasks.length > 1 ? "s" : ""} before starting this step.
        {firstIncompletePrereqId ? (
          <>
            {" "}
            <a href={`#task-${firstIncompletePrereqId}`} className="font-semibold text-brand-blue underline">
              Go to prerequisite →
            </a>
          </>
        ) : null}
      </p>
    </StepSection>
  );

  // --- Overview panel (always the first tab) ---
  const overviewPanel = (
    <div className="grid gap-5">
      {mission.objective ? (
        <SectionCard title="Objective">
          <ProseText>{mission.objective}</ProseText>
        </SectionCard>
      ) : null}
      <SectionCard title="Mission Brief">
        <ProseText>{mission.brief}</ProseText>
      </SectionCard>
      <SectionCard title="Required Deliverables">
        <ProseText>{mission.deliverables}</ProseText>
      </SectionCard>
      <SectionCard title="Acceptance Criteria">
        <ProseText>{mission.acceptanceCriteria}</ProseText>
      </SectionCard>
      <SectionCard title="Evaluation Criteria">
        <ProseText>{mission.evaluationCriteria}</ProseText>
      </SectionCard>
      {mission.competencyTags.length > 0 ? (
        <SectionCard
          title="Competencies"
          description="An accepted submission demonstrates these competencies as portfolio evidence."
        >
          <div className="flex flex-wrap gap-2">
            {mission.competencyTags.map((tag) => (
              <span key={tag} className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-blue">
                {tag}
              </span>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );

  // --- Tab assembly (Overview + one tab per step) ---
  const tabs: WorkspaceTab[] = [{ id: "overview", label: "Overview", marker: "•", status: "overview" }];
  const panels: React.ReactNode[] = [overviewPanel];

  if (step1 && assignment) {
    tabs.push({ id: "step-1", label: step1.title, marker: stepsLocked ? "🔒" : step1.complete ? "✓" : "1", status: stepStatus(model, 1) });
    panels.push(
      stepsLocked ? (
        lockedStepPanel(1, step1.title)
      ) : (
        <StepSection index={1} title={step1.title} status={stepStatus(model, 1)} badge={<StepStatusPill status={stepStatus(model, 1)} />}>
          <p className="text-sm leading-6 text-slate-600">
            Read the mission brief and deliverables in the Overview tab, then mark this step complete to record your
            review.
          </p>
          <ToggleTaskComplete assignmentId={assignment.id} taskIndex={1} complete={step1.complete} />
        </StepSection>
      )
    );
  }

  if (step2 && assignment) {
    tabs.push({ id: "step-2", label: step2.title, marker: stepsLocked ? "🔒" : step2.complete ? "✓" : "2", status: stepStatus(model, 2) });
    panels.push(
      stepsLocked ? (
        lockedStepPanel(2, step2.title)
      ) : (
        <StepSection index={2} title={step2.title} status={stepStatus(model, 2)} badge={<StepStatusPill status={stepStatus(model, 2)} />}>
        {youtubeVideoId ? (
          <TutorialTaskGate
            videoId={youtubeVideoId}
            tutorialUrl={tutorialUrl}
            assignmentId={assignment.id}
            taskIndex={2}
            complete={step2.complete}
          />
        ) : (
          <div className="grid gap-4">
            {tutorialUrl ? (
              <a href={tutorialUrl} target="_blank" rel="noreferrer noopener" className="inline-block break-all text-sm text-brand-blue underline">
                {tutorialUrl}
              </a>
            ) : (
              <p className="text-sm text-slate-500">No tutorial link has been added for this mission yet.</p>
            )}
            <ToggleTaskComplete assignmentId={assignment.id} taskIndex={2} complete={step2.complete} />
          </div>
        )}
        </StepSection>
      )
    );
  }

  // Weekly learning tasks become their own tabs — completed in order (each unlocks the next), with
  // videos playing in-tab and gated to 90% watched before completion.
  if (assignment) {
    let priorComplete = true;
    for (const learningTask of weeklyTasks) {
      const done = completedWeeklyTaskIds.has(learningTask.id);
      const locked = !priorComplete;
      tabs.push({
        id: `task-${learningTask.id}`,
        label: learningTask.title,
        marker: done ? "✓" : locked ? "🔒" : "•",
        status: done ? "complete" : "upcoming"
      });
      panels.push(
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">Learning task</p>
              <h2 className="text-lg font-semibold text-brand-navy">{learningTask.title}</h2>
              {learningTask.description ? <p className="mt-1 text-sm text-slate-600">{learningTask.description}</p> : null}
            </div>
            {done ? (
              <span className="inline-flex shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Completed
              </span>
            ) : locked ? (
              <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                🔒 Locked
              </span>
            ) : null}
          </div>
          <div className="mt-4">
            {locked ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                🔒 Complete the previous learning task to unlock this one.
              </p>
            ) : (
              <LearningTaskPanel
                resources={learningTask.resources}
                complete={done}
                assignmentOpen={assignmentOpen}
                taskId={learningTask.id}
                missionAssignmentId={assignment.id}
              />
            )}
          </div>
        </Card>
      );
      if (!done) priorComplete = false;
    }
  }

  if (assignment) {
    tabs.push({
      id: "step-3",
      label: step3?.title ?? "Submission",
      marker: stepsLocked ? "🔒" : step3?.complete ? "✓" : "3",
      status: stepStatus(model, 3)
    });
    panels.push(
      stepsLocked ? (
        lockedStepPanel(3, step3?.title ?? "Submit your evidence")
      ) : (
      <StepSection
        index={3}
        title={step3?.title ?? "Submit your evidence"}
        status={stepStatus(model, 3)}
        badge={<SubmissionStatusBadge status={submission?.status ?? null} />}
      >
        {model.submissionMode === "failed" ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            This mission&apos;s deadline and grace period have both passed without a submission.
          </p>
        ) : (
          <>
            {model.showReviewerFeedback && submission?.reviewerFeedback ? (
              <div
                className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                  model.reviewerFeedbackTone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <p className="font-semibold">Reviewer feedback</p>
                <p className="mt-1 whitespace-pre-wrap">{submission.reviewerFeedback}</p>
              </div>
            ) : null}

            {model.submissionMode === "editable" ? (
              <>
                <MissionTaskChecklist tasks={requiredTasks} />
                <SubmissionForm
                  missionId={mission.id}
                  isRevision={submission?.status === "NEEDS_REVISION"}
                  canSubmit={model.canSubmit}
                  readiness={readiness ? { tasks: readiness.tasks, journals: readiness.journals } : null}
                  defaults={{
                    repositoryUrl: submission?.repositoryUrl ?? "",
                    deploymentUrl: submission?.deploymentUrl ?? "",
                    loomUrl: submission?.loomUrl ?? ""
                  }}
                />
              </>
            ) : submission ? (
              <SubmittedEvidence submission={submission} />
            ) : null}
          </>
        )}
      </StepSection>
      )
    );
  }

  const isAcceptMode = model.submissionMode === "accept";

  return (
    <article className="mx-auto max-w-6xl">
      <Link href="/dashboard/missions" className="text-sm font-semibold text-brand-blue hover:underline">
        ← Back to missions
      </Link>

      {/* Workspace header — compact: eyebrow + badge up top; title, progress, deadline and Continue on one row. */}
      <header className="mt-4 rounded-2xl bg-brand-navy px-5 py-4 text-white shadow-sm sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-mist">
            Week {mission.weekNumber} {"•"} {mission.difficulty}
          </p>
          <MissionStatusBadge status={assignment?.status ?? null} tone="onDark" />
        </div>

        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-5">
            <h1 className="truncate text-xl font-bold sm:text-2xl lg:max-w-sm">{mission.title}</h1>
            {!isAcceptMode ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-40">
                  <div className="flex items-center justify-between text-[11px] text-brand-mist">
                    <span className="font-medium">Progress</span>
                    <span>{model.progressPercent}%</span>
                  </div>
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20"
                    role="progressbar"
                    aria-valuenow={model.progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Mission progress"
                  >
                    <div className="h-full rounded-full bg-white transition-all" style={{ width: `${model.progressPercent}%` }} />
                  </div>
                </div>
                {model.showCountdown && assignment?.deadlineAt ? (
                  <CountdownTimer deadlineAt={assignment.deadlineAt} graceEndsAt={assignment.graceEndsAt} />
                ) : null}
              </div>
            ) : null}
          </div>
          {!isAcceptMode && continueAnchor ? (
            <a
              href={`#${continueAnchor}`}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-mist"
            >
              Continue →
            </a>
          ) : null}
        </div>
      </header>

      {/* Workspace body */}
      {isAcceptMode ? (
        <div className="mt-6 grid gap-6">
          {overviewPanel}
          <Card>
            <h2 className="text-lg font-semibold text-brand-navy">Start this mission</h2>
            <AcceptMissionButton missionId={mission.id} />
          </Card>
        </div>
      ) : (
        <div className="mt-6">
          <WorkspaceTabs
            tabs={tabs}
            panels={panels}
            completedStepCount={model.completedStepCount}
            totalStepCount={model.totalStepCount}
            progressPercent={model.progressPercent}
          />
        </div>
      )}
    </article>
  );
}

function stepStatus(model: ReturnType<typeof buildMissionWorkspaceModel>, index: number): WorkspaceStepStatus {
  return model.steps.find((step) => step.index === index)?.status ?? "upcoming";
}

function StepSection({
  index,
  title,
  status,
  badge,
  children
}: {
  index: number;
  title: string;
  status: WorkspaceStepStatus;
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  const marker = status === "complete" ? "✓" : String(index);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              status === "complete"
                ? "bg-emerald-500 text-white"
                : status === "current"
                  ? "bg-brand-blue text-white"
                  : "border border-slate-300 text-slate-500"
            }`}
          >
            {marker}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">Step {index}</p>
            <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
          </div>
        </div>
        {badge}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function StepStatusPill({ status }: { status: WorkspaceStepStatus }) {
  const map: Record<WorkspaceStepStatus, { label: string; className: string }> = {
    complete: { label: "Completed", className: "bg-emerald-100 text-emerald-700" },
    current: { label: "In progress", className: "bg-blue-100 text-blue-700" },
    upcoming: { label: "Up next", className: "bg-slate-100 text-slate-600" }
  };
  const { label, className } = map[status];
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

function MissionTaskChecklist({ tasks }: { tasks: MissionTaskSummary[] }) {
  if (tasks.length === 0) {
    return null;
  }
  const allComplete = tasks.every((task) => task.complete);
  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        allComplete ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <p className={`font-semibold ${allComplete ? "text-emerald-800" : "text-amber-800"}`}>
        {allComplete
          ? "All required steps complete — you can submit for review."
          : "Complete these steps before you can submit for review:"}
      </p>
      <ul className="mt-2 space-y-1">
        {tasks.map((task) => (
          <li key={task.index}>
            <a
              href={`#step-${task.index}`}
              className={`underline ${task.complete ? "text-emerald-700" : "text-amber-800"}`}
            >
              {task.complete ? "✓" : "○"} Step {task.index}: {task.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SubmittedEvidence({ submission }: { submission: Submission }) {
  const links = buildSubmissionEvidenceLinks(submission);

  return (
    <div className="grid gap-4 text-sm">
      <ul className="grid gap-2">
        {links.map((link) => (
          <li key={link.label}>
            <span className="font-medium text-slate-700">{link.label}: </span>
            <a href={link.href} target="_blank" rel="noreferrer noopener" className="break-all text-brand-blue underline">
              {link.href}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-sm text-slate-600">
        Write your daily reflection in the{" "}
        <Link href="/dashboard/journal" className="font-semibold text-brand-blue underline">
          Engineering Journal
        </Link>
        .
      </p>
      {submission.submittedAt ? (
        <p className="text-xs text-slate-500">
          Submitted {submission.submittedAt.toLocaleString()} — evidence is locked while under review.
        </p>
      ) : null}
    </div>
  );
}
