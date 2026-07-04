import { PrismaClient, type TenantRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo TalentOS Academy",
      slug: "demo",
      primaryColor: "#2563eb",
      secondaryColor: "#0f172a"
    }
  });

  const program = await prisma.program.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: "ai-native-engineering"
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "AI-Native Software Engineering",
      slug: "ai-native-engineering",
      description: "Applications-first pilot program for TalentOS.",
      status: "PUBLISHED"
    }
  });

  await prisma.mission.upsert({
    where: { id: "seed-mission-week-1-landing-page" },
    update: {
      tenantId: tenant.id,
      programId: program.id,
      title: "Build a Public Product Landing Page",
      difficulty: "BEGINNER",
      status: "PUBLISHED",
      weekNumber: 1,
      order: 1,
      objective: "Convert a rough business idea into a deployed public landing page.",
      brief: `A small startup is preparing to launch a new product but does not yet have a public website. Your mission is to turn a rough business idea into a deployed product landing page that explains the product, captures user interest, and demonstrates professional engineering discipline.

Business context:
The client wants a simple public website for a product called TaskPilot, an AI-assisted task planning tool for small teams.

The site should help visitors understand:
- What the product does
- Who it is for
- Why it is useful
- How to express interest before launch

You are expected to use AI tools, but you must document how AI helped you and what decisions you made independently.

SEM lifecycle:
1. Discover: write at least 5 clarification questions you would ask the client.
2. Analyze: summarize the business problem and target users.
3. Specify: create a short PRD with product goal, users, features, out-of-scope items and acceptance criteria.
4. Design: create a basic page structure or wireframe.
5. Build: build a responsive landing page.
6. Test: create and execute a manual test checklist.
7. Deploy: publish the site using Vercel, Netlify, GitHub Pages or similar.
8. Present: record a 3-5 minute Loom demo.
9. Reflect: write an engineering journal entry.
10. Production Readiness Review: evaluate whether the solution is ready for real users.`,
      deliverables: `- PRD
- User stories
- Acceptance criteria
- Wireframe or page structure
- GitHub repository URL
- Deployment URL
- README
- Manual test checklist
- Loom demo video
- Engineering journal entry
- AI usage disclosure`,
      acceptanceCriteria: `- The landing page is publicly accessible.
- The page is responsive on desktop and mobile.
- The GitHub repository contains a clear README.
- The PRD and user stories are included in documentation.
- The deployment URL works without login.
- The participant has submitted a Loom demo.
- AI usage is documented transparently.
- Manual testing evidence is included.`,
      evaluationCriteria: `Bronze: working deployed landing page with README and basic demo.
Silver: includes PRD, user stories, acceptance criteria and test checklist.
Gold: responsive polished UI, clear documentation, AI usage disclosure and strong Loom presentation.
Platinum: professional-grade landing page with excellent UX, clear commit history, accessibility checks and thoughtful production readiness reflection.`,
      competencyTags: [
        "Problem Discovery",
        "Requirements Engineering",
        "AI Collaboration",
        "Software Construction",
        "Quality Engineering",
        "Deployment & Operations",
        "Documentation",
        "Communication",
        "Professionalism"
      ]
    },
    create: {
      id: "seed-mission-week-1-landing-page",
      tenantId: tenant.id,
      programId: program.id,
      title: "Build a Public Product Landing Page",
      difficulty: "BEGINNER",
      status: "PUBLISHED",
      weekNumber: 1,
      order: 1,
      objective: "Convert a rough business idea into a deployed public landing page.",
      brief: `A small startup is preparing to launch a new product but does not yet have a public website. Your mission is to turn a rough business idea into a deployed product landing page that explains the product, captures user interest, and demonstrates professional engineering discipline.

Business context:
The client wants a simple public website for a product called TaskPilot, an AI-assisted task planning tool for small teams.

The site should help visitors understand:
- What the product does
- Who it is for
- Why it is useful
- How to express interest before launch

You are expected to use AI tools, but you must document how AI helped you and what decisions you made independently.

SEM lifecycle:
1. Discover: write at least 5 clarification questions you would ask the client.
2. Analyze: summarize the business problem and target users.
3. Specify: create a short PRD with product goal, users, features, out-of-scope items and acceptance criteria.
4. Design: create a basic page structure or wireframe.
5. Build: build a responsive landing page.
6. Test: create and execute a manual test checklist.
7. Deploy: publish the site using Vercel, Netlify, GitHub Pages or similar.
8. Present: record a 3-5 minute Loom demo.
9. Reflect: write an engineering journal entry.
10. Production Readiness Review: evaluate whether the solution is ready for real users.`,
      deliverables: `- PRD
- User stories
- Acceptance criteria
- Wireframe or page structure
- GitHub repository URL
- Deployment URL
- README
- Manual test checklist
- Loom demo video
- Engineering journal entry
- AI usage disclosure`,
      acceptanceCriteria: `- The landing page is publicly accessible.
- The page is responsive on desktop and mobile.
- The GitHub repository contains a clear README.
- The PRD and user stories are included in documentation.
- The deployment URL works without login.
- The participant has submitted a Loom demo.
- AI usage is documented transparently.
- Manual testing evidence is included.`,
      evaluationCriteria: `Bronze: working deployed landing page with README and basic demo.
Silver: includes PRD, user stories, acceptance criteria and test checklist.
Gold: responsive polished UI, clear documentation, AI usage disclosure and strong Loom presentation.
Platinum: professional-grade landing page with excellent UX, clear commit history, accessibility checks and thoughtful production readiness reflection.`,
      competencyTags: [
        "Problem Discovery",
        "Requirements Engineering",
        "AI Collaboration",
        "Software Construction",
        "Quality Engineering",
        "Deployment & Operations",
        "Documentation",
        "Communication",
        "Professionalism"
      ]
    }
  });

  // A draft program so the admin Programs list shows more than one status out of the box.
  await prisma.program.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "cloud-platform-engineering" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Cloud Platform Engineering",
      slug: "cloud-platform-engineering",
      description: "Draft program for the next TalentOS cohort.",
      status: "DRAFT"
    }
  });

  // Platform Super Admin (no tenant membership; identity + credentials live in Keycloak).
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@talentos.local" },
    update: { platformRole: "SUPER_ADMIN" },
    create: {
      email: "superadmin@talentos.local",
      name: "Platform Super Admin",
      platformRole: "SUPER_ADMIN"
    }
  });

  // Demo organization users, one per org-scoped role (mirrors the Keycloak realm import).
  const orgUsers: { email: string; name: string; role: TenantRole }[] = [
    { email: "orgadmin@demo.talentos.local", name: "Demo Org Admin", role: "ORG_ADMIN" },
    { email: "hr@demo.talentos.local", name: "Demo HR", role: "HR" },
    { email: "techlead@demo.talentos.local", name: "Demo Tech Lead", role: "TECH_LEAD" },
    { email: "applicant@demo.talentos.local", name: "Demo Applicant", role: "APPLICANT" },
    { email: "accepted@demo.talentos.local", name: "Demo Accepted Applicant", role: "APPLICANT" }
  ];

  for (const orgUser of orgUsers) {
    const user = await prisma.user.upsert({
      where: { email: orgUser.email },
      update: {},
      create: { email: orgUser.email, name: orgUser.name }
    });

    await prisma.tenantMembership.upsert({
      where: {
        tenantId_userId_role: {
          tenantId: tenant.id,
          userId: user.id,
          role: orgUser.role
        }
      },
      update: {},
      create: {
        tenantId: tenant.id,
        userId: user.id,
        role: orgUser.role
      }
    });
  }

  // Seed one SUBMITTED application so the admin review workflow is demoable out of the box.
  const applicant = await prisma.user.findUnique({
    where: { email: "applicant@demo.talentos.local" }
  });

  if (applicant) {
    const existingApplication = await prisma.application.findFirst({
      where: { applicantId: applicant.id, programId: program.id }
    });

    if (!existingApplication) {
      await prisma.application.create({
        data: {
          tenantId: tenant.id,
          programId: program.id,
          applicantId: applicant.id,
          status: "SUBMITTED",
          submittedAt: new Date(),
          answers: {
            create: [
              {
                questionKey: "motivation",
                questionLabel: "Why do you want to join?",
                answer:
                  "I want to build and ship production-grade software with AI mentorship from week one."
              }
            ]
          }
        }
      });
    }
  }

  // Seed one ACCEPTED application so the applicant dashboard has demo data out of the box.
  const acceptedApplicant = await prisma.user.findUnique({
    where: { email: "accepted@demo.talentos.local" }
  });

  if (acceptedApplicant) {
    const existingAcceptedApplication = await prisma.application.findFirst({
      where: { applicantId: acceptedApplicant.id, programId: program.id }
    });

    if (!existingAcceptedApplication) {
      await prisma.application.create({
        data: {
          tenantId: tenant.id,
          programId: program.id,
          applicantId: acceptedApplicant.id,
          status: "ACCEPTED",
          submittedAt: new Date(),
          reviewedAt: new Date(),
          reviewerNotes: "Accepted demo applicant for local dashboard validation.",
          answers: {
            create: [
              {
                questionKey: "motivation",
                questionLabel: "Why do you want to join?",
                answer:
                  "I want to use TalentOS to practice the full engineering lifecycle and build a public portfolio."
              }
            ]
          }
        }
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorUserId: superAdmin.id,
      action: "seed.initialized",
      entityType: "Tenant",
      entityId: tenant.id,
      metadata: { programId: program.id }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
