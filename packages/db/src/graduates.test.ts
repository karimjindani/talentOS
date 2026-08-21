import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  applicationFindFirst: vi.fn(),
  storedFileFindFirst: vi.fn(),
  submissionFindMany: vi.fn(),
  graduateProfileFindFirst: vi.fn(),
  graduateProfileFindMany: vi.fn(),
  graduateProfileFindUnique: vi.fn(),
  graduateProfileCount: vi.fn(),
  programFindMany: vi.fn(),
  recruiterAccountUpsert: vi.fn(),
  recruiterAccountFindUnique: vi.fn(),
  recruiterAccountUpdate: vi.fn(),
  recruiterAccessRequestCreate: vi.fn(),
  recruiterAccessRequestFindMany: vi.fn(),
  recruiterAccessRequestFindFirst: vi.fn(),
  recruiterAccessRequestCount: vi.fn(),
  recruiterAccessRequestFindUnique: vi.fn(),
  recruiterAccessRequestUpdate: vi.fn(),
  recruiterSessionFindUnique: vi.fn(),
  recruiterSessionUpdate: vi.fn(),
  recruiterSessionDeleteMany: vi.fn(),
  savedCandidateFindUnique: vi.fn(),
  savedCandidateCreate: vi.fn(),
  savedCandidateDelete: vi.fn(),
  consentHistoryFindMany: vi.fn(),
  transaction: vi.fn(),
  txGraduateProfileUpsert: vi.fn(),
  txGraduateProfileUpdate: vi.fn(),
  txGraduateProfileCreate: vi.fn(),
  txGraduateArtifactDeleteMany: vi.fn(),
  txGraduateArtifactCreateMany: vi.fn(),
  txConsentHistoryCreate: vi.fn(),
  txRecruiterAccessRequestFindUnique: vi.fn(),
  txRecruiterAccessRequestUpdate: vi.fn(),
  txRecruiterSessionDeleteMany: vi.fn(),
  txRecruiterSessionCreate: vi.fn(),
  txRecruiterAccountUpdate: vi.fn()
}));

vi.mock("./client", () => ({
  prisma: {
    user: { findUnique: prismaMock.userFindUnique },
    application: { findFirst: prismaMock.applicationFindFirst },
    storedFile: { findFirst: prismaMock.storedFileFindFirst },
    submission: { findMany: prismaMock.submissionFindMany },
    graduateProfile: {
      findFirst: prismaMock.graduateProfileFindFirst,
      findMany: prismaMock.graduateProfileFindMany,
      findUnique: prismaMock.graduateProfileFindUnique,
      count: prismaMock.graduateProfileCount
    },
    program: { findMany: prismaMock.programFindMany },
    recruiterAccount: {
      upsert: prismaMock.recruiterAccountUpsert,
      findUnique: prismaMock.recruiterAccountFindUnique,
      update: prismaMock.recruiterAccountUpdate
    },
    recruiterAccessRequest: {
      create: prismaMock.recruiterAccessRequestCreate,
      findMany: prismaMock.recruiterAccessRequestFindMany,
      findFirst: prismaMock.recruiterAccessRequestFindFirst,
      count: prismaMock.recruiterAccessRequestCount,
      findUnique: prismaMock.recruiterAccessRequestFindUnique,
      update: prismaMock.recruiterAccessRequestUpdate
    },
    recruiterSession: {
      findUnique: prismaMock.recruiterSessionFindUnique,
      update: prismaMock.recruiterSessionUpdate,
      deleteMany: prismaMock.recruiterSessionDeleteMany
    },
    savedCandidate: {
      findUnique: prismaMock.savedCandidateFindUnique,
      create: prismaMock.savedCandidateCreate,
      delete: prismaMock.savedCandidateDelete
    },
    consentHistory: { findMany: prismaMock.consentHistoryFindMany },
    $transaction: prismaMock.transaction
  }
}));

vi.mock("./slug-generator", () => ({
  generateUniqueSlug: vi.fn(async (name: string) => `${name.toLowerCase().replace(/\s+/g, "-")}-slug`)
}));

import {
  approveAccessRequest,
  consumeRecruiterAccessToken,
  createOrUpdateGraduateProfile,
  createRecruiterAccessRequest,
  declineGraduateProfilePublishing,
  getAllAccessibleGraduates,
  getFullProfileForRecruiter,
  getGraduateEligibility,
  getGraduateProfileDefaults,
  getPublicProfile,
  getPublicProfiles,
  isGraduateConsentRequired,
  rejectAccessRequest,
  revokeAccessRequest,
  skipGraduateConsent,
  toggleSavedCandidate
} from "./graduates";
import { generateUniqueSlug } from "./slug-generator";
import { hashToken } from "./token-generator";

