/**
 * Seed script for applicant dashboard demo data.
 * Run with: npx tsx scripts/seed-dashboard.ts
 *
 * Creates ProgramTasks, VideoResources, CalendarEvents, and Notifications
 * for the first PUBLISHED program and its ACCEPTED applicants.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../packages/db/src/client";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const weekOneTaskContentDir = join(
  scriptDir,
  "..",
  "packages",
  "db",
  "prisma",
  "seed-data",
  "tasks",
  "ai-native-engineering",
  "week-1"
);

async function main() {
  // Find the first published program with an accepted application
  const acceptedApp = await prisma.application.findFirst({
    where: { status: "ACCEPTED" },
    include: { program: true, tenant: true, applicant: true },
  });

  if (!acceptedApp) {
    console.log("No accepted application found. Please create one first.");
    return;
  }

  const { program, tenant, applicant } = acceptedApp;
  console.log(`Seeding dashboard data for program: ${program.name} (${program.id})`);
  console.log(`Tenant: ${tenant.name} | Applicant: ${applicant.email}`);

  // --- Required Week 1 tasks ---
  const taskDefs = [
    {
      aliases: ["Environment Setup"],
      weekNumber: 1,
      order: 1,
      title: "Environment Setup",
      description: "Install the required tools, clone TalentOS, run it locally, and confirm the Applicant Portal works.",
      dueAt: addDays(program.startsAt, 3)
    },
    {
      aliases: ["Git & GitHub Basics", "Git and GitHub Basics"],
      weekNumber: 1,
      order: 2,
      title: "Git and GitHub Basics",
      description: "Practice safe branching, status, staging, commits, pulling, pushing, and pull-request collaboration.",
      dueAt: addDays(program.startsAt, 5)
    },
    {
      aliases: ["Intro to AI-Assisted Coding", "Introduction to AI-Assisted Coding"],
      weekNumber: 1,
      order: 3,
      title: "Introduction to AI-Assisted Coding",
      description: "Use AI for planning, implementation, testing, debugging, and documentation while reviewing its output.",
      dueAt: addDays(program.startsAt, 7)
    }
  ];

  const seededTasks = new Map<string, { id: string; weekNumber: number }>();
  for (const task of taskDefs) {
    const existing = await prisma.programTask.findFirst({
      where: {
        tenantId: tenant.id,
        programId: program.id,
        weekNumber: task.weekNumber,
        title: { in: task.aliases }
      }
    });
    const { aliases: _aliases, ...taskData } = task;
    const saved = existing
      ? await prisma.programTask.update({
          where: { id: existing.id },
          data: { ...taskData, required: true, published: true }
        })
      : await prisma.programTask.create({
          data: {
            tenantId: tenant.id,
            programId: program.id,
            ...taskData,
            required: true,
            published: true
          }
        });
    seededTasks.set(task.title, { id: saved.id, weekNumber: saved.weekNumber });
  }
  console.log(`Upserted ${taskDefs.length} program tasks`);

  // Previous dashboard demo data used a fake YouTube URL. Remove only those known placeholders.
  await prisma.videoResource.deleteMany({
    where: { tenantId: tenant.id, programId: program.id, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
  });

  // --- Task-linked Markdown and YouTube resources ---
  const resourceDefs = [
    resourcePair(
      "Environment Setup",
      "Introduction to TalentOS",
      "introduction-to-talentos.md",
      "A three-minute TalentOS introduction. Final YouTube URL pending."
    ),
    resourcePair(
      "Git and GitHub Basics",
      "Git and GitHub Basics",
      "git-and-github-basics.md",
      "A short Git collaboration walkthrough. Final YouTube URL pending."
    ),
    resourcePair(
      "Introduction to AI-Assisted Coding",
      "Introduction to AI-Assisted Coding",
      "ai-assisted-coding.md",
      "A short responsible AI-assisted engineering walkthrough. Final YouTube URL pending."
    )
  ].flat();

  for (const resource of resourceDefs) {
    const task = seededTasks.get(resource.taskTitle);
    if (!task) throw new Error(`Seeded task was not found: ${resource.taskTitle}`);
    const existing = await prisma.videoResource.findFirst({
      where: {
        tenantId: tenant.id,
        programId: program.id,
        taskId: task.id,
        type: resource.type,
        title: resource.title
      }
    });
    const data = {
      tenantId: tenant.id,
      programId: program.id,
      taskId: task.id,
      weekNumber: task.weekNumber,
      type: resource.type,
      title: resource.title,
      url: resource.url,
      markdownContent: resource.markdownContent,
      description: resource.description,
      order: resource.order,
      durationSeconds: resource.durationSeconds
    };
    if (existing) {
      await prisma.videoResource.update({ where: { id: existing.id }, data });
    } else {
      await prisma.videoResource.create({ data });
    }
  }
  console.log(`Upserted ${resourceDefs.length} task learning resources`);

  // --- Calendar Events ---
  const eventDefs = [
    { title: "Week 1 Kickoff Call", description: "Welcome and program overview.", startsAt: addDays(program.startsAt, 0), endsAt: addDays(program.startsAt, 0, 60), location: "Zoom" },
    { title: "Week 2 Sync", description: "Progress check and Q&A.", startsAt: addDays(program.startsAt, 7), endsAt: addDays(program.startsAt, 7, 60), location: "Zoom" },
    { title: "Week 3 Sync", description: "Progress check and Q&A.", startsAt: addDays(program.startsAt, 14), endsAt: addDays(program.startsAt, 14, 60), location: "Zoom" },
    { title: "Week 4 Sync", description: "Final preparations.", startsAt: addDays(program.startsAt, 21), endsAt: addDays(program.startsAt, 21, 60), location: "Zoom" },
    { title: "Final Presentations", description: "Each participant presents their project.", startsAt: addDays(program.startsAt, 28), endsAt: addDays(program.startsAt, 28, 120), location: "Zoom" },
  ];

  for (const event of eventDefs) {
    const existing = await prisma.calendarEvent.findFirst({
      where: { tenantId: tenant.id, programId: program.id, title: event.title, startsAt: event.startsAt },
    });
    if (existing) {
      await prisma.calendarEvent.update({ where: { id: existing.id }, data: event });
    } else {
      await prisma.calendarEvent.create({ data: { tenantId: tenant.id, programId: program.id, ...event } });
    }
  }
  console.log(`Upserted ${eventDefs.length} calendar events`);

  // --- Notifications ---
  const notifDefs = [
    { type: "SUCCESS" as const, title: "Application Accepted!", body: `Congratulations! You've been accepted into ${program.name}.` },
    { type: "INFO" as const, title: "Welcome to Your Dashboard", body: "Explore your program progress, tasks, and resources here." },
    { type: "TASK_DUE" as const, title: "Task Due Soon", body: "Environment Setup is due in 3 days. Don't forget to complete it!" },
  ];

  for (const notif of notifDefs) {
    const existing = await prisma.notification.findFirst({
      where: { tenantId: tenant.id, userId: applicant.id, title: notif.title },
    });
    if (existing) {
      await prisma.notification.update({ where: { id: existing.id }, data: notif });
    } else {
      await prisma.notification.create({ data: { tenantId: tenant.id, userId: applicant.id, ...notif } });
    }
  }
  console.log(`Upserted ${notifDefs.length} notifications`);

  console.log("\n✅ Seed complete!");
}

function resourcePair(taskTitle: string, title: string, markdownFile: string, videoDescription: string) {
  return [
    {
      taskTitle,
      type: "MARKDOWN" as const,
      title,
      url: null,
      markdownContent: readFileSync(join(weekOneTaskContentDir, markdownFile), "utf8"),
      description: `Required reading for ${taskTitle}.`,
      order: 1,
      durationSeconds: null
    },
    {
      taskTitle,
      type: "YOUTUBE" as const,
      title,
      url: null,
      markdownContent: null,
      description: videoDescription,
      order: 2,
      durationSeconds: 180
    }
  ];
}

function addDays(base: Date | null, days: number, minutes = 0): Date {
  const d = base ? new Date(base) : new Date();
  d.setDate(d.getDate() + days);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
