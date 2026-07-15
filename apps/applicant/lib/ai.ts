import type { ApplicantContext } from "./ai-context";
import { contextToPromptSection, buildContextSignature } from "./ai-context";
import type { KnowledgeSnippet } from "./knowledge-base";
import { knowledgeToPromptSection } from "./knowledge-base";
import { classifyQuestion } from "./ai-rbse";

export type MentorConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

export type AIInteractionRequest = {
  tenantId: string;
  userId?: string;
  purpose: "mentor" | "knowledge_assistant" | "reviewer" | "interviewer";
  prompt: string;
  /** Phase 4: real applicant context for context-aware responses. */
  context?: ApplicantContext;
  /** Phase 5: retrieved knowledge snippets for RAG-style responses. */
  knowledge?: KnowledgeSnippet[];
  /** Recent persisted turns, oldest first. Keeps coaching continuous across messages. */
  conversationHistory?: MentorConversationTurn[];
  /** Called as model text arrives, enabling end-to-end UI streaming. */
  onToken?: (token: string) => void | Promise<void>;
};

/** A rich content block that the mentor can return inside a response. */
export type MentorCard =
  | { kind: "task"; title: string; description: string; dueDate?: string; estimatedTime?: string }
  | { kind: "progress"; title: string; percentage: number }
  | { kind: "timeline"; title: string; items: string[] }
  | { kind: "tips"; title: string; items: string[] }
  | { kind: "badge"; label: string; value: string };

export type AIInteractionResponse = {
  status: "stubbed" | "ok" | "error";
  message: string;
  cards?: MentorCard[];
};

// ---------------------------------------------------------------------------
// Phase 6: GLM_Z.ai / ZhipuAI integration
// ---------------------------------------------------------------------------

// Support both GLM_Z_API_KEY (user's naming) and ZHIPUAI_API_KEY (standard naming)
const ZHIPUAI_API_KEY = process.env.GLM_Z_API_KEY ?? process.env.ZHIPUAI_API_KEY;
// AI API endpoint (LiteLLM proxy or direct ZhipuAI)
const AI_BASE_URL =
  process.env.AI_BASE_URL ?? "https://api.z.ai/api/coding/paas/v4";
const AI_MODEL = process.env.AI_MODEL ?? "glm-5.2";
const AI_FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL ?? "glm-5.1";
const LLM_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS ?? "512", 10);
const LLM_TEMPERATURE = parseFloat(process.env.LLM_TEMPERATURE ?? "0.7");
const LLM_TIMEOUT_MS = 60_000; // 60 second timeout — fail fast, don't make user wait 2 minutes
const LLM_MAX_RETRIES = 1; // Only retry on network/server errors, not timeouts

// ---------------------------------------------------------------------------
// Smart LLM Response Cache (in-memory, context-signature-aware)
// ---------------------------------------------------------------------------

const LLM_RESPONSE_CACHE = new Map<string, { content: string; timestamp: number }>();
const LLM_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LLM_CACHE_MAX_SIZE = 200; // prevent unbounded growth

/**
 * Determine if a prompt is a dynamic action (depends on applicant data)
 * vs. a static knowledge question (depends only on the topic).
 *
 * Dynamic actions: task, progress, timeline, missions, submission, deadline, schedule.
 * Static knowledge: SDLC, SEM, testing, deployment, PRD, engineering concepts.
 */
function isDynamicAction(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const dynamicKeywords = [
    "my task", "today's task", "current task", "next task", "what should i work on",
    "my progress", "show my progress", "how am i doing", "completion status",
    "my timeline", "my schedule", "upcoming weeks", "next week",
    "my mission", "my missions",
    "my submission", "submission status", "my submissions",
    "deadline", "due date", "remaining",
  ];
  return dynamicKeywords.some((kw) => lower.includes(kw));
}

/**
 * Build the cache key for an LLM response.
 *
 * - Dynamic actions: include tenantId, userId, contextSignature, and prompt.
 *   If the applicant's data changes, the signature changes → cache miss → fresh LLM call.
 * - Static knowledge: include only the prompt (no user-specific data).
 *   These answers are the same for all users.
 */
