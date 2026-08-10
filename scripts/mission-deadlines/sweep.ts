import { prisma, sweepMissionDeadlines } from "@talentos/db";

// Intended to be invoked by an external scheduler (cron / OS task scheduler), not the app process
// — run on whatever cadence the deadline granularity warrants (e.g. every few minutes). Safe to
// run concurrently or re-run after a failure: sweepMissionDeadlines is idempotent.
sweepMissionDeadlines()
  .then(async (result) => {
    console.log(JSON.stringify(result, null, 2));
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