beforeEach(() => {
  for (const mock of Object.values(prismaMock)) mock.mockReset();
  vi.mocked(generateUniqueSlug).mockClear();
  prismaMock.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({
      graduateProfile: {
        upsert: prismaMock.txGraduateProfileUpsert,
        update: prismaMock.txGraduateProfileUpdate,
        create: prismaMock.txGraduateProfileCreate
      },
      graduateArtifact: {
        deleteMany: prismaMock.txGraduateArtifactDeleteMany,
        createMany: prismaMock.txGraduateArtifactCreateMany
      },
      consentHistory: { create: prismaMock.txConsentHistoryCreate },
      recruiterAccessRequest: {
        findUnique: prismaMock.txRecruiterAccessRequestFindUnique,
        update: prismaMock.txRecruiterAccessRequestUpdate
      },
      recruiterSession: {
        deleteMany: prismaMock.txRecruiterSessionDeleteMany,
        create: prismaMock.txRecruiterSessionCreate
      },
      recruiterAccount: { update: prismaMock.txRecruiterAccountUpdate }
    })
  );
});

function acceptedSubmission(overrides: Partial<{
  id: string; rating: number; programId: string; missionId: string; reviewedAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "sub-1",
    rating: overrides.rating ?? 4.5,
    reviewedAt: overrides.reviewedAt ?? new Date("2026-03-01T00:00:00.000Z"),
    submittedAt: new Date("2026-02-28T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    mission: {
      id: overrides.missionId ?? "mission-1",
      title: "Week Mission",
      programId: overrides.programId ?? "program-1",
      program: { name: "AI-Native Software Engineering" }
    }
  };
}

function fourAcceptedSubmissions(programId = "program-1") {
  return [1, 2, 3, 4].map((week) =>
    acceptedSubmission({
      id: `sub-${week}`,
      missionId: `mission-${week}`,
      programId,
      rating: week,
      reviewedAt: new Date(`2026-0${week}-01T00:00:00.000Z`)
    })
  );
}

describe("createOrUpdateGraduateProfile", () => {
  it("requires four accepted, rated missions in one program", async () => {
    prismaMock.userFindUnique.mockResolvedValue({ name: "G", email: "g@example.com", graduateProfile: null });
    prismaMock.submissionFindMany.mockResolvedValue([acceptedSubmission(), acceptedSubmission({ id: "sub-2" })]);
    await expect(createOrUpdateGraduateProfile("user-1", { bio: "Hi" })).rejects.toThrow(
      "four accepted missions"
    );
    expect(prismaMock.transaction).not.toHaveBeenCalled();
  });

  it("only counts submissions from the program with 4+ accepted missions, picking the most recently completed program", async () => {
    prismaMock.submissionFindMany.mockResolvedValue([
      ...fourAcceptedSubmissions("program-old"), // completes 2026-04-01
      acceptedSubmission({ id: "sub-x", programId: "program-partial" }) // only 1, ignored
    ]);
    prismaMock.userFindUnique.mockResolvedValue({ name: "Amina", email: "amina@example.com", graduateProfile: null });
    prismaMock.txGraduateProfileUpsert.mockResolvedValue({ id: "profile-1", slug: "amina-slug", programId: "program-old" });

    await createOrUpdateGraduateProfile("user-1", { bio: "Hi" });

    expect(prismaMock.txGraduateProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ programId: "program-old" })
      })
    );
  });

  it("generates a new slug for a first-time profile but reuses an existing slug on update", async () => {
    prismaMock.submissionFindMany.mockResolvedValue(fourAcceptedSubmissions());
    prismaMock.userFindUnique.mockResolvedValue({ name: "Amina Rahman", email: "amina@example.com", graduateProfile: null });
    prismaMock.txGraduateProfileUpsert.mockResolvedValue({ id: "profile-1", slug: "amina-rahman-slug" });

    await createOrUpdateGraduateProfile("user-1", { bio: "Hi" });
    expect(generateUniqueSlug).toHaveBeenCalledWith("Amina Rahman");
    expect(prismaMock.txGraduateProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ slug: "amina-rahman-slug", userId: "user-1" }) })
    );

    vi.mocked(generateUniqueSlug).mockClear();
    prismaMock.userFindUnique.mockResolvedValue({
      name: "Amina Rahman",
      email: "amina@example.com",
      graduateProfile: { id: "profile-1", slug: "existing-slug" }
    });

    await createOrUpdateGraduateProfile("user-1", { bio: "Updated bio" });
    expect(generateUniqueSlug).not.toHaveBeenCalled();
    expect(prismaMock.txGraduateProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ slug: "existing-slug" }) })
    );
  });

  it("computes the overall rating as the average of the four counted submissions", async () => {
    // ratings 1,2,3,4 -> average 2.5
    prismaMock.submissionFindMany.mockResolvedValue(fourAcceptedSubmissions());
    prismaMock.userFindUnique.mockResolvedValue({ name: "G", email: "g@example.com", graduateProfile: null });
    prismaMock.txGraduateProfileUpsert.mockResolvedValue({ id: "profile-1" });

    await createOrUpdateGraduateProfile("user-1", { bio: "Hi" });

    expect(prismaMock.txGraduateProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ overallRating: 2.5 }) })
    );
  });

  it("rejects a profile photo file that is not owned by this user", async () => {
    prismaMock.submissionFindMany.mockResolvedValue(fourAcceptedSubmissions());
    prismaMock.userFindUnique.mockResolvedValue({ name: "G", email: "g@example.com", graduateProfile: null });
    prismaMock.storedFileFindFirst.mockResolvedValue(null);

    await expect(
      createOrUpdateGraduateProfile("user-1", { bio: "Hi", profilePhotoFileId: "file-1" })
    ).rejects.toThrow("Profile photo upload is invalid");
    expect(prismaMock.transaction).not.toHaveBeenCalled();
  });

  it("replaces artifacts and records an ACKNOWLEDGED consent-history entry", async () => {
    prismaMock.submissionFindMany.mockResolvedValue(fourAcceptedSubmissions());
    prismaMock.userFindUnique.mockResolvedValue({ name: "G", email: "g@example.com", graduateProfile: null });
    prismaMock.txGraduateProfileUpsert.mockResolvedValue({ id: "profile-1" });

    await createOrUpdateGraduateProfile("user-1", {
      bio: "Hi",
      artifacts: [{ title: "Portfolio", url: "https://example.com" }]
    });

    expect(prismaMock.txGraduateArtifactDeleteMany).toHaveBeenCalledWith({ where: { graduateId: "profile-1" } });
    expect(prismaMock.txGraduateArtifactCreateMany).toHaveBeenCalledWith({
      data: [{ graduateId: "profile-1", title: "Portfolio", url: "https://example.com" }]
    });
    expect(prismaMock.txConsentHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ graduateProfileId: "profile-1", status: "ACKNOWLEDGED" })
    });
  });

  it("throws when the user does not exist", async () => {
    prismaMock.submissionFindMany.mockResolvedValue(fourAcceptedSubmissions());
    prismaMock.userFindUnique.mockResolvedValue(null);
    await expect(createOrUpdateGraduateProfile("missing-user", { bio: "Hi" })).rejects.toThrow("User not found");
  });
});

