CREATE TYPE "MissionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "missions"
  ADD COLUMN "status" "MissionStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "weekNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "objective" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "acceptanceCriteria" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "deliverables" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "evaluationCriteria" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "competencyTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "missions_tenantId_programId_status_idx" ON "missions"("tenantId", "programId", "status");
CREATE INDEX "missions_tenantId_status_idx" ON "missions"("tenantId", "status");
