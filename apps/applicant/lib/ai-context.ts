/**
 * AI Context Integration (Phase 4)
 *
 * Collects real applicant data — active program, progress, upcoming tasks,
 * and submission status — so the AI Mentor can produce context-aware responses.
 *
 * All queries are scoped by tenantId + userId for tenant isolation.
 * Every field has a safe fallback if the applicant has no accepted application
 * or no data yet.
 */

import {
  prisma,
  listApplicantApplications,
  listProgramTasks,
  listCompletedTaskIds,
  listPublishedProgramMissions,
  getApplicantProgramProgress,
  listApplicantMissionAssignmentStatuses,
} from "@talentos/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single upcoming or overdue task relevant to the applicant. */
export type ContextTask = {
  id: string;
  title: string;
  weekNumber: number;
  dueAt: string | null;
  completed: boolean;
  overdue: boolean;
};

/** Per-week progress summary. */
export type ContextWeekProgress = {
  weekNumber: number;
  totalTasks: number;
  completedTasks: number;
  percentage: number;
};

/** Submission status for a mission. */
export type ContextSubmission = {
  missionId: string;
  missionTitle: string;
  weekNumber: number;
  status: string;
  submittedAt: string | null;
};

/** Per-mission readiness summary — the unambiguous status the LLM needs. */
export type ContextMissionStatus = {
  missionId: string;
  title: string;
  weekNumber: number;
  difficulty: string;
  /** null = not assigned to this applicant. "ACCEPTED" = they accepted the assignment (started), NOT completed. */
  assignmentStatus: string | null;
  deadlineAt: string | null;
  hasSubmission: boolean;
  submissionStatus: string | null;
  journalEntryCount: number;
  requiredTaskTotal: number;
  requiredTaskCompleted: number;
};

/** The full applicant context passed to the AI mentor. */
export type ApplicantContext = {
  tenantId: string;
  userId: string;

  /** The accepted program the applicant is enrolled in, if any. */
  program: {
    id: string;
    name: string;
    slug: string;
    startsAt: string | null;
    endsAt: string | null;
  } | null;

  /** Application status (always "ACCEPTED" when program is set, but kept for clarity). */
  applicationStatus: string | null;

  /** Overall task completion stats. */
  progress: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    overallPercentage: number;
    weeks: ContextWeekProgress[];
  } | null;

  /** Upcoming / overdue tasks (max 5, sorted by due date). */
  upcomingTasks: ContextTask[];

  /** Published missions for the program. */
  missions: {
    id: string;
    title: string;
    weekNumber: number;
    difficulty: string;
  }[];

  /** Mission assignment statuses for the applicant (which missions are assigned and their progress). */
  assignments: {
    missionId: string;
    status: string;
    deadlineAt: string | null;
  }[];

  /** Submission statuses for missions the applicant has started. */
  submissions: ContextSubmission[];

  /** Unambiguous per-mission readiness summary (assignment, submission, journal, tasks). */
  missionStatus: ContextMissionStatus[];

  /** Days remaining in the program (null if no end date). */
  daysRemaining: number | null;
};

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

/**
 * Build the applicant context for the AI Mentor.
 *
 * Returns a safe empty-ish context if the applicant has no accepted application
 * or if any query fails. This function never throws.
 */
