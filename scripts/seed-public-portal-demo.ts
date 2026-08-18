import { createOrUpdateGraduateProfile, prisma } from "@talentos/db";

const DEMO_EMAIL_DOMAIN = "public-portal-demo.talentos.local";

const graduates = [
  {
    email: `amina.rahman@${DEMO_EMAIL_DOMAIN}`,
    name: "Amina Rahman",
    bio: "Full-stack engineer building accessible products with TypeScript, React, Node.js and PostgreSQL.",
    country: "Pakistan",
    skills: ["typescript", "react", "node.js", "postgresql"],
    interests: ["accessibility", "ai tooling"],
    linkedinUrl: "https://linkedin.com/in/amina-rahman-demo",
    githubUrl: "https://github.com/amina-rahman-demo",
    ratings: [4.4, 4.6, 4.8, 4.7]
  },
  {
    email: `daniel.okafor@${DEMO_EMAIL_DOMAIN}`,
    name: "Daniel Okafor",
    bio: "Backend-focused software engineer interested in dependable APIs, cloud infrastructure and observability.",
    country: "Nigeria",
    skills: ["node.js", "docker", "postgresql", "ci/cd"],
    interests: ["distributed systems", "devops"],
    linkedinUrl: "https://linkedin.com/in/daniel-okafor-demo",
    githubUrl: "https://github.com/daniel-okafor-demo",
    ratings: [4.2, 4.5, 4.7, 4.6]
  },
  {
    email: `sophia.martinez@${DEMO_EMAIL_DOMAIN}`,
    name: "Sophia Martinez",
    bio: "Product-minded frontend engineer who turns complex requirements into polished and inclusive user experiences.",
    country: "Mexico",
    skills: ["react", "typescript", "testing", "ux engineering"],
    interests: ["design systems", "education technology"],
    linkedinUrl: "https://linkedin.com/in/sophia-martinez-demo",
    githubUrl: "https://github.com/sophia-martinez-demo",
    ratings: [4.6, 4.7, 4.9, 4.8]
  },
  {
    email: `yusuf.khan@${DEMO_EMAIL_DOMAIN}`,
    name: "Yusuf Khan",
    bio: "AI-native software engineer focused on secure delivery, test automation and production readiness.",
    country: "United Arab Emirates",
    skills: ["python", "typescript", "security testing", "docker"],
    interests: ["application security", "machine learning"],
    linkedinUrl: "https://linkedin.com/in/yusuf-khan-demo",
    githubUrl: "https://github.com/yusuf-khan-demo",
    ratings: [4.3, 4.6, 4.6, 4.9]
  }
];

async function cleanup() {
  const result = await prisma.user.deleteMany({ where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } });
  console.log(`Removed ${result.count} public-portal demo graduates.`);
}

async function seed() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo" } });
  if (!tenant) throw new Error("Demo tenant not found. Run npm.cmd run db:seed first.");
  const program = await prisma.program.findUnique({ where: { tenantId_slug: { tenantId: tenant.id, slug: "ai-native-engineering" } } });
  if (!program) throw new Error("AI-Native Software Engineering program not found. Run npm.cmd run db:seed first.");
  const reviewer = await prisma.user.findUnique({ where: { email: "orgadmin@demo.talentos.local" } });
  if (!reviewer) throw new Error("Demo organization admin not found. Run npm.cmd run db:seed first.");

  const published = await prisma.mission.findMany({ where: { programId: program.id, status: "PUBLISHED", weekNumber: { in: [1, 2, 3, 4] } }, orderBy: [{ weekNumber: "asc" }, { order: "asc" }] });
  const missions = [1, 2, 3, 4].map((week) => published.find((mission) => mission.weekNumber === week));
  if (missions.some((mission) => !mission)) throw new Error("The demo program needs at least one published mission in each of weeks 1 through 4.");

  for (const [graduateIndex, data] of graduates.entries()) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      create: { email: data.email, name: data.name, emailVerified: new Date() },
      update: { name: data.name, emailVerified: new Date(), status: "ACTIVE" }
    });
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId_role: { tenantId: tenant.id, userId: user.id, role: "APPLICANT" } },
      create: { tenantId: tenant.id, userId: user.id, role: "APPLICANT" }, update: {}
    });
    const existingApplication = await prisma.application.findFirst({ where: { tenantId: tenant.id, programId: program.id, applicantId: user.id } });
    if (existingApplication) {
      await prisma.application.update({ where: { id: existingApplication.id }, data: { status: "ACCEPTED", submittedAt: existingApplication.submittedAt ?? new Date(), reviewedAt: new Date(), reviewerNotes: "Accepted public-portal demo graduate." } });
    } else {
      await prisma.application.create({ data: { tenantId: tenant.id, programId: program.id, applicantId: user.id, status: "ACCEPTED", submittedAt: new Date(), reviewedAt: new Date(), reviewerNotes: "Accepted public-portal demo graduate." } });
    }

    for (const [missionIndex, mission] of missions.entries()) {
      if (!mission) continue;
      const existingAssignment = await prisma.missionAssignment.findUnique({
        where: { tenantId_programId_applicantId_weekNumber_attemptNumber: { tenantId: tenant.id, programId: program.id, applicantId: user.id, weekNumber: mission.weekNumber, attemptNumber: 1 } }
      });
      const assignment = existingAssignment
        ? await prisma.missionAssignment.update({ where: { id: existingAssignment.id }, data: { missionId: mission.id, status: "PASSED" } })
        : await prisma.missionAssignment.create({ data: { tenantId: tenant.id, programId: program.id, applicantId: user.id, missionId: mission.id, weekNumber: mission.weekNumber, attemptNumber: 1, status: "PASSED" } });
      const completionDate = new Date(Date.UTC(2026, 2 + graduateIndex, 7 + missionIndex));
      await prisma.submission.upsert({
        where: { missionAssignmentId: assignment.id },
        create: { tenantId: tenant.id, missionId: mission.id, applicantId: user.id, missionAssignmentId: assignment.id, status: "ACCEPTED", repositoryUrl: `https://github.com/talentos-demo/${data.name.toLowerCase().replace(/[^a-z]+/g, "-")}-week-${mission.weekNumber}`, deploymentUrl: `https://week-${mission.weekNumber}.example.com`, journalMarkdown: `## Week ${mission.weekNumber}\nCompleted and verified for the public-portal demo.`, rating: data.ratings[missionIndex], submittedAt: completionDate, reviewedAt: completionDate, reviewerUserId: reviewer.id, reviewerFeedback: "Meets the mission acceptance criteria." },
        update: { missionId: mission.id, applicantId: user.id, status: "ACCEPTED", rating: data.ratings[missionIndex], submittedAt: completionDate, reviewedAt: completionDate, reviewerUserId: reviewer.id, reviewerFeedback: "Meets the mission acceptance criteria." }
      });
    }

    const profile = await createOrUpdateGraduateProfile(user.id, {
      bio: data.bio,
      country: data.country,
      skills: data.skills,
      interests: data.interests,
      linkedinUrl: data.linkedinUrl,
      githubUrl: data.githubUrl,
      emailPublic: false,
      artifacts: [{ title: "Final engineering portfolio", url: `https://github.com/talentos-demo/${data.name.toLowerCase().replace(/[^a-z]+/g, "-")}-portfolio`, description: "Evidence from all four program weeks." }]
    });
    console.log(`Published ${data.name}: /graduates/${profile.slug}`);
  }
  console.log(`Public-portal demo is ready with ${graduates.length} graduates.`);
}

(process.argv.includes("--cleanup") ? cleanup() : seed())
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