describe("getGraduateEligibility / isGraduateConsentRequired", () => {
  it("reports ineligible with a reason when fewer than four rated missions are accepted", async () => {
    prismaMock.submissionFindMany.mockResolvedValue([acceptedSubmission()]);
    const result = await getGraduateEligibility("user-1");
    expect(result).toEqual({ eligible: false, reason: expect.stringContaining("four accepted missions") });
  });

  it("reports eligible with per-mission ratings and the overall rating", async () => {
    prismaMock.submissionFindMany.mockResolvedValue(fourAcceptedSubmissions());
    const result = await getGraduateEligibility("user-1");
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.missionRatings).toHaveLength(4);
      expect(result.overallRating).toBe(2.5);
    }
  });

  it("does not require consent for an ineligible applicant", async () => {
    prismaMock.submissionFindMany.mockResolvedValue([]);
    await expect(isGraduateConsentRequired("user-1")).resolves.toBe(false);
    expect(prismaMock.graduateProfileFindUnique).not.toHaveBeenCalled();
  });

  it("requires consent for an eligible applicant whose profile is not yet public", async () => {
    prismaMock.submissionFindMany.mockResolvedValue(fourAcceptedSubmissions());
    prismaMock.graduateProfileFindUnique.mockResolvedValue({ publicProfileEnabled: false });
    await expect(isGraduateConsentRequired("user-1")).resolves.toBe(true);
  });

  it("does not require consent once the profile is already public", async () => {
    prismaMock.submissionFindMany.mockResolvedValue(fourAcceptedSubmissions());
    prismaMock.graduateProfileFindUnique.mockResolvedValue({ publicProfileEnabled: true });
    await expect(isGraduateConsentRequired("user-1")).resolves.toBe(false);
  });
});

