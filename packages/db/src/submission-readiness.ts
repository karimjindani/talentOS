import { Prisma } from "@prisma/client";
import { prisma } from "./client";
import {
  normalizeDeploymentUrls,
  parseDeploymentUrls,
  parseEvidenceUrl,
  type EvidenceUrlKind,
  type PublicUrlCheckResult
} from "./url-safety";

export const REQUIRED_JOURNAL_ENTRY_COUNT = 4;

export type MissionSubmissionReadinessInput = {
  tenantId: string;
  applicantId: string;
  missionAssignmentId: string;
};

export type SubmissionUrlReadiness = {
  present: boolean;
  validFormat: boolean;
  value: string | null;
  reachable: boolean | null;
  statusCode: number | null;
  error: string | null;
};

export type DeploymentUrlReachability = {
  value: string;
  validFormat: boolean;
  reachable: boolean | null;
  statusCode: number | null;
  error: string | null;
};

export type SubmissionDeploymentUrlReadiness = SubmissionUrlReadiness & {
  count: number;
  values: string[];
  reachability: DeploymentUrlReachability[];
};

export type MissionSubmissionReadiness = {
  ready: boolean;
  assignment: {
    id: string;
    missionId: string;
    programId: string;
    weekNumber: number;
    attemptNumber: number;
    status: string;
  };
  submission: {
    id: string;
    status: string;
  } | null;
  tasks: {
    required: number;
    completed: number;
    incomplete: Array<{ id: string; title: string }>;
  };
  journals: {
    required: number;
    completed: number;
  };
  urls: {
    repository: SubmissionUrlReadiness;
    deployment: SubmissionDeploymentUrlReadiness;
    loom: SubmissionUrlReadiness;
  };
  blockers: string[];
};

type ReadinessClient = Pick<
  Prisma.TransactionClient,
  | "missionAssignment"
  | "application"
  | "submission"
  | "programTask"
  | "userTaskCompletion"
  | "engineeringJournalEntry"
>;

export class SubmissionReadinessError extends Error {
  constructor(
    message: string,
    public readonly blockers: string[]
  ) {
    super(message);
    this.name = "SubmissionReadinessError";
  }
}

export function getMissionSubmissionReadiness(
  input: MissionSubmissionReadinessInput,
  now = new Date()
): Promise<MissionSubmissionReadiness> {
  return getMissionSubmissionReadinessWithClient(prisma, input, now);
}

