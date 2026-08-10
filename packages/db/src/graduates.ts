import { prisma } from "./client";
import { generateUniqueSlug } from "./slug-generator";
import { generateSecureToken, hashToken } from "./token-generator";

const REQUIRED_ACCEPTED_MISSIONS = 4;

type ArtifactInput = { title: string; url: string; description?: string | null };
type GraduateProfileInput = {
  bio: string;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  profilePhotoUrl?: string | null;
  profilePhotoFileId?: string | null;
  country?: string | null;
  skills?: string[];
  interests?: string[];
  emailPublic?: boolean;
  artifacts?: ArtifactInput[];
};

type CompletionSubmission = {
  id: string;
  rating: number | null;
  reviewedAt: Date | null;
  submittedAt: Date | null;
  updatedAt: Date;
  mission: { id: string; title: string; programId: string; program: { name: string } };
};

function publicName(name: string | null, email: string) {
  return name?.trim() || email.split("@")[0] || "TalentOS Graduate";
}

function completionDateOf(submission: CompletionSubmission) {
  return submission.reviewedAt ?? submission.submittedAt ?? submission.updatedAt;
}

async function getCompletionSnapshot(userId: string) {
  const submissions = await prisma.submission.findMany({
    where: { applicantId: userId, status: "ACCEPTED", rating: { not: null } },
    select: {
      id: true, rating: true, reviewedAt: true, submittedAt: true, updatedAt: true,
      mission: { select: { id: true, title: true, programId: true, program: { select: { name: true } } } }
    }
  });
  const programs = new Map<string, Map<string, CompletionSubmission>>();
  for (const submission of submissions) {
    const missions = programs.get(submission.mission.programId) ?? new Map<string, CompletionSubmission>();
    const existing = missions.get(submission.mission.id);
    if (!existing || completionDateOf(submission) > completionDateOf(existing)) missions.set(submission.mission.id, submission);
    programs.set(submission.mission.programId, missions);
  }
  const eligible = [...programs.entries()]
    .map(([programId, missionMap]) => ({ programId, submissions: [...missionMap.values()] }))
    .filter((entry) => entry.submissions.length >= REQUIRED_ACCEPTED_MISSIONS)
    .sort((a, b) => Math.max(...b.submissions.map((s) => completionDateOf(s).getTime())) - Math.max(...a.submissions.map((s) => completionDateOf(s).getTime())))[0];
  if (!eligible) throw new Error("Graduate profile publishing requires four accepted missions with reviewer ratings in one program.");
  const completedSubmissions = eligible.submissions.sort((a, b) => completionDateOf(a).getTime() - completionDateOf(b).getTime());
  const ratings = completedSubmissions.map((submission) => submission.rating as number);
  return {
    programId: eligible.programId,
    programName: completedSubmissions[0].mission.program.name,
    submissions: completedSubmissions,
    graduationDate: new Date(Math.max(...completedSubmissions.map((submission) => completionDateOf(submission).getTime()))),
    overallRating: ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
  };
}

