import { Prisma, type ProgramStatus } from "@prisma/client";
import { prisma } from "./client";

/** Published programs a tenant currently accepts applications for. */
export function listPublishedPrograms(tenantId: string) {
  return prisma.program.findMany({
    where: { tenantId, status: "PUBLISHED" },
    orderBy: { name: "asc" }
  });
}

/** All programs for a tenant (admin management list). */
export function listTenantPrograms(tenantId: string) {
  return prisma.program.findMany({
    where: { tenantId },
    orderBy: [{ status: "asc" }, { name: "asc" }]
  });
}

/** A single tenant-scoped program (admin detail/edit). */
export function getTenantProgram(id: string, tenantId: string) {
  return prisma.program.findFirst({ where: { id, tenantId } });
}

/** Derive a URL-friendly slug from a program name. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Translate a unique-constraint violation on [tenantId, slug] into a friendly message.
function rethrowDuplicateSlug(error: unknown, slug: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new Error(`A program with slug "${slug}" already exists for this tenant.`);
  }
  throw error;
}

export type CreateProgramInput = {
  tenantId: string;
  name: string;
  slug: string;
  description: string;
  status: ProgramStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  actorUserId: string | null;
};

export async function createProgram({
  tenantId,
  name,
  slug,
  description,
  status,
  startsAt,
  endsAt,
  actorUserId
}: CreateProgramInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const program = await tx.program.create({
        data: { tenantId, name, slug, description, status, startsAt: startsAt ?? null, endsAt: endsAt ?? null }
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId,
          action: "program.created",
          entityType: "Program",
          entityId: program.id,
          metadata: { slug, status }
        }
      });

      return program;
    });
  } catch (error) {
    rethrowDuplicateSlug(error, slug);
  }
}

export type UpdateProgramInput = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  actorUserId: string | null;
};

export async function updateProgram({
  id,
  tenantId,
  name,
  slug,
  description,
  startsAt,
  endsAt,
  actorUserId
}: UpdateProgramInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Scope the write by tenant so a raw id can never cross tenants (defense-in-depth for D-051).
      const result = await tx.program.updateMany({
        where: { id, tenantId },
        data: { name, slug, description, startsAt: startsAt ?? null, endsAt: endsAt ?? null }
      });
      if (result.count === 0) {
        throw new Error("Program not found for this tenant.");
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId,
          action: "program.updated",
          entityType: "Program",
          entityId: id,
          metadata: { slug }
        }
      });

      return tx.program.findFirstOrThrow({ where: { id, tenantId } });
    });
  } catch (error) {
    rethrowDuplicateSlug(error, slug);
  }
}

export type SetProgramStatusInput = {
  id: string;
  tenantId: string;
  status: ProgramStatus;
  actorUserId: string | null;
};

export function setProgramStatus({ id, tenantId, status, actorUserId }: SetProgramStatusInput) {
  return prisma.$transaction(async (tx) => {
    // Scope the write by tenant so a raw id can never cross tenants (defense-in-depth for D-051).
    const result = await tx.program.updateMany({ where: { id, tenantId }, data: { status } });
    if (result.count === 0) {
      throw new Error("Program not found for this tenant.");
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: "program.status_changed",
        entityType: "Program",
        entityId: id,
        metadata: { status }
      }
    });

    return tx.program.findFirstOrThrow({ where: { id, tenantId } });
  });
}