export async function getMissionSubmissionReadinessWithClient(
  client: ReadinessClient,
  input: MissionSubmissionReadinessInput,
  now = new Date()
): Promise<MissionSubmissionReadiness> {
  const assignment = await client.missionAssignment.findFirst({
    where: {
      id: input.missionAssignmentId,
      tenantId: input.tenantId,
      applicantId: input.applicantId,
      mission: { status: "PUBLISHED" }
    },
    select: {
      id: true,
      tenantId: true,
      applicantId: true,
      missionId: true,
      programId: true,
      weekNumber: true,
      attemptNumber: true,
      status: true
    }
  });
  if (!assignment) {
    throw new Error("Assignment was not found for this applicant and tenant.");
  }

  const acceptedApplication = await client.application.findFirst({
    where: {
      tenantId: input.tenantId,
      applicantId: input.applicantId,
      programId: assignment.programId,
      status: "ACCEPTED"
    },
    select: { id: true }
  });
  if (!acceptedApplication) {
    throw new Error("Submission readiness requires an accepted application for this program.");
  }

  const [submission, tasks, journalCount] = await Promise.all([
    client.submission.findFirst({
      where: {
        tenantId: input.tenantId,
        applicantId: input.applicantId,
        missionAssignmentId: assignment.id,
        missionId: assignment.missionId
      },
      select: {
        id: true,
        status: true,
        repositoryUrl: true,
        deploymentUrl: true,
        loomUrl: true
      }
    }),
    client.programTask.findMany({
      where: {
        tenantId: input.tenantId,
        programId: assignment.programId,
        weekNumber: assignment.weekNumber,
        published: true,
        required: true
      },
      select: { id: true, title: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }]
    }),
    client.engineeringJournalEntry.count({
      where: {
        tenantId: input.tenantId,
        applicantId: input.applicantId,
        missionAssignmentId: assignment.id,
        entryDate: { lte: latestGlobalCalendarDate(now) }
      }
    })
  ]);

  const completions = tasks.length
    ? await client.userTaskCompletion.findMany({
        where: {
          tenantId: input.tenantId,
          userId: input.applicantId,
          taskId: { in: tasks.map((task) => task.id) },
          task: {
            tenantId: input.tenantId,
            programId: assignment.programId,
            weekNumber: assignment.weekNumber
          }
        },
        select: { taskId: true }
      })
    : [];
  const completedTaskIds = new Set(completions.map((completion) => completion.taskId));
  const incompleteTasks = tasks.filter((task) => !completedTaskIds.has(task.id));

  const urls = {
    repository: evaluateUrl(submission?.repositoryUrl ?? null, "repository"),
    deployment: evaluateDeploymentUrls(submission?.deploymentUrl ?? null),
    loom: evaluateUrl(submission?.loomUrl ?? null, "loom")
  };
  const blockers: string[] = [];

  if (!["ACCEPTED", "IN_PROGRESS", "OVERDUE"].includes(assignment.status)) {
    blockers.push("The current assignment attempt is not open for submission.");
  }
  if (submission && submission.status !== "DRAFT" && submission.status !== "NEEDS_REVISION") {
    blockers.push(`The submission cannot be submitted from ${submission.status}.`);
  }
  if (incompleteTasks.length > 0) {
    blockers.push(
      `Complete all required Week ${assignment.weekNumber} tasks: ${incompleteTasks.map((task) => task.title).join(", ")}.`
    );
  }
  if (journalCount < REQUIRED_JOURNAL_ENTRY_COUNT) {
    blockers.push(
      `Add at least ${REQUIRED_JOURNAL_ENTRY_COUNT} Engineering Journal entries for this assignment attempt (${journalCount} of ${REQUIRED_JOURNAL_ENTRY_COUNT} completed).`
    );
  }
  for (const urlStatus of Object.values(urls)) {
    if (!urlStatus.present || !urlStatus.validFormat) {
      blockers.push(urlStatus.error ?? "A required submission URL is missing or invalid.");
    }
  }

  return {
    ready: blockers.length === 0,
    assignment: {
      id: assignment.id,
      missionId: assignment.missionId,
      programId: assignment.programId,
      weekNumber: assignment.weekNumber,
      attemptNumber: assignment.attemptNumber,
      status: assignment.status
    },
    submission: submission ? { id: submission.id, status: submission.status } : null,
    tasks: {
      required: tasks.length,
      completed: tasks.length - incompleteTasks.length,
      incomplete: incompleteTasks
    },
    journals: { required: REQUIRED_JOURNAL_ENTRY_COUNT, completed: journalCount },
    urls,
    blockers
  };
}

export function assertMissionSubmissionReady(readiness: MissionSubmissionReadiness): void {
  if (!readiness.ready) {
    throw new SubmissionReadinessError(readiness.blockers.join(" "), readiness.blockers);
  }
}