describe("getGraduateProfileDefaults", () => {
  it("carries github/linkedin from the applicant's accepted application and their avatar as the default photo", async () => {
    prismaMock.applicationFindFirst.mockResolvedValue({
      githubUrl: "https://github.com/amina",
      linkedinUrl: "https://www.linkedin.com/in/amina"
    });
    prismaMock.userFindUnique.mockResolvedValue({ avatarFileId: "file-avatar-1" });

    const result = await getGraduateProfileDefaults("user-1");

    expect(prismaMock.applicationFindFirst).toHaveBeenCalledWith({
      where: { applicantId: "user-1", status: "ACCEPTED" },
      orderBy: { createdAt: "desc" },
      select: { githubUrl: true, linkedinUrl: true }
    });
    expect(result).toEqual({
      githubUrl: "https://github.com/amina",
      linkedinUrl: "https://www.linkedin.com/in/amina",
      profilePhotoFileId: "file-avatar-1"
    });
  });

  it("returns nulls when there is no accepted application or avatar", async () => {
    prismaMock.applicationFindFirst.mockResolvedValue(null);
    prismaMock.userFindUnique.mockResolvedValue({ avatarFileId: null });

    const result = await getGraduateProfileDefaults("user-1");

    expect(result).toEqual({ githubUrl: null, linkedinUrl: null, profilePhotoFileId: null });
  });
});

describe("declineGraduateProfilePublishing / skipGraduateConsent (D-consent-persist fix)", () => {
  // Regression coverage for the bug where declining/skipping consent silently no-op'd
  // for an applicant who had never created a graduateProfile row: the route returned
  // {success:true} without persisting anything, so the choice was lost on reload.
  it("decline creates a placeholder profile and consent-history row when none exists yet", async () => {
    prismaMock.userFindUnique.mockResolvedValue({ name: "New Grad", email: "newgrad@example.com", graduateProfile: null, avatarFileId: "file-avatar-1" });
    prismaMock.applicationFindFirst.mockResolvedValue({ githubUrl: "https://github.com/newgrad", linkedinUrl: null });
    prismaMock.txGraduateProfileCreate.mockResolvedValue({ id: "profile-new", consentStatus: "DECLINED" });

    const result = await declineGraduateProfilePublishing("user-1");

    expect(prismaMock.txGraduateProfileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        slug: "new-grad-slug",
        publicProfileEnabled: false,
        consentStatus: "DECLINED",
        githubUrl: "https://github.com/newgrad",
        linkedinUrl: null,
        profilePhotoFileId: "file-avatar-1"
      })
    });
    expect(prismaMock.txGraduateProfileUpdate).not.toHaveBeenCalled();
    expect(prismaMock.txConsentHistoryCreate).toHaveBeenCalledWith({
      data: { graduateProfileId: "profile-new", status: "DECLINED", action: "Applicant declined public profile sharing" }
    });
    expect(result).toEqual({ id: "profile-new", consentStatus: "DECLINED" });
  });

  it("decline updates the existing profile in place, bumping consentVersion and clearing consentDate", async () => {
    prismaMock.userFindUnique.mockResolvedValue({ name: "G", email: "g@example.com", graduateProfile: { id: "profile-1" } });
    prismaMock.txGraduateProfileUpdate.mockResolvedValue({ id: "profile-1", consentStatus: "DECLINED" });

    await declineGraduateProfilePublishing("user-1");

    expect(prismaMock.txGraduateProfileCreate).not.toHaveBeenCalled();
    expect(prismaMock.txGraduateProfileUpdate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: {
        publicProfileEnabled: false,
        consentDate: null,
        consentVersion: { increment: 1 },
        consentStatus: "DECLINED"
      }
    });
  });

  it("skip creates a placeholder profile and consent-history row when none exists yet", async () => {
    prismaMock.userFindUnique.mockResolvedValue({ name: "New Grad", email: "newgrad@example.com", graduateProfile: null, avatarFileId: null });
    prismaMock.applicationFindFirst.mockResolvedValue(null);
    prismaMock.txGraduateProfileCreate.mockResolvedValue({ id: "profile-new", consentStatus: "SKIPPED" });

    await skipGraduateConsent("user-1");

    expect(prismaMock.txGraduateProfileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        publicProfileEnabled: false,
        consentStatus: "SKIPPED",
        githubUrl: null,
        linkedinUrl: null,
        profilePhotoFileId: null
      })
    });
    expect(prismaMock.txConsentHistoryCreate).toHaveBeenCalledWith({
      data: { graduateProfileId: "profile-new", status: "SKIPPED", action: "Applicant chose to decide later" }
    });
  });

  it("skip updates the existing profile in place without touching consentVersion", async () => {
    prismaMock.userFindUnique.mockResolvedValue({ name: "G", email: "g@example.com", graduateProfile: { id: "profile-1" } });
    prismaMock.txGraduateProfileUpdate.mockResolvedValue({ id: "profile-1", consentStatus: "SKIPPED" });

    await skipGraduateConsent("user-1");

    expect(prismaMock.txGraduateProfileUpdate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { publicProfileEnabled: false, consentDate: null, consentStatus: "SKIPPED" }
    });
  });

  it("both decline and skip throw when the user does not exist", async () => {
    prismaMock.userFindUnique.mockResolvedValue(null);
    await expect(declineGraduateProfilePublishing("missing")).rejects.toThrow("User not found");
    await expect(skipGraduateConsent("missing")).rejects.toThrow("User not found");
  });
});

