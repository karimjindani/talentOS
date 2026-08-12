-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('ACCEPTED', 'CHANGES_REQUESTED', 'REPEAT');

-- CreateEnum
CREATE TYPE "ReviewOutcome" AS ENUM ('ACCEPTED_FIRST_TIME', 'ACCEPTED_AFTER_CHANGES', 'CHANGES_REQUESTED', 'REPEATED');

-- AlterTable
ALTER TABLE "mission_assignments" ADD COLUMN     "reviewOutcome" "ReviewOutcome",
ADD COLUMN     "revisionCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "submission_reviews" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "missionAssignmentId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "feedback" TEXT,
    "reviewerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submission_reviews_tenantId_weekNumber_idx" ON "submission_reviews"("tenantId", "weekNumber");

-- CreateIndex
CREATE INDEX "submission_reviews_submissionId_idx" ON "submission_reviews"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "submission_review_round_key" ON "submission_reviews"("missionAssignmentId", "round");

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_missionAssignmentId_fkey" FOREIGN KEY ("missionAssignmentId") REFERENCES "mission_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Backfill (v0.20.0)
--
-- Every review decision was already written to audit_logs as "submission.reviewed" with the decided
-- status, the actor and a timestamp, so the full round-by-round history is recoverable even though
-- the submissions table only ever kept the latest one.
--
-- Feedback text is the one thing audit_logs never stored: only the most recent reviewerFeedback
-- survives on the submission row. It is therefore attached to the final round only; earlier rounds
-- backfill with NULL feedback rather than guessing.
-- ---------------------------------------------------------------------------
WITH reviewed AS (
    SELECT
        a."createdAt",
        a."actorUserId",
        a.metadata ->> 'status'          AS decided,
        s.id                              AS submission_id,
        s."reviewerFeedback"              AS latest_feedback,
        ma.id                             AS assignment_id,
        ma."weekNumber",
        ma."attemptNumber",
        ROW_NUMBER() OVER (PARTITION BY ma.id ORDER BY a."createdAt")      AS round,
        ROW_NUMBER() OVER (PARTITION BY ma.id ORDER BY a."createdAt" DESC) AS round_desc
    FROM audit_logs a
    JOIN submissions s          ON s.id = a."entityId"
    JOIN mission_assignments ma ON ma.id = s."missionAssignmentId"
    WHERE a.action = 'submission.reviewed'
      AND a.metadata ->> 'status' IN ('ACCEPTED', 'NEEDS_REVISION', 'REPEAT')
)
INSERT INTO "submission_reviews" (
    "id", "tenantId", "submissionId", "missionAssignmentId",
    "weekNumber", "attemptNumber", "round", "decision", "feedback", "reviewerUserId", "createdAt"
)
SELECT
    'bf_' || md5(r.assignment_id || ':' || r.round::text),
    (SELECT "tenantId" FROM submissions WHERE id = r.submission_id),
    r.submission_id,
    r.assignment_id,
    r."weekNumber",
    r."attemptNumber",
    r.round,
    CASE r.decided
        WHEN 'ACCEPTED'       THEN 'ACCEPTED'::"ReviewDecision"
        WHEN 'NEEDS_REVISION' THEN 'CHANGES_REQUESTED'::"ReviewDecision"
        ELSE                       'REPEAT'::"ReviewDecision"
    END,
    CASE WHEN r.round_desc = 1 THEN r.latest_feedback ELSE NULL END,
    r."actorUserId",
    r."createdAt"
FROM reviewed r
ON CONFLICT ("missionAssignmentId", "round") DO NOTHING;

-- Roll the reconstructed history up onto the assignment.
UPDATE "mission_assignments" ma
SET "revisionCount" = agg.revisions,
    "reviewOutcome" = CASE agg.last_decision
        WHEN 'REPEAT'            THEN 'REPEATED'::"ReviewOutcome"
        WHEN 'CHANGES_REQUESTED' THEN 'CHANGES_REQUESTED'::"ReviewOutcome"
        ELSE CASE WHEN agg.revisions = 0
                  THEN 'ACCEPTED_FIRST_TIME'::"ReviewOutcome"
                  ELSE 'ACCEPTED_AFTER_CHANGES'::"ReviewOutcome" END
    END
FROM (
    SELECT
        sr."missionAssignmentId" AS assignment_id,
        COUNT(*) FILTER (WHERE sr.decision = 'CHANGES_REQUESTED')::int AS revisions,
        (ARRAY_AGG(sr.decision ORDER BY sr.round DESC))[1]             AS last_decision
    FROM "submission_reviews" sr
    GROUP BY sr."missionAssignmentId"
) agg
WHERE ma.id = agg.assignment_id;
