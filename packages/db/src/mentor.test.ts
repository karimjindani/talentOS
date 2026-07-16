import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => ({
  mentorConversationFindFirst: vi.fn(),
  mentorConversationCreate: vi.fn(),
  mentorConversationUpdate: vi.fn(),
  mentorMessageCreate: vi.fn(),
}));

vi.mock("./client", () => ({
  prisma: {
    mentorConversation: {
      findFirst: prismaMock.mentorConversationFindFirst,
      create: prismaMock.mentorConversationCreate,
      update: prismaMock.mentorConversationUpdate,
    },
    mentorMessage: {
      create: prismaMock.mentorMessageCreate,
    },
  },
}));

import {
  getOrCreateConversation,
  appendMessage,
  loadConversationHistory,
  createConversation,
} from "./mentor";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Mentor DB — getOrCreateConversation", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
  });

  it("returns existing conversation when one exists", async () => {
    prismaMock.mentorConversationFindFirst.mockResolvedValue({
      id: "conv-1",
      title: "Existing Chat",
    });

    const result = await getOrCreateConversation("t1", "u1");

    expect(result.id).toBe("conv-1");
    expect(result.title).toBe("Existing Chat");
    expect(prismaMock.mentorConversationCreate).not.toHaveBeenCalled();
  });

  it("creates a new conversation when none exists", async () => {
    prismaMock.mentorConversationFindFirst.mockResolvedValue(null);
    prismaMock.mentorConversationCreate.mockResolvedValue({
      id: "conv-new",
      title: "New Conversation",
    });

    const result = await getOrCreateConversation("t1", "u1");

    expect(result.id).toBe("conv-new");
    expect(result.title).toBe("New Conversation");
    expect(prismaMock.mentorConversationCreate).toHaveBeenCalledWith({
      data: { tenantId: "t1", userId: "u1", title: "New Conversation" },
      select: { id: true, title: true },
    });
  });

  it("uses custom title when provided", async () => {
    prismaMock.mentorConversationFindFirst.mockResolvedValue(null);
    prismaMock.mentorConversationCreate.mockResolvedValue({
      id: "conv-custom",
      title: "Custom Title",
    });

    await getOrCreateConversation("t1", "u1", "Custom Title");

    expect(prismaMock.mentorConversationCreate).toHaveBeenCalledWith({
      data: { tenantId: "t1", userId: "u1", title: "Custom Title" },
      select: { id: true, title: true },
    });
  });

  // Tenant isolation
  it("scopes findFirst by tenantId and userId", async () => {
    prismaMock.mentorConversationFindFirst.mockResolvedValue(null);
    prismaMock.mentorConversationCreate.mockResolvedValue({ id: "c1", title: "New Conversation" });

    await getOrCreateConversation("tenant-a", "user-b");

    const callArgs = prismaMock.mentorConversationFindFirst.mock.calls[0][0];
    expect(callArgs.where).toEqual({ tenantId: "tenant-a", userId: "user-b" });
    expect(callArgs.orderBy).toEqual({ updatedAt: "desc" });
  });
});

describe("Mentor DB — appendMessage", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
  });

  it("creates a message and bumps conversation updatedAt", async () => {
    prismaMock.mentorMessageCreate.mockResolvedValue({});
    prismaMock.mentorConversationUpdate.mockResolvedValue({});

    await appendMessage("conv-1", "user", "Hello mentor", null);

    expect(prismaMock.mentorMessageCreate).toHaveBeenCalledWith({
      data: { conversationId: "conv-1", role: "user", content: "Hello mentor", cardsJson: null },
    });
    expect(prismaMock.mentorConversationUpdate).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it("stores cardsJson when provided", async () => {
    prismaMock.mentorMessageCreate.mockResolvedValue({});
    prismaMock.mentorConversationUpdate.mockResolvedValue({});

    const cards = JSON.stringify([{ kind: "tips", title: "Tips", items: ["tip1"] }]);
    await appendMessage("conv-1", "mentor", "Here are tips", cards);

    expect(prismaMock.mentorMessageCreate).toHaveBeenCalledWith({
      data: { conversationId: "conv-1", role: "mentor", content: "Here are tips", cardsJson: cards },
    });
  });

  it("accepts both 'user' and 'mentor' roles", async () => {
    prismaMock.mentorMessageCreate.mockResolvedValue({});
    prismaMock.mentorConversationUpdate.mockResolvedValue({});

    await appendMessage("conv-1", "user", "question", null);
    await appendMessage("conv-1", "mentor", "answer", null);

    expect(prismaMock.mentorMessageCreate).toHaveBeenCalledTimes(2);
    const firstCall = prismaMock.mentorMessageCreate.mock.calls[0][0];
    const secondCall = prismaMock.mentorMessageCreate.mock.calls[1][0];
    expect(firstCall.data.role).toBe("user");
    expect(secondCall.data.role).toBe("mentor");
  });
});

