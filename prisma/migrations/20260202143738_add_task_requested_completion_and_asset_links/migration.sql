-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "assetLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "requestedCompletionAt" TIMESTAMP(3);
