/*
  Warnings:

  - You are about to drop the column `trainingData` on the `BusinessBrain` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BusinessBrain" DROP COLUMN "trainingData",
ADD COLUMN     "completionData" JSONB,
ADD COLUMN     "completionScore" INTEGER;
