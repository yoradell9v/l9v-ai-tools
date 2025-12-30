-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('SUPERADMIN', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('INITIAL_ONBOARDING', 'JOB_DESCRIPTION', 'SOP_GENERATION', 'CHAT_CONVERSATION', 'MANUAL_UPDATE', 'FILE_UPLOAD', 'AI_ENRICHMENT');

-- CreateEnum
CREATE TYPE "LearningEventType" AS ENUM ('PATTERN_DETECTED', 'OPTIMIZATION_FOUND', 'INSIGHT_GENERATED', 'INCONSISTENCY_FIXED', 'KNOWLEDGE_EXPANDED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstname" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "globalRole" "GlobalRole",
    "timezone" TEXT DEFAULT 'America/New_York',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOrganization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "UserOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationToken" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "InvitationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationKnowledgeBase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessName" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "industryOther" TEXT,
    "whatYouSell" TEXT,
    "monthlyRevenue" TEXT,
    "teamSize" TEXT,
    "primaryGoal" TEXT,
    "biggestBottleNeck" TEXT,
    "idealCustomer" TEXT,
    "topObjection" TEXT,
    "coreOffer" TEXT,
    "customerJourney" TEXT NOT NULL,
    "toolStack" TEXT[],
    "primaryCRM" TEXT,
    "defaultTimeZone" TEXT,
    "bookingLink" TEXT,
    "supportEmail" TEXT,
    "brandVoiceStyle" TEXT,
    "riskBoldness" TEXT,
    "voiceExampleGood" TEXT,
    "voiceExamplesAvoid" TEXT,
    "contentLinks" TEXT,
    "isRegulated" BOOLEAN DEFAULT false,
    "regulatedIndustry" TEXT,
    "forbiddenWords" TEXT,
    "disclaimers" TEXT,
    "defaultWeeklyHours" TEXT,
    "defaultManagementStyle" TEXT,
    "defaultEnglishLevel" TEXT,
    "proofAssets" TEXT,
    "proofFiles" JSONB,
    "pipeLineStages" TEXT,
    "emailSignOff" TEXT,
    "aiInsights" JSONB,
    "extractedKnowledge" JSONB,
    "completeness" INTEGER,
    "completenessBreakdown" JSONB,
    "aiQualityScore" INTEGER,
    "aiQualityAnalysis" JSONB,
    "aiQualityAnalyzedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastEditedBy" TEXT NOT NULL,
    "lastEditedAt" TIMESTAMP(3),
    "contributors" TEXT[],
    "lastEnrichedAt" TIMESTAMP(3),
    "enrichmentVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationKnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSource" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "contributeFields" TEXT[],
    "extractedData" JSONB,
    "confidence" INTEGER NOT NULL,
    "contributedBy" TEXT NOT NULL,
    "contributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "eventType" "LearningEventType" NOT NULL,
    "insight" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "triggeredBy" TEXT,
    "sourceIds" TEXT[],
    "metadata" JSONB,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "appliedToFields" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedAnalysis" (
    "id" TEXT NOT NULL,
    "userOrganizationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intakeData" JSONB NOT NULL,
    "analysis" JSONB NOT NULL,
    "usedKnowledgeBaseVersion" INTEGER,
    "knowledgeBaseSnapshot" JSONB,
    "contributedInsights" JSONB,
    "parentAnalysisId" TEXT,
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" TIMESTAMP(3),
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefinementMessage" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "userOrganizationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "changedSections" TEXT[],
    "analysisSnapshot" JSONB,
    "sequenceNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefinementMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SOP" (
    "id" TEXT NOT NULL,
    "userOrganizationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "intakeData" JSONB NOT NULL,
    "usedKnowledgeBaseVersion" INTEGER,
    "knowledgeBaseSnapshot" JSONB,
    "contributedInsights" JSONB,
    "metadata" JSONB,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "rootSOPId" TEXT,
    "isCurrentVersion" BOOLEAN NOT NULL DEFAULT true,
    "versionCreatedBy" TEXT,
    "versionCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SOP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnhancementAnalysis" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "analysis" JSONB NOT NULL,
    "dataHash" TEXT NOT NULL,
    "analyzedFields" TEXT[],
    "fieldConfidences" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "EnhancementAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "userOrganizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "usedKnowledgeBaseVersion" INTEGER,
    "contributedInsights" JSONB,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "activeTopics" TEXT[],
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
    "knowledgeBaseCitations" JSONB,
    "generatedArtifacts" JSONB,
    "sequenceNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_globalRole_idx" ON "User"("globalRole");

-- CreateIndex
CREATE INDEX "UserOrganization_organizationId_idx" ON "UserOrganization"("organizationId");

-- CreateIndex
CREATE INDEX "UserOrganization_userId_idx" ON "UserOrganization"("userId");

-- CreateIndex
CREATE INDEX "UserOrganization_deactivatedAt_idx" ON "UserOrganization"("deactivatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserOrganization_userId_organizationId_key" ON "UserOrganization"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationToken_token_key" ON "InvitationToken"("token");

-- CreateIndex
CREATE INDEX "InvitationToken_token_idx" ON "InvitationToken"("token");

-- CreateIndex
CREATE INDEX "InvitationToken_organizationId_idx" ON "InvitationToken"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationToken_organizationId_email_key" ON "InvitationToken"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationKnowledgeBase_organizationId_key" ON "OrganizationKnowledgeBase"("organizationId");

-- CreateIndex
CREATE INDEX "KnowledgeSource_knowledgeBaseId_idx" ON "KnowledgeSource"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "KnowledgeSource_sourceType_idx" ON "KnowledgeSource"("sourceType");

-- CreateIndex
CREATE INDEX "KnowledgeSource_contributedAt_idx" ON "KnowledgeSource"("contributedAt");

-- CreateIndex
CREATE INDEX "LearningEvent_knowledgeBaseId_idx" ON "LearningEvent"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "LearningEvent_eventType_idx" ON "LearningEvent"("eventType");

-- CreateIndex
CREATE INDEX "LearningEvent_category_idx" ON "LearningEvent"("category");

-- CreateIndex
CREATE INDEX "LearningEvent_createdAt_idx" ON "LearningEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SavedAnalysis_userOrganizationId_idx" ON "SavedAnalysis"("userOrganizationId");

-- CreateIndex
CREATE INDEX "SavedAnalysis_createdAt_idx" ON "SavedAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX "SavedAnalysis_isFinalized_idx" ON "SavedAnalysis"("isFinalized");

-- CreateIndex
CREATE INDEX "SavedAnalysis_parentAnalysisId_idx" ON "SavedAnalysis"("parentAnalysisId");

-- CreateIndex
CREATE INDEX "RefinementMessage_analysisId_idx" ON "RefinementMessage"("analysisId");

-- CreateIndex
CREATE INDEX "RefinementMessage_userOrganizationId_idx" ON "RefinementMessage"("userOrganizationId");

-- CreateIndex
CREATE INDEX "RefinementMessage_sequenceNumber_idx" ON "RefinementMessage"("sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RefinementMessage_analysisId_sequenceNumber_key" ON "RefinementMessage"("analysisId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "SOP_userOrganizationId_idx" ON "SOP"("userOrganizationId");

-- CreateIndex
CREATE INDEX "SOP_organizationId_idx" ON "SOP"("organizationId");

-- CreateIndex
CREATE INDEX "SOP_createdAt_idx" ON "SOP"("createdAt");

-- CreateIndex
CREATE INDEX "SOP_rootSOPId_idx" ON "SOP"("rootSOPId");

-- CreateIndex
CREATE INDEX "SOP_isCurrentVersion_idx" ON "SOP"("isCurrentVersion");

-- CreateIndex
CREATE INDEX "SOP_rootSOPId_versionNumber_idx" ON "SOP"("rootSOPId", "versionNumber");

-- CreateIndex
CREATE INDEX "SOP_rootSOPId_isCurrentVersion_idx" ON "SOP"("rootSOPId", "isCurrentVersion");

-- CreateIndex
CREATE INDEX "EnhancementAnalysis_organizationId_idx" ON "EnhancementAnalysis"("organizationId");

-- CreateIndex
CREATE INDEX "EnhancementAnalysis_knowledgeBaseId_idx" ON "EnhancementAnalysis"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "EnhancementAnalysis_generatedAt_idx" ON "EnhancementAnalysis"("generatedAt");

-- CreateIndex
CREATE INDEX "EnhancementAnalysis_dataHash_idx" ON "EnhancementAnalysis"("dataHash");

-- CreateIndex
CREATE INDEX "BusinessConversation_organizationId_idx" ON "BusinessConversation"("organizationId");

-- CreateIndex
CREATE INDEX "BusinessConversation_knowledgeBaseId_idx" ON "BusinessConversation"("knowledgeBaseId");

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
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationToken" ADD CONSTRAINT "InvitationToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationKnowledgeBase" ADD CONSTRAINT "OrganizationKnowledgeBase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "OrganizationKnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "OrganizationKnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedAnalysis" ADD CONSTRAINT "SavedAnalysis_userOrganizationId_fkey" FOREIGN KEY ("userOrganizationId") REFERENCES "UserOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedAnalysis" ADD CONSTRAINT "SavedAnalysis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedAnalysis" ADD CONSTRAINT "SavedAnalysis_parentAnalysisId_fkey" FOREIGN KEY ("parentAnalysisId") REFERENCES "SavedAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefinementMessage" ADD CONSTRAINT "RefinementMessage_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "SavedAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefinementMessage" ADD CONSTRAINT "RefinementMessage_userOrganizationId_fkey" FOREIGN KEY ("userOrganizationId") REFERENCES "UserOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOP" ADD CONSTRAINT "SOP_userOrganizationId_fkey" FOREIGN KEY ("userOrganizationId") REFERENCES "UserOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOP" ADD CONSTRAINT "SOP_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOP" ADD CONSTRAINT "SOP_rootSOPId_fkey" FOREIGN KEY ("rootSOPId") REFERENCES "SOP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnhancementAnalysis" ADD CONSTRAINT "EnhancementAnalysis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnhancementAnalysis" ADD CONSTRAINT "EnhancementAnalysis_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "OrganizationKnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "OrganizationKnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_userOrganizationId_fkey" FOREIGN KEY ("userOrganizationId") REFERENCES "UserOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessMessage" ADD CONSTRAINT "BusinessMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "BusinessConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
