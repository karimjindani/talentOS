-- Optional applicant/user profile photo, distinct from GraduateProfile.profilePhotoFileId which
-- only exists post-graduation. v0.20.7.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatarFileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_avatarFileId_key" ON "users"("avatarFileId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatarFileId_fkey" FOREIGN KEY ("avatarFileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
