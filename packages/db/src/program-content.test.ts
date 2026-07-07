import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  transaction: vi.fn(),
  txProgramFindFirst: vi.fn(),
  txResourceCreate: vi.fn(),
  txResourceUpdateMany: vi.fn(),
  txResourceDeleteMany: vi.fn(),
  txResourceFindFirstOrThrow: vi.fn(),
  txTaskCreate: vi.fn(),
  txTaskUpdateMany: vi.fn(),
  txTaskDeleteMany: vi.fn(),
  txTaskFindFirstOrThrow: vi.fn(),
  txEventCreate: vi.fn(),
  txEventUpdateMany: vi.fn(),
  txEventDeleteMany: vi.fn(),
  txEventFindFirstOrThrow: vi.fn(),
  txAuditLogCreate: vi.fn()
}));

vi.mock("./client", () => ({
  prisma: {
    $transaction: prismaMock.transaction
  }
}));

import {
  createCalendarEvent,
  createProgramTask,
  createVideoResource,
  deleteCalendarEvent,
  deleteProgramTask,
  deleteVideoResource,
  updateProgramTask,
  updateVideoResource
} from "./program-content";

// Program-content CRUD (v0.16.0, D-069): tenant-scoped, program-chained and audited, mirroring
// the missions.ts conventions.
describe("program content data access", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
    prismaMock.transaction.mockImplementation(async (callback) =>
      callback({
        program: { findFirst: prismaMock.txProgramFindFirst },
        videoResource: {
          create: prismaMock.txResourceCreate,
          updateMany: prismaMock.txResourceUpdateMany,
          deleteMany: prismaMock.txResourceDeleteMany,
          findFirstOrThrow: prismaMock.txResourceFindFirstOrThrow
        },
        programTask: {
          create: prismaMock.txTaskCreate,
          updateMany: prismaMock.txTaskUpdateMany,
          deleteMany: prismaMock.txTaskDeleteMany,
          findFirstOrThrow: prismaMock.txTaskFindFirstOrThrow
        },
        calendarEvent: {
          create: prismaMock.txEventCreate,
          updateMany: prismaMock.txEventUpdateMany,
          deleteMany: prismaMock.txEventDeleteMany,
          findFirstOrThrow: prismaMock.txEventFindFirstOrThrow
        },
        auditLog: { create: prismaMock.txAuditLogCreate }
      })
    );
    prismaMock.txProgramFindFirst.mockResolvedValue({ id: "program-1" });
    prismaMock.txResourceCreate.mockResolvedValue({ id: "res-1" });
    prismaMock.txResourceUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.txResourceDeleteMany.mockResolvedValue({ count: 1 });
    prismaMock.txResourceFindFirstOrThrow.mockResolvedValue({ id: "res-1" });
    prismaMock.txTaskCreate.mockResolvedValue({ id: "task-1" });
    prismaMock.txTaskUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.txTaskDeleteMany.mockResolvedValue({ count: 1 });
    prismaMock.txTaskFindFirstOrThrow.mockResolvedValue({ id: "task-1" });
    prismaMock.txEventCreate.mockResolvedValue({ id: "event-1" });
    prismaMock.txEventUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.txEventDeleteMany.mockResolvedValue({ count: 1 });
    prismaMock.txEventFindFirstOrThrow.mockResolvedValue({ id: "event-1" });
    prismaMock.txAuditLogCreate.mockResolvedValue({ id: "audit-1" });
  });

  it("creates a video resource only for a program of the tenant, with audit", async () => {
    await createVideoResource(resourceInput());

    expect(prismaMock.txProgramFindFirst).toHaveBeenCalledWith({
      where: { id: "program-1", tenantId: "tenant-1" },
      select: { id: true }
    });
    expect(prismaMock.txResourceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-1", programId: "program-1", weekNumber: 1 })
    });
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "resource.created", entityType: "VideoResource" })
    });
  });

  it("rejects creating content for a program outside the tenant", async () => {
    prismaMock.txProgramFindFirst.mockResolvedValue(null);
    await expect(createVideoResource(resourceInput())).rejects.toThrow("Program not found for this tenant.");
    await expect(createProgramTask(taskInput())).rejects.toThrow("Program not found for this tenant.");
    await expect(createCalendarEvent(eventInput())).rejects.toThrow("Program not found for this tenant.");
    expect(prismaMock.txResourceCreate).not.toHaveBeenCalled();
    expect(prismaMock.txTaskCreate).not.toHaveBeenCalled();
    expect(prismaMock.txEventCreate).not.toHaveBeenCalled();
  });

  it("updates are tenant + program scoped and audited", async () => {
    await updateVideoResource({ ...resourceInput(), id: "res-1" });
    expect(prismaMock.txResourceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "res-1", tenantId: "tenant-1", programId: "program-1" } })
    );
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "resource.updated" })
    });

    await updateProgramTask({ ...taskInput(), id: "task-1" });
    expect(prismaMock.txTaskUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "task-1", tenantId: "tenant-1", programId: "program-1" } })
    );
  });

  it("rejects cross-tenant updates (zero rows matched)", async () => {
    prismaMock.txResourceUpdateMany.mockResolvedValue({ count: 0 });
    await expect(updateVideoResource({ ...resourceInput(), id: "res-1", tenantId: "other-tenant" })).rejects.toThrow(
      "Video resource not found for this tenant."
    );
    expect(prismaMock.txAuditLogCreate).not.toHaveBeenCalled();
  });

  it("creates tasks and events with audit entries", async () => {
    await createProgramTask(taskInput());
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "task.created", entityType: "ProgramTask" })
    });

    await createCalendarEvent(eventInput());
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "event.created", entityType: "CalendarEvent" })
    });
  });

  it("deletes are tenant-scoped, audited, and reject cross-tenant ids", async () => {
    await deleteVideoResource({ id: "res-1", tenantId: "tenant-1", actorUserId: "admin-1" });
    expect(prismaMock.txResourceDeleteMany).toHaveBeenCalledWith({ where: { id: "res-1", tenantId: "tenant-1" } });
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "resource.deleted" })
    });

    await deleteProgramTask({ id: "task-1", tenantId: "tenant-1", actorUserId: "admin-1" });
    await deleteCalendarEvent({ id: "event-1", tenantId: "tenant-1", actorUserId: "admin-1" });

    prismaMock.txEventDeleteMany.mockResolvedValue({ count: 0 });
    await expect(
      deleteCalendarEvent({ id: "event-1", tenantId: "other-tenant", actorUserId: "admin-1" })
    ).rejects.toThrow("Calendar event not found for this tenant.");
  });
});

function resourceInput() {
  return {
    tenantId: "tenant-1",
    programId: "program-1",
    title: "REST API Best Practices",
    url: "https://www.youtube.com/watch?v=abc",
    description: "API design principles.",
    weekNumber: 1,
    actorUserId: "admin-1"
  };
}

function taskInput() {
  return {
    tenantId: "tenant-1",
    programId: "program-1",
    title: "Environment Setup",
    description: "Install Node.js and Docker.",
    weekNumber: 1,
    order: 0,
    dueAt: new Date("2026-07-10"),
    actorUserId: "admin-1"
  };
}

function eventInput() {
  return {
    tenantId: "tenant-1",
    programId: "program-1",
    title: "Week 1 Kickoff",
    description: "Welcome call.",
    startsAt: new Date("2026-07-08T10:00:00Z"),
    endsAt: new Date("2026-07-08T11:00:00Z"),
    location: "Zoom",
    actorUserId: "admin-1"
  };
}
