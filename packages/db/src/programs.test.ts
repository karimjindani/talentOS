import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  programFindMany: vi.fn(),
  programFindFirst: vi.fn(),
  transaction: vi.fn(),
  txProgramCreate: vi.fn(),
  txProgramUpdateMany: vi.fn(),
  txProgramFindFirstOrThrow: vi.fn(),
  txAuditLogCreate: vi.fn()
}));

vi.mock("./client", () => ({
  prisma: {
    program: {
      findMany: prismaMock.programFindMany,
      findFirst: prismaMock.programFindFirst
    },
    $transaction: prismaMock.transaction
  }
}));

import { Prisma } from "@prisma/client";
import {
  listPublishedPrograms,
  listTenantPrograms,
  getTenantProgram,
  slugify,
  createProgram,
  updateProgram
} from "./programs";

describe("program data access", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
    prismaMock.transaction.mockImplementation(async (callback) =>
      callback({
        program: {
          create: prismaMock.txProgramCreate,
          updateMany: prismaMock.txProgramUpdateMany,
          findFirstOrThrow: prismaMock.txProgramFindFirstOrThrow
        },
        auditLog: { create: prismaMock.txAuditLogCreate }
      })
    );
  });

  describe("listPublishedPrograms", () => {
    it("lists only PUBLISHED programs for a tenant, ordered by name", async () => {
      prismaMock.programFindMany.mockResolvedValue([{ id: "p1", name: "Alpha", status: "PUBLISHED" }]);

      const result = await listPublishedPrograms("tenant-1");

      expect(prismaMock.programFindMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", status: "PUBLISHED" },
        orderBy: { name: "asc" }
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("listTenantPrograms", () => {
    it("lists all programs for a tenant, ordered by status then name", async () => {
      prismaMock.programFindMany.mockResolvedValue([]);

      await listTenantPrograms("tenant-1");

      expect(prismaMock.programFindMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1" },
        orderBy: [{ status: "asc" }, { name: "asc" }]
      });
    });
  });

  describe("getTenantProgram", () => {
    it("finds a program scoped by tenant", async () => {
      const program = { id: "p1", tenantId: "tenant-1", name: "Alpha" };
      prismaMock.programFindFirst.mockResolvedValue(program);

      const result = await getTenantProgram("p1", "tenant-1");

      expect(prismaMock.programFindFirst).toHaveBeenCalledWith({ where: { id: "p1", tenantId: "tenant-1" } });
      expect(result).toEqual(program);
    });

    it("returns null for a cross-tenant program", async () => {
      prismaMock.programFindFirst.mockResolvedValue(null);
      expect(await getTenantProgram("p1", "other-tenant")).toBeNull();
    });
  });

  describe("slugify", () => {
    it("lowercases and hyphenates", () => {
      expect(slugify("AI-Native Engineering")).toBe("ai-native-engineering");
      expect(slugify("Cloud Platform")).toBe("cloud-platform");
    });

    it("replaces non-alphanumeric sequences with a single hyphen", () => {
      expect(slugify("A B!C@D")).toBe("a-b-c-d");
    });

    it("strips leading and trailing hyphens", () => {
      expect(slugify("  Hello  ")).toBe("hello");
    });

    it("returns empty string for non-alphanumeric input", () => {
      expect(slugify("!@#$%")).toBe("");
    });
  });

  describe("createProgram", () => {
    const input = {
      tenantId: "tenant-1",
      name: "New Program",
      slug: "new-program",
      description: "A program",
      status: "DRAFT" as const,
      startsAt: null,
      endsAt: null,
      actorUserId: "admin-1"
    };

    it("creates a program and writes an audit log", async () => {
      prismaMock.txProgramCreate.mockResolvedValue({ id: "p-new", ...input });

      const result = await createProgram(input);

      expect(prismaMock.txProgramCreate).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-1",
          name: "New Program",
          slug: "new-program",
          description: "A program",
          status: "DRAFT",
          startsAt: null,
          endsAt: null
        }
      });
      expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "program.created",
          entityType: "Program",
          entityId: "p-new",
          metadata: { slug: "new-program", status: "DRAFT" }
        })
      });
      expect(result).toEqual({ id: "p-new", ...input });
    });

    it("throws a friendly error on duplicate slug (P2002)", async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.10.0"
      });
      prismaMock.txProgramCreate.mockRejectedValue(p2002);

      await expect(createProgram(input)).rejects.toThrow(
        'A program with slug "new-program" already exists for this tenant.'
      );
    });
  });

  describe("updateProgram", () => {
    const input = {
      id: "p1",
      tenantId: "tenant-1",
      name: "Updated",
      slug: "updated",
      description: "Updated desc",
      startsAt: null,
      endsAt: null,
      actorUserId: "admin-1"
    };

    it("updates a tenant-scoped program and writes audit", async () => {
      prismaMock.txProgramUpdateMany.mockResolvedValue({ count: 1 });
      prismaMock.txProgramFindFirstOrThrow.mockResolvedValue({ id: "p1", name: "Updated" });

      await updateProgram(input);

      expect(prismaMock.txProgramUpdateMany).toHaveBeenCalledWith({
        where: { id: "p1", tenantId: "tenant-1" },
        data: { name: "Updated", slug: "updated", description: "Updated desc", startsAt: null, endsAt: null }
      });
      expect(prismaMock.txAuditLogCreate).toHaveBeenCalled();
    });

    it("throws when the program does not exist in this tenant (count: 0)", async () => {
      prismaMock.txProgramUpdateMany.mockResolvedValue({ count: 0 });

      await expect(updateProgram(input)).rejects.toThrow("Program not found for this tenant.");
    });
  });
});
