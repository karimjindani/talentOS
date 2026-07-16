-- Explicit mission-accept step, per-mission deadline + grace period, week auto-advance, and
-- reject-to-alternate-mission program outcomes.

-- New Application outcomes used by the deadline sweep and the reject-with-no-alternate path.
ALTER TYPE "ApplicationStatus" ADD VALUE 'DISQUALIFIED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'AWAITING_MISSION_ASSIGNMENT';

-- Per-mission timing config. Defaults (7-day deadline, 24h grace) apply to every existing mission,
-- since none had timing configured before this migration.
ALTER TABLE "missions"
ADD COLUMN "deadlineHours" INTEGER NOT NULL DEFAULT 168,
ADD COLUMN "gracePeriodHours" INTEGER NOT NULL DEFAULT 24;

-- Mission assignments now track the full applicant-facing lifecycle instead of the old
-- ACTIVE/SUBMITTED/PASSED/REPEAT set. The old and new enums don't share every value, so existing
-- rows are remapped into a scratch text column before the column is retyped.
ALTER TABLE "mission_assignments" ADD COLUMN "status_text" TEXT;

UPDATE "mission_assignments" AS assignment
SET "status_text" = CASE
  WHEN assignment."status" = 'PASSED' THEN 'PASSED'
  WHEN assignment."status" = 'REPEAT' THEN 'REPEAT'
  WHEN assignment."status" = 'SUBMITTED' THEN 'PENDING_EVALUATION'
  WHEN assignment."status" = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM "submissions" AS submission
    WHERE submission."missionAssignmentId" = assignment."id"
      AND submission."status" = 'DRAFT'
  ) THEN 'IN_PROGRESS'
  ELSE 'ACCEPTED'
END;

CREATE TYPE "MissionAssignmentStatus_new" AS ENUM (
  'NOT_STARTED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_EVALUATION', 'LATE_SUBMITTED', 'OVERDUE', 'FAILED', 'PASSED', 'REPEAT'
);

ALTER TABLE "mission_assignments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "mission_assignments" ALTER COLUMN "status" TYPE "MissionAssignmentStatus_new"
  USING ("status_text"::"MissionAssignmentStatus_new");
ALTER TYPE "MissionAssignmentStatus" RENAME TO "MissionAssignmentStatus_old";
ALTER TYPE "MissionAssignmentStatus_new" RENAME TO "MissionAssignmentStatus";
DROP TYPE "MissionAssignmentStatus_old";
ALTER TABLE "mission_assignments" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';
ALTER TABLE "mission_assignments" DROP COLUMN "status_text";

-- Applicant-facing timing on each assignment attempt. Every pre-existing row is treated as already
-- "accepted" at assignedAt — the explicit accept step, and the deadline it starts, is new behavior
-- going forward only; this backfill just keeps the fields consistent with what already happened.
ALTER TABLE "mission_assignments"
ADD COLUMN "acceptedAt" TIMESTAMP(3),
ADD COLUMN "deadlineAt" TIMESTAMP(3),
ADD COLUMN "graceEndsAt" TIMESTAMP(3);

UPDATE "mission_assignments" AS assignment
SET
  "acceptedAt" = assignment."assignedAt",
  "deadlineAt" = assignment."assignedAt" + (mission."deadlineHours" || ' hours')::INTERVAL,
  "graceEndsAt" = assignment."assignedAt"
    + (mission."deadlineHours" || ' hours')::INTERVAL
    + (mission."gracePeriodHours" || ' hours')::INTERVAL
FROM "missions" AS mission
WHERE mission."id" = assignment."missionId";
