-- Link submissions and Engineering Journal entries to assignment attempts without guessing
-- ambiguous legacy relationships. Existing assignment rows become Attempt 1.

ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'REPEAT';

CREATE TYPE "MissionAssignmentStatus" AS ENUM ('ACTIVE', 'SUBMITTED', 'PASSED', 'REPEAT');

ALTER TABLE "mission_assignments"
ADD COLUMN "attemptNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "status" "MissionAssignmentStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "submissions"
ADD COLUMN "missionAssignmentId" TEXT;

ALTER TABLE "engineering_journal_entries"
ADD COLUMN "missionAssignmentId" TEXT,
ADD COLUMN "lockedAt" TIMESTAMP(3);

-- Backfill only when tenant + applicant + mission identifies exactly one assignment.
UPDATE "submissions" AS submission
SET "missionAssignmentId" = match."missionAssignmentId"
FROM (
  SELECT candidate."submissionId", MIN(candidate."missionAssignmentId") AS "missionAssignmentId"
  FROM (
    SELECT submission_row."id" AS "submissionId", assignment."id" AS "missionAssignmentId"
    FROM "submissions" AS submission_row
    JOIN "mission_assignments" AS assignment
      ON assignment."tenantId" = submission_row."tenantId"
     AND assignment."applicantId" = submission_row."applicantId"
     AND assignment."missionId" = submission_row."missionId"
  ) AS candidate
  GROUP BY candidate."submissionId"
  HAVING COUNT(*) = 1
) AS match
WHERE submission."id" = match."submissionId";

UPDATE "engineering_journal_entries" AS journal
SET "missionAssignmentId" = match."missionAssignmentId"
FROM (
  SELECT candidate."journalId", MIN(candidate."missionAssignmentId") AS "missionAssignmentId"
  FROM (
    SELECT journal_row."id" AS "journalId", assignment."id" AS "missionAssignmentId"
    FROM "engineering_journal_entries" AS journal_row
    JOIN "mission_assignments" AS assignment
      ON assignment."tenantId" = journal_row."tenantId"
     AND assignment."applicantId" = journal_row."applicantId"
     AND assignment."missionId" = journal_row."missionId"
     AND assignment."weekNumber" = journal_row."weekNumber"
  ) AS candidate
  GROUP BY candidate."journalId"
  HAVING COUNT(*) = 1
) AS match
WHERE journal."id" = match."journalId";

-- Preserve the existing post-submission read-only behavior as persisted lock timestamps.
UPDATE "engineering_journal_entries" AS journal
SET "lockedAt" = COALESCE(submission."submittedAt", submission."updatedAt")
FROM "submissions" AS submission
WHERE journal."missionAssignmentId" = submission."missionAssignmentId"
  AND (
    submission."submittedAt" IS NOT NULL
    OR submission."status" IN ('SUBMITTED', 'REVIEWED', 'NEEDS_REVISION', 'ACCEPTED')
  );

UPDATE "mission_assignments" AS assignment
SET "status" = CASE
  WHEN EXISTS (
    SELECT 1 FROM "submissions" AS submission
    WHERE submission."missionAssignmentId" = assignment."id"
      AND submission."status" = 'ACCEPTED'
  ) THEN 'PASSED'::"MissionAssignmentStatus"
  WHEN EXISTS (
    SELECT 1 FROM "submissions" AS submission
    WHERE submission."missionAssignmentId" = assignment."id"
      AND submission."status" IN ('SUBMITTED', 'REVIEWED')
  ) THEN 'SUBMITTED'::"MissionAssignmentStatus"
  ELSE 'ACTIVE'::"MissionAssignmentStatus"
END;

DROP INDEX "mission_assignments_tenantId_programId_applicantId_weekNumber_k";

DROP INDEX "submissions_missionId_applicantId_key";

CREATE UNIQUE INDEX "mission_assignment_attempt_key"
ON "mission_assignments"("tenantId", "programId", "applicantId", "weekNumber", "attemptNumber");

CREATE UNIQUE INDEX "submission_assignment_key"
ON "submissions"("missionAssignmentId");

CREATE INDEX "engineering_journal_entries_missionAssignmentId_entryDate_idx"
ON "engineering_journal_entries"("missionAssignmentId", "entryDate");

ALTER TABLE "submissions"
ADD CONSTRAINT "submissions_missionAssignmentId_fkey"
FOREIGN KEY ("missionAssignmentId") REFERENCES "mission_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "engineering_journal_entries"
ADD CONSTRAINT "engineering_journal_entries_missionAssignmentId_fkey"
FOREIGN KEY ("missionAssignmentId") REFERENCES "mission_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
