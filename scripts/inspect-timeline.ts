import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const mission = await prisma.mission.findFirst({
    where: { title: { contains: "Production-Grade Automated Testing" } },
    select: { id: true, createdAt: true, programId: true, tenantId: true, weekNumber: true },
  });
  if (!mission) { console.log("Mission not found"); return; }

  const app = await prisma.application.findFirst({
    where: { programId: mission.programId, tenantId: mission.tenantId, status: "ACCEPTED" },
    select: { id: true, status: true, reviewedAt: true, createdAt: true, applicantId: true },
  });

  console.log("Mission createdAt:", mission.createdAt);
  console.log("Application reviewedAt:", app?.reviewedAt);
  console.log("Application createdAt:", app?.createdAt);

  if (app && mission.createdAt > app.reviewedAt!) {
    console.log("\n*** Mission was created AFTER application was accepted ***");
    console.log("This means assignWeekMissionToAcceptedApplicantTx ran when no PUBLISHED mission existed yet.");
    console.log("The assignment was never created because missions.length === 0 at acceptance time.");
  } else if (app && mission.createdAt < app.reviewedAt!) {
    console.log("\n*** Mission was created BEFORE application was accepted ***");
    console.log("The assignment should have been created. Something else is wrong.");
  }

  // Check if there are any other published missions for week 1 in this program
  const week1Missions = await prisma.mission.findMany({
    where: { tenantId: mission.tenantId, programId: mission.programId, weekNumber: 1, status: "PUBLISHED" },
    select: { id: true, title: true, createdAt: true },
  });
  console.log("\nAll Week 1 PUBLISHED missions:", JSON.stringify(week1Missions, null, 2));

  // Check all assignments for this applicant
  const allAssignments = await prisma.missionAssignment.findMany({
    where: { applicantId: app!.applicantId },
    select: { id: true, missionId: true, weekNumber: true, status: true, createdAt: true },
  });
  console.log("\nAll assignments for applicant:", JSON.stringify(allAssignments, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
