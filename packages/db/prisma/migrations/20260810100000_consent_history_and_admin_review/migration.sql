-- Create enums
CREATE TYPE "ConsentStatus" AS ENUM ('ACKNOWLEDGED', 'DECLINED', 'SKIPPED');
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED');

-- Add consentStatus to graduate_profiles
ALTER TABLE "graduate_profiles" ADD COLUMN "consentStatus" "ConsentStatus";

-- Add admin review fields to recruiter_access_requests
ALTER TABLE "recruiter_access_requests" ADD COLUMN "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "recruiter_access_requests" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "recruiter_access_requests" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "recruiter_access_requests" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "recruiter_access_requests" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "recruiter_access_requests" ADD COLUMN "revokedById" TEXT;

-- Create consent_history table
CREATE TABLE "consent_history" (
    "id" TEXT NOT NULL,
    "graduateProfileId" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "action" VARCHAR(500) NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_history_pkey" PRIMARY KEY ("id")
);

-- Foreign key for consent_history
ALTER TABLE "consent_history" ADD CONSTRAINT "consent_history_graduateProfileId_fkey"
    FOREIGN KEY ("graduateProfileId") REFERENCES "graduate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "consent_history_graduateProfileId_idx" ON "consent_history"("graduateProfileId");
CREATE INDEX "consent_history_createdAt_idx" ON "consent_history"("createdAt");
CREATE INDEX "recruiter_access_requests_status_idx" ON "recruiter_access_requests"("status");
CREATE INDEX "recruiter_access_requests_reviewedById_idx" ON "recruiter_access_requests"("reviewedById");