function buildLLMCacheKey(
  tenantId: string,
  userId: string | undefined,
  prompt: string,
  contextSig: string
): string {
  if (isDynamicAction(prompt)) {
    return `dynamic:${tenantId}:${userId ?? "anon"}:${contextSig}:${prompt}`;
  }
  // Static knowledge — simpler key, shared across users
  return `static:${prompt}`;
}

/** Check the cache for a valid (non-expired) entry. */
function getCachedLLMResponse(cacheKey: string): string | null {
  const cached = LLM_RESPONSE_CACHE.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > LLM_CACHE_TTL_MS) {
    LLM_RESPONSE_CACHE.delete(cacheKey);
    return null;
  }
  return cached.content;
}

/** Store an LLM response in the cache. Evicts oldest entries when at capacity. */
function setCachedLLMResponse(cacheKey: string, content: string): void {
  // Evict oldest if at capacity
  if (LLM_RESPONSE_CACHE.size >= LLM_CACHE_MAX_SIZE) {
    const oldestKey = LLM_RESPONSE_CACHE.keys().next().value;
    if (oldestKey) LLM_RESPONSE_CACHE.delete(oldestKey);
  }
  LLM_RESPONSE_CACHE.set(cacheKey, { content, timestamp: Date.now() });
}

/** Whether a real LLM API key is configured. */
function hasLLMConfig(): boolean {
  return !!ZHIPUAI_API_KEY && ZHIPUAI_API_KEY.length > 0;
}

/**
 * Build the system prompt for the GLM chat completion.
 *
 * Combines: mentor role + guardrails + applicant context + knowledge snippets.
 */
function buildSystemPrompt(
  context?: ApplicantContext,
  knowledge?: KnowledgeSnippet[]
): string {
  const parts: string[] = [
    "You are an AI Mentor for TalentOS, a platform that develops AI-native software engineers.",
    "You are a supportive, practical AI Mentor for TalentOS—not a documentation reader.",
    "Guide interns through tasks, missions, progress, and engineering practices (SDLC, SEM, testing, deployment).",
    "",
    "RULES:",
    "- Start with a direct, human answer; do not dump documentation or repeat the user's context.",
    "- Continue naturally from recent turns. Treat short replies such as yes, no, done, not yet, an error message, or a platform name as answers to your previous question.",
    "- Match the applicant's language and tone. If they use Roman Urdu mixed with English, reply naturally in the same mix while keeping technical terms in English.",
    "- Briefly acknowledge progress or frustration when it is relevant; never restart with a generic introduction during an active conversation.",
    "- Give exactly one small, concrete next action tailored to the applicant's current progress when relevant.",
    "- End with at most one short, purposeful follow-up question only when it helps the learner move forward.",
    "- For simple questions, use only: **What to do now** and **Next step**. Use a detailed guide only when explicitly requested.",
    "- Finish every sentence and section; do not begin an extra section if there is not enough room to complete it.",
    "- Keep normal responses under 220 words unless the user explicitly asks for a detailed explanation.",
    "- NEVER complete assignments for the intern — guide and explain only.",
    "- If you don't know something, say so honestly.",
  ];

  // Applicant context (Phase 4)
  if (context?.program) {
    parts.push("", "--- Applicant Context ---", contextToPromptSection(context));
  }

  // Knowledge snippets (Phase 5) — limit to top 2 to keep prompt small
  const topKnowledge = (knowledge ?? []).slice(0, 2);
  const knowledgeSection = knowledgeToPromptSection(topKnowledge);
  if (knowledgeSection) {
    parts.push("", knowledgeSection);
  }

  return parts.join("\n");
}

/** ZhipuAI chat completion request shape. */
type GLMChatRequest = {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  max_tokens: number;
  temperature: number;
  stream: boolean;
};

