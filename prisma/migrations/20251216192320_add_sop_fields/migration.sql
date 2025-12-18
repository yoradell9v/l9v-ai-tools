/*
  Warnings:

  - Added the required column `intakeData` to the `SOP` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SOP" ADD COLUMN     "intakeData" JSONB NOT NULL,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "organizationProfileSnapshot" JSONB;

-- CreateIndex
CREATE INDEX "SOP_createdAt_idx" ON "SOP"("createdAt");
