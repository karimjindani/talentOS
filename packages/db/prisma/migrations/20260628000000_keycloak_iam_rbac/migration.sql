-- AlterEnum: replace OWNER/ADMIN with the org-scoped role model
BEGIN;
CREATE TYPE "TenantRole_new" AS ENUM ('ORG_ADMIN', 'HR', 'TECH_LEAD', 'APPLICANT');
ALTER TABLE "tenant_memberships" ALTER COLUMN "role" TYPE "TenantRole_new" USING ("role"::text::"TenantRole_new");
ALTER TYPE "TenantRole" RENAME TO "TenantRole_old";
ALTER TYPE "TenantRole_new" RENAME TO "TenantRole";
DROP TYPE "TenantRole_old";
COMMIT;

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN');

-- AlterTable: make local password optional and add Keycloak identity mapping
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "keycloakSubjectId" TEXT;
ALTER TABLE "users" ADD COLUMN "emailVerified" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "platformRole" "PlatformRole";

-- CreateIndex
CREATE UNIQUE INDEX "users_keycloakSubjectId_key" ON "users"("keycloakSubjectId");
