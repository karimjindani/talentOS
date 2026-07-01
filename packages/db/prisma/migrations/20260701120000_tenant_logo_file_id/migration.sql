ALTER TABLE "tenants" ADD COLUMN "logoFileId" TEXT;
CREATE UNIQUE INDEX "tenants_logoFileId_key" ON "tenants"("logoFileId");
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_logoFileId_fkey"
  FOREIGN KEY ("logoFileId") REFERENCES "stored_files"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
