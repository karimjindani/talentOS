-- Mission Assignment MVP: assign applicants to one mission per tenant/program/week.

CREATE TABLE "mission_assignments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "weekNumber" INTEGER NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mission_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mission_assignments_tenantId_programId_applicantId_weekNumber_key"
ON "mission_assignments"("tenantId", "programId", "applicantId", "weekNumber");

CREATE INDEX "mission_assignments_tenantId_programId_weekNumber_idx"
ON "mission_assignments"("tenantId", "programId", "weekNumber");

CREATE INDEX "mission_assignments_applicantId_idx"
ON "mission_assignments"("applicantId");

CREATE INDEX "mission_assignments_missionId_idx"
ON "mission_assignments"("missionId");

ALTER TABLE "mission_assignments"
ADD CONSTRAINT "mission_assignments_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mission_assignments"
ADD CONSTRAINT "mission_assignments_programId_fkey"
FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mission_assignments"
ADD CONSTRAINT "mission_assignments_applicantId_fkey"
FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mission_assignments"
ADD CONSTRAINT "mission_assignments_missionId_fkey"
FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
