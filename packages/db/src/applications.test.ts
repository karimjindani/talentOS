import type { ApplicationStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  applicationFindFirst: vi.fn(),
  transaction: vi.fn(),
  txApplicationFindFirst: vi.fn(),
  txApplicationCreate: vi.fn(),
  txAuditLogCreate: vi.fn()
}));

vi.mock("./client", () => ({
  prisma: {
    application: {
      findFirst: prismaMock.applicationFindFirst
    },
    $transaction: prismaMock.transaction
  }
}));

import {
  APPLICATION_DUPLICATE_POLICY_CASES,
  canApplyAfterPreviousApplicationStatus,
  createSubmittedApplication,
  DUPLICATE_APPLICATION_ERROR_MESSAGE,
  DUPLICATE_BLOCKING_APPLICATION_STATUSES,
  findActiveApplication
} from "./applications";

const ALL_APPLICATION_STATUSES: ApplicationStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "WAITLISTED"
];

describe("application duplicate policy", () => {
  beforeEach(() => {
    prismaMock.applicationFindFirst.mockReset();
    prismaMock.transaction.mockReset();
    prismaMock.txApplicationFindFirst.mockReset();
    prismaMock.txApplicationCreate.mockReset();
    prismaMock.txAuditLogCreate.mockReset();

    prismaMock.transaction.mockImplementation(async (callback) =>
      callback({
        application: {
          findFirst: prismaMock.txApplicationFindFirst,
          create: prismaMock.txApplicationCreate
        },
        auditLog: {
          create: prismaMock.txAuditLogCreate
        }
      })
    );
    prismaMock.txApplicationCreate.mockResolvedValue({ id: "application-1" });
    prismaMock.txAuditLogCreate.mockResolvedValue({ id: "audit-1" });
  });

  it("matches the documented duplicate-application rules", () => {
    for (const { previousStatus, canApply } of APPLICATION_DUPLICATE_POLICY_CASES) {
      expect(canApplyAfterPreviousApplicationStatus(previousStatus)).toBe(canApply);
    }
  });

  it("blocks every non-rejected status that represents an existing application", () => {
    expect(DUPLICATE_BLOCKING_APPLICATION_STATUSES).toEqual([
      "DRAFT",
      "SUBMITTED",
      "UNDER_REVIEW",
      "ACCEPTED",
      "WAITLISTED"
    ]);
    expect(DUPLICATE_BLOCKING_APPLICATION_STATUSES).not.toContain("REJECTED");

    const allowedAfter = ALL_APPLICATION_STATUSES.filter(canApplyAfterPreviousApplicationStatus);
    expect(allowedAfter).toEqual(["REJECTED"]);
  });

  it("searches duplicate-blocking statuses before allowing an apply attempt", async () => {
    prismaMock.applicationFindFirst.mockResolvedValue(null);

    await findActiveApplication("applicant-1", "program-1");

    expect(prismaMock.applicationFindFirst).toHaveBeenCalledWith({
      where: {
        applicantId: "applicant-1",
        programId: "program-1",
        status: { in: DUPLICATE_BLOCKING_APPLICATION_STATUSES }
      }
    });
  });

  it("rechecks duplicate-blocking applications inside the create transaction", async () => {
    prismaMock.txApplicationFindFirst.mockResolvedValue({ id: "existing-application" });

    await expect(
      createSubmittedApplication({
        tenantId: "tenant-1",
        programId: "program-1",
        applicantId: "applicant-1",
        answers: [{ questionKey: "motivation", questionLabel: "Motivation", answer: "Because." }]
      })
    ).rejects.toThrow(DUPLICATE_APPLICATION_ERROR_MESSAGE);

    expect(prismaMock.txApplicationFindFirst).toHaveBeenCalledWith({
      where: {
        applicantId: "applicant-1",
        programId: "program-1",
        status: { in: DUPLICATE_BLOCKING_APPLICATION_STATUSES }
      }
    });
    expect(prismaMock.txApplicationCreate).not.toHaveBeenCalled();
  });

  it("maps database duplicate unique violations to the shared application error", async () => {
    prismaMock.transaction.mockRejectedValue({
      code: "P2002",
      meta: { target: ["applicantId", "programId"] }
    });

    await expect(
      createSubmittedApplication({
        tenantId: "tenant-1",
        programId: "program-1",
        applicantId: "applicant-1",
        answers: [{ questionKey: "motivation", questionLabel: "Motivation", answer: "Because." }]
      })
    ).rejects.toThrow(DUPLICATE_APPLICATION_ERROR_MESSAGE);
  });
});
