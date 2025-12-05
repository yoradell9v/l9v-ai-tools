-- CreateTable
CREATE TABLE "EnhancementAnalysis" (
    "id" TEXT NOT NULL,
    "brainId" TEXT NOT NULL,
    "analysis" JSONB NOT NULL,
    "dataHash" TEXT NOT NULL,
    "cardIds" TEXT[],
    "cardConfidences" INTEGER[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "EnhancementAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnhancementAnalysis_brainId_idx" ON "EnhancementAnalysis"("brainId");

-- CreateIndex
CREATE INDEX "EnhancementAnalysis_generatedAt_idx" ON "EnhancementAnalysis"("generatedAt");

-- CreateIndex
CREATE INDEX "EnhancementAnalysis_dataHash_idx" ON "EnhancementAnalysis"("dataHash");

-- AddForeignKey
ALTER TABLE "EnhancementAnalysis" ADD CONSTRAINT "EnhancementAnalysis_brainId_fkey" FOREIGN KEY ("brainId") REFERENCES "BusinessBrain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
