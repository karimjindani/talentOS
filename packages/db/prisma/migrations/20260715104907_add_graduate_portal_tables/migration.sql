-- CreateTable
CREATE TABLE "graduate_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicProfileEnabled" BOOLEAN NOT NULL DEFAULT false,
    "consentDate" TIMESTAMP(3),
    "consentVersion" INTEGER NOT NULL DEFAULT 1,
    "bio" VARCHAR(500),
    "linkedinUrl" VARCHAR(500),
    "githubUrl" VARCHAR(500),
    "profilePhotoUrl" VARCHAR(500),
    "country" VARCHAR(100),
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emailPublic" BOOLEAN NOT NULL DEFAULT false,
    "graduationDate" TIMESTAMP(3) NOT NULL,
    "overallRating" DOUBLE PRECISION NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graduate_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruiter_access_requests" (
    "id" TEXT NOT NULL,
    "graduateId" TEXT NOT NULL,
    "recruiterName" TEXT NOT NULL,
    "recruiterOrganization" TEXT,
    "recruiterDesignation" TEXT,
    "recruiterEmail" TEXT NOT NULL,
    "recruiterPhone" TEXT,
    "hiringRequirement" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruiter_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_view_audits" (
    "id" TEXT NOT NULL,
    "graduateId" TEXT NOT NULL,
    "accessRequestId" TEXT,
    "recruiterEmail" TEXT,
    "recruiterName" TEXT,
    "recruiterOrganization" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "profile_view_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "graduate_profiles_userId_key" ON "graduate_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "graduate_profiles_slug_key" ON "graduate_profiles"("slug");

-- CreateIndex
CREATE INDEX "graduate_profiles_publicProfileEnabled_idx" ON "graduate_profiles"("publicProfileEnabled");

-- CreateIndex
CREATE INDEX "graduate_profiles_overallRating_idx" ON "graduate_profiles"("overallRating");

-- CreateIndex
CREATE INDEX "graduate_profiles_graduationDate_idx" ON "graduate_profiles"("graduationDate");

-- CreateIndex
CREATE UNIQUE INDEX "recruiter_access_requests_token_key" ON "recruiter_access_requests"("token");

-- CreateIndex
CREATE INDEX "recruiter_access_requests_graduateId_idx" ON "recruiter_access_requests"("graduateId");

-- CreateIndex
CREATE INDEX "recruiter_access_requests_token_idx" ON "recruiter_access_requests"("token");

-- CreateIndex
CREATE INDEX "recruiter_access_requests_recruiterEmail_idx" ON "recruiter_access_requests"("recruiterEmail");

-- CreateIndex
CREATE INDEX "profile_view_audits_graduateId_idx" ON "profile_view_audits"("graduateId");

-- CreateIndex
CREATE INDEX "profile_view_audits_viewedAt_idx" ON "profile_view_audits"("viewedAt");

-- CreateIndex
CREATE INDEX "profile_view_audits_recruiterOrganization_idx" ON "profile_view_audits"("recruiterOrganization");

-- AddForeignKey
ALTER TABLE "graduate_profiles" ADD CONSTRAINT "graduate_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_access_requests" ADD CONSTRAINT "recruiter_access_requests_graduateId_fkey" FOREIGN KEY ("graduateId") REFERENCES "graduate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_view_audits" ADD CONSTRAINT "profile_view_audits_graduateId_fkey" FOREIGN KEY ("graduateId") REFERENCES "graduate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_view_audits" ADD CONSTRAINT "profile_view_audits_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "recruiter_access_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
