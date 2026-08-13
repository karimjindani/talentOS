-- Engineering Journal date rule: one entry per applicant per mission per calendar date.
-- Previously: one entry per applicant per calendar date (regardless of mission).
-- Now: applicants can write separate entries for different missions on the same day.

-- Drop the old unique index (applicant + date only)
DROP INDEX IF EXISTS "engineering_journal_entries_tenantId_applicantId_entryDate_key";

-- Create the new unique index (applicant + mission + date)
CREATE UNIQUE INDEX "engineering_journal_entries_tenantId_applicantId_missionId_entryDate_key"
ON "engineering_journal_entries"("tenantId", "applicantId", "missionId", "entryDate");
