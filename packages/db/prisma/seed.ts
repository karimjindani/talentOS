import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, type MissionDifficulty, type TenantRole } from "@prisma/client";
import { assignWeekMissionToAcceptedApplicantTx } from "../src/mission-assignments";

const prisma = new PrismaClient();
const seedDir = dirname(fileURLToPath(import.meta.url));

/**
 * Four-week mission arc (docs/curriculum.md, docs/SEM.md, docs/vision.md).
 *
 * One continuous product (TaskPilot) is taken from idea to production across four
 * missions. Every mission runs the full 10-step SEM lifecycle; only complexity
 * increases week over week. Deployment progression follows the vision roadmap:
 * static hosting → full-stack hosting → Docker + CI/CD → VPS with reverse proxy/SSL.
 * Competency tags use the names in docs/Competency_Framework.md.
 */
type MissionSeed = {
  id: string;
  title: string;
  difficulty: MissionDifficulty;
  weekNumber: number;
  order: number;
  objective: string;
  brief: string;
  deliverables: string;
  acceptanceCriteria: string;
  evaluationCriteria: string;
  competencyTags: string[];
};

const weekOneMissionSpecs: { id: string; specFile: string; order: number }[] = [
  {
    id: "seed-mission-week-1-landing-page",
    specFile: "taskpilot-landing-page.md",
    order: 1
  },
  {
    id: "seed-mission-week-1-bugbrief-status-page",
    specFile: "bugbrief-status-page.md",
    order: 2
  },
  {
    id: "seed-mission-week-1-careercraft-profile",
    specFile: "careercraft-profile-page.md",
    order: 3
  },
  {
    id: "seed-mission-week-1-launchlist-waitlist",
    specFile: "launchlist-waitlist-page.md",
    order: 4
  },
];

function loadWeekOneMissionSeed({ id, specFile, order }: { id: string; specFile: string; order: number }): MissionSeed {
  const markdown = readFileSync(join(seedDir, "seed-data", "missions", "ai-native-engineering", "week-1", specFile), "utf8");

  return {
    id,
    title: extractTitle(markdown),
    difficulty: "BEGINNER",
    weekNumber: 1,
    order,
    objective: extractSection(markdown, "Objective"),
    brief: extractSection(markdown, "Mission Brief"),
    deliverables: extractSection(markdown, "Deliverables"),
    acceptanceCriteria: extractSection(markdown, "Acceptance Criteria"),
    evaluationCriteria: extractSection(markdown, "Evaluation Criteria"),
    competencyTags: extractListSection(markdown, "Competency Tags")
  };
}

function extractTitle(markdown: string): string {
  const title = markdown
    .split(/\r?\n/)
    .find((line) => line.startsWith("# "))
    ?.replace(/^#\s+/, "")
    .trim();
  if (!title) {
    throw new Error("Mission spec is missing a level-1 title.");
  }
  return title;
}

function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) {
    throw new Error(`Mission spec is missing ## ${heading}.`);
  }
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join("\n")
    .trim();
}

function extractListSection(markdown: string, heading: string): string[] {
  return extractSection(markdown, heading)
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^-\s+/, ""))
    .filter(Boolean);
}

