import { cleanupRegressionData, prisma } from "@talentos/db";

const runId = process.argv[2];

cleanupRegressionData(runId)
  .then(async (summary) => {
    console.log(JSON.stringify(summary, null, 2));
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
