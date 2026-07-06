-- v0.15.0 Mission Submission Workflow (D-067)

-- Cleanup: the init migration's 2-column missions index was superseded by the 3-column
-- (tenantId, programId, status) index in v0.14.0 but never dropped.
DROP INDEX "missions_tenantId_programId_idx";

-- AlterTable: review fields + direct tenant scoping for submissions.
ALTER TABLE "submissions"
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewerFeedback" TEXT,
  ADD COLUMN "reviewerUserId" TEXT,
  ADD COLUMN "tenantId" TEXT;

-- Backfill tenantId from the parent mission. The table is expected to be empty (the Submission
-- model was unused v0.14.0 scaffolding), but backfill defensively before tightening the column.
UPDATE "submissions" s
SET "tenantId" = m."tenantId"
FROM "missions" m
WHERE s."missionId" = m."id" AND s."tenantId" IS NULL;

ALTER TABLE "submissions" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "submissions_tenantId_status_idx" ON "submissions"("tenantId", "status");

-- One submission row per applicant per mission; the SEM revision loop reuses the row.
CREATE UNIQUE INDEX "submissions_missionId_applicantId_key" ON "submissions"("missionId", "applicantId");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