export async function checkMissionSubmissionUrlReachability(
  readiness: MissionSubmissionReadiness,
  checkUrl: (url: string, kind: EvidenceUrlKind) => Promise<PublicUrlCheckResult>
): Promise<MissionSubmissionReadiness> {
  const targets = [
    ...(readiness.urls.repository.value
      ? [{ value: readiness.urls.repository.value, kind: "repository" as const }]
      : []),
    ...readiness.urls.deployment.values.map((value) => ({ value, kind: "deployment" as const })),
    ...(readiness.urls.loom.value ? [{ value: readiness.urls.loom.value, kind: "loom" as const }] : [])
  ];
  const checked = await Promise.all(
    targets.map(async (target) => ({ ...target, result: await checkUrl(target.value, target.kind) }))
  );
  const resultFor = (kind: EvidenceUrlKind, value: string | null) =>
    checked.find((entry) => entry.kind === kind && entry.value === value)?.result ?? null;
  const repositoryResult = resultFor("repository", readiness.urls.repository.value);
  const loomResult = resultFor("loom", readiness.urls.loom.value);
  const deploymentReachability = readiness.urls.deployment.values.map((value) => {
    const result = resultFor("deployment", value);
    const previous = readiness.urls.deployment.reachability.find((entry) => entry.value === value);
    return {
      value,
      validFormat: previous?.validFormat ?? true,
      reachable: result?.reachable ?? null,
      statusCode: result?.statusCode ?? null,
      error: result?.error ?? null
    };
  });
  const networkBlockers = checked
    .filter((entry) => !entry.result.reachable)
    .map((entry) => `${entry.value}: ${entry.result.error ?? "URL is not publicly reachable."}`);
  const blockers = [...readiness.blockers, ...networkBlockers];

  return {
    ...readiness,
    ready: blockers.length === 0,
    urls: {
      repository: {
        ...readiness.urls.repository,
        reachable: repositoryResult?.reachable ?? null,
        statusCode: repositoryResult?.statusCode ?? null,
        error: repositoryResult?.error ?? readiness.urls.repository.error
      },
      deployment: {
        ...readiness.urls.deployment,
        reachable:
          deploymentReachability.length > 0
            ? deploymentReachability.every((entry) => entry.reachable === true)
            : null,
        statusCode: null,
        reachability: deploymentReachability,
        error: networkBlockers.length > 0 ? networkBlockers.join(" ") : readiness.urls.deployment.error
      },
      loom: {
        ...readiness.urls.loom,
        reachable: loomResult?.reachable ?? null,
        statusCode: loomResult?.statusCode ?? null,
        error: loomResult?.error ?? readiness.urls.loom.error
      }
    },
    blockers
  };
}

function evaluateUrl(value: string | null, kind: EvidenceUrlKind): SubmissionUrlReadiness {
  const label: Record<EvidenceUrlKind, string> = {
    repository: "GitHub repository URL",
    deployment: "Deployed application URL",
    loom: "Loom walkthrough URL"
  };
  if (!value) {
    return {
      present: false,
      validFormat: false,
      value: null,
      reachable: null,
      statusCode: null,
      error: `${label[kind]} is required.`
    };
  }
  try {
    return {
      present: true,
      validFormat: true,
      value: parseEvidenceUrl(value, kind),
      reachable: null,
      statusCode: null,
      error: null
    };
  } catch (error) {
    return {
      present: true,
      validFormat: false,
      value,
      reachable: null,
      statusCode: null,
      error: error instanceof Error ? error.message : `${label[kind]} is invalid.`
    };
  }
}

function evaluateDeploymentUrls(value: string | null): SubmissionDeploymentUrlReadiness {
  if (!value) {
    return {
      present: false,
      validFormat: false,
      value: null,
      values: [],
      count: 0,
      reachable: null,
      statusCode: null,
      reachability: [],
      error: "At least one deployed application URL is required."
    };
  }
  try {
    const values = parseDeploymentUrls(value);
    const normalized = normalizeDeploymentUrls(value);
    return {
      present: values.length > 0,
      validFormat: values.length > 0,
      value: normalized,
      values,
      count: values.length,
      reachable: null,
      statusCode: null,
      reachability: values.map((url) => ({
        value: url,
        validFormat: true,
        reachable: null,
        statusCode: null,
        error: null
      })),
      error: values.length > 0 ? null : "At least one deployed application URL is required."
    };
  } catch (error) {
    const supplied = value.split(";").map((entry) => entry.trim()).filter(Boolean);
    const perUrlFormat = supplied.map((rawUrl) => {
      try {
        return {
          value: parseEvidenceUrl(rawUrl, "deployment") ?? rawUrl,
          validFormat: true,
          reachable: null,
          statusCode: null,
          error: null
        };
      } catch (formatError) {
        return {
          value: rawUrl,
          validFormat: false,
          reachable: null,
          statusCode: null,
          error: formatError instanceof Error ? formatError.message : "Deployed application URL is invalid."
        };
      }
    });
    return {
      present: supplied.length > 0,
      validFormat: false,
      value,
      values: supplied,
      count: supplied.length,
      reachable: null,
      statusCode: null,
      reachability: perUrlFormat,
      error: error instanceof Error ? error.message : "Deployed application URLs are invalid."
    };
  }
}

function latestGlobalCalendarDate(value: Date): Date {
  const latestTimeZoneInstant = new Date(value.getTime() + 14 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(
      latestTimeZoneInstant.getUTCFullYear(),
      latestTimeZoneInstant.getUTCMonth(),
      latestTimeZoneInstant.getUTCDate()
    )
  );
}
