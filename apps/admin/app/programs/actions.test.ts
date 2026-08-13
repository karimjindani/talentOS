import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenantAccess: vi.fn(),
  createProgram: vi.fn(),
  getTenantProgram: vi.fn(),
  updateProgram: vi.fn(),
  setProgramStatus: vi.fn(),
  slugify: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn()
}));

vi.mock("@/lib/tenant-guard", () => ({
  requireTenantAccess: mocks.requireTenantAccess
}));

vi.mock("@talentos/db", () => ({
  createProgram: mocks.createProgram,
  getTenantProgram: mocks.getTenantProgram,
  setProgramStatus: mocks.setProgramStatus,
  slugify: mocks.slugify,
  updateProgram: mocks.updateProgram
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  createProgramAction,
  updateProgramAction,
  setProgramStatusAction
} from "./actions";

const tenantCtx = { tenant: { id: "tenant-1", slug: "demo" }, actorUserId: "admin-1" };

describe("createProgramAction", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.requireTenantAccess.mockResolvedValue(tenantCtx);
    mocks.slugify.mockImplementation((v: string) => v.toLowerCase().replace(/\s+/g, "-"));
  });

  it("creates a program and redirects to its detail page", async () => {
    mocks.createProgram.mockResolvedValue({ id: "p-new" });

    const formData = new FormData();
    formData.set("name", "New Program");
    formData.set("slug", "new-program");
    formData.set("description", "A description");
    formData.set("status", "DRAFT");

    await createProgramAction(formData);

    expect(mocks.createProgram).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        name: "New Program",
        slug: "new-program",
        description: "A description",
        status: "DRAFT"
      })
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/programs/p-new");
  });

  it("derives the slug from the name when slug is blank", async () => {
    mocks.createProgram.mockResolvedValue({ id: "p-new" });

    const formData = new FormData();
    formData.set("name", "Cloud Platform");
    formData.set("slug", "");
    formData.set("description", "");
    formData.set("status", "DRAFT");

    await createProgramAction(formData);

    expect(mocks.createProgram).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "cloud-platform" })
    );
  });

  it("defaults status to DRAFT when an invalid status is provided", async () => {
    mocks.createProgram.mockResolvedValue({ id: "p-new" });

    const formData = new FormData();
    formData.set("name", "Test");
    formData.set("slug", "");
    formData.set("description", "");
    formData.set("status", "INVALID");

    await createProgramAction(formData);

    expect(mocks.createProgram).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DRAFT" })
    );
  });
});

describe("updateProgramAction", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.requireTenantAccess.mockResolvedValue(tenantCtx);
    mocks.slugify.mockImplementation((v: string) => v.toLowerCase().replace(/\s+/g, "-"));
  });

  it("updates an existing program and revalidates", async () => {
    mocks.getTenantProgram.mockResolvedValue({ id: "p1", tenantId: "tenant-1" });
    mocks.updateProgram.mockResolvedValue({});

    const formData = new FormData();
    formData.set("programId", "p1");
    formData.set("name", "Updated Name");
    formData.set("slug", "updated");
    formData.set("description", "Updated");

    await updateProgramAction(formData);

    expect(mocks.updateProgram).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1", tenantId: "tenant-1", name: "Updated Name" })
    );
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("throws when the program does not exist in this tenant", async () => {
    mocks.getTenantProgram.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("programId", "p-missing");
    formData.set("name", "Updated");

    await expect(updateProgramAction(formData)).rejects.toThrow("Program not found");
  });
});

describe("setProgramStatusAction", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.requireTenantAccess.mockResolvedValue(tenantCtx);
  });

  it("transitions a program to PUBLISHED and revalidates", async () => {
    mocks.getTenantProgram.mockResolvedValue({ id: "p1", tenantId: "tenant-1", status: "DRAFT" });
    mocks.setProgramStatus.mockResolvedValue({});

    const formData = new FormData();
    formData.set("programId", "p1");
    formData.set("toStatus", "PUBLISHED");

    await setProgramStatusAction(formData);

    expect(mocks.setProgramStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1", tenantId: "tenant-1", status: "PUBLISHED" })
    );
  });

  it("throws when the program does not exist", async () => {
    mocks.getTenantProgram.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("programId", "p-missing");
    formData.set("toStatus", "PUBLISHED");

    await expect(setProgramStatusAction(formData)).rejects.toThrow("Program not found");
  });
});
