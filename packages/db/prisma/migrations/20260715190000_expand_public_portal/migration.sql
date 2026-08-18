ALTER TABLE "graduate_profiles"
  ADD COLUMN "programId" TEXT,
  ADD COLUMN "profilePhotoFileId" TEXT,
  ADD COLUMN "aiTechnicalSkills" DOUBLE PRECISION,
  ADD COLUMN "aiProblemSolving" DOUBLE PRECISION,
  ADD COLUMN "aiCommunication" DOUBLE PRECISION,
  ADD COLUMN "aiOwnership" DOUBLE PRECISION,
  ADD COLUMN "aiTeamCollaboration" DOUBLE PRECISION,
  ADD COLUMN "aiSummary" TEXT,
  ADD COLUMN "aiEvaluatedAt" TIMESTAMP(3);

ALTER TABLE "recruiter_access_requests"
  ADD COLUMN "recruiterId" TEXT,
  ADD COLUMN "consumedAt" TIMESTAMP(3);

CREATE TABLE "graduate_artifacts" (
  "id" TEXT NOT NULL,
  "graduateId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" VARCHAR(1000) NOT NULL,
  "description" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "graduate_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruiter_accounts" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "organization" TEXT NOT NULL,
  "designation" TEXT NOT NULL,
  "phone" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruiter_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruiter_sessions" (
  "id" TEXT NOT NULL,
  "recruiterId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recruiter_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saved_candidates" (
  "id" TEXT NOT NULL,
  "recruiterId" TEXT NOT NULL,
  "graduateId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "graduate_profiles_profilePhotoFileId_key" ON "graduate_profiles"("profilePhotoFileId");
CREATE INDEX "graduate_profiles_programId_idx" ON "graduate_profiles"("programId");
CREATE INDEX "graduate_artifacts_graduateId_idx" ON "graduate_artifacts"("graduateId");
CREATE UNIQUE INDEX "recruiter_accounts_email_key" ON "recruiter_accounts"("email");
CREATE UNIQUE INDEX "recruiter_sessions_tokenHash_key" ON "recruiter_sessions"("tokenHash");
CREATE INDEX "recruiter_sessions_recruiterId_idx" ON "recruiter_sessions"("recruiterId");
CREATE INDEX "recruiter_sessions_expiresAt_idx" ON "recruiter_sessions"("expiresAt");
CREATE UNIQUE INDEX "saved_candidates_recruiterId_graduateId_key" ON "saved_candidates"("recruiterId", "graduateId");
CREATE INDEX "saved_candidates_graduateId_idx" ON "saved_candidates"("graduateId");
CREATE INDEX "recruiter_access_requests_recruiterId_idx" ON "recruiter_access_requests"("recruiterId");

ALTER TABLE "graduate_profiles" ADD CONSTRAINT "graduate_profiles_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "graduate_profiles" ADD CONSTRAINT "graduate_profiles_profilePhotoFileId_fkey" FOREIGN KEY ("profilePhotoFileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "graduate_artifacts" ADD CONSTRAINT "graduate_artifacts_graduateId_fkey" FOREIGN KEY ("graduateId") REFERENCES "graduate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruiter_access_requests" ADD CONSTRAINT "recruiter_access_requests_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "recruiter_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruiter_sessions" ADD CONSTRAINT "recruiter_sessions_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "recruiter_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_candidates" ADD CONSTRAINT "saved_candidates_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "recruiter_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_candidates" ADD CONSTRAINT "saved_candidates_graduateId_fkey" FOREIGN KEY ("graduateId") REFERENCES "graduate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
