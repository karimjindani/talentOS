-- CreateTable
CREATE TABLE "mentor_conversations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "cardsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentor_conversations_tenantId_userId_updatedAt_idx" ON "mentor_conversations"("tenantId", "userId", "updatedAt");

-- CreateIndex
CREATE INDEX "mentor_messages_conversationId_createdAt_idx" ON "mentor_messages"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "mentor_conversations" ADD CONSTRAINT "mentor_conversations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_conversations" ADD CONSTRAINT "mentor_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_messages" ADD CONSTRAINT "mentor_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "mentor_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
