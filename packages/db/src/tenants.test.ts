import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  tenantFindUnique: vi.fn(),
  tenantFindMany: vi.fn(),
  transaction: vi.fn(),
  txTenantCreate: vi.fn(),
  txTenantUpdate: vi.fn(),
  txUserUpsert: vi.fn(),
  txTenantMembershipUpsert: vi.fn(),
  txAuditLogCreate: vi.fn()
}));

vi.mock("./client", () => ({
  prisma: {
    tenant: {
      findUnique: prismaMock.tenantFindUnique,
      findMany: prismaMock.tenantFindMany
    },
    $transaction: prismaMock.transaction
  }
}));

import { Prisma } from "@prisma/client";
import {
  getTenantBySlug,
  listTenants,
  createOrganization,
  updateTenantBranding
} from "./tenants";

describe("tenant data access", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
    prismaMock.transaction.mockImplementation(async (callback) =>
      callback({
        tenant: {
          create: prismaMock.txTenantCreate,
          update: prismaMock.txTenantUpdate
        },
        user: { upsert: prismaMock.txUserUpsert },
        tenantMembership: { upsert: prismaMock.txTenantMembershipUpsert },
        auditLog: { create: prismaMock.txAuditLogCreate }
      })
    );
  });

  describe("getTenantBySlug", () => {
    it("resolves a tenant by its slug", async () => {
      const tenant = { id: "t1", slug: "demo", name: "Demo" };
      prismaMock.tenantFindUnique.mockResolvedValue(tenant);

      const result = await getTenantBySlug("demo");

      expect(prismaMock.tenantFindUnique).toHaveBeenCalledWith({ where: { slug: "demo" } });
      expect(result).toEqual(tenant);
    });

    it("returns null for an unknown slug", async () => {
      prismaMock.tenantFindUnique.mockResolvedValue(null);
      expect(await getTenantBySlug("nonexistent")).toBeNull();
    });
  });

  describe("listTenants", () => {
    it("lists all tenants ordered by name with member and program counts", async () => {
      const tenants = [
        { id: "t1", name: "Alpha", slug: "alpha", _count: { memberships: 3, programs: 2 } },
        { id: "t2", name: "Beta", slug: "beta", _count: { memberships: 5, programs: 1 } }
      ];
      prismaMock.tenantFindMany.mockResolvedValue(tenants);

      const result = await listTenants();

      expect(prismaMock.tenantFindMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
        include: { _count: { select: { memberships: true, programs: true } } }
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("createOrganization", () => {
    const input = {
      name: "Acme Corp",
      slug: "acme",
      primaryColor: "#2563eb",
      secondaryColor: "#0f172a",
      adminEmail: "admin@acme.com",
      adminName: "Acme Admin",
      actorUserId: "superadmin-1"
    };

    it("creates a tenant, upserts the admin user, grants ORG_ADMIN, and writes audit", async () => {
      prismaMock.txTenantCreate.mockResolvedValue({ id: "t-new", slug: "acme", name: "Acme Corp" });
      prismaMock.txUserUpsert.mockResolvedValue({ id: "u-admin", email: "admin@acme.com" });
      prismaMock.txTenantMembershipUpsert.mockResolvedValue({});

      const result = await createOrganization(input);

      expect(prismaMock.txTenantCreate).toHaveBeenCalledWith({
        data: { name: "Acme Corp", slug: "acme", primaryColor: "#2563eb", secondaryColor: "#0f172a" }
      });
      expect(prismaMock.txUserUpsert).toHaveBeenCalledWith({
        where: { email: "admin@acme.com" },
        update: { name: "Acme Admin" },
        create: { email: "admin@acme.com", name: "Acme Admin" }
      });
      expect(prismaMock.txTenantMembershipUpsert).toHaveBeenCalledWith({
        where: {
          tenantId_userId_role: { tenantId: "t-new", userId: "u-admin", role: "ORG_ADMIN" }
        },
        update: {},
        create: { tenantId: "t-new", userId: "u-admin", role: "ORG_ADMIN" }
      });
      expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "organization.created",
          entityType: "Tenant",
          entityId: "t-new",
          metadata: { slug: "acme", adminEmail: "admin@acme.com" }
        })
      });
      expect(result).toEqual({ id: "t-new", slug: "acme", name: "Acme Corp" });
    });

    it("normalizes the admin email before upsert", async () => {
      prismaMock.txTenantCreate.mockResolvedValue({ id: "t-new", slug: "acme" });
      prismaMock.txUserUpsert.mockResolvedValue({ id: "u-admin", email: "admin@acme.com" });

      await createOrganization({ ...input, adminEmail: "  Admin@ACME.com  " });

      expect(prismaMock.txUserUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: "admin@acme.com" } })
      );
    });

    it("throws a friendly error on duplicate slug (P2002)", async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.10.0"
      });
      prismaMock.txTenantCreate.mockRejectedValue(p2002);

      await expect(createOrganization(input)).rejects.toThrow('A tenant with slug "acme" already exists.');
    });

    it("writes the actor user id in the audit log", async () => {
      prismaMock.txTenantCreate.mockResolvedValue({ id: "t-new", slug: "acme" });
      prismaMock.txUserUpsert.mockResolvedValue({ id: "u-admin" });

      await createOrganization(input);

      expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ actorUserId: "superadmin-1" })
      });
    });

    it("writes a null actor user id when no actor is provided", async () => {
      prismaMock.txTenantCreate.mockResolvedValue({ id: "t-new", slug: "acme" });
      prismaMock.txUserUpsert.mockResolvedValue({ id: "u-admin" });

      await createOrganization({ ...input, actorUserId: null });

      expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ actorUserId: null })
      });
    });
  });

  describe("updateTenantBranding", () => {
    const input = {
      id: "t1",
      name: "Updated Name",
      primaryColor: "#ff0000",
      secondaryColor: "#00ff00",
      actorUserId: "admin-1"
    };

    it("updates tenant branding and writes an audit log", async () => {
      prismaMock.txTenantUpdate.mockResolvedValue({ id: "t1", name: "Updated Name" });

      const result = await updateTenantBranding(input);

      expect(prismaMock.txTenantUpdate).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { name: "Updated Name", primaryColor: "#ff0000", secondaryColor: "#00ff00" }
      });
      expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "tenant.branding_updated",
          entityType: "Tenant",
          entityId: "t1",
          metadata: { name: "Updated Name", primaryColor: "#ff0000", secondaryColor: "#00ff00" }
        })
      });
      expect(result).toEqual({ id: "t1", name: "Updated Name" });
    });

    it("includes logoFileId when provided", async () => {
      prismaMock.txTenantUpdate.mockResolvedValue({ id: "t1" });

      await updateTenantBranding({ ...input, logoFileId: "file-1" });

      expect(prismaMock.txTenantUpdate).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: expect.objectContaining({ logoFileId: "file-1" })
      });
    });

    it("omits logoFileId when undefined (preserves existing logo)", async () => {
      prismaMock.txTenantUpdate.mockResolvedValue({ id: "t1" });

      await updateTenantBranding({ ...input, logoFileId: undefined });

      const updateData = prismaMock.txTenantUpdate.mock.calls[0][0].data;
      expect(updateData).not.toHaveProperty("logoFileId");
    });

    it("allows clearing the logo by passing null", async () => {
      prismaMock.txTenantUpdate.mockResolvedValue({ id: "t1" });

      await updateTenantBranding({ ...input, logoFileId: null });

      expect(prismaMock.txTenantUpdate).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: expect.objectContaining({ logoFileId: null })
      });
    });
  });
});
