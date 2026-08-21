import { describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  userUpdate: vi.fn()
}));

vi.mock("./client", () => ({
  prisma: {
    user: {
      update: prismaMock.userUpdate
    }
  }
}));

import { normalizeEmail, setUserAvatar } from "./users";

// Email is the identity join key and the unique index is case-sensitive, so every write path must
// normalize to one canonical form (v0.10.4). These guard against duplicate/orphaned User rows.
describe("normalizeEmail", () => {
  it("lowercases and trims surrounding whitespace", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com");
  });

  it("is idempotent", () => {
    expect(normalizeEmail(normalizeEmail("Bob@X.io"))).toBe("bob@x.io");
  });

  it("collapses casing variants to a single identity", () => {
    expect(normalizeEmail("OWNER@acme.test")).toBe(normalizeEmail("owner@ACME.test"));
  });
});

describe("setUserAvatar", () => {
  it("updates the user's avatarFileId to the given stored file", async () => {
    prismaMock.userUpdate.mockResolvedValue({ id: "user-1", avatarFileId: "file-1" });

    const result = await setUserAvatar("user-1", "file-1");

    expect(prismaMock.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { avatarFileId: "file-1" }
    });
    expect(result.avatarFileId).toBe("file-1");
  });

  it("clears the avatar when passed null", async () => {
    prismaMock.userUpdate.mockResolvedValue({ id: "user-1", avatarFileId: null });

    await setUserAvatar("user-1", null);

    expect(prismaMock.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { avatarFileId: null }
    });
  });
});