export async function buildApplicantContext(
  tenantId: string,
  userId: string
): Promise<ApplicantContext> {
  const emptyContext: ApplicantContext = {
    tenantId,
    userId,
    program: null,
    applicationStatus: null,
    progress: null,
    upcomingTasks: [],
    missions: [],
    assignments: [],
    submissions: [],
    missionStatus: [],
    daysRemaining: null,
  };

  try {
    // 1. Find the applicant's accepted application
    const applications = await listApplicantApplications(userId, tenantId);
    const acceptedApp = applications.find((a) => a.status === "ACCEPTED");

    if (!acceptedApp) {
      return emptyContext;
    }

    const program = acceptedApp.program;

    // 2. Gather tasks, completions, missions, and progress in parallel
    const [tasks, completedTaskIds, missions, weekProgress, submissions, assignmentStatuses, journalEntries] = await Promise.all([
      listProgramTasks(tenantId, program.id),
      listCompletedTaskIds(tenantId, userId, program.id),
      listPublishedProgramMissions(tenantId, program.id),
      getApplicantProgramProgress(userId, tenantId, program.id),
      // Fetch submissions for this applicant's missions
      prisma.submission.findMany({
        where: { applicantId: userId, mission: { tenantId, programId: program.id } },
        include: { mission: { select: { id: true, title: true, weekNumber: true } } },
        orderBy: { createdAt: "desc" },
      }),
      // Fetch assignment statuses so the mentor knows which missions are assigned and their state
      listApplicantMissionAssignmentStatuses(tenantId, userId, program.id),
      // Fetch journal entry missionIds so we can count entries per mission
      prisma.engineeringJournalEntry.findMany({
        where: { tenantId, applicantId: userId, mission: { tenantId, programId: program.id } },
        select: { missionId: true },
      }),
    ]);

    // Build assignment list from the mission list + assignment status map
    const assignmentList = missions
      .map((m) => {
        const info = assignmentStatuses.get(m.id);
        return info
          ? {
              missionId: m.id,
              status: info.status as string,
              deadlineAt: info.deadlineAt ? info.deadlineAt.toISOString() : null,
            }
          : null;
      })
      .filter((a): a is { missionId: string; status: string; deadlineAt: string | null } => a !== null);

    // 3. Compute progress summary
    const totalTasks = tasks.length;
    const completedTasks = completedTaskIds.length;
    const pendingTasks = totalTasks - completedTasks;
    const overallPercentage =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    // 4. Build upcoming/overdue task list (max 5, sorted by due date ascending)
    const now = new Date();
    const upcomingTasks: ContextTask[] = tasks
      .map((t) => {
        const completed = completedTaskIds.includes(t.id);
        const overdue = !completed && t.dueAt != null && new Date(t.dueAt) < now;
        return {
          id: t.id,
          title: t.title,
          weekNumber: t.weekNumber,
          dueAt: t.dueAt ? t.dueAt.toISOString() : null,
          completed,
          overdue,
        };
      })
      .filter((t) => !t.completed) // Only show incomplete tasks
      .sort((a, b) => {
        // Overdue first, then by due date
        if (a.overdue && !b.overdue) return -1;
        if (!a.overdue && b.overdue) return 1;
        const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
        const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
        return aDue - bDue;
      })
      .slice(0, 5);

    // 5. Build mission list
    const missionList = missions.map((m) => ({
      id: m.id,
      title: m.title,
      weekNumber: m.weekNumber,
      difficulty: m.difficulty,
    }));

    // 6. Build submission list
    const submissionList: ContextSubmission[] = submissions.map((s) => ({
      missionId: s.mission.id,
      missionTitle: s.mission.title,
      weekNumber: s.mission.weekNumber,
      status: s.status,
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
    }));

    // 7. Days remaining
    const daysRemaining = program.endsAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(program.endsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          )
        )
      : null;

    // 8. Per-mission readiness summary — the unambiguous status the LLM needs to avoid
    //    misreading "ACCEPTED" assignment as mission completion, or task % as mission %.
    const journalCountByMission = new Map<string, number>();
    for (const je of journalEntries) {
      journalCountByMission.set(je.missionId, (journalCountByMission.get(je.missionId) ?? 0) + 1);
    }
    const missionStatusList: ContextMissionStatus[] = missionList.map((m) => {
      const assignment = assignmentList.find((a) => a.missionId === m.id);
      const submission = submissionList.find((s) => s.missionId === m.id);
      const missionTasks = tasks.filter((t) => t.missionId === m.id && t.required && t.published);
      const requiredTaskTotal = missionTasks.length;
      const requiredTaskCompleted = missionTasks.filter((t) => completedTaskIds.includes(t.id)).length;
      return {
        missionId: m.id,
        title: m.title,
        weekNumber: m.weekNumber,
        difficulty: m.difficulty,
        assignmentStatus: assignment?.status ?? null,
        deadlineAt: assignment?.deadlineAt ?? null,
        hasSubmission: !!submission,
        submissionStatus: submission?.status ?? null,
        journalEntryCount: journalCountByMission.get(m.id) ?? 0,
        requiredTaskTotal,
        requiredTaskCompleted,
      };
    });

    return {
      tenantId,
      userId,
      program: {
        id: program.id,
        name: program.name,
        slug: program.slug,
        startsAt: program.startsAt ? program.startsAt.toISOString() : null,
        endsAt: program.endsAt ? program.endsAt.toISOString() : null,
      },
      applicationStatus: acceptedApp.status,
      progress: {
        totalTasks,
        completedTasks,
        pendingTasks,
        overallPercentage,
        weeks: weekProgress.map((w) => ({
          weekNumber: w.weekNumber,
          totalTasks: w.totalTasks,
          completedTasks: w.completedTasks,
          percentage: w.percentage,
        })),
      },
      upcomingTasks,
      missions: missionList,
      assignments: assignmentList,
      submissions: submissionList,
      missionStatus: missionStatusList,
      daysRemaining,
    };
  } catch {
    // Safe fallback — never break the mentor chat due to context gathering
    return emptyContext;
  }
}

