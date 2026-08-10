-- Document learning resources (v0.20.0): admins can upload a document (PDF/DOC/DOCX/TXT/image) as a
-- learning resource, stored via StoredFile and linked from the resource row.

-- AlterEnum
ALTER TYPE "LearningResourceType" ADD VALUE 'DOCUMENT';

-- AlterTable
ALTER TABLE "video_resources" ADD COLUMN     "fileId" TEXT;

-- AddForeignKey
ALTER TABLE "video_resources" ADD CONSTRAINT "video_resources_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