describe("getPublicProfile / getPublicProfiles", () => {
  it("only returns a profile that is public AND acknowledged", async () => {
    prismaMock.graduateProfileFindFirst.mockResolvedValue(null);
    await expect(getPublicProfile("some-slug")).resolves.toBeNull();
    expect(prismaMock.graduateProfileFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "some-slug", publicProfileEnabled: true, consentStatus: "ACKNOWLEDGED" } })
    );
  });

  it("serializes the public profile, deriving the photo URL from the stored file id when present", async () => {
    prismaMock.graduateProfileFindFirst.mockResolvedValue({
      id: "profile-1", slug: "amina-rahman", profilePhotoFileId: "file-1", profilePhotoUrl: null,
      overallRating: 4.6, bio: "Bio", country: "Pakistan", graduationDate: new Date("2026-03-10"),
      linkedinUrl: null, githubUrl: null, skills: ["typescript"],
      program: { id: "program-1", name: "AI-Native Software Engineering" },
      user: { name: "Amina Rahman", email: "amina@example.com" }
    });

    const profile = await getPublicProfile("amina-rahman");
    expect(profile?.photo).toBe("/api/graduates/amina-rahman/photo");
    expect(profile?.name).toBe("Amina Rahman");
  });

  it("falls back to the raw profilePhotoUrl when no stored-file photo exists", async () => {
    prismaMock.graduateProfileFindFirst.mockResolvedValue({
      id: "profile-1", slug: "amina-rahman", profilePhotoFileId: null, profilePhotoUrl: "https://cdn.example.com/a.jpg",
      overallRating: 4.6, bio: "Bio", country: "Pakistan", graduationDate: new Date("2026-03-10"),
      linkedinUrl: null, githubUrl: null, skills: [],
      program: null, user: { name: null, email: "amina@example.com" }
    });

    const profile = await getPublicProfile("amina-rahman");
    expect(profile?.photo).toBe("https://cdn.example.com/a.jpg");
    // Falls back to the email's local part when the user has no display name.
    expect(profile?.name).toBe("amina");
  });

  it("filters public profiles by search, country, program and graduation month, always scoped to public+acknowledged", async () => {
    prismaMock.graduateProfileFindMany.mockResolvedValue([]);
    prismaMock.graduateProfileCount.mockResolvedValue(0);
    prismaMock.programFindMany.mockResolvedValue([]);

    await getPublicProfiles({
      search: "React",
      country: "Pakistan",
      programId: "program-1",
      monthFrom: new Date("2026-01-01"),
      monthTo: new Date("2026-02-01"),
      page: 2,
      limit: 5
    });

    expect(prismaMock.graduateProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          publicProfileEnabled: true,
          consentStatus: "ACKNOWLEDGED",
          country: { contains: "Pakistan", mode: "insensitive" },
          programId: "program-1",
          graduationDate: { gte: new Date("2026-01-01"), lt: new Date("2026-02-01") }
        }),
        skip: 5,
        take: 5
      })
    );
  });

  it("defaults to sorting by rating descending", async () => {
    prismaMock.graduateProfileFindMany.mockResolvedValue([]);
    prismaMock.graduateProfileCount.mockResolvedValue(0);
    prismaMock.programFindMany.mockResolvedValue([]);

    await getPublicProfiles({});

    expect(prismaMock.graduateProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { overallRating: "desc" } })
    );
  });
});