/**
 * Build a stable context signature (cache key component) from the applicant context.
 *
 * This signature captures all dynamic fields that could change the AI's answer:
 * - program id
 * - task ids + completion status + due dates
 * - submission ids + status
 * - progress counts (total, completed, percentage)
 * - mission ids
 * - days remaining
 *
 * If any of these change (e.g. user completes a task, submits a mission, a deadline
 * passes), the signature changes and the LLM cache misses — forcing a fresh LLM call.
 *
 * When there is no program, the signature is "no-program" so that all no-program
 * users share the same cache namespace for a given prompt.
 */
export function buildContextSignature(ctx: ApplicantContext): string {
  if (!ctx.program) {
    return "no-program";
  }

  const parts: string[] = [`p:${ctx.program.id}`];

  // Progress counts
  if (ctx.progress) {
    parts.push(
      `pg:${ctx.progress.completedTasks}/${ctx.progress.totalTasks}/${ctx.progress.overallPercentage}`
    );
  }

  // Task ids + status + due dates (sorted for stability)
  const taskSig = ctx.upcomingTasks
    .map((t) => `${t.id}:${t.completed ? 1 : 0}:${t.overdue ? 1 : 0}:${t.dueAt ?? "none"}`)
    .sort()
    .join(",");
  parts.push(`t:${taskSig}`);

  // Mission ids (sorted)
  const missionSig = ctx.missions
    .map((m) => m.id)
    .sort()
    .join(",");
  parts.push(`m:${missionSig}`);

  // Submission ids + status (sorted)
  const subSig = ctx.submissions
    .map((s) => `${s.missionId}:${s.status}`)
    .sort()
    .join(",");
  parts.push(`s:${subSig}`);

  // Assignment ids + status + deadline (sorted) — ensures cache invalidates when assignment
  // status changes (e.g. NOT_STARTED → IN_PROGRESS → PASSED) or deadline changes
  const assignSig = ctx.assignments
    .map((a) => `${a.missionId}:${a.status}:${a.deadlineAt ?? "none"}`)
    .sort()
    .join(",");
  parts.push(`a:${assignSig}`);

  // Per-mission readiness (submission, journal count, task completion) — invalidates when
  // the applicant submits, writes a journal entry, or completes a required task.
  const msSig = ctx.missionStatus
    .map((m) => `${m.missionId}:${m.hasSubmission ? 1 : 0}:${m.submissionStatus ?? "none"}:${m.journalEntryCount}:${m.requiredTaskCompleted}/${m.requiredTaskTotal}`)
    .sort()
    .join(",");
  parts.push(`ms:${msSig}`);

  // Days remaining
  parts.push(`d:${ctx.daysRemaining ?? "none"}`);

  return parts.join("|");
}

