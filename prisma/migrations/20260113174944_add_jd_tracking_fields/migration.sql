-- AlterTable
ALTER TABLE "OrganizationKnowledgeBase" ADD COLUMN     "bottleneckHistory" JSONB,
ADD COLUMN     "hiringHistory" JSONB,
ADD COLUMN     "servicePreferences" JSONB,
ADD COLUMN     "skillRequirements" JSONB;
