/*
  Warnings:

  - The values [USER] on the enum `TenantRole` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `intakeData` to the `BusinessBrain` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GlobalRole" ADD VALUE 'ADMIN';
ALTER TYPE "GlobalRole" ADD VALUE 'MEMBER';

-- AlterEnum
BEGIN;
CREATE TYPE "TenantRole_new" AS ENUM ('ADMIN', 'MEMBER');
ALTER TABLE "UserOrganization" ALTER COLUMN "role" TYPE "TenantRole_new" USING ("role"::text::"TenantRole_new");
ALTER TABLE "InvitationToken" ALTER COLUMN "role" TYPE "TenantRole_new" USING ("role"::text::"TenantRole_new");
ALTER TYPE "TenantRole" RENAME TO "TenantRole_old";
ALTER TYPE "TenantRole_new" RENAME TO "TenantRole";
DROP TYPE "TenantRole_old";
COMMIT;

-- AlterTable
ALTER TABLE "BusinessBrain" ADD COLUMN     "fileUploads" JSONB,
ADD COLUMN     "intakeData" JSONB NOT NULL,
ALTER COLUMN "trainingData" DROP NOT NULL,
ALTER COLUMN "knowledgeBase" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InvitationToken" ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SavedAnalysis" ADD COLUMN     "parentAnalysisId" TEXT,
ADD COLUMN     "versionNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "BusinessCard" (
    "id" TEXT NOT NULL,
    "brainId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" INTEGER,
    "metadata" JSONB,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessCard_brainId_idx" ON "BusinessCard"("brainId");

-- CreateIndex
CREATE INDEX "BusinessCard_type_idx" ON "BusinessCard"("type");

-- CreateIndex
CREATE INDEX "SavedAnalysis_parentAnalysisId_idx" ON "SavedAnalysis"("parentAnalysisId");

-- AddForeignKey
ALTER TABLE "SavedAnalysis" ADD CONSTRAINT "SavedAnalysis_parentAnalysisId_fkey" FOREIGN KEY ("parentAnalysisId") REFERENCES "SavedAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCard" ADD CONSTRAINT "BusinessCard_brainId_fkey" FOREIGN KEY ("brainId") REFERENCES "BusinessBrain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
