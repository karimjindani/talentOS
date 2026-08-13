import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 1. Find the mission
  let missions;
  try {
    missions = await prisma.mission.findMany({
      where: { title: { contains: "Production-Grade Automated Testing" } },
      include: {
        program: true,
        tenant: true,
        assignments: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    console.log("Found missions:", missions.length);
  } catch (e) {
    console.error("Query error:", (e as Error).message);
    // Try without includes
    missions = await prisma.mission.findMany({
      where: { title: { contains: "Production-Grade" } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    console.log("Found missions (simple):", missions.length);
  }

  console.log("=== MISSION RECORDS ===");
  for (const m of missions) {
    console.log(JSON.stringify({
      id: m.id,
      title: m.title,
      status: m.status,
      weekNumber: m.weekNumber,
      displayOrder: m.displayOrder,
      programId: m.programId,
      tenantId: m.tenantId,
      createdAt: m.createdAt,
      tutorialUrl: m.tutorialUrl,
      repositoryUrl: m.repositoryUrl,
      deadlineHours: m.deadlineHours,
      gracePeriodHours: m.gracePeriodHours,
      program: {
        id: m.program.id,
        title: m.program.title,
        status: m.program.status,
        tenantId: m.program.tenantId,
      },
      tenant: {
        id: m.tenant.id,
        slug: m.tenant.slug,
        name: m.tenant.name,
      },
      assignmentsCount: m.assignments.length,
    }, null, 2));
  }

  if (missions.length === 0) {
    console.log("No missions found with that title!");
    // List all missions to see what's there
    const allMissions = await prisma.mission.findMany({
      select: { id: true, title: true, status: true, weekNumber: true, programId: true, tenantId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    console.log("\n=== ALL RECENT MISSIONS ===");
    for (const m of allMissions) {
      console.log(`  ${m.title} | status=${m.status} | week=${m.weekNumber} | created=${m.createdAt.toISOString()}`);
    }
    console.log(`\nTotal missions found: ${allMissions.length}`);
  }

  // 2. For the first matching mission, check applicant visibility
  if (missions.length > 0) {
    const mission = missions[0];
    console.log("\n=== APPLICANT VISIBILITY ANALYSIS ===");
    console.log(`Mission status: ${mission.status}`);
    console.log(`Program status: ${mission.program.status}`);

    // Find all applicants in this tenant
    const applicants = await prisma.user.findMany({
      where: {
        memberships: { some: { tenantId: mission.tenantId } },
      },
      select: { id: true, email: true, keycloakSubjectId: true },
      take: 10,
    });
    console.log(`\nApplicants in tenant ${mission.tenant.slug}:`);
    console.log(JSON.stringify(applicants, null, 2));

    // Check applications for this program
    const applications = await prisma.application.findMany({
      where: { programId: mission.programId },
      select: {
        id: true,
        status: true,
        applicantId: true,
        programId: true,
        tenantId: true,
      },
    });
    console.log(`\nApplications for program ${mission.program.title}:`);
    console.log(JSON.stringify(applications, null, 2));

    // Check mission assignments
    const assignments = await prisma.missionAssignment.findMany({
      where: { missionId: mission.id },
      select: {
        id: true,
        applicantId: true,
        missionId: true,
        weekNumber: true,
        status: true,
      },
    });
    console.log(`\nMission assignments for this mission:`);
    console.log(JSON.stringify(assignments, null, 2));

    // Check ALL mission assignments for applicants in this tenant
    const allAssignments = await prisma.missionAssignment.findMany({
      where: {
        applicant: {
          memberships: { some: { tenantId: mission.tenantId } },
        },
      },
      select: {
        id: true,
        applicantId: true,
        missionId: true,
        weekNumber: true,
        status: true,
        mission: { select: { id: true, title: true, status: true, weekNumber: true } },
      },
    });
    console.log(`\nALL mission assignments for applicants in this tenant:`);
    console.log(JSON.stringify(allAssignments, null, 2));
  }

  await prisma.$disconnect();
}

main().catch(console.error);
