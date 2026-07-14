-- Mission-driven tasks: a per-mission tutorial link and per-assignment completion tracking for the
-- fixed 3-task template (Task 3 is implied complete by the linked Submission, so it has no row here).

ALTER TABLE "missions" ADD COLUMN     "tutorialUrl" TEXT;

CREATE TABLE "mission_task_completions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "missionAssignmentId" TEXT NOT NULL,
    "taskIndex" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_task_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mission_task_completion_key" ON "mission_task_completions"("missionAssignmentId", "taskIndex");

ALTER TABLE "mission_task_completions" ADD CONSTRAINT "mission_task_completions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mission_task_completions" ADD CONSTRAINT "mission_task_completions_missionAssignmentId_fkey" FOREIGN KEY ("missionAssignmentId") REFERENCES "mission_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
