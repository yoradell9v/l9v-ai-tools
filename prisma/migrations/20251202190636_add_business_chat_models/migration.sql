-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateTable
CREATE TABLE "BusinessConversation" (
    "id" TEXT NOT NULL,
    "brainId" TEXT NOT NULL,
    "userOrganizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "activeCardIds" TEXT[],
    "contextSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "attachments" JSONB,
    "cardCitations" JSONB,
    "generatedArtifacts" JSONB,
    "sequenceNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessConversation_brainId_idx" ON "BusinessConversation"("brainId");

-- CreateIndex
CREATE INDEX "BusinessConversation_userOrganizationId_idx" ON "BusinessConversation"("userOrganizationId");

-- CreateIndex
CREATE INDEX "BusinessConversation_status_idx" ON "BusinessConversation"("status");

-- CreateIndex
CREATE INDEX "BusinessConversation_lastMessageAt_idx" ON "BusinessConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "BusinessMessage_conversationId_idx" ON "BusinessMessage"("conversationId");

-- CreateIndex
CREATE INDEX "BusinessMessage_role_idx" ON "BusinessMessage"("role");

-- CreateIndex
CREATE INDEX "BusinessMessage_createdAt_idx" ON "BusinessMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessMessage_conversationId_sequenceNumber_key" ON "BusinessMessage"("conversationId", "sequenceNumber");

-- AddForeignKey
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_brainId_fkey" FOREIGN KEY ("brainId") REFERENCES "BusinessBrain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_userOrganizationId_fkey" FOREIGN KEY ("userOrganizationId") REFERENCES "UserOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessMessage" ADD CONSTRAINT "BusinessMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "BusinessConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