export async function createOrUpdateGraduateProfile(userId: string, data: GraduateProfileInput) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, graduateProfile: { select: { slug: true, id: true } } } });
  if (!user) throw new Error("User not found.");
  const completion = await getCompletionSnapshot(userId);
  if (data.profilePhotoFileId) {
    const photo = await prisma.storedFile.findFirst({
      where: { id: data.profilePhotoFileId, ownerUserId: userId, status: "READY", contentType: { startsWith: "image/" } }
    });
    if (!photo) throw new Error("Profile photo upload is invalid or is not owned by this graduate.");
  }
  const slug = user.graduateProfile?.slug ?? await generateUniqueSlug(publicName(user.name, user.email));
  const profileData = {
    programId: completion.programId,
    publicProfileEnabled: true,
    consentDate: new Date(),
    consentVersion: 1,
    consentStatus: "ACKNOWLEDGED" as const,
    bio: data.bio,
    linkedinUrl: data.linkedinUrl ?? null,
    githubUrl: data.githubUrl ?? null,
    profilePhotoUrl: data.profilePhotoUrl ?? null,
    profilePhotoFileId: data.profilePhotoFileId ?? null,
    country: data.country ?? null,
    skills: data.skills ?? [], interests: data.interests ?? [], emailPublic: data.emailPublic ?? false,
    graduationDate: completion.graduationDate, overallRating: completion.overallRating
  };
  return prisma.$transaction(async (tx) => {
    const profile = await tx.graduateProfile.upsert({ where: { userId }, create: { userId, slug, ...profileData }, update: profileData });
    if (data.artifacts) {
      await tx.graduateArtifact.deleteMany({ where: { graduateId: profile.id } });
      if (data.artifacts.length) await tx.graduateArtifact.createMany({ data: data.artifacts.map((artifact) => ({ graduateId: profile.id, ...artifact })) });
    }
    // Record consent history
    await tx.consentHistory.create({ data: { graduateProfileId: profile.id, status: "ACKNOWLEDGED", action: "Applicant acknowledged consent and published profile" } });
    return profile;
  });
}

export async function getGraduateEligibility(userId: string) {
  try {
    const snapshot = await getCompletionSnapshot(userId);
    return { eligible: true as const, programName: snapshot.programName, overallRating: snapshot.overallRating, graduationDate: snapshot.graduationDate,
      missionRatings: snapshot.submissions.map((submission) => ({ name: submission.mission.title, rating: submission.rating as number })) };
  } catch (error) {
    if (error instanceof Error && error.message.includes("four accepted missions")) return { eligible: false as const, reason: error.message };
    throw error;
  }
}

export async function isGraduateConsentRequired(userId: string) {
  const eligibility = await getGraduateEligibility(userId);
  if (!eligibility.eligible) return false;
  const profile = await prisma.graduateProfile.findUnique({ where: { userId }, select: { publicProfileEnabled: true } });
  return !profile?.publicProfileEnabled;
}

function serializePublicProfile(profile: any) {
  return {
    id: profile.id, slug: profile.slug, name: publicName(profile.user.name, profile.user.email),
    photo: profile.profilePhotoFileId ? `/api/graduates/${profile.slug}/photo` : profile.profilePhotoUrl,
    rating: profile.overallRating, bio: profile.bio ?? "TalentOS program graduate", country: profile.country,
    completionDate: profile.graduationDate, linkedinUrl: profile.linkedinUrl, githubUrl: profile.githubUrl,
    program: profile.program ? { id: profile.program.id, name: profile.program.name } : null,
    skills: profile.skills
  };
}

const publicProfileInclude = { user: { select: { name: true, email: true } }, program: { select: { id: true, name: true } } } as const;

export async function getPublicProfile(slug: string) {
  const profile = await prisma.graduateProfile.findFirst({ where: { slug, publicProfileEnabled: true }, include: publicProfileInclude });
  return profile ? serializePublicProfile(profile) : null;
}

