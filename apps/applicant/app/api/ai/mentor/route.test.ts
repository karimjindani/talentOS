import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveTenantAccess: vi.fn(),
  requestAIInteraction: vi.fn(),
  buildApplicantContext: vi.fn(),
  retrieveKnowledge: vi.fn(),
  getOrCreateConversation: vi.fn(),
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  listConversations: vi.fn(),
  appendMessage: vi.fn(),
  loadConversationHistory: vi.fn(),
}));

vi.mock("@/lib/tenant-guard", () => ({ resolveTenantAccess: mocks.resolveTenantAccess }));
vi.mock("@/lib/ai", () => ({
  requestAIInteraction: mocks.requestAIInteraction,
}));
vi.mock("@/lib/ai-context", () => ({ buildApplicantContext: mocks.buildApplicantContext }));
vi.mock("@/lib/knowledge-base", () => ({ retrieveKnowledge: mocks.retrieveKnowledge }));
vi.mock("@talentos/db", () => ({
  getOrCreateConversation: mocks.getOrCreateConversation,
  createConversation: mocks.createConversation,
  deleteConversation: mocks.deleteConversation,
  listConversations: mocks.listConversations,
  appendMessage: mocks.appendMessage,
  loadConversationHistory: mocks.loadConversationHistory,
}));

import { GET, POST, DELETE } from "./route";

function mockRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

describe("AI Mentor API route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("GET — load conversation history", () => {
    it("returns 401 when tenant access is denied", async () => {
      mocks.resolveTenantAccess.mockResolvedValue({ ok: false });
      const req = mockRequest("http://localhost:3100/api/ai/mentor");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 when actorUserId is missing", async () => {
      mocks.resolveTenantAccess.mockResolvedValue({
        ok: true,
        tenant: { id: "t1" },
        actorUserId: null,
      });
      const req = mockRequest("http://localhost:3100/api/ai/mentor");
      const res = await GET(req);
      expect(res.status).toBe(403);
    });

    it("returns conversation list when ?list=1", async () => {
      mocks.resolveTenantAccess.mockResolvedValue({
        ok: true,
        tenant: { id: "t1" },
        actorUserId: "u1",
      });
      mocks.listConversations.mockResolvedValue([
        { id: "c1", title: "Chat 1", createdAt: new Date() },
      ]);
      const req = mockRequest("http://localhost:3100/api/ai/mentor?list=1");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.conversations).toHaveLength(1);
    });

    it("returns empty messages when no history exists", async () => {
      mocks.resolveTenantAccess.mockResolvedValue({
        ok: true,
        tenant: { id: "t1" },
        actorUserId: "u1",
      });
      mocks.loadConversationHistory.mockResolvedValue(null);
      const req = mockRequest("http://localhost:3100/api/ai/mentor");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.messages).toEqual([]);
    });

    it("returns 500 on internal error", async () => {
      mocks.resolveTenantAccess.mockResolvedValue({
        ok: true,
        tenant: { id: "t1" },
        actorUserId: "u1",
      });
      mocks.loadConversationHistory.mockRejectedValue(new Error("DB down"));
      const req = mockRequest("http://localhost:3100/api/ai/mentor");
      const res = await GET(req);
      expect(res.status).toBe(500);
    });
  });

  describe("POST — send prompt", () => {
    it("returns 401 when unauthorized", async () => {
      mocks.resolveTenantAccess.mockResolvedValue({ ok: false });
      const req = mockRequest("http://localhost:3100/api/ai/mentor", {
        method: "POST",
        body: JSON.stringify({ prompt: "Hello" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 when prompt is empty", async () => {
      mocks.resolveTenantAccess.mockResolvedValue({
        ok: true,
        tenant: { id: "t1" },
        actorUserId: "u1",
      });
      const req = mockRequest("http://localhost:3100/api/ai/mentor", {
        method: "POST",
        body: JSON.stringify({ prompt: "   " }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("required");
    });

    it("returns 400 when prompt exceeds 2000 characters", async () => {
      mocks.resolveTenantAccess.mockResolvedValue({
        ok: true,
        tenant: { id: "t1" },
        actorUserId: "u1",
      });
      const req = mockRequest("http://localhost:3100/api/ai/mentor", {
        method: "POST",
        body: JSON.stringify({ prompt: "a".repeat(2001) }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("2000");
    });

    it("returns 400 on invalid JSON body", async () => {
      mocks.resolveTenantAccess.mockResolvedValue({
        ok: true,
        tenant: { id: "t1" },
        actorUserId: "u1",
      });
      const req = mockRequest("http://localhost:3100/api/ai/mentor", {
        method: "POST",
        body: "not json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE — delete conversation", () => {
    it("returns 401 when unauthorized", async () => {
      mocks.resolveTenantAccess.mockResolvedValue({ ok: false });
      const req = mockRequest("http://localhost:3100/api/ai/mentor?conversationId=c1", {
        method: "DELETE",
      });
      const res = await DELETE(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 when conversationId is missing", async () => {
      mocks.resolveTenantAccess.mockResolvedValue({
        ok: true,
        tenant: { id: "t1" },
        actorUserId: "u1",
      });
      const req = mockRequest("http://localhost:3100/api/ai/mentor", {
        method: "DELETE",
      });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });
  });
});