describe("recruiter access request lifecycle", () => {
  it("createRecruiterAccessRequest upserts the recruiter account and stores only the hashed token as PENDING", async () => {
    prismaMock.recruiterAccountUpsert.mockResolvedValue({ id: "recruiter-1" });
    prismaMock.recruiterAccessRequestCreate.mockResolvedValue({ id: "request-1", status: "PENDING" });

    await createRecruiterAccessRequest(
      "graduate-1",
      { recruiterName: "Jordan", recruiterOrganization: "Acme", recruiterDesignation: "Recruiter", recruiterEmail: "jordan@acme.com" },
      "raw-token-value",
      new Date("2026-08-26")
    );

    expect(prismaMock.recruiterAccessRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        graduateId: "graduate-1",
        recruiterId: "recruiter-1",
        token: hashToken("raw-token-value"),
        status: "PENDING"
      })
    });
    // The raw token itself must never be persisted.
    const createArgs = prismaMock.recruiterAccessRequestCreate.mock.calls[0][0].data;
    expect(createArgs.token).not.toBe("raw-token-value");
  });

  it("approveAccessRequest only approves a PENDING request, sets a 7-day expiry and stores the hashed new token", async () => {
    prismaMock.txRecruiterAccessRequestFindUnique.mockResolvedValue({ id: "request-1", status: "PENDING", recruiter: { id: "recruiter-1" } });
    prismaMock.txRecruiterAccessRequestUpdate.mockResolvedValue({ id: "request-1", status: "APPROVED" });

    const result = await approveAccessRequest("request-1", "admin-1", "fresh-raw-token");

    const updateArgs = prismaMock.txRecruiterAccessRequestUpdate.mock.calls[0][0];
    expect(updateArgs.data.status).toBe("APPROVED");
    expect(updateArgs.data.token).toBe(hashToken("fresh-raw-token"));
    const msInSevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(updateArgs.data.expiresAt.getTime() - Date.now()).toBeGreaterThan(msInSevenDays - 5000);
    expect(updateArgs.data.expiresAt.getTime() - Date.now()).toBeLessThan(msInSevenDays + 5000);
    expect(result.rawToken).toBe("fresh-raw-token");
  });

  it("approveAccessRequest refuses to re-approve a request that is not PENDING", async () => {
    prismaMock.txRecruiterAccessRequestFindUnique.mockResolvedValue({ id: "request-1", status: "APPROVED", recruiter: { id: "recruiter-1" } });
    await expect(approveAccessRequest("request-1", "admin-1", "raw-token")).rejects.toThrow("already APPROVED");
  });

  it("approveAccessRequest throws for a missing request", async () => {
    prismaMock.txRecruiterAccessRequestFindUnique.mockResolvedValue(null);
    await expect(approveAccessRequest("missing", "admin-1", "raw-token")).rejects.toThrow("not found");
  });

  it("rejectAccessRequest records the reviewer and rejection reason", async () => {
    prismaMock.recruiterAccessRequestUpdate.mockResolvedValue({ id: "request-1", status: "REJECTED" });
    await rejectAccessRequest("request-1", "admin-1", "Not a verified recruiter");
    expect(prismaMock.recruiterAccessRequestUpdate).toHaveBeenCalledWith({
      where: { id: "request-1" },
      data: expect.objectContaining({ status: "REJECTED", reviewedById: "admin-1", rejectionReason: "Not a verified recruiter" })
    });
  });

  it("revokeAccessRequest only revokes an APPROVED request and invalidates the recruiter's sessions", async () => {
    prismaMock.txRecruiterAccessRequestFindUnique.mockResolvedValue({ id: "request-1", status: "APPROVED", recruiterId: "recruiter-1" });
    prismaMock.txRecruiterAccessRequestUpdate.mockResolvedValue({ id: "request-1", status: "REVOKED" });

    await revokeAccessRequest("request-1", "admin-1");

    expect(prismaMock.txRecruiterAccessRequestUpdate).toHaveBeenCalledWith({
      where: { id: "request-1" },
      data: expect.objectContaining({ status: "REVOKED", revokedById: "admin-1" })
    });
    expect(prismaMock.txRecruiterSessionDeleteMany).toHaveBeenCalledWith({ where: { recruiterId: "recruiter-1" } });
  });

  it("revokeAccessRequest refuses to revoke a request that was never approved", async () => {
    prismaMock.txRecruiterAccessRequestFindUnique.mockResolvedValue({ id: "request-1", status: "PENDING" });
    await expect(revokeAccessRequest("request-1", "admin-1")).rejects.toThrow("Only approved requests");
    expect(prismaMock.txRecruiterAccessRequestUpdate).not.toHaveBeenCalled();
  });

  it("revokeAccessRequest throws for a missing request", async () => {
    prismaMock.txRecruiterAccessRequestFindUnique.mockResolvedValue(null);
    await expect(revokeAccessRequest("missing", "admin-1")).rejects.toThrow("not found");
  });
});

