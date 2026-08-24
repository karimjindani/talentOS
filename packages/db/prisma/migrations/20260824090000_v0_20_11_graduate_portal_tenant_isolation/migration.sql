-- Tenant-isolate the public graduate portal and recruiter access grants. v0.20.11, D-110.
--
-- GraduateProfile had no tenantId at all; Program.tenantId only covers 57% of existing rows
-- (programId is null on decline/skip paths) so it is backfilled from the graduate's own most
-- recent Application.tenantId instead, matching the precedent already used in
-- apps/applicant/app/api/graduates/profile/photo/route.ts. Every existing GraduateProfile row has
-- at least one Application (verified against the local dataset before writing this migration).

-- AlterTable
ALTER TABLE "graduate_profiles" ADD COLUMN "tenantId" TEXT;

-- Backfill from the graduate's most recent Application.
UPDATE "graduate_profiles" gp
SET "tenantId" = (
  SELECT a."tenantId"
  FROM "applications" a
  WHERE a."applicantId" = gp."userId"
  ORDER BY a."createdAt" DESC
  LIMIT 1
);

-- AlterTable
ALTER TABLE "graduate_profiles" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "graduate_profiles_tenantId_idx" ON "graduate_profiles"("tenantId");

-- AddForeignKey
ALTER TABLE "graduate_profiles" ADD CONSTRAINT "graduate_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RecruiterAccessRequest.tenantId is denormalized from the target graduate's tenantId at creation
-- time, so recruiter access grants (recruiterHasActiveAccess / getAllAccessibleGraduates /
-- getFullProfileForRecruiter) can be scoped per tenant instead of granting access to every
-- tenant's published graduates. graduateId is never null, so the backfill join is unambiguous.

-- AlterTable
ALTER TABLE "recruiter_access_requests" ADD COLUMN "tenantId" TEXT;

-- Backfill from the linked graduate profile (now that graduate_profiles.tenantId is populated).
UPDATE "recruiter_access_requests" rar
SET "tenantId" = (
  SELECT gp."tenantId"
  FROM "graduate_profiles" gp
  WHERE gp."id" = rar."graduateId"
);

-- AlterTable
ALTER TABLE "recruiter_access_requests" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "recruiter_access_requests_tenantId_idx" ON "recruiter_access_requests"("tenantId");

-- AddForeignKey
ALTER TABLE "recruiter_access_requests" ADD CONSTRAINT "recruiter_access_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
