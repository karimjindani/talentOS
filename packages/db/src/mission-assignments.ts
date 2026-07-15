import { Prisma } from "@prisma/client";
import { prisma } from "./client";

export const DEFAULT_ASSIGNMENT_WEEK = 1;

export type MissionAssignmentInput = {
  tenantId: string;
  programId: string;
  applicantId: string;
  weekNumber?: number;
  chooseAssignmentIndex?: (candidateCount: number) => number;
};

type MissionCandidate = {
  id: string;
  title: string;
  order: number;
};

export function listAssignedProgramMissions(tenantId: string, applicantId: string, programId: string) {
  return prisma.missionAssignment
    .findMany({
      where: { tenantId, applicantId, programId, mission: { status: "PUBLISHED" } },
      include: { mission: true },
      orderBy: [{ weekNumber: "asc" }, { attemptNumber: "desc" }]
    })
    .then((assignments) => {
      const latestByWeek = new Map<number, (typeof assignments)[number]>();
      for (const assignment of assignments) {
        if (!latestByWeek.has(assignment.weekNumber)) {
          latestByWeek.set(assignment.weekNumber, assignment);
        }
      }
      return [...latestByWeek.values()]
        .map((assignment) => assignment.mission)
        .sort((a, b) => a.weekNumber - b.weekNumber || a.order - b.order || a.title.localeCompare(b.title));
    });
}

export function getAssignedProgramMission(
  missionId: string,
  tenantId: string,
  applicantId: string,
  programId: string
) {
  return prisma.mission.findFirst({
    where: {
      id: missionId,
      tenantId,
      programId,
      status: "PUBLISHED",
      assignments: { some: { tenantId, programId, applicantId } }
    }
  });
}

export function getCurrentMissionAssignmentForApplicantProgram(
  tenantId: string,
  applicantId: string,
  programId: string
) {
  return prisma.missionAssignment.findFirst({
    where: {
      tenantId,
      applicantId,
      programId,
      status: "ACTIVE",
      mission: { status: "PUBLISHED" }
    },
    include: { mission: true },
    orderBy: [{ weekNumber: "asc" }, { attemptNumber: "desc" }]
  });
}

export function getLatestMissionAssignmentForApplicantProgram(
  tenantId: string,
  applicantId: string,
  programId: string
) {
  return prisma.missionAssignment.findFirst({
    where: { tenantId, applicantId, programId, mission: { status: "PUBLISHED" } },
    include: { mission: true },
    orderBy: [{ weekNumber: "desc" }, { attemptNumber: "desc" }]
  });
}

export function getApplicantMissionAssignmentForMission(
  tenantId: string,
  applicantId: string,
  missionId: string
) {
  return prisma.missionAssignment.findFirst({
    where: {
      tenantId,
      applicantId,
      missionId,
      mission: { status: "PUBLISHED" }
    },
    include: { mission: true },
    orderBy: { attemptNumber: "desc" }
  });
}

export function assignWeekMissionToAcceptedApplicant(input: MissionAssignmentInput) {
  return prisma.$transaction((tx) => assignWeekMissionToAcceptedApplicantTx(tx, input));
}

export async function assignWeekMissionToAcceptedApplicantTx(
  tx: Prisma.TransactionClient,
  {
    tenantId,
    programId,
    applicantId,
    weekNumber = DEFAULT_ASSIGNMENT_WEEK,
    chooseAssignmentIndex = randomAssignmentIndex
  }: MissionAssignmentInput
) {
  const acceptedApplication = await tx.application.findFirst({
    where: { tenantId, programId, applicantId, status: "ACCEPTED" },
    select: { id: true }
  });
  if (!acceptedApplication) {
    throw new Error("Mission assignments require an accepted application for this program.");
  }

  const existing = await tx.missionAssignment.findFirst({
    where: { tenantId, programId, applicantId, weekNumber, attemptNumber: 1 }
  });
  if (existing) {
    return existing;
  }

  const missions = await tx.mission.findMany({
    where: { tenantId, programId, weekNumber, status: "PUBLISHED" },
    select: { id: true, title: true, order: true },
    orderBy: [{ order: "asc" }, { title: "asc" }]
  });
  if (missions.length === 0) {
    return null;
  }

  const counts = await tx.missionAssignment.groupBy({
    by: ["missionId"],
    where: { tenantId, programId, weekNumber, missionId: { in: missions.map((mission) => mission.id) } },
    _count: { missionId: true }
  });
  const assignmentCountByMission = new Map(counts.map((count) => [count.missionId, count._count.missionId]));
  const leastAssignedCount = Math.min(...missions.map((mission) => assignmentCountByMission.get(mission.id) ?? 0));
  const leastAssignedMissions = missions.filter(
    (mission) => (assignmentCountByMission.get(mission.id) ?? 0) === leastAssignedCount
  );
  const mission = pickMissionCandidate(leastAssignedMissions, chooseAssignmentIndex);

  return tx.missionAssignment.create({
    data: {
      tenantId,
      programId,
      applicantId,
      missionId: mission.id,
      weekNumber,
      attemptNumber: 1,
      status: "ACTIVE"
    }
  });
}

export function getActiveMissionAssignmentForMissionTx(
  tx: Prisma.TransactionClient,
  {
    tenantId,
    applicantId,
    missionId
  }: {
    tenantId: string;
    applicantId: string;
    missionId: string;
  }
) {
  return tx.missionAssignment.findFirst({
    where: {
      tenantId,
      applicantId,
      missionId,
      status: "ACTIVE",
      mission: { status: "PUBLISHED" }
    },
    include: { mission: { select: { id: true, programId: true, weekNumber: true } } },
    orderBy: { attemptNumber: "desc" }
  });
}

export async function createRepeatMissionAssignmentTx(
  tx: Prisma.TransactionClient,
  assignment: {
    id: string;
    tenantId: string;
    programId: string;
    applicantId: string;
    missionId: string;
    weekNumber: number;
    attemptNumber: number;
  }
) {
  const latest = await tx.missionAssignment.findFirst({
    where: {
      tenantId: assignment.tenantId,
      programId: assignment.programId,
      applicantId: assignment.applicantId,
      weekNumber: assignment.weekNumber
    },
    select: { id: true, attemptNumber: true },
    orderBy: { attemptNumber: "desc" }
  });
  if (!latest || latest.id !== assignment.id) {
    throw new Error("Only the latest assignment attempt can be repeated.");
  }

  return tx.missionAssignment.create({
    data: {
      tenantId: assignment.tenantId,
      programId: assignment.programId,
      applicantId: assignment.applicantId,
      missionId: assignment.missionId,
      weekNumber: assignment.weekNumber,
      attemptNumber: assignment.attemptNumber + 1,
      status: "ACTIVE"
    }
  });
}

function pickMissionCandidate(
  candidates: MissionCandidate[],
  chooseAssignmentIndex: (candidateCount: number) => number
): MissionCandidate {
  const requestedIndex = Math.trunc(chooseAssignmentIndex(candidates.length));
  const safeIndex = Number.isFinite(requestedIndex)
    ? Math.min(Math.max(requestedIndex, 0), candidates.length - 1)
    : 0;
  const candidate = candidates[safeIndex];
  if (!candidate) {
    throw new Error("No mission assignment candidates are available.");
  }
  return candidate;
}

function randomAssignmentIndex(candidateCount: number): number {
  return Math.floor(Math.random() * candidateCount);
}
