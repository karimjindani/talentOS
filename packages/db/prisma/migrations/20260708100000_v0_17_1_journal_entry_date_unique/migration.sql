-- Engineering Journal date rule: one entry per applicant per calendar date.

UPDATE "engineering_journal_entries"
SET "entryDate" = date_trunc('day', "entryDate");

CREATE UNIQUE INDEX "engineering_journal_entries_tenantId_applicantId_entryDate_key"
ON "engineering_journal_entries"("tenantId", "applicantId", "entryDate");

DROP INDEX IF EXISTS "engineering_journal_entries_tenantId_applicantId_entryDate_idx";
