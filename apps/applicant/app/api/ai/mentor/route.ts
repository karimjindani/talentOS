import { NextResponse } from "next/server";
import { requestAIInteraction, type MentorCard } from "@/lib/ai";
import { buildApplicantContext } from "@/lib/ai-context";
import { retrieveKnowledge } from "@/lib/knowledge-base";
import { resolveTenantAccess } from "@/lib/tenant-guard";
import {
  getOrCreateConversation,
  appendMessage,
  loadConversationHistory,
} from "@talentos/db";

const MAX_PROMPT_LENGTH = 2000;
const AFFIRMATIVE_FOLLOW_UP = /^(?:yes|yes please|yep|yeah|sure|okay|ok|continue|go ahead|please do|please)$/i;

function buildContinuationPrompt(prompt: string, previousMentorMessage?: string): string {
  if (!previousMentorMessage || !AFFIRMATIVE_FOLLOW_UP.test(prompt.trim())) {
    return prompt;
  }

  return [
    "The applicant replied positively to your previous question.",
    "Continue the conversation from that question. Give the requested next guidance; do not repeat the previous answer or ask the same question again.",
    "Previous mentor message:",
    previousMentorMessage.slice(-4000),
    `Applicant reply: ${prompt}`,
  ].join("\n\n");
}

/** GET /api/ai/mentor — load the user's conversation history. */
export async function GET() {
  const access = await resolveTenantAccess();
  if (!access.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenant, actorUserId } = access;
  if (!actorUserId) {
    return NextResponse.json({ error: "User not found" }, { status: 403 });
  }

  try {
    const history = await loadConversationHistory(tenant.id, actorUserId);

    if (!history) {
      return NextResponse.json({ messages: [] });
    }

    return NextResponse.json({
      conversationId: history.id,
      messages: history.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        cards: m.cardsJson ? (JSON.parse(m.cardsJson) as MentorCard[]) : undefined,
        timestamp: m.createdAt,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load conversation history" },
      { status: 500 }
    );
  }
}

/** POST /api/ai/mentor — send a prompt and persist the exchange. */
export async function POST(request: Request) {
  const access = await resolveTenantAccess();
  if (!access.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenant, actorUserId } = access;
  if (!actorUserId) {
    return NextResponse.json({ error: "User not found" }, { status: 403 });
  }

  let body: { prompt?: string };

  try {
    body = (await request.json().catch(() => ({}))) as { prompt?: string };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const prompt = body.prompt?.trim() ?? "";

  if (!prompt) {
    return NextResponse.json(
      { error: "Prompt is required" },
      { status: 400 }
    );
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Prompt must be at most ${MAX_PROMPT_LENGTH} characters` },
      { status: 400 }
    );
  }

  try {
    // Load the previous mentor message before persisting the follow-up so short
    // confirmations such as "yes" can continue the current conversation.
    const conversation = await getOrCreateConversation(tenant.id, actorUserId);
    const history = await loadConversationHistory(tenant.id, actorUserId);
    const previousMentorMessage = history?.messages
      .filter((message) => message.role === "mentor")
      .at(-1)?.content;
    const effectivePrompt = buildContinuationPrompt(prompt, previousMentorMessage);

    // Persist the user's original message, not the expanded internal prompt.
    await appendMessage(conversation.id, "user", prompt, null);

    // Build real applicant context (Phase 4) — safe fallback if no data
    const context = await buildApplicantContext(tenant.id, actorUserId);

    // Retrieve relevant knowledge snippets (Phase 5) — limit to top 2 for faster LLM response
    const knowledge = retrieveKnowledge(effectivePrompt, 2);

    // Generate the mentor response
    const response = await requestAIInteraction({
      tenantId: tenant.id,
      userId: actorUserId,
      purpose: "mentor",
      prompt: effectivePrompt,
      context,
      knowledge,
    });

    // Persist the mentor's response (with cards as JSON)
    const cardsJson = response.cards ? JSON.stringify(response.cards) : null;
    await appendMessage(conversation.id, "mentor", response.message, cardsJson);

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate mentor response" },
      { status: 500 }
    );
  }
}
