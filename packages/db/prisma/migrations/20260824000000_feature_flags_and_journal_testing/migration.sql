-- v0.20.8: Feature flags table + drop the one-entry-per-mission-per-date DB constraint so the
-- Ops console's `journal.testing_mode` flag can relax it for local testing. Production integrity is
-- now enforced by the app-layer assertEntryDateAvailable check in packages/db/src/journal.ts.

-- DropIndex
DROP INDEX "engineering_journal_entries_tenantId_applicantId_missionId_entryDate_key";

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");