describe("consumeRecruiterAccessToken", () => {
  function pendingRequest(overrides: Partial<{
    status: string; expiresAt: Date; consumedAt: Date | null;
    graduatePublic: boolean; graduateConsent: string; rejectionReason: string | null;
  }> = {}) {
    return {
      id: "request-1",
      status: overrides.status ?? "APPROVED",
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
      consumedAt: overrides.consumedAt ?? null,
      rejectionReason: overrides.rejectionReason ?? null,
      recruiter: { id: "recruiter-1" },
      graduate: {
        id: "graduate-1",
        slug: "amina-rahman",
        publicProfileEnabled: overrides.graduatePublic ?? true,
        consentStatus: overrides.graduateConsent ?? "ACKNOWLEDGED"
      }
    };
  }

  it("returns null for an unknown token", async () => {
    prismaMock.txRecruiterAccessRequestFindUnique.mockResolvedValue(null);
    await expect(consumeRecruiterAccessToken("bad-token")).resolves.toBeNull();
  });

  it.each([
    ["REVOKED", "REVOKED"],
    ["REJECTED", "REJECTED"],
    ["PENDING", "PENDING"]
  ])("surfaces a %s request as the %s error without granting a session", async (status, expectedError) => {
    prismaMock.txRecruiterAccessRequestFindUnique.mockResolvedValue(pendingRequest({ status }));
    const result = await consumeRecruiterAccessToken("token");
    expect(result).toMatchObject({ error: expectedError });
    expect(prismaMock.txRecruiterSessionCreate).not.toHaveBeenCalled();
  });

  it("treats an expired APPROVED request as EXPIRED", async () => {
    prismaMock.txRecruiterAccessRequestFindUnique.mockResolvedValue(
      pendingRequest({ expiresAt: new Date(Date.now() - 1000) })
    );
    const result = await consumeRecruiterAccessToken("token");
    expect(result).toEqual({ error: "EXPIRED" });
    expect(prismaMock.txRecruiterSessionCreate).not.toHaveBeenCalled();
  });

  it("refuses access once the graduate has disabled their public profile", async () => {
    prismaMock.txRecruiterAccessRequestFindUnique.mockResolvedValue(pendingRequest({ graduatePublic: false }));
    const result = await consumeRecruiterAccessToken("token");
    expect(result).toEqual({ error: "PROFILE_DISABLED" });
  });

  it("refuses access once the graduate's consent is no longer ACKNOWLEDGED", async () => {
    prismaMock.txRecruiterAccessRequestFindUnique.mockResolvedValue(pendingRequest({ graduateConsent: "DECLINED" }));
    const result = await consumeRecruiterAccessToken("token");
    expect(result).toEqual({ error: "PROFILE_DISABLED" });
  });

  it("grants a session and marks first-use on a valid approved token", async () => {
    prismaMock.txRecruiterAccessRequestFindUnique.mockResolvedValue(pendingRequest());
    const result = await consumeRecruiterAccessToken("token");

    expect(prismaMock.txRecruiterAccessRequestUpdate).toHaveBeenCalledWith({
      where: { id: "request-1" },
      data: { consumedAt: expect.any(Date) }
    });
    expect(prismaMock.txRecruiterAccountUpdate).toHaveBeenCalledWith({
      where: { id: "recruiter-1" },
      data: { verifiedAt: expect.any(Date) }
    });
    expect(prismaMock.txRecruiterSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ recruiterId: "recruiter-1" })
    });
    expect(result).toMatchObject({ sessionToken: expect.any(String) });
  });

  it("does not re-stamp consumedAt on a second visit (link stays reusable for the full window)", async () => {
    prismaMock.txRecruiterAccessRequestFindUnique.mockResolvedValue(pendingRequest({ consumedAt: new Date("2026-08-19T00:00:00.000Z") }));
    await consumeRecruiterAccessToken("token");
    expect(prismaMock.txRecruiterAccessRequestUpdate).not.toHaveBeenCalled();
    // Still grants a fresh session on every verified visit.
    expect(prismaMock.txRecruiterSessionCreate).toHaveBeenCalled();
  });
});