/** ZhipuAI chat completion response shape (minimal). */
type GLMChatResponse = {
  id?: string;
  choices?: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

/**
 * Parse an SSE (Server-Sent Events) stream from the GLM API.
 *
 * The stream emits `data: {...}` lines. Each JSON chunk contains a `choices[0].delta.content`
 * field with a text fragment. We concatenate all fragments to build the full response.
 * The final chunk includes `usage` with token counts.
 *
 * Example SSE line:
 *   data: {"id":"123","choices":[{"delta":{"content":"Hello"}}],"usage":null}
 *   data: [DONE]
 */
async function parseSSEStream(
  response: Response,
  onToken?: (token: string) => void | Promise<void>
): Promise<{ content: string; usage?: GLMChatResponse["usage"] }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("LLM_NO_RESPONSE_BODY");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let usage: GLMChatResponse["usage"] | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines (separated by \n\n or \n)
      const lines = buffer.split("\n");
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === "[DONE]") continue;

        try {
          const chunk = JSON.parse(jsonStr) as GLMChatResponse & {
            choices?: { delta?: { content?: string }; message?: { content?: string } }[];
          };

          // Extract content fragment — delta for streaming, message for non-streaming fallback
          const fragment =
            chunk.choices?.[0]?.delta?.content ??
            chunk.choices?.[0]?.message?.content;
          if (fragment) {
            content += fragment;
            await onToken?.(fragment);
          }

          // Capture usage from the final chunk
          if (chunk.usage) {
            usage = chunk.usage;
          }
        } catch {
          // Skip malformed JSON lines
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { content, usage };
}

/**
 * Call the ZhipuAI (GLM_Z.ai) chat completions endpoint with retry logic.
 *
 * Uses native fetch with timeout via AbortController.
 * Returns the assistant's text content.
 * Throws on auth errors, rate limits, timeouts, and invalid responses.
 */