describe("Mentor DB — loadConversationHistory", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
  });

  it("returns null when no conversation exists", async () => {
    prismaMock.mentorConversationFindFirst.mockResolvedValue(null);

    const result = await loadConversationHistory("t1", "u1");

    expect(result).toBeNull();
  });

  it("returns conversation with messages sorted by createdAt asc", async () => {
    const mockConversation = {
      id: "conv-1",
      title: "Test Chat",
      createdAt: new Date("2026-07-01"),
      updatedAt: new Date("2026-07-09"),
      messages: [
        { id: "msg-1", role: "user", content: "Hello", cardsJson: null, createdAt: new Date("2026-07-01") },
        { id: "msg-2", role: "mentor", content: "Hi there!", cardsJson: null, createdAt: new Date("2026-07-02") },
      ],
    };
    prismaMock.mentorConversationFindFirst.mockResolvedValue(mockConversation);

    const result = await loadConversationHistory("t1", "u1");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("conv-1");
    expect(result!.title).toBe("Test Chat");
    expect(result!.messages).toHaveLength(2);
    expect(result!.messages[0].role).toBe("user");
    expect(result!.messages[1].role).toBe("mentor");
  });

  // Tenant isolation
  it("scopes by tenantId and userId", async () => {
    prismaMock.mentorConversationFindFirst.mockResolvedValue(null);

    await loadConversationHistory("tenant-x", "user-y");

    const callArgs = prismaMock.mentorConversationFindFirst.mock.calls[0][0];
    expect(callArgs.where).toEqual({ tenantId: "tenant-x", userId: "user-y" });
    expect(callArgs.orderBy).toEqual({ updatedAt: "desc" });
    expect(callArgs.include.messages.orderBy).toEqual({ createdAt: "asc" });
  });
});

describe("Mentor DB — createConversation", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
  });

  it("creates a new conversation and returns its id", async () => {
    prismaMock.mentorConversationCreate.mockResolvedValue({ id: "conv-new-id" });

    const result = await createConversation("t1", "u1");

    expect(result.id).toBe("conv-new-id");
    expect(prismaMock.mentorConversationCreate).toHaveBeenCalledWith({
      data: { tenantId: "t1", userId: "u1", title: "New Conversation" },
      select: { id: true },
    });
  });

  it("uses custom title when provided", async () => {
    prismaMock.mentorConversationCreate.mockResolvedValue({ id: "conv-custom-id" });

    await createConversation("t1", "u1", "My Custom Chat");

    expect(prismaMock.mentorConversationCreate).toHaveBeenCalledWith({
      data: { tenantId: "t1", userId: "u1", title: "My Custom Chat" },
      select: { id: true },
    });
  });

  // Tenant isolation
  it("includes tenantId and userId in creation data", async () => {
    prismaMock.mentorConversationCreate.mockResolvedValue({ id: "c1" });

    await createConversation("tenant-abc", "user-xyz");

    const callArgs = prismaMock.mentorConversationCreate.mock.calls[0][0];
    expect(callArgs.data.tenantId).toBe("tenant-abc");
    expect(callArgs.data.userId).toBe("user-xyz");
  });
});
