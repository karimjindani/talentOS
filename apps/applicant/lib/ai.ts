import type { ApplicantContext } from "./ai-context";
import { contextToPromptSection } from "./ai-context";
import type { KnowledgeSnippet } from "./knowledge-base";
import { knowledgeToPromptSection } from "./knowledge-base";
import { classifyQuestion } from "./ai-rbse";

export type AIInteractionRequest = {
  tenantId: string;
  userId?: string;
  purpose: "mentor" | "knowledge_assistant" | "reviewer" | "interviewer";
  prompt: string;
  /** Phase 4: real applicant context for context-aware responses. */
  context?: ApplicantContext;
  /** Phase 5: retrieved knowledge snippets for RAG-style responses. */
  knowledge?: KnowledgeSnippet[];
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
// Z.AI coding endpoint (api.z.ai) — works with the GLM_Z API key
const ZHIPUAI_BASE_URL =
  process.env.ZHIPUAI_BASE_URL ?? "https://api.z.ai/api/coding/paas/v4";
const ZHIPUAI_MODEL = process.env.ZHIPUAI_MODEL ?? "glm-4.5-air";
const LLM_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS ?? "1024", 10); // 1024 is enough for complete structured responses
const LLM_TEMPERATURE = parseFloat(process.env.LLM_TEMPERATURE ?? "0.7");
const LLM_TIMEOUT_MS = 60_000; // 60 second timeout — fail fast, don't make user wait 2 minutes
const LLM_MAX_RETRIES = 1; // Only retry on network/server errors, not timeouts

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
    "Guide interns through tasks, missions, progress, and engineering practices (SDLC, SEM, testing, deployment).",
    "",
    "RULES:",
    "- Answer concisely using bullet points and Markdown.",
    "- Use sections: **Summary**, **Details**, **Key Concepts**, **Example** (if relevant), **Recommended Action**.",
    "- Keep responses under 300 words unless the user explicitly asks for a detailed explanation.",
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
  stream: false;
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
 * Call the ZhipuAI (GLM_Z.ai) chat completions endpoint with retry logic.
 *
 * Uses native fetch with timeout via AbortController.
 * Returns the assistant's text content.
 * Throws on auth errors, rate limits, timeouts, and invalid responses.
 */
async function callGLM(
  systemPrompt: string,
  userPrompt: string,
  maxTokens?: number
): Promise<{ content: string; usage?: GLMChatResponse["usage"] }> {
  const url = `${ZHIPUAI_BASE_URL}/chat/completions`;
  const effectiveMaxTokens = maxTokens ?? LLM_MAX_TOKENS;

  const body: GLMChatRequest = {
    model: ZHIPUAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: effectiveMaxTokens,
    temperature: LLM_TEMPERATURE,
    stream: false,
  };

  console.log(`[ai-mentor] callGLM: model=${ZHIPUAI_MODEL}, max_tokens=${effectiveMaxTokens}, systemPromptLen=${systemPrompt.length}, userPromptLen=${userPrompt.length}`);
  
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

      const data = (await response.json()) as GLMChatResponse;

      const content = data.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("LLM_INVALID_RESPONSE");
      }

      clearTimeout(timeoutId);
      console.log(`[ai-mentor] callGLM: Success on attempt ${attempt}, contentLen=${content.length}, tokens=${data.usage?.completion_tokens ?? '?'}, retries=${retryCount}`);
      return { content, usage: data.usage };
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
      
      // Don't retry on auth errors or timeouts — these won't succeed on retry
      if (lastError.message === "LLM_AUTH_ERROR" || lastError.message === "LLM_TIMEOUT") {
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
  const { prompt, context, knowledge } = request;

  // Step 1: Apply Rule-Based System Engine (RBSE)
  const rbseAction = classifyQuestion(prompt, context);
  
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

  // Step 3: Call LLM with context and knowledge
  try {
    const systemPrompt = buildSystemPrompt(context, knowledge);
    
    // Use more tokens for explicitly detailed questions, fewer for simple ones
    const lowerPrompt = prompt.toLowerCase();
    const isDetailedRequest = lowerPrompt.includes("detailed") || lowerPrompt.includes("complete") || 
      lowerPrompt.includes("in detail") || lowerPrompt.includes("all phases") || lowerPrompt.includes("explain everything");
    const maxTokens = isDetailedRequest ? Math.max(LLM_MAX_TOKENS, 2048) : LLM_MAX_TOKENS;
    
    console.log(`[ai-mentor] Calling GLM: model=${ZHIPUAI_MODEL}, maxTokens=${maxTokens}, promptLen=${prompt.length}, systemPromptLen=${systemPrompt.length}, detailed=${isDetailedRequest}`);
    const startTime = Date.now();
    const { content, usage } = await callGLM(systemPrompt, prompt, maxTokens);
    const duration = Date.now() - startTime;
    console.log(`[ai-mentor] GLM call succeeded in ${duration}ms, responseLen=${content.length}, tokens=${usage?.completion_tokens ?? '?'}`);
    
    return {
      status: "ok",
      message: content,
    };
  } catch (err) {
    // Log the error (without exposing the API key) and fall back to stub
    const errorMsg = err instanceof Error ? err.message : "unknown";
    console.error(`[ai-mentor] LLM call failed (${errorMsg}), falling back to stub`);

    // Return stub with error status so the frontend can indicate degradation
    const stub = await generateStubResponse(prompt, context, knowledge);
    return {
      ...stub,
      status: "error",
      message: `${stub.message}\n\n*(Note: The AI service was unavailable, showing a cached response.)*`,
    };
  }
}