describe("getAllAccessibleGraduates / getFullProfileForRecruiter (grant-gated recruiter reads)", () => {
  it("getAllAccessibleGraduates returns null when the recruiter has no active APPROVED grant", async () => {
    prismaMock.recruiterAccessRequestFindFirst.mockResolvedValue(null);
    await expect(getAllAccessibleGraduates("recruiter-1")).resolves.toBeNull();
    expect(prismaMock.graduateProfileFindMany).not.toHaveBeenCalled();
  });

  it("getAllAccessibleGraduates returns every public+consented graduate, not just the one tied to the request", async () => {
    prismaMock.recruiterAccessRequestFindFirst.mockResolvedValue({ id: "request-1", expiresAt: new Date("2026-08-26") });
    prismaMock.graduateProfileFindMany.mockResolvedValue([
      { id: "g1", slug: "amina", profilePhotoFileId: null, profilePhotoUrl: null, overallRating: 4.6, bio: "Bio", country: null, graduationDate: new Date(), linkedinUrl: null, githubUrl: null, skills: [], program: null, user: { name: "Amina", email: "a@x.com" } },
      { id: "g2", slug: "daniel", profilePhotoFileId: null, profilePhotoUrl: null, overallRating: 4.5, bio: "Bio", country: null, graduationDate: new Date(), linkedinUrl: null, githubUrl: null, skills: [], program: null, user: { name: "Daniel", email: "d@x.com" } }
    ]);

    const result = await getAllAccessibleGraduates("recruiter-1");

    expect(prismaMock.graduateProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publicProfileEnabled: true, consentStatus: "ACKNOWLEDGED" } })
    );
    expect(result?.graduates).toHaveLength(2);
    expect(result?.accessExpiresAt).toEqual(new Date("2026-08-26"));
  });

  it("getFullProfileForRecruiter returns null when the recruiter has no active grant, without leaking any profile data", async () => {
    prismaMock.recruiterAccessRequestFindFirst.mockResolvedValue(null);
    await expect(getFullProfileForRecruiter("amina", "recruiter-1")).resolves.toBeNull();
    expect(prismaMock.graduateProfileFindUnique).not.toHaveBeenCalled();
  });

  it("getFullProfileForRecruiter returns null for a profile that has since gone private, even with a valid grant", async () => {
    prismaMock.recruiterAccessRequestFindFirst.mockResolvedValue({ id: "request-1", expiresAt: new Date("2026-08-26") });
    prismaMock.graduateProfileFindUnique.mockResolvedValue({
      id: "g1", publicProfileEnabled: false, consentStatus: "ACKNOWLEDGED",
      user: { submissions: [] }
    });
    await expect(getFullProfileForRecruiter("amina", "recruiter-1")).resolves.toBeNull();
  });

  it("getFullProfileForRecruiter hides the applicant's email unless they opted into emailPublic", async () => {
    prismaMock.recruiterAccessRequestFindFirst.mockResolvedValue({ id: "request-1", expiresAt: new Date("2026-08-26") });
    prismaMock.graduateProfileFindUnique.mockResolvedValue({
      id: "g1", slug: "amina", publicProfileEnabled: true, consentStatus: "ACKNOWLEDGED", emailPublic: false,
      profilePhotoFileId: null, profilePhotoUrl: null, bio: "Bio", country: null, skills: [], interests: [],
      linkedinUrl: null, githubUrl: null, program: null, overallRating: 4.6, graduationDate: new Date(),
      artifacts: [], aiEvaluatedAt: null,
      user: { name: "Amina", email: "amina@example.com", submissions: [] }
    });
    prismaMock.savedCandidateFindUnique.mockResolvedValue(null);

    const profile = await getFullProfileForRecruiter("amina", "recruiter-1");
    expect(profile?.overview.email).toBeNull();
  });

  it("getFullProfileForRecruiter surfaces the applicant's email when emailPublic is true", async () => {
    prismaMock.recruiterAccessRequestFindFirst.mockResolvedValue({ id: "request-1", expiresAt: new Date("2026-08-26") });
    prismaMock.graduateProfileFindUnique.mockResolvedValue({
      id: "g1", slug: "amina", publicProfileEnabled: true, consentStatus: "ACKNOWLEDGED", emailPublic: true,
      profilePhotoFileId: null, profilePhotoUrl: null, bio: "Bio", country: null, skills: [], interests: [],
      linkedinUrl: null, githubUrl: null, program: null, overallRating: 4.6, graduationDate: new Date(),
      artifacts: [], aiEvaluatedAt: null,
      user: { name: "Amina", email: "amina@example.com", submissions: [] }
    });
    prismaMock.savedCandidateFindUnique.mockResolvedValue(null);

    const profile = await getFullProfileForRecruiter("amina", "recruiter-1");
    expect(profile?.overview.email).toBe("amina@example.com");
  });
});

describe("toggleSavedCandidate", () => {
  it("returns null when the graduate slug does not resolve to a public, consented profile", async () => {
    prismaMock.graduateProfileFindFirst.mockResolvedValue(null);
    await expect(toggleSavedCandidate("recruiter-1", "unknown-slug")).resolves.toBeNull();
    expect(prismaMock.savedCandidateFindUnique).not.toHaveBeenCalled();
  });

  it("saves the candidate when not already saved", async () => {
    prismaMock.graduateProfileFindFirst.mockResolvedValue({ id: "graduate-1" });
    prismaMock.savedCandidateFindUnique.mockResolvedValue(null);
    const result = await toggleSavedCandidate("recruiter-1", "amina-rahman");
    expect(prismaMock.savedCandidateCreate).toHaveBeenCalledWith({ data: { recruiterId: "recruiter-1", graduateId: "graduate-1" } });
    expect(result).toEqual({ saved: true });
  });

  it("un-saves the candidate when already saved", async () => {
    prismaMock.graduateProfileFindFirst.mockResolvedValue({ id: "graduate-1" });
    prismaMock.savedCandidateFindUnique.mockResolvedValue({ id: "saved-1" });
    const result = await toggleSavedCandidate("recruiter-1", "amina-rahman");
    expect(prismaMock.savedCandidateDelete).toHaveBeenCalledWith({ where: { id: "saved-1" } });
    expect(result).toEqual({ saved: false });
  });
});
