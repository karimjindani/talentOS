-- Mission-scoped program tasks (v0.20.0).
--
-- ProgramTask moves from (tenant, program, week) to (tenant, program, mission). Admins author tasks
-- under a specific mission and applicants only ever see the tasks for the mission they were
-- assigned. weekNumber is retained, denormalized from the mission, for the existing week-ordered
-- queries and indexes.

-- 1. Add the column nullable so existing rows can be backfilled before the NOT NULL constraint.
ALTER TABLE "program_tasks" ADD COLUMN "missionId" TEXT;

-- 2. Backfill: attach each existing week-scoped task to the first mission of the same
--    tenant/program/week, matching the order applicants already saw them in.
UPDATE "program_tasks" t
SET "missionId" = (
  SELECT m."id"
  FROM "missions" m
  WHERE m."tenantId" = t."tenantId"
    AND m."programId" = t."programId"
    AND m."weekNumber" = t."weekNumber"
  ORDER BY m."order" ASC, m."title" ASC
  LIMIT 1
)
WHERE t."missionId" IS NULL;

-- 3. A task whose week has no mission at all cannot be mission-scoped and has nothing to attach to.
--    Its learning resources cascade with it (VideoResource.taskId is ON DELETE CASCADE).
DELETE FROM "program_tasks" WHERE "missionId" IS NULL;

-- 4. Enforce the new model.
ALTER TABLE "program_tasks" ALTER COLUMN "missionId" SET NOT NULL;

ALTER TABLE "program_tasks"
  ADD CONSTRAINT "program_tasks_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "program_tasks_tenantId_missionId_published_order_idx"
  ON "program_tasks"("tenantId", "missionId", "published", "order");
