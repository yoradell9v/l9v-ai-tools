/*
  Warnings:

  - You are about to drop the column `activeCardIds` on the `BusinessConversation` table. All the data in the column will be lost.
  - You are about to drop the column `brainId` on the `BusinessConversation` table. All the data in the column will be lost.
  - You are about to drop the column `cardCitations` on the `BusinessMessage` table. All the data in the column will be lost.
  - You are about to drop the column `brainId` on the `EnhancementAnalysis` table. All the data in the column will be lost.
  - You are about to drop the column `cardConfidences` on the `EnhancementAnalysis` table. All the data in the column will be lost.
  - You are about to drop the column `cardIds` on the `EnhancementAnalysis` table. All the data in the column will be lost.
  - You are about to drop the column `organizationProfileSnapshot` on the `SOP` table. All the data in the column will be lost.
  - You are about to drop the `BusinessBrain` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BusinessCard` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrganizationProfile` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `knowledgeBaseId` to the `BusinessConversation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `BusinessConversation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `knowledgeBaseId` to the `EnhancementAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `EnhancementAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `SOP` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `SavedAnalysis` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('INITIAL_ONBOARDING', 'JOB_DESCRIPTION', 'SOP_GENERATION', 'CHAT_CONVERSATION', 'MANUAL_UPDATE', 'FILE_UPLOAD', 'AI_ENRICHMENT');

-- CreateEnum
CREATE TYPE "LearningEventType" AS ENUM ('PATTERN_DETECTED', 'OPTIMIZATION_FOUND', 'INSIGHT_GENERATED', 'INCONSISTENCY_FIXED', 'KNOWLEDGE_EXPANDED');

-- DropForeignKey
ALTER TABLE "BusinessBrain" DROP CONSTRAINT "BusinessBrain_userOrganizationId_fkey";

-- DropForeignKey
ALTER TABLE "BusinessCard" DROP CONSTRAINT "BusinessCard_brainId_fkey";

-- DropForeignKey
ALTER TABLE "BusinessConversation" DROP CONSTRAINT "BusinessConversation_brainId_fkey";

-- DropForeignKey
ALTER TABLE "EnhancementAnalysis" DROP CONSTRAINT "EnhancementAnalysis_brainId_fkey";

-- DropIndex
DROP INDEX "BusinessConversation_brainId_idx";

-- DropIndex
DROP INDEX "EnhancementAnalysis_brainId_idx";

-- AlterTable
ALTER TABLE "BusinessConversation" DROP COLUMN "activeCardIds",
DROP COLUMN "brainId",
ADD COLUMN     "activeTopics" TEXT[],
ADD COLUMN     "contributedInsights" JSONB,
ADD COLUMN     "knowledgeBaseId" TEXT NOT NULL,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "usedKnowledgeBaseVersion" INTEGER;

-- AlterTable
ALTER TABLE "BusinessMessage" DROP COLUMN "cardCitations",
ADD COLUMN     "knowledgeBaseCitations" JSONB;

-- AlterTable
ALTER TABLE "EnhancementAnalysis" DROP COLUMN "brainId",
DROP COLUMN "cardConfidences",
DROP COLUMN "cardIds",
ADD COLUMN     "analyzedFields" TEXT[],
ADD COLUMN     "fieldConfidences" JSONB,
ADD COLUMN     "knowledgeBaseId" TEXT NOT NULL,
ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SOP" DROP COLUMN "organizationProfileSnapshot",
ADD COLUMN     "contributedInsights" JSONB,
ADD COLUMN     "knowledgeBaseSnapshot" JSONB,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "usedKnowledgeBaseVersion" INTEGER;

-- AlterTable
ALTER TABLE "SavedAnalysis" ADD COLUMN     "contributedInsights" JSONB,
ADD COLUMN     "knowledgeBaseSnapshot" JSONB,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "usedKnowledgeBaseVersion" INTEGER;

-- DropTable
DROP TABLE "BusinessBrain";

-- DropTable
DROP TABLE "BusinessCard";

-- DropTable (IF EXISTS because OrganizationProfile may not have been created)
DROP TABLE IF EXISTS "OrganizationProfile";

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
    "qualityScore" INTEGER,
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
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "appliedToFields" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "BusinessConversation_organizationId_idx" ON "BusinessConversation"("organizationId");

-- CreateIndex
CREATE INDEX "BusinessConversation_knowledgeBaseId_idx" ON "BusinessConversation"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "EnhancementAnalysis_organizationId_idx" ON "EnhancementAnalysis"("organizationId");

-- CreateIndex
CREATE INDEX "EnhancementAnalysis_knowledgeBaseId_idx" ON "EnhancementAnalysis"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "SOP_organizationId_idx" ON "SOP"("organizationId");

-- AddForeignKey
ALTER TABLE "OrganizationKnowledgeBase" ADD CONSTRAINT "OrganizationKnowledgeBase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "OrganizationKnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "OrganizationKnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedAnalysis" ADD CONSTRAINT "SavedAnalysis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOP" ADD CONSTRAINT "SOP_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnhancementAnalysis" ADD CONSTRAINT "EnhancementAnalysis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnhancementAnalysis" ADD CONSTRAINT "EnhancementAnalysis_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "OrganizationKnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "OrganizationKnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