/**
 * Render the applicant context as a human-readable system prompt section.
 *
 * This is what would be prepended to the LLM system prompt in Phase 6.
 * For now (Phase 4), it's used by the stub to produce context-aware dummy responses.
 */
export function contextToPromptSection(ctx: ApplicantContext): string {
  if (!ctx.program) {
    return "No active program enrollment found.";
  }

  const lines: string[] = [
    `Program: ${ctx.program.name}`,
    `Application Status: ${ctx.applicationStatus ?? "UNKNOWN"}`,
  ];

  if (ctx.daysRemaining != null) {
    lines.push(`Days Remaining: ${ctx.daysRemaining}`);
  }

  if (ctx.progress) {
    lines.push(
      `Task Completion: ${ctx.progress.overallPercentage}% (${ctx.progress.completedTasks}/${ctx.progress.totalTasks} program tasks done). NOTE: this is TASK completion, NOT mission completion. A mission is only complete when it has a PASSED submission.`
    );
    for (const w of ctx.progress.weeks) {
      lines.push(`  Week ${w.weekNumber}: ${w.completedTasks}/${w.totalTasks} tasks (${w.percentage}%)`);
    }
  }

  if (ctx.upcomingTasks.length > 0) {
    lines.push("Upcoming Tasks:");
    for (const t of ctx.upcomingTasks) {
      const status = t.overdue ? "OVERDUE" : "Pending";
      const due = t.dueAt ? new Date(t.dueAt).toLocaleDateString() : "no due date";
      lines.push(`  - [${status}] ${t.title} (Week ${t.weekNumber}, due ${due})`);
    }
  }

  if (ctx.missionStatus.length > 0) {
    lines.push("Missions (authoritative status — use THIS, do not infer completion from task %):");
    for (const m of ctx.missionStatus) {
      const assignLabel =
        m.assignmentStatus == null
          ? "not assigned"
          : m.assignmentStatus === "ACCEPTED"
            ? "you accepted the assignment (started; NOT yet completed)"
            : m.assignmentStatus === "IN_PROGRESS"
              ? "in progress"
              : m.assignmentStatus === "PASSED"
                ? "PASSED (mission complete)"
                : m.assignmentStatus === "OVERDUE"
                  ? "OVERDUE — submit now"
                  : m.assignmentStatus === "REJECTED"
                    ? "REJECTED — retry needed"
                    : m.assignmentStatus;
      const deadlineLabel = m.deadlineAt
        ? `, deadline ${new Date(m.deadlineAt).toLocaleDateString()}`
        : "";
      const submissionLabel = m.hasSubmission
        ? `submitted (status=${m.submissionStatus})`
        : "NOT YET SUBMITTED";
      const taskLabel = `${m.requiredTaskCompleted}/${m.requiredTaskTotal} required tasks done`;
      const journalLabel = `${m.journalEntryCount} journal entries (4 required before submission)`;
      const completeLabel = m.hasSubmission && m.submissionStatus === "PASSED"
        ? "COMPLETE"
        : m.hasSubmission
          ? `submitted (${m.submissionStatus}) — awaiting review`
          : "IN PROGRESS — not yet submitted";
      lines.push(`  Mission ${m.weekNumber}: ${m.title} (${m.difficulty})`);
      lines.push(`    - Assignment: ${assignLabel}${deadlineLabel}`);
      lines.push(`    - Submission: ${submissionLabel}`);
      lines.push(`    - Tasks: ${taskLabel}`);
      lines.push(`    - Journal: ${journalLabel}`);
      lines.push(`    - Status: ${completeLabel}`);
    }
  }

  return lines.join("\n");
}
