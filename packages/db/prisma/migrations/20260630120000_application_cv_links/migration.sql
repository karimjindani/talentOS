-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "cvFileId" TEXT,
ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "linkedinUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "applications_cvFileId_key" ON "applications"("cvFileId");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_cvFileId_fkey" FOREIGN KEY ("cvFileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
