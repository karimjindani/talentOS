import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// Dynamic imports with vi.resetModules() are slow under the full suite —
// give these tests a longer timeout.
beforeAll(() => {
  vi.setConfig({ testTimeout: 15_000 });
});

// We need to control env vars for hasLLMConfig / callGLM
beforeEach(() => {
  fetchMock.mockReset();
});

// Import after mocks are set up — ai.ts reads process.env at module load,
// so we use vi.resetModules + dynamic import in each test group.
async function importAI() {
  vi.resetModules();
  return (await import("./ai")) as typeof import("./ai");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mock an SSE streaming response from the GLM API.
 * Splits content into fragments to simulate real streaming behavior.
 */
function mockGLMResponse(content: string, status = 200) {
  // Split content into small fragments to simulate streaming
  const fragments: string[] = [];
  const chunkSize = 10;
  for (let i = 0; i < content.length; i += chunkSize) {
    fragments.push(content.slice(i, i + chunkSize));
  }
  if (fragments.length === 0) fragments.push("");

  // Build SSE lines: data: {"choices":[{"delta":{"content":"..."}}]}\n
  const sseLines: string[] = [];
  for (const frag of fragments) {
    sseLines.push(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: frag } }] })}`);
  }
  // Final chunk with usage and finish_reason
  sseLines.push(`data: ${JSON.stringify({
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  })}`);
  sseLines.push("data: [DONE]");

  const fullSSE = sseLines.join("\n\n") + "\n\n";
  const encoder = new TextEncoder();
  const bytes = encoder.encode(fullSSE);

  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader: () => {
        let offset = 0;
        return {
          read: async () => {
            if (offset >= bytes.length) {
              return { done: true, value: undefined };
            }
            const value = bytes.slice(offset);
            offset = bytes.length;
            return { done: false, value };
          },
          releaseLock: () => {},
        };
      },
    },
    // Keep json() for backward compat with any non-streaming checks
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

function mockErrorResponse(status: number) {
  return {
    ok: false,
    status,
    body: null,
    json: async () => ({ error: "error" }),
  };
}

import type { ApplicantContext } from "./ai-context";

const sampleContext: ApplicantContext = {
  tenantId: "t1",
  userId: "u1",
  program: { id: "p1", name: "Full-Stack Engineering", slug: "fse", startsAt: null, endsAt: null },
  applicationStatus: "ACCEPTED",
  progress: {
    totalTasks: 10,
    completedTasks: 4,
    pendingTasks: 6,
    overallPercentage: 40,
    weeks: [],
  },
  upcomingTasks: [],
  missions: [],
  submissions: [],
  daysRemaining: 30,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AI Integration — requestAIInteraction", () => {
  // UT-ERR-02: Stub response when no API key
  it("returns stubbed response when no LLM API key configured", async () => {
    delete process.env.GLM_Z_API_KEY;
    delete process.env.ZHIPUAI_API_KEY;
    const ai = await importAI();

    const result = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "What is my task today?",
      context: sampleContext,
    });

    expect(result.status).toBe("stubbed");
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // UT-ERR-01: Fallback to stub on LLM failure
  it("returns error status with stub content when LLM fails", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    fetchMock.mockRejectedValueOnce(new Error("network failure"));
    // Second attempt (retry) also fails
    fetchMock.mockRejectedValueOnce(new Error("network failure"));
    const ai = await importAI();

    const result = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain SDLC in detail",
    });

    expect(result.status).toBe("error");
    expect(result.message).toContain("cached response");
  });

  // UT-LLM-01 + UT-LLM-10: Successful LLM call
  it("returns ok status with LLM content on success", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockGLMResponse("SDLC has 7 core principles..."));
    const ai = await importAI();

    const result = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain SDLC in detail",
    });

    expect(result.status).toBe("ok");
    expect(result.message).toBe("SDLC has 7 core principles...");
  });

  // UT-RBSE integration: blocked questions don't call LLM
  it("does not call LLM for blocked questions", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    const ai = await importAI();

    const result = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Who won the football match?",
    });

    expect(result.status).toBe("stubbed");
    expect(result.message).toContain("AI Mentor");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // UT-RBSE integration: direct answers don't call LLM
  it("does not call LLM for direct answer patterns", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    const ai = await importAI();

    const result = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "What is my progress?",
      context: sampleContext,
    });

    expect(result.status).toBe("stubbed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // UT-ERR-03: Stub response includes knowledge
  it("returns knowledge content in stub response when knowledge is available", async () => {
    delete process.env.GLM_Z_API_KEY;
    delete process.env.ZHIPUAI_API_KEY;
    const ai = await importAI();

    const { retrieveKnowledge } = await import("./knowledge-base");
    const knowledge = retrieveKnowledge("What is SDLC?");

    const result = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "What is SDLC?",
      knowledge,
    });

    expect(result.status).toBe("stubbed");
    expect(result.message).toContain("TalentOS");
    expect(result.cards).toBeDefined();
    expect(result.cards!.some((c) => c.kind === "tips")).toBe(true);
  });
});

describe("AI Integration — callGLM error handling", () => {
  // UT-LLM-06: Auth error
  it("throws LLM_AUTH_ERROR on 401 without retrying", async () => {
    process.env.GLM_Z_API_KEY = "bad-key";
    fetchMock.mockResolvedValueOnce(mockErrorResponse(401));
    const ai = await importAI();

    const result = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain SDLC in detail",
    });

    // Should fall back to stub with error status
    expect(result.status).toBe("error");
    // Should only have been called once (no retry on auth error)
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // UT-LLM-07: Rate limit
  it("falls back to stub on 429 rate limit", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockErrorResponse(429));
    // Retry also 429
    fetchMock.mockResolvedValueOnce(mockErrorResponse(429));
    const ai = await importAI();

    const result = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain SDLC in detail",
    });

    expect(result.status).toBe("error");
  });

  // UT-LLM-09: Retry on 500
  it("retries once on 500 server error", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockErrorResponse(500));
    fetchMock.mockResolvedValueOnce(mockGLMResponse("Success on retry!"));
    const ai = await importAI();

    const result = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain SDLC in detail",
    });

    expect(result.status).toBe("ok");
    expect(result.message).toBe("Success on retry!");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("AI Integration — buildSystemPrompt", () => {
  it("builds a system prompt containing role description and rules", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockGLMResponse("ok"));
    const ai = await importAI();

    // We can't directly call buildSystemPrompt (not exported), but we can
    // verify it's used by checking the fetch body
    await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain SDLC in detail",
    });

    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("AI Mentor");
    expect(body.messages[0].content).toContain("RULES");
  });

  it("includes context section when context is provided", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockGLMResponse("ok"));
    const ai = await importAI();

    await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain SDLC in detail",
      context: sampleContext,
    });

    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.messages[0].content).toContain("Full-Stack Engineering");
  });

  it("includes knowledge section when knowledge is provided", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockGLMResponse("ok"));
    const ai = await importAI();

    const { retrieveKnowledge } = await import("./knowledge-base");
    const knowledge = retrieveKnowledge("What is SDLC?");

    await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain SDLC in detail",
      knowledge,
    });

    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.messages[0].content).toContain("Relevant Knowledge");
  });
});

describe("AI Integration — request body format", () => {
  // UT-LLM-05: Request body format
  it("sends correct model, messages, max_tokens, temperature, stream:true", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    process.env.ZHIPUAI_MODEL = "glm-4.5-air";
    process.env.LLM_MAX_TOKENS = "1024";
    process.env.LLM_TEMPERATURE = "0.7";
    fetchMock.mockResolvedValueOnce(mockGLMResponse("ok"));
    const ai = await importAI();

    // Use a prompt that does NOT trigger the "detailed" path (no "in detail" etc.)
    await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "What is SDLC?",
    });

    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.model).toBe("glm-4.5-air");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toBe("What is SDLC?");
    expect(body.max_tokens).toBe(1024);
    expect(body.temperature).toBe(0.7);
    expect(body.stream).toBe(true);

    // Headers
    expect(callArgs[1].headers["Content-Type"]).toBe("application/json");
    expect(callArgs[1].headers["Authorization"]).toContain("Bearer");
  });

  // UT-LLM-03: Token limit configuration
  it("respects LLM_MAX_TOKENS env override", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    process.env.LLM_MAX_TOKENS = "2048";
    fetchMock.mockResolvedValueOnce(mockGLMResponse("ok"));
    const ai = await importAI();

    await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain SDLC in detail",
    });

    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.max_tokens).toBeGreaterThanOrEqual(2048);
  });

  // UT-LLM-04: Timeout configuration — verify AbortController signal is passed
  it("passes an AbortSignal to fetch for timeout", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(mockGLMResponse("ok"));
    const ai = await importAI();

    await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain SDLC in detail",
    });

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1].signal).toBeDefined();
    expect(callArgs[1].signal.aborted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SSE Stream Parsing Tests (v0.18.4, D-079)
// ---------------------------------------------------------------------------

describe("AI Integration — SSE stream parsing", () => {
  // UT-SSE-01: Multi-fragment SSE stream is correctly concatenated
  it("concatenates multiple SSE fragments into full response", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    fetchMock.mockResolvedValueOnce(
      mockGLMResponse("The SDLC has 7 phases: planning, analysis, design, implementation, testing, deployment, maintenance.")
    );
    const ai = await importAI();

    const result = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain SDLC in detail",
    });

    expect(result.status).toBe("ok");
    expect(result.message).toContain("SDLC has 7 phases");
    expect(result.message).toContain("maintenance");
  });

  // UT-SSE-02: Empty content fragments are handled gracefully
  it("handles empty content in SSE stream", async () => {
    process.env.GLM_Z_API_KEY = "test-key";

    // SSE with empty delta content then real content
    const sseLines = [
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {} }] })}`,
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "Hello" } }] })}`,
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: " world" } }] })}`,
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } })}`,
      "data: [DONE]",
    ];
    const fullSSE = sseLines.join("\n\n") + "\n\n";
    const encoder = new TextEncoder();
    const bytes = encoder.encode(fullSSE);

    fetchMock.mockResolvedValueOnce({
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
    });

    const ai = await importAI();
    const result = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain SDLC in detail",
    });

    expect(result.status).toBe("ok");
    expect(result.message).toBe("Hello world");
  });

  // UT-SSE-03: Malformed SSE lines are skipped without error
  it("skips malformed SSE lines gracefully", async () => {
    process.env.GLM_Z_API_KEY = "test-key";

    const sseLines = [
      "data: {invalid json}",
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "Valid" } }] })}`,
      "data: not-json-at-all",
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: " response" } }] })}`,
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } })}`,
      "data: [DONE]",
    ];
    const fullSSE = sseLines.join("\n\n") + "\n\n";
    const encoder = new TextEncoder();
    const bytes = encoder.encode(fullSSE);

    fetchMock.mockResolvedValueOnce({
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
    });

    const ai = await importAI();
    const result = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain SDLC in detail",
    });

    expect(result.status).toBe("ok");
    expect(result.message).toBe("Valid response");
  });

  // UT-SSE-04: [DONE] sentinel is handled correctly
  it("handles [DONE] sentinel in SSE stream", async () => {
    process.env.GLM_Z_API_KEY = "test-key";
    // The mockGLMResponse already includes [DONE] at the end
    fetchMock.mockResolvedValueOnce(mockGLMResponse("Test response with DONE"));
    const ai = await importAI();

    const result = await ai.requestAIInteraction({
      tenantId: "t1",
      userId: "u1",
      purpose: "mentor",
      prompt: "Explain SDLC in detail",
    });

    expect(result.status).toBe("ok");
    expect(result.message).toBe("Test response with DONE");
  });
});
