/**
 * Seed script for applicant dashboard demo data.
 * Run with: npx tsx scripts/seed-dashboard.ts
 *
 * Creates ProgramTasks, VideoResources, CalendarEvents, and Notifications
 * for the first PUBLISHED program and its ACCEPTED applicants.
 */
import { prisma } from "../packages/db/src/client";

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

  // --- Program Tasks (4 weeks, 2-3 tasks each) ---
  const taskDefs = [
    // Week 1
    { weekNumber: 1, order: 0, title: "Environment Setup", description: "Set up your development environment with Node.js, Docker, and VS Code.", dueAt: addDays(program.startsAt, 3) },
    { weekNumber: 1, order: 1, title: "Git & GitHub Basics", description: "Complete the Git fundamentals tutorial and push your first repository.", dueAt: addDays(program.startsAt, 5) },
    { weekNumber: 1, order: 2, title: "Intro to AI-Assisted Coding", description: "Watch the intro video and submit a reflection on AI coding tools.", dueAt: addDays(program.startsAt, 7) },
    // Week 2
    { weekNumber: 2, order: 0, title: "Build a REST API", description: "Create a simple REST API with Express and CRUD operations.", dueAt: addDays(program.startsAt, 10) },
    { weekNumber: 2, order: 1, title: "Database Integration", description: "Connect your API to PostgreSQL and implement data persistence.", dueAt: addDays(program.startsAt, 14) },
    // Week 3
    { weekNumber: 3, order: 0, title: "Frontend Integration", description: "Build a React frontend that consumes your REST API.", dueAt: addDays(program.startsAt, 17) },
    { weekNumber: 3, order: 1, title: "Authentication & Authorization", description: "Implement JWT-based auth in your application.", dueAt: addDays(program.startsAt, 21) },
    // Week 4
    { weekNumber: 4, order: 0, title: "Deployment to Cloud", description: "Deploy your full-stack app to a cloud provider.", dueAt: addDays(program.startsAt, 24) },
    { weekNumber: 4, order: 1, title: "Final Presentation", description: "Prepare and deliver a 10-minute presentation of your project.", dueAt: addDays(program.startsAt, 28) },
  ];

  for (const task of taskDefs) {
    const existing = await prisma.programTask.findFirst({
      where: { tenantId: tenant.id, programId: program.id, weekNumber: task.weekNumber, title: task.title },
    });
    if (existing) {
      await prisma.programTask.update({ where: { id: existing.id }, data: task });
    } else {
      await prisma.programTask.create({ data: { tenantId: tenant.id, programId: program.id, ...task } });
    }
  }
  console.log(`Upserted ${taskDefs.length} program tasks`);

  // --- Video Resources ---
  const videoDefs = [
    { weekNumber: 1, title: "Welcome & Program Overview", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", description: "Welcome message from your program lead." },
    { weekNumber: 1, title: "Dev Environment Setup Guide", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", description: "Step-by-step environment setup." },
    { weekNumber: 2, title: "REST API Best Practices", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", description: "Learn REST API design principles." },
    { weekNumber: 3, title: "React + API Integration", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", description: "Connecting React to your backend." },
    { weekNumber: 4, title: "Cloud Deployment Walkthrough", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", description: "Deploy your app step by step." },
  ];

  for (const video of videoDefs) {
    const existing = await prisma.videoResource.findFirst({
      where: { tenantId: tenant.id, programId: program.id, title: video.title, url: video.url },
    });
    if (existing) {
      await prisma.videoResource.update({ where: { id: existing.id }, data: video });
    } else {
      await prisma.videoResource.create({ data: { tenantId: tenant.id, programId: program.id, ...video } });
    }
  }
  console.log(`Upserted ${videoDefs.length} video resources`);

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
