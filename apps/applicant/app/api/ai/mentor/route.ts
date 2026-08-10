import { NextResponse } from "next/server";
import { requestAIInteraction, type MentorCard, type MentorConversationTurn } from "@/lib/ai";
import { buildApplicantContext } from "@/lib/ai-context";
import { retrieveKnowledge } from "@/lib/knowledge-base";
import { resolveTenantAccess } from "@/lib/tenant-guard";
import {
  getOrCreateConversation,
  createConversation,
  deleteConversation,
  listConversations,
  appendMessage,
  loadConversationHistory,
} from "@talentos/db";

const MAX_PROMPT_LENGTH = 2000;
/** GET /api/ai/mentor — load the user's conversation history. */
export async function GET(request: Request) {
  const access = await resolveTenantAccess();
  if (!access.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenant, actorUserId } = access;
  if (!actorUserId) {
    return NextResponse.json({ error: "User not found" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    if (url.searchParams.get("list") === "1") {
      return NextResponse.json({ conversations: await listConversations(tenant.id, actorUserId) });
    }
    const conversationId = url.searchParams.get("conversationId") ?? undefined;
    const history = await loadConversationHistory(tenant.id, actorUserId, conversationId);

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

  let body: { prompt?: string; conversationId?: string };

  try {
    body = (await request.json().catch(() => ({}))) as { prompt?: string; conversationId?: string };
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
    const requestedId = body.conversationId?.trim();
    let conversation = requestedId
      ? await loadConversationHistory(tenant.id, actorUserId, requestedId)
      : null;
    if (!conversation && requestedId?.startsWith("conv-")) {
      const created = await createConversation(tenant.id, actorUserId, prompt.slice(0, 60));
      conversation = await loadConversationHistory(tenant.id, actorUserId, created.id);
    }
    if (!conversation) {
      const existing = await getOrCreateConversation(tenant.id, actorUserId, prompt.slice(0, 60));
      conversation = await loadConversationHistory(tenant.id, actorUserId, existing.id);
    }
    if (!conversation) throw new Error("Failed to create conversation");
    const history = conversation;
    // The original prompt plus structured message history gives the model all
    // needed context without duplicating the last answer in the prompt.
    const effectivePrompt = prompt;
    const conversationHistory: MentorConversationTurn[] = (history?.messages ?? [])
      .slice(-8)
      .map((message) => ({
        role: message.role === "mentor" ? "assistant" as const : "user" as const,
        // Limit each turn so a long older answer cannot consume the mentor's context window.
        content: message.content.slice(-1200),
      }));

    // Persist the user's original message, not the expanded internal prompt.
    await appendMessage(conversation.id, "user", prompt, null);

    // Build real applicant context (Phase 4) — safe fallback if no data
    const context = await buildApplicantContext(tenant.id, actorUserId);

    // Retrieve relevant knowledge snippets (Phase 5) — limit to top 2 for faster LLM response
    const knowledge = retrieveKnowledge(effectivePrompt, 2);

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const send = (event: object) => writer.write(encoder.encode(`${JSON.stringify(event)}\n`));

    void (async () => {
      try {
        let emitted = false;
        const response = await requestAIInteraction({
          tenantId: tenant.id, userId: actorUserId, purpose: "mentor",
          prompt: effectivePrompt, context, knowledge, conversationHistory,
          onToken: async (token) => { emitted = true; await send({ type: "token", token }); },
        });
        if (!emitted) await send({ type: "token", token: response.message });
        const cardsJson = response.cards ? JSON.stringify(response.cards) : null;
        await appendMessage(conversation.id, "mentor", response.message, cardsJson);
        await send({ type: "done", conversationId: conversation.id, cards: response.cards, status: response.status });
      } catch (error) {
        await send({ type: "error", error: error instanceof Error ? error.message : "Failed to generate response" });
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate mentor response" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const access = await resolveTenantAccess();
  if (!access.ok || !access.actorUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  const deleted = await deleteConversation(access.tenant.id, access.actorUserId, conversationId);
  return NextResponse.json({ deleted }, { status: deleted ? 200 : 404 });
}