async function callGLM(
  systemPrompt: string,
  userPrompt: string,
  maxTokens?: number,
  model?: string,
  conversationHistory: MentorConversationTurn[] = [],
  onToken?: (token: string) => void | Promise<void>
): Promise<{ content: string; usage?: GLMChatResponse["usage"] }> {
  const url = `${AI_BASE_URL}/chat/completions`;
  const effectiveMaxTokens = maxTokens ?? LLM_MAX_TOKENS;
  const effectiveModel = model ?? AI_MODEL;

  const body: GLMChatRequest = {
    model: effectiveModel,
    messages: [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: userPrompt },
    ],
    max_tokens: effectiveMaxTokens,
    temperature: LLM_TEMPERATURE,
    stream: true,
  };

  console.log(`[ai-mentor] callGLM: model=${effectiveModel}, max_tokens=${effectiveMaxTokens}, systemPromptLen=${systemPrompt.length}, userPromptLen=${userPrompt.length}`);
  
  let lastError: Error | null = null;
  let retryCount = 0;
  
  for (let attempt = 1; attempt <= LLM_MAX_RETRIES + 1; attempt++) {
    console.log(`[ai-mentor] callGLM: Attempt ${attempt}/${LLM_MAX_RETRIES + 1}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[ai-mentor] callGLM: Timeout after ${LLM_TIMEOUT_MS}ms on attempt ${attempt}`);
      controller.abort();
    }, LLM_TIMEOUT_MS);

    try {
      const startTime = Date.now();
      console.log(`[ai-mentor] callGLM: Starting fetch at ${startTime}`);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ZHIPUAI_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const fetchTime = Date.now() - startTime;
      console.log(`[ai-mentor] callGLM: Fetch completed in ${fetchTime}ms, status=${response.status}`);

      if (response.status === 401 || response.status === 403) {
        throw new Error("LLM_AUTH_ERROR");
      }

      if (response.status === 429) {
        throw new Error("LLM_RATE_LIMIT");
      }

      if (!response.ok) {
        throw new Error(`LLM_HTTP_${response.status}`);
      }

      // Parse SSE stream response (stream: true returns text/event-stream)
      const { content, usage } = await parseSSEStream(response, onToken);

      if (!content || typeof content !== "string") {
        throw new Error("LLM_INVALID_RESPONSE");
      }

      clearTimeout(timeoutId);
      console.log(`[ai-mentor] callGLM: Success on attempt ${attempt}, contentLen=${content.length}, tokens=${usage?.completion_tokens ?? '?'}, retries=${retryCount}`);
      return { content, usage };
    } catch (err) {
      clearTimeout(timeoutId);
      const errName = err instanceof Error ? err.name : 'unknown';
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`[ai-mentor] callGLM: Attempt ${attempt} failed: ${errName}: ${errMsg}`);
      
      if (err instanceof Error && err.name === "AbortError") {
        lastError = new Error("LLM_TIMEOUT");
      } else if (err instanceof Error) {
        lastError = err;
      } else {
        lastError = new Error("LLM_NETWORK_ERROR");
      }
      
      // Don't retry on auth errors, timeouts, or rate limits — these won't succeed on retry
      if (lastError.message === "LLM_AUTH_ERROR" || lastError.message === "LLM_TIMEOUT" || lastError.message === "LLM_RATE_LIMIT") {
        throw lastError;
      }
      
      // Only retry on network/server errors (5xx, network failures)
      // Don't retry just because the response is slow
      if (attempt <= LLM_MAX_RETRIES) {
        retryCount++;
        const delay = 1000 * attempt;
        console.log(`[ai-mentor] callGLM: Retrying (reason: ${errMsg}) after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we get here, all retries failed
  throw lastError || new Error("LLM_UNKNOWN_ERROR");
}

// ---------------------------------------------------------------------------
// Stub response generator (Phases 4-5)
// ---------------------------------------------------------------------------

/**
 * Generate a stubbed response using applicant context and knowledge snippets.
 *
 * This is the fallback when no LLM API key is configured, and also serves
 * as the safe degradation path if the LLM call fails.
 */
async function generateStubResponse(
  prompt: string,
  context?: ApplicantContext,
  knowledge?: KnowledgeSnippet[]
): Promise<AIInteractionResponse> {
  const lower = prompt.toLowerCase();

  // --- Knowledge-base responses (Phase 5) ---
  // If we retrieved knowledge snippets, return them as the primary response.
  const hasKnowledge = knowledge && knowledge.length > 0;

  // --- Context-aware enhancements (Phase 4) ---
  const hasContext = !!context?.program;
  const programName = context?.program?.name ?? "your program";
  const overallPct = context?.progress?.overallPercentage ?? 0;
  const completedTasks = context?.progress?.completedTasks ?? 0;
  const totalTasks = context?.progress?.totalTasks ?? 0;
  const daysRemaining = context?.daysRemaining;

  // Find the next incomplete task from context, if available
  const nextTask = context?.upcomingTasks?.[0];

  // --- Knowledge-base response (Phase 5) ---
  // If knowledge snippets were retrieved and this looks like a knowledge question,
  // return the knowledge content as the response. This takes priority over
  // the generic task/progress/timeline keyword matches.
  if (hasKnowledge) {
    const topSnippet = knowledge![0];
    const additionalSnippets = knowledge!.slice(1);

    return {
      status: "stubbed",
      message: topSnippet.content,
      cards: [
        {
          kind: "tips",
          title: topSnippet.title,
          items: additionalSnippets.map((s) => `📚 ${s.title} (${s.source})`),
        },
        ...(topSnippet.source
          ? [{ kind: "badge" as const, label: "Source", value: topSnippet.source }]
          : []),
      ],
    };
  }

  if (lower.includes("task") || lower.includes("assignment")) {
    return {
      status: "stubbed",
      message: nextTask
        ? `Here's your next task in ${programName}. ${nextTask.overdue ? "This task is overdue — prioritize it now." : "Focus on completing it before the deadline."}`
        : `Here's your next task. Focus on writing clean, tested code and submit before the deadline.`,
      cards: [
        {
          kind: "task",
          title: nextTask
            ? `Week ${nextTask.weekNumber} — ${nextTask.title}`
            : "Mission 3 — Build a REST API",
          description: nextTask
            ? nextTask.overdue
              ? "This task is overdue. Please complete and submit as soon as possible."
              : "Continue working on this task and mark it complete when done."
            : "Implement a CRUD API with validation, error handling, and integration tests.",
          dueDate: nextTask?.dueAt
            ? new Date(nextTask.dueAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Jul 12, 2026",
          estimatedTime: "~4 hours",
        },
      ],
    };
  }

  if (lower.includes("progress") || lower.includes("status")) {
    return {
      status: "stubbed",
      message: hasContext
        ? `You're ${overallPct}% through ${programName}. ${completedTasks} of ${totalTasks} tasks completed${daysRemaining != null ? `, ${daysRemaining} days remaining` : ""}.`
        : "You're making great progress! Here's a summary of your current standing.",
      cards: [
        { kind: "progress", title: "Overall Progress", percentage: hasContext ? overallPct : 65 },
        {
          kind: "badge",
          label: "Submission Status",
          value: hasContext
            ? `${completedTasks} of ${totalTasks} tasks completed`
            : "2 of 3 missions submitted",
        },
      ],
    };
  }

  if (lower.includes("timeline") || lower.includes("schedule") || lower.includes("week")) {
    // Build timeline from context missions if available
    const missionItems = context?.missions?.length
      ? context.missions
          .sort((a, b) => a.weekNumber - b.weekNumber)
          .map((m) => `Week ${m.weekNumber}: ${m.title} (${m.difficulty})`)
      : [
          "Week 1–2: Onboarding & setup",
          "Week 3–4: Mission 1 — Frontend fundamentals",
          "Week 5–6: Mission 2 — Database design",
          "Week 7–8: Mission 3 — API development (current)",
          "Week 9–10: Mission 4 — Deployment & CI/CD",
        ];

    return {
      status: "stubbed",
      message: hasContext
        ? `Here's the timeline for ${programName}.`
        : "Here's your internship timeline at a glance.",
      cards: [
        {
          kind: "timeline",
          title: hasContext ? `${programName} Timeline` : "Internship Timeline",
          items: missionItems,
        },
      ],
    };
  }

  if (lower.includes("tip") || lower.includes("advice") || lower.includes("help")) {
    return {
      status: "stubbed",
      message: "Here are some tips to help you succeed.",
      cards: [
        {
          kind: "tips",
          title: "Engineering Tips",
          items: [
            "Write tests before refactoring — they catch regressions early.",
            "Keep functions small and focused on a single responsibility.",
            "Use meaningful variable names; future-you will thank present-you.",
            "Review your own PR before requesting review — catch the easy stuff.",
          ],
        },
      ],
    };
  }

  return {
    status: "stubbed",
    message: hasContext
      ? `I can help you with tasks, progress, timelines, tips for ${programName}, or answer questions about SDLC, SEM, missions, testing, and more. Try asking about any of those topics.`
      : "That's a great question! I can help you with tasks, progress, timelines, engineering tips, or answer questions about SDLC, SEM, missions, testing, and more. Try asking about any of those topics.",
  };
}

