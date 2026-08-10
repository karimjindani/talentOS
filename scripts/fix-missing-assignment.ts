import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const mission = await prisma.mission.findFirst({
    where: { title: { contains: "Production-Grade Automated Testing" } },
    select: { id: true, tenantId: true, programId: true, weekNumber: true },
  });
  if (!mission) { console.log("Mission not found"); return; }

  const acceptedApps = await prisma.application.findMany({
    where: { tenantId: mission.tenantId, programId: mission.programId, status: "ACCEPTED" },
    select: { applicantId: true },
  });
  console.log(`Found ${acceptedApps.length} accepted application(s)`);

  for (const app of acceptedApps) {
    const existing = await prisma.missionAssignment.findFirst({
      where: { tenantId: mission.tenantId, programId: mission.programId, applicantId: app.applicantId, weekNumber: 1 }
    });
    if (existing) {
      console.log(`Applicant ${app.applicantId} already has assignment ${existing.id}`);
      continue;
    }
    const assignment = await prisma.missionAssignment.create({
      data: {
        tenantId: mission.tenantId,
        programId: mission.programId,
        applicantId: app.applicantId,
        missionId: mission.id,
        weekNumber: 1,
        attemptNumber: 1,
        status: "NOT_STARTED"
      }
    });
    console.log(`Created assignment ${assignment.id} for applicant ${app.applicantId}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