const missionSeeds: MissionSeed[] = [
  ...weekOneMissionSpecs.map(loadWeekOneMissionSeed),
  {
    id: "seed-mission-week-2-taskpilot-app",
    title: "Design and Build the TaskPilot Application",
    difficulty: "INTERMEDIATE",
    weekNumber: 2,
    order: 2,
    objective:
      "Design the system before you build it, then ship a deployed full-stack TaskPilot MVP backed by an API and a database.",
    brief: `TaskPilot's founders loved your landing page and interest signups are arriving. The client now wants the real product: a working web application where a small team can plan and track tasks. This week the theme is "Can you design before you build?" — no application code before the architecture document, ERD and API specification exist.

Business context:
TaskPilot is an AI-assisted task planning tool for small teams. The MVP must let a team member:
- Create a task with a title, description, priority and due date
- Assign a task to a team member
- Move a task between states (to do, in progress, done)
- See all of the team's tasks in one list or board

You are expected to use AI tools throughout, and to document how AI helped and which design decisions you made independently.

SEM lifecycle:
1. Discover: write clarification questions about team workflows, roles and data ownership.
2. Analyze: identify the entities, relationships and core user journeys behind the MVP.
3. Specify: update the PRD with user stories and acceptance criteria for every MVP feature.
4. Design: produce an architecture document with a component diagram, an ERD and an API specification.
5. Build: implement the frontend, the CRUD API and the database according to your design.
6. Test: derive test cases from your acceptance criteria, execute them, and start a regression test list.
7. Deploy: host the full stack (frontend, backend and database) on a public URL.
8. Present: record a 3-5 minute Loom walking through the design artifacts and the working product.
9. Reflect: journal on where your design survived contact with the build and where it did not.
10. Production Readiness Review: assess data integrity, error handling and responsive UX.`,
    deliverables: `- Updated deployed application (full stack)
- Updated PRD with user stories and acceptance criteria
- Architecture document with component diagram
- ERD
- API specification
- Test cases and execution results
- Regression test list
- Deployment evidence
- GitHub repository URL
- Loom demo video
- Engineering journal entry
- AI usage disclosure`,
    acceptanceCriteria: `- The architecture document, ERD and API specification exist and match the built system.
- Tasks can be created, assigned, updated, moved between states and listed.
- Data persists in a real database across restarts.
- The API follows the published API specification.
- The full stack is deployed and publicly reachable.
- Test cases trace back to acceptance criteria and include executed results.
- The UI is responsive on desktop and mobile.
- AI usage is documented transparently.`,
    evaluationCriteria: `Bronze: working deployed CRUD application with a database and README.
Silver: adds a coherent architecture document, ERD and API specification that match the implementation.
Gold: adds traceable test cases, a started regression list, clean commit history and a clear design-first Loom walkthrough.
Platinum: professional design documentation, thoughtful trade-off analysis, polished responsive UX and an honest production readiness assessment.`,
    competencyTags: [
      "Requirements Engineering",
      "Solution Design",
      "AI Collaboration",
      "Software Construction",
      "Quality Engineering",
      "Deployment & Operations",
      "Documentation",
      "Communication"
    ]
  },
  {
    id: "seed-mission-week-3-production-team",
    title: "Containerize, Automate and Load-Test TaskPilot",
    difficulty: "ADVANCED",
    weekNumber: 3,
    order: 3,
    objective:
      "Make TaskPilot operable like a production team would: containerized, continuously delivered, measured under load and threat-modeled.",
    brief: `TaskPilot is gaining users and the client is worried: will the application survive real traffic, and can changes ship safely? This week the theme is "Can your software survive real users?" — you industrialize last week's application without breaking it.

Business context:
The client is planning a public beta and requires:
- A reproducible runtime: the whole application starts with one Docker command
- A CI/CD pipeline that builds and tests every change automatically
- Evidence of how the system behaves under concurrent users
- An honest assessment of security threats and design mitigations

SEM lifecycle:
1. Discover: write clarification questions about expected traffic, availability and acceptable risk for the beta.
2. Analyze: profile the current application for likely bottlenecks and failure points.
3. Specify: define measurable performance targets (concurrent users, TPS, throughput, latency) and the pipeline stages.
4. Design: design the container topology, the CI/CD pipeline and a threat model of the deployed system.
5. Build: write the Dockerfile(s) and compose configuration, and implement the CI/CD pipeline.
6. Test: run load tests against the deployed application, capture TPS/throughput/latency, and keep the regression suite green.
7. Deploy: deploy through the pipeline and show logs and metrics from the running system.
8. Present: record a Loom demonstrating a pipeline run, the load test results and the monitoring evidence.
9. Reflect: journal on the trade-offs made under performance and security pressure.
10. Production Readiness Review: score the system against your own performance targets and threat model.`,
    deliverables: `- Dockerized application (Dockerfile and compose configuration)
- CI/CD pipeline configuration and a passing run
- Performance test report (concurrent users, TPS, throughput, latency)
- Threat model
- Monitoring evidence (logs and metrics)
- Updated regression test results
- GitHub repository URL
- Loom demo video
- Engineering journal entry
- AI usage disclosure`,
    acceptanceCriteria: `- The full application starts locally with a single documented Docker command.
- The CI/CD pipeline builds and tests every push and blocks on failure.
- The performance test report states targets and measured TPS, throughput and latency under concurrent users.
- The threat model identifies concrete threats and the design mitigation for each.
- Logs and metrics from the running deployment are captured as evidence.
- Previously delivered functionality still passes its regression tests.
- AI usage is documented transparently.`,
    evaluationCriteria: `Bronze: application runs in Docker and a pipeline builds it automatically.
Silver: adds executed load tests with recorded TPS/throughput/latency and a basic threat model.
Gold: adds monitoring evidence, a green regression suite in CI and mitigations traced from the threat model into the design.
Platinum: performance tuning informed by measurements, a defensible threat model, and a production-team-quality Loom that a technical lead would sign off on.`,
    competencyTags: [
      "Solution Design",
      "AI Collaboration",
      "Software Construction",
      "Quality Engineering",
      "Deployment & Operations",
      "Documentation",
      "Communication",
      "Engineering Leadership"
    ]
  },
  {
    id: "seed-mission-week-4-production-launch",
    title: "Take TaskPilot to Production",
    difficulty: "EXPERT",
    weekNumber: 4,
    order: 4,
    objective:
      "Deploy TaskPilot to real infrastructure, attack it before real attackers do, and defend a go/no-go recommendation.",
    brief: `The client is ready to launch TaskPilot and asks the question every engineer must answer: "Would you trust this in production?" This week you operate as the production engineer responsible for the launch.

Business context:
The launch requires:
- The Dockerized application running on VPS infrastructure behind a reverse proxy with SSL
- A vulnerability assessment and penetration test of the deployed system
- Documentation an operations team could run the product with
- A final portfolio proving every competency built over the four weeks

SEM lifecycle:
1. Discover: capture launch requirements and operational constraints; ask clarification questions about uptime, data protection and support expectations.
2. Analyze: perform a risk assessment across security, availability and operability.
3. Specify: define the release readiness checklist your launch will be judged against.
4. Design: design the production topology (VPS, reverse proxy, SSL, backups) and a rollback plan.
5. Build: provision, configure and harden the production environment.
6. Test: run a vulnerability assessment and penetration test (for example OWASP ZAP, Nuclei, dependency scanners) and remediate findings.
7. Deploy: serve TaskPilot on the production URL over HTTPS.
8. Present: deliver an executive-style Loom presentation and defend your technical decisions.
9. Reflect: write a final journal entry on your growth across the four weeks.
10. Production Readiness Review: run a formal review against your release readiness checklist and issue a go/no-go recommendation.`,
    deliverables: `- Production deployment on VPS infrastructure (HTTPS URL)
- VA/PT report with remediation evidence
- Deployment guide
- Operations guide / runbook
- Security guide
- Release readiness checklist and risk assessment
- Production Readiness Review with go/no-go recommendation
- Final portfolio covering all four weeks
- Executive Loom presentation
- Final engineering journal entry
- AI usage disclosure`,
    acceptanceCriteria: `- The application is served from VPS infrastructure behind a reverse proxy over valid SSL.
- The VA/PT report lists findings, severity and what was remediated or accepted.
- The deployment guide allows a third party to rebuild the environment from scratch.
- The operations guide covers routine operation, troubleshooting and rollback.
- The Production Readiness Review states an explicit, evidence-backed go/no-go recommendation.
- The final portfolio links all four weeks of repositories, deployments, documents and videos.
- All previously delivered functionality still works in production.
- AI usage is documented transparently.`,
    evaluationCriteria: `Bronze: application reachable on VPS infrastructure over HTTPS with a deployment guide.
Silver: adds an executed VA/PT report with remediations and an operations runbook.
Gold: adds a formal Production Readiness Review, complete security guide and a persuasive executive presentation.
Platinum: launch-grade operation end to end — traceable evidence for every claim, defensible risk decisions, and a portfolio a recruiter could hire from.`,
    competencyTags: [
      "Solution Design",
      "AI Collaboration",
      "Quality Engineering",
      "Deployment & Operations",
      "Documentation",
      "Communication",
      "Professionalism",
      "Production Readiness"
    ]
  }
];

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

  for (const missionSeed of missionSeeds) {
    const { id, ...missionData } = missionSeed;
    await prisma.mission.upsert({
      where: { id },
      update: {
        tenantId: tenant.id,
        programId: program.id,
        status: "PUBLISHED",
        ...missionData
      },
      create: {
        id,
        tenantId: tenant.id,
        programId: program.id,
        status: "PUBLISHED",
        ...missionData
      }
    });
  }

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

  await assignAcceptedApplicantsToWeekOne(tenant.id, program.id);

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

async function assignAcceptedApplicantsToWeekOne(tenantId: string, programId: string) {
  const acceptedApplications = await prisma.application.findMany({
    where: { tenantId, programId, status: "ACCEPTED" },
    select: { applicantId: true }
  });

  for (const application of acceptedApplications) {
    await prisma.$transaction((tx) =>
      assignWeekMissionToAcceptedApplicantTx(tx, {
        tenantId,
        programId,
        applicantId: application.applicantId
      })
    );
  }
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