// ---------------------------------------------------------------------------
// Main entry point — orchestrates LLM vs stub
// ---------------------------------------------------------------------------

/**
 * AI mentor interaction boundary.
 *
 * 1. First applies Rule-Based System Engine (RBSE) to classify the question
 * 2. If blocked: returns refusal response without calling LLM
 * 3. If direct answer: returns context-based response without calling LLM
 * 4. If allowed: proceeds to LLM call with context and knowledge
 * 5. If no API key or LLM fails: falls back to stub response
 */
export async function requestAIInteraction(
  request: AIInteractionRequest
): Promise<AIInteractionResponse> {
  const { prompt, context, knowledge, conversationHistory = [], onToken } = request;

  // Step 1: Apply Rule-Based System Engine (RBSE)
  // RBSE shortcuts are useful for isolated first-turn requests, but they lose
  // conversational meaning (for example, "I use Windows" answering a setup
  // question). Once a real history exists, let the model interpret the turn.
  const rbseAction = conversationHistory.length > 0
    ? ({ type: "allow_llm" } as const)
    : classifyQuestion(prompt, context);
  
  switch (rbseAction.type) {
    case "blocked":
      console.log(`[ai-mentor] RBSE blocked question: "${prompt.substring(0, 100)}..."`);
      return rbseAction.response;
    
    case "direct_answer":
      console.log(`[ai-mentor] RBSE direct answer for: "${prompt.substring(0, 100)}..."`);
      return rbseAction.response;
    
    case "allow_llm":
      // Continue to LLM processing
      console.log(`[ai-mentor] RBSE allowing LLM for: "${prompt.substring(0, 100)}..."`);
      break;
  }

  // Step 2: Check if LLM API key is configured
  if (!hasLLMConfig()) {
    console.log(`[ai-mentor] No LLM API key configured, using stub for: "${prompt.substring(0, 100)}..."`);
    return generateStubResponse(prompt, context, knowledge);
  }

  // Step 3: Call LLM with context and knowledge (with smart caching)
  const contextSig = context ? buildContextSignature(context) : "no-context";
  const cacheKey = buildLLMCacheKey(request.tenantId, request.userId, prompt, contextSig);

  // Check cache first — only for successful "ok" responses, never errors
  // A response that relies on conversation turns is personal to this learner;
  // never reuse it from the shared static cache.
  const canUseCache = conversationHistory.length === 0;
  const cached = canUseCache ? getCachedLLMResponse(cacheKey) : null;
  if (cached) {
    console.log(`[ai-mentor] Cache HIT for key: ${cacheKey.substring(0, 80)}...`);
    return { status: "ok", message: cached };
  }

  try {
    const systemPrompt = buildSystemPrompt(context, knowledge);
    
    // Use more tokens for explicitly detailed questions, fewer for simple ones
    const lowerPrompt = prompt.toLowerCase();
    const isDetailedRequest = lowerPrompt.includes("detailed") || lowerPrompt.includes("complete") || 
      lowerPrompt.includes("in detail") || lowerPrompt.includes("all phases") || lowerPrompt.includes("explain everything");
    const maxTokens = isDetailedRequest ? Math.max(LLM_MAX_TOKENS, 1024) : Math.max(LLM_MAX_TOKENS, 512);
    
    console.log(`[ai-mentor] Calling GLM: model=${AI_MODEL}, maxTokens=${maxTokens}, promptLen=${prompt.length}, systemPromptLen=${systemPrompt.length}, detailed=${isDetailedRequest}`);
    const startTime = Date.now();
    
    let content: string;
    let usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;
    
    try {
      const result = await callGLM(systemPrompt, prompt, maxTokens, undefined, conversationHistory, onToken);
      content = result.content;
      usage = result.usage;
    } catch (primaryErr) {
      // Primary model failed — try fallback model (glm-5.1)
      const errMsg = primaryErr instanceof Error ? primaryErr.message : "unknown";
      console.log(`[ai-mentor] Primary model ${AI_MODEL} failed (${errMsg}), trying fallback model ${AI_FALLBACK_MODEL}`);
      const fallbackResult = await callGLM(systemPrompt, prompt, maxTokens, AI_FALLBACK_MODEL, conversationHistory, onToken);
      content = fallbackResult.content;
      usage = fallbackResult.usage;
      console.log(`[ai-mentor] Fallback model ${AI_FALLBACK_MODEL} succeeded, responseLen=${content.length}`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[ai-mentor] GLM call succeeded in ${duration}ms, responseLen=${content.length}, tokens=${usage?.completion_tokens ?? '?'}`);
    
    // Cache the successful response — never cache errors
    if (canUseCache) {
      setCachedLLMResponse(cacheKey, content);
      console.log(`[ai-mentor] Cached response for key: ${cacheKey.substring(0, 80)}...`);
    }
    
    return {
      status: "ok",
      message: content,
    };
  } catch (err) {
    // Both primary and fallback failed — fall back to stub
    const errorMsg = err instanceof Error ? err.message : "unknown";
    console.error(`[ai-mentor] LLM call failed (${errorMsg}), falling back to stub`);

    // Return stub with error status — NOT cached
    const stub = await generateStubResponse(prompt, context, knowledge);
    return {
      ...stub,
      status: "error",
      message: `${stub.message}\n\n*(Note: The AI service was unavailable, showing a cached response.)*`,
    };
  }
}
