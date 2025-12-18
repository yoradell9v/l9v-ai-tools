/*
  Warnings:

  - You are about to drop the column `qualityScore` on the `OrganizationKnowledgeBase` table. All the data in the column will be lost.
  - You are about to drop the `OrganizationProfile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "OrganizationProfile" DROP CONSTRAINT "OrganizationProfile_organizationId_fkey";

-- AlterTable
ALTER TABLE "OrganizationKnowledgeBase" DROP COLUMN "qualityScore",
ADD COLUMN     "aiQualityAnalysis" JSONB,
ADD COLUMN     "aiQualityAnalyzedAt" TIMESTAMP(3),
ADD COLUMN     "aiQualityScore" INTEGER;

-- DropTable
DROP TABLE "OrganizationProfile";
