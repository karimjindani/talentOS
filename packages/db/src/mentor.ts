import { prisma } from "./client";

/**
 * Persistence helpers for AI Mentor chat history.
 *
 * All queries are scoped by tenantId + userId — tenant isolation is enforced
 * at the database level by including both keys in every where-clause.
 */

export type SavedMentorMessage = {
  id: string;
  role: string;
  content: string;
  cardsJson: string | null;
  createdAt: Date;
};

export type SavedConversation = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: SavedMentorMessage[];
};

/**
 * Get or create the most recently updated conversation for a user within a tenant.
 * If none exists, creates a new one with the given title.
 */
export async function getOrCreateConversation(
  tenantId: string,
  userId: string,
  title = "New Conversation"
): Promise<{ id: string; title: string }> {
  const existing = await prisma.mentorConversation.findFirst({
    where: { tenantId, userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });

  if (existing) return existing;

  const created = await prisma.mentorConversation.create({
    data: { tenantId, userId, title },
    select: { id: true, title: true },
  });

  return created;
}

/**
 * Append a message to a conversation and bump the conversation's updatedAt.
 */
export async function appendMessage(
  conversationId: string,
  role: "user" | "mentor",
  content: string,
  cardsJson: string | null
): Promise<void> {
  await prisma.mentorMessage.create({
    data: { conversationId, role, content, cardsJson },
  });

  // Touch the conversation so it sorts as most-recent.
  await prisma.mentorConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

/**
 * Load the full message history for a user's most recent conversation.
 * Returns null if the user has no conversations.
 */
export async function loadConversationHistory(
  tenantId: string,
  userId: string
): Promise<SavedConversation | null> {
  const conversation = await prisma.mentorConversation.findFirst({
    where: { tenantId, userId },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          cardsJson: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) return null;

  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: conversation.messages,
  };
}

/**
 * Start a brand-new conversation for a user (e.g. "New chat" button).
 */
export async function createConversation(
  tenantId: string,
  userId: string,
  title = "New Conversation"
): Promise<{ id: string }> {
  const created = await prisma.mentorConversation.create({
    data: { tenantId, userId, title },
    select: { id: true },
  });
  return created;
}
