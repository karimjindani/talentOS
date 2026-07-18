-- Extend the existing dashboard task/resource models without removing legacy data.
CREATE TYPE "LearningResourceType" AS ENUM ('MARKDOWN', 'YOUTUBE');

ALTER TABLE "program_tasks"
  ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "video_resources"
  ADD COLUMN "taskId" TEXT,
  ADD COLUMN "type" "LearningResourceType" NOT NULL DEFAULT 'YOUTUBE',
  ADD COLUMN "markdownContent" TEXT,
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "durationSeconds" INTEGER,
  ALTER COLUMN "url" DROP NOT NULL;

-- Completion tenant ownership is derived unambiguously from the completed task.
ALTER TABLE "user_task_completions" ADD COLUMN "tenantId" TEXT;

UPDATE "user_task_completions" AS completion
SET "tenantId" = task."tenantId"
FROM "program_tasks" AS task
WHERE completion."taskId" = task."id";

ALTER TABLE "user_task_completions" ALTER COLUMN "tenantId" SET NOT NULL;

DROP INDEX "program_tasks_tenantId_programId_weekNumber_idx";
CREATE INDEX "program_tasks_tenantId_programId_weekNumber_published_order_idx"
  ON "program_tasks"("tenantId", "programId", "weekNumber", "published", "order");

CREATE INDEX "video_resources_tenantId_taskId_order_idx"
  ON "video_resources"("tenantId", "taskId", "order");

DROP INDEX "user_task_completions_taskId_userId_key";
DROP INDEX "user_task_completions_userId_idx";
CREATE UNIQUE INDEX "user_task_completions_tenantId_userId_taskId_key"
  ON "user_task_completions"("tenantId", "userId", "taskId");
CREATE INDEX "user_task_completions_tenantId_userId_idx"
  ON "user_task_completions"("tenantId", "userId");
CREATE INDEX "user_task_completions_tenantId_taskId_idx"
  ON "user_task_completions"("tenantId", "taskId");

ALTER TABLE "video_resources"
  ADD CONSTRAINT "video_resources_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "program_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_task_completions"
  ADD CONSTRAINT "user_task_completions_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
