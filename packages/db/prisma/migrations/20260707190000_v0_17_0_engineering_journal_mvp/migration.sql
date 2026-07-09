-- Engineering Journal MVP: dedicated daily reflection entries plus applicant language preference.

ALTER TABLE "users"
ADD COLUMN "preferredJournalLanguage" TEXT NOT NULL DEFAULT 'English';

CREATE TABLE "engineering_journal_entries" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "weekNumber" INTEGER NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL,
  "language" TEXT NOT NULL,
  "workedOn" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "solution" TEXT NOT NULL,
  "learned" TEXT NOT NULL,
  "aiUsage" TEXT NOT NULL,
  "confidenceRating" INTEGER NOT NULL,
  "timeSpentHours" DOUBLE PRECISION NOT NULL,
  "evidenceLinks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reflectionDepthScore" INTEGER,
  "problemSolvingScore" INTEGER,
  "learningQualityScore" INTEGER,
  "communicationClarityScore" INTEGER,
  "consistencyScore" INTEGER,
  "totalScore" INTEGER,
  "aiReviewFeedback" TEXT,
  "aiReviewedAt" TIMESTAMP(3),
  "aiReviewMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "engineering_journal_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "engineering_journal_entries_tenantId_applicantId_entryDate_idx"
ON "engineering_journal_entries"("tenantId", "applicantId", "entryDate");

CREATE INDEX "engineering_journal_entries_tenantId_programId_weekNumber_idx"
ON "engineering_journal_entries"("tenantId", "programId", "weekNumber");

CREATE INDEX "engineering_journal_entries_missionId_idx"
ON "engineering_journal_entries"("missionId");

ALTER TABLE "engineering_journal_entries"
ADD CONSTRAINT "engineering_journal_entries_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "engineering_journal_entries"
ADD CONSTRAINT "engineering_journal_entries_applicantId_fkey"
FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "engineering_journal_entries"
ADD CONSTRAINT "engineering_journal_entries_programId_fkey"
FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "engineering_journal_entries"
ADD CONSTRAINT "engineering_journal_entries_missionId_fkey"
FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