export async function getPublicProfiles(options: {
  page?: number; limit?: number; sort?: "rating" | "date" | "name"; search?: string; country?: string;
  monthFrom?: Date; monthTo?: Date; programId?: string;
} = {}) {
  const { page = 1, limit = 20, sort = "rating", search, country, monthFrom, monthTo, programId } = options;
  const where = {
    publicProfileEnabled: true,
    ...(search ? { OR: [{ bio: { contains: search, mode: "insensitive" as const } }, { skills: { hasSome: [search.toLowerCase()] } }, { user: { name: { contains: search, mode: "insensitive" as const } } }] } : {}),
    ...(country ? { country: { contains: country, mode: "insensitive" as const } } : {}),
    ...(programId ? { programId } : {}),
    ...(monthFrom || monthTo ? { graduationDate: { ...(monthFrom ? { gte: monthFrom } : {}), ...(monthTo ? { lt: monthTo } : {}) } } : {})
  };
  const orderBy = sort === "date" ? { graduationDate: "desc" as const } : sort === "name" ? { user: { name: "asc" as const } } : { overallRating: "desc" as const };
  const [profiles, total, programs] = await Promise.all([
    prisma.graduateProfile.findMany({ where, include: publicProfileInclude, orderBy, skip: (page - 1) * limit, take: limit }),
    prisma.graduateProfile.count({ where }),
    prisma.program.findMany({ where: { graduateProfiles: { some: { publicProfileEnabled: true } } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
  ]);
  return { data: profiles.map(serializePublicProfile), pagination: { page, limit, total, pages: Math.ceil(total / limit) }, filters: { programs } };
}

export async function createRecruiterAccessRequest(graduateId: string, recruiterData: {
  recruiterName: string; recruiterOrganization: string; recruiterDesignation: string; recruiterEmail: string;
  recruiterPhone?: string; hiringRequirement?: string;
}, rawToken: string, expiresAt: Date) {
  const recruiter = await prisma.recruiterAccount.upsert({
    where: { email: recruiterData.recruiterEmail },
    create: { email: recruiterData.recruiterEmail, name: recruiterData.recruiterName, organization: recruiterData.recruiterOrganization, designation: recruiterData.recruiterDesignation, phone: recruiterData.recruiterPhone },
    update: { name: recruiterData.recruiterName, organization: recruiterData.recruiterOrganization, designation: recruiterData.recruiterDesignation, phone: recruiterData.recruiterPhone }
  });
  // Create as PENDING — admin must approve before token is usable and email is sent
  return prisma.recruiterAccessRequest.create({
    data: { graduateId, recruiterId: recruiter.id, ...recruiterData, token: hashToken(rawToken), expiresAt, status: "PENDING" }
  });
}

// --- Admin review functions ---

export async function getPendingAccessRequests(options: { page?: number; limit?: number; status?: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED" | "EXPIRED" } = {}) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const where = options.status ? { status: options.status } : {};
  const [requests, total] = await Promise.all([
    prisma.recruiterAccessRequest.findMany({
      where,
      include: { graduate: { include: { user: { select: { name: true, email: true } }, program: { select: { name: true } } } }, recruiter: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit, take: limit
    }),
    prisma.recruiterAccessRequest.count({ where })
  ]);
  return { requests, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getAccessRequestDetail(id: string) {
  return prisma.recruiterAccessRequest.findUnique({
    where: { id },
    include: { graduate: { include: { user: { select: { name: true, email: true } }, program: { select: { name: true } } } }, recruiter: true }
  });
}

export async function approveAccessRequest(id: string, reviewerId: string, rawToken: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  return prisma.$transaction(async (tx) => {
    const request = await tx.recruiterAccessRequest.findUnique({ where: { id }, include: { recruiter: true } });
    if (!request) throw new Error("Access request not found.");
    if (request.status !== "PENDING") throw new Error(`Request is already ${request.status}.`);
    const updated = await tx.recruiterAccessRequest.update({
      where: { id },
      data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt: new Date(), token: hashToken(rawToken), expiresAt, approvedAt: new Date() },
      include: { graduate: { include: { user: true } } }
    });
    return { request: updated, rawToken, expiresAt };
  });
}

export async function rejectAccessRequest(id: string, reviewerId: string, rejectionReason?: string) {
  return prisma.recruiterAccessRequest.update({
    where: { id },
    data: { status: "REJECTED", reviewedById: reviewerId, reviewedAt: new Date(), rejectionReason }
  });
}

export async function revokeAccessRequest(id: string, reviewerId: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.recruiterAccessRequest.findUnique({ where: { id } });
    if (!request) throw new Error("Access request not found.");
    if (request.status !== "APPROVED") throw new Error("Only approved requests can be revoked.");
    const updated = await tx.recruiterAccessRequest.update({
      where: { id },
      data: { status: "REVOKED", revokedAt: new Date(), revokedById: reviewerId }
    });
    // Also invalidate any active recruiter sessions for this request's recruiter+graduate pair
    if (request.recruiterId) {
      await tx.recruiterSession.deleteMany({ where: { recruiterId: request.recruiterId } });
    }
    return updated;
  });
}

export async function getAccessRequestStats() {
  const [pending, approved, rejected, revoked, expired] = await Promise.all([
    prisma.recruiterAccessRequest.count({ where: { status: "PENDING" } }),
    prisma.recruiterAccessRequest.count({ where: { status: "APPROVED" } }),
    prisma.recruiterAccessRequest.count({ where: { status: "REJECTED" } }),
    prisma.recruiterAccessRequest.count({ where: { status: "REVOKED" } }),
    prisma.recruiterAccessRequest.count({ where: { status: "EXPIRED" } })
  ]);
  return { pending, approved, rejected, revoked, expired, total: pending + approved + rejected + revoked + expired };
}

export async function consumeRecruiterAccessToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const sessionToken = generateSecureToken();
  return prisma.$transaction(async (tx) => {
    const request = await tx.recruiterAccessRequest.findUnique({ where: { token: tokenHash }, include: { graduate: true, recruiter: true } });
    // Must be APPROVED, not expired, not consumed, not revoked, and profile still public
    if (!request || !request.recruiter) return null;
    if (request.status === "REVOKED") return { error: "REVOKED" as const };
    if (request.status === "REJECTED") return { error: "REJECTED" as const };
    if (request.status === "PENDING") return { error: "PENDING" as const };
    if (request.status !== "APPROVED") return { error: "INVALID" as const };
    if (request.expiresAt <= new Date()) return { error: "EXPIRED" as const };
    if (request.consumedAt) return { error: "CONSUMED" as const };
    if (!request.graduate.publicProfileEnabled) return { error: "PROFILE_DISABLED" as const };
    const consumed = await tx.recruiterAccessRequest.updateMany({ where: { id: request.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (consumed.count !== 1) return null;
    await tx.recruiterAccount.update({ where: { id: request.recruiter.id }, data: { verifiedAt: new Date() } });
    await tx.recruiterSession.create({ data: { recruiterId: request.recruiter.id, tokenHash: hashToken(sessionToken), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
    return { request, sessionToken };
  });
}

export async function getRecruiterSession(rawToken: string | undefined) {
  if (!rawToken) return null;
  const session = await prisma.recruiterSession.findUnique({ where: { tokenHash: hashToken(rawToken) }, include: { recruiter: true } });
  if (!session || session.expiresAt <= new Date()) return null;
  await prisma.recruiterSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
  return session;
}

export async function getFullProfileForRecruiter(slug: string, recruiterId: string) {
  const grant = await prisma.recruiterAccessRequest.findFirst({ where: { recruiterId, graduate: { slug, publicProfileEnabled: true }, status: "APPROVED", expiresAt: { gt: new Date() } } });
  if (!grant) return null;
  const profile = await prisma.graduateProfile.findUnique({
    where: { slug }, include: {
      program: { select: { id: true, name: true } }, artifacts: { orderBy: { createdAt: "asc" } },
      user: { include: { submissions: { where: { status: "ACCEPTED", rating: { not: null } }, orderBy: { reviewedAt: "asc" }, include: {
        mission: { select: { id: true, title: true, weekNumber: true, programId: true } },
        missionAssignment: { include: { journalEntries: { orderBy: { entryDate: "asc" } } } }
      } } } }
    }
  });
  if (!profile) return null;
  return {
    graduateId: profile.id, accessRequestId: grant.id,
    overview: { name: publicName(profile.user.name, profile.user.email), email: profile.emailPublic ? profile.user.email : null,
      photo: profile.profilePhotoFileId ? `/api/graduates/${profile.slug}/photo` : profile.profilePhotoUrl, bio: profile.bio, country: profile.country,
      skills: profile.skills, interests: profile.interests, linkedinUrl: profile.linkedinUrl, githubUrl: profile.githubUrl, program: profile.program },
    rating: profile.overallRating, completionDate: profile.graduationDate, artifacts: profile.artifacts,
    aiEvaluation: profile.aiEvaluatedAt ? { technicalSkills: profile.aiTechnicalSkills, problemSolving: profile.aiProblemSolving, communication: profile.aiCommunication,
      ownership: profile.aiOwnership, teamCollaboration: profile.aiTeamCollaboration, summary: profile.aiSummary, evaluatedAt: profile.aiEvaluatedAt } : null,
    saved: Boolean(await prisma.savedCandidate.findUnique({ where: { recruiterId_graduateId: { recruiterId, graduateId: profile.id } } })),
    assignments: profile.user.submissions.map((submission) => ({ id: submission.id, missionId: submission.mission.id, missionTitle: submission.mission.title,
      weekNumber: submission.mission.weekNumber, rating: submission.rating, completionDate: submission.reviewedAt ?? submission.submittedAt,
      reviewerFeedback: submission.reviewerFeedback, repositoryUrl: submission.repositoryUrl, deploymentUrl: submission.deploymentUrl, loomUrl: submission.loomUrl,
      journalMarkdown: submission.journalMarkdown, journalEntries: submission.missionAssignment?.journalEntries ?? [] }))
  };
}

export async function getRecruiterGraduateContact(slug: string, recruiterId: string) {
  const grant = await prisma.recruiterAccessRequest.findFirst({
    where: { recruiterId, graduate: { slug, publicProfileEnabled: true }, status: "APPROVED", expiresAt: { gt: new Date() } },
    include: { graduate: { include: { user: { select: { name: true, email: true } } } }, recruiter: true }
  });
  if (!grant || !grant.recruiter) return null;
  return {
    graduateId: grant.graduateId,
    graduateName: publicName(grant.graduate.user.name, grant.graduate.user.email),
    graduateEmail: grant.graduate.user.email,
    recruiter: grant.recruiter
  };
}

export async function getGraduatePhoto(slug: string) {
  return prisma.graduateProfile.findFirst({
    where: { slug, publicProfileEnabled: true, profilePhotoFileId: { not: null } },
    select: { profilePhotoFile: { select: { storageKey: true } } }
  });
}

export async function toggleSavedCandidate(recruiterId: string, slug: string) {
  const graduate = await prisma.graduateProfile.findFirst({ where: { slug, publicProfileEnabled: true }, select: { id: true } });
  if (!graduate) return null;
  const existing = await prisma.savedCandidate.findUnique({ where: { recruiterId_graduateId: { recruiterId, graduateId: graduate.id } } });
  if (existing) { await prisma.savedCandidate.delete({ where: { id: existing.id } }); return { saved: false }; }
  await prisma.savedCandidate.create({ data: { recruiterId, graduateId: graduate.id } });
  return { saved: true };
}

export async function getRecruiterDashboard(recruiterId: string) {
  const recruiter = await prisma.recruiterAccount.findUnique({
    where: { id: recruiterId },
    select: {
      id: true, email: true, name: true, organization: true, designation: true, phone: true, verifiedAt: true,
      savedCandidates: { orderBy: { createdAt: "desc" }, include: { graduate: { include: publicProfileInclude } } },
      accessRequests: { where: { status: "APPROVED", expiresAt: { gt: new Date() } }, select: { graduateId: true, expiresAt: true } }
    }
  });
  if (!recruiter) return null;
  const grants = new Map(recruiter.accessRequests.map((grant) => [grant.graduateId, grant.expiresAt]));
  return {
    account: { id: recruiter.id, email: recruiter.email, name: recruiter.name, organization: recruiter.organization, designation: recruiter.designation, phone: recruiter.phone, verifiedAt: recruiter.verifiedAt },
    savedCandidates: recruiter.savedCandidates.filter((saved) => saved.graduate.publicProfileEnabled).map((saved) => ({ ...serializePublicProfile(saved.graduate), savedAt: saved.createdAt, portfolioAccessExpiresAt: grants.get(saved.graduateId) ?? null }))
  };
}

export function updateRecruiterAccount(recruiterId: string, data: { name: string; organization: string; designation: string; phone?: string | null }) {
  return prisma.recruiterAccount.update({ where: { id: recruiterId }, data });
}

export async function revokeRecruiterSession(rawToken: string | undefined) {
  if (!rawToken) return false;
  const deleted = await prisma.recruiterSession.deleteMany({ where: { tokenHash: hashToken(rawToken) } });
  return deleted.count > 0;
}

export function saveGraduateAiEvaluation(graduateId: string, evaluation: { technicalSkills: number; problemSolving: number; communication: number; ownership: number; teamCollaboration: number; summary: string }) {
  return prisma.graduateProfile.update({ where: { id: graduateId }, data: { aiTechnicalSkills: evaluation.technicalSkills, aiProblemSolving: evaluation.problemSolving,
    aiCommunication: evaluation.communication, aiOwnership: evaluation.ownership, aiTeamCollaboration: evaluation.teamCollaboration, aiSummary: evaluation.summary, aiEvaluatedAt: new Date() } });
}

export function getGraduateEvaluationEvidence(graduateId: string) {
  return prisma.graduateProfile.findUnique({
    where: { id: graduateId },
    select: { bio: true, skills: true, interests: true, overallRating: true, artifacts: { select: { title: true, description: true } }, user: { select: { submissions: { where: { status: "ACCEPTED", rating: { not: null } }, select: { rating: true, reviewerFeedback: true, journalMarkdown: true, mission: { select: { title: true } } } } } } }
  });
}

export function logProfileView(graduateId: string, accessRequestId: string, recruiterData: { recruiterEmail?: string; recruiterName?: string; recruiterOrganization?: string | null }, ipAddress?: string, userAgent?: string) {
  return prisma.profileViewAudit.create({ data: { graduateId, accessRequestId, ...recruiterData, ipAddress, userAgent } });
}

export function disableProfilePublishing(userId: string) {
  return prisma.graduateProfile.update({ where: { userId }, data: { publicProfileEnabled: false } });
}

export async function declineGraduateProfilePublishing(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { graduateProfile: { select: { id: true } } } });
  if (!user?.graduateProfile) {
    throw new Error("No graduate profile exists to decline.");
  }
  return prisma.$transaction(async (tx) => {
    const profile = await tx.graduateProfile.update({ where: { userId }, data: { publicProfileEnabled: false, consentDate: null, consentVersion: { increment: 1 }, consentStatus: "DECLINED" } });
    await tx.consentHistory.create({ data: { graduateProfileId: profile.id, status: "DECLINED", action: "Applicant declined public profile sharing" } });
    return profile;
  });
}

// --- Skip consent (decide later) ---
export async function skipGraduateConsent(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { graduateProfile: { select: { id: true } } } });
  if (!user?.graduateProfile) {
    throw new Error("No graduate profile exists to skip consent.");
  }
  return prisma.$transaction(async (tx) => {
    const profile = await tx.graduateProfile.update({ where: { userId }, data: { publicProfileEnabled: false, consentDate: null, consentStatus: "SKIPPED" } });
    await tx.consentHistory.create({ data: { graduateProfileId: profile.id, status: "SKIPPED", action: "Applicant chose to decide later" } });
    return profile;
  });
}

// --- Consent history ---
export async function getConsentHistory(graduateProfileId: string) {
  return prisma.consentHistory.findMany({
    where: { graduateProfileId },
    orderBy: { createdAt: "asc" }
  });
}

export async function getConsentHistoryByUserId(userId: string) {
  const profile = await prisma.graduateProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) return [];
  return getConsentHistory(profile.id);
}
