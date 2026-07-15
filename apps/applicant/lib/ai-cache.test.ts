/**
 * Cache verification test — proves the smart LLM cache works correctly.
 *
 * Run: npx vitest run apps/applicant/lib/ai-cache.test.ts
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicantContext } from "./ai-context";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeAll(() => {
  vi.setConfig({ testTimeout: 15_000 });
});

beforeEach(() => {
  fetchMock.mockReset();
});

async function importAI() {
  vi.resetModules();
  return (await import("./ai")) as typeof import("./ai");
}

function mockGLMResponse(content: string) {
  // Build SSE stream response
  const fragments: string[] = [];
  const chunkSize = 10;
  for (let i = 0; i < content.length; i += chunkSize) {
    fragments.push(content.slice(i, i + chunkSize));
  }
  if (fragments.length === 0) fragments.push("");

  const sseLines: string[] = [];
  for (const frag of fragments) {
    sseLines.push(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: frag } }] })}`);
  }
  sseLines.push(`data: ${JSON.stringify({
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  })}`);
  sseLines.push("data: [DONE]");

  const fullSSE = sseLines.join("\n\n") + "\n\n";
  const encoder = new TextEncoder();
  const bytes = encoder.encode(fullSSE);

  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => {
        let offset = 0;
        return {
          read: async () => {
            if (offset >= bytes.length) return { done: true, value: undefined };
            const value = bytes.slice(offset);
            offset = bytes.length;
            return { done: false, value };
          },
          releaseLock: () => {},
        };
      },
    },
    json: async () => ({
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    }),
  };
}

// Two different contexts — simulates "before task completion" and "after task completion"
const contextBefore: ApplicantContext = {
  tenantId: "t1",
  userId: "u1",
  program: { id: "prog-1", name: "Full-Stack Engineering", slug: "fse", startsAt: null, endsAt: null },
  applicationStatus: "ACCEPTED",
  progress: { totalTasks: 3, completedTasks: 1, pendingTasks: 2, overallPercentage: 33, weeks: [] },
  upcomingTasks: [
    { id: "task-2", title: "Build REST API", weekNumber: 3, dueAt: "2026-07-20T00:00:00Z", completed: false, overdue: false },
    { id: "task-3", title: "Write Tests", weekNumber: 3, dueAt: null, completed: false, overdue: false },
  ],
  missions: [{ id: "m-1", title: "API Development", weekNumber: 3, difficulty: "Intermediate" }],
  submissions: [],
  daysRemaining: 30,
};

const contextAfter: ApplicantContext = {
  ...contextBefore,
  progress: { totalTasks: 3, completedTasks: 2, pendingTasks: 1, overallPercentage: 67, weeks: [] },
  upcomingTasks: [
    { id: "task-3", title: "Write Tests", weekNumber: 3, dueAt: null, completed: false, overdue: false },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Smart LLM Cache — Verification", () => {
  it("CACHE HIT: same dynamic prompt twice → second call returns cached (no fetch)", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockGLMResponse("Your next task is Build REST API."));
    const ai = await importAI();

    // First call — should hit LLM
    const result1 = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Can you help me with my task for this week?",
      context: contextBefore,
    });

    expect(result1.status).toBe("ok");
    expect(result1.message).toBe("Your next task is Build REST API.");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call — same prompt, same context → should be cache HIT (no new fetch)
    const result2 = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Can you help me with my task for this week?",
      context: contextBefore,
    });

    expect(result2.status).toBe("ok");
    expect(result2.message).toBe("Your next task is Build REST API.");
    // Still only 1 fetch call — second was served from cache
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("CACHE MISS: context changed (task completed) → fresh LLM call", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockGLMResponse("Your next task is Build REST API."));
    fetchMock.mockResolvedValueOnce(mockGLMResponse("Your next task is Write Tests."));
    const ai = await importAI();

    // First call with contextBefore (1 task completed)
    const result1 = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Can you help me with my task for this week?",
      context: contextBefore,
    });
    expect(result1.message).toBe("Your next task is Build REST API.");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call with contextAfter (2 tasks completed — different signature)
    const result2 = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Can you help me with my task for this week?",
      context: contextAfter,
    });
    expect(result2.message).toBe("Your next task is Write Tests.");
    // 2 fetch calls — cache missed because context changed
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("STATIC CACHE: static knowledge prompt → shared across users", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockGLMResponse("SDLC has 7 core principles."));
    const ai = await importAI();

    // User 1 asks a static knowledge question
    const result1 = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "user-A",
      purpose: "mentor",
      prompt: "Explain the SDLC process in software engineering",
    });
    expect(result1.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // User 2 asks the SAME static question → cache hit (different user, same static key)
    const result2 = await ai.requestAIInteraction({
      tenantId: "t2",
      userId: "user-B",
      purpose: "mentor",
      prompt: "Explain the SDLC process in software engineering",
    });
    expect(result2.status).toBe("ok");
    expect(result2.message).toBe("SDLC has 7 core principles.");
    // Still 1 fetch — static cache is shared across users
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("NEVER CACHE ERRORS: failed LLM → error response not cached, retry on next call", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    // First call: primary model fails (attempt + retry), fallback model also fails (attempt + retry)
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, body: null, json: async () => ({}) });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, body: null, json: async () => ({}) });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, body: null, json: async () => ({}) });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, body: null, json: async () => ({}) });
    // Second call (after error) succeeds
    fetchMock.mockResolvedValueOnce(mockGLMResponse("Fresh response after recovery."));
    const ai = await importAI();

    // First call — LLM fails, falls back to stub
    const result1 = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain the SDLC process in software engineering",
    });
    expect(result1.status).toBe("error");

    // Second call — should attempt LLM again (error was NOT cached)
    const result2 = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain the SDLC process in software engineering",
    });
    expect(result2.status).toBe("ok");
    expect(result2.message).toBe("Fresh response after recovery.");
  });

  it("DIFFERENT USERS: same dynamic prompt → separate cache entries", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockGLMResponse("User A task response."));
    fetchMock.mockResolvedValueOnce(mockGLMResponse("User B task response."));
    const ai = await importAI();

    // User A asks about their task
    const resultA = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "user-A",
      purpose: "mentor",
      prompt: "Can you help me with my task for this week?",
      context: contextBefore,
    });
    expect(resultA.message).toBe("User A task response.");

    // User B asks the same prompt — different user → cache miss → fresh LLM call
    const resultB = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "user-B",
      purpose: "mentor",
      prompt: "Can you help me with my task for this week?",
      context: contextBefore,
    });
    expect(resultB.message).toBe("User B task response.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("RBSE direct answers bypass cache entirely (no LLM call)", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    const ai = await importAI();

    // "What is my progress?" is a RBSE direct_answer pattern — no LLM, no cache
    const result = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "What is my progress?",
      context: contextBefore,
    });

    expect(result.status).toBe("stubbed");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
