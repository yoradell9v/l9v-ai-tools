-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "OrganizationDocument" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER,
    "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "extractedContent" JSONB,
    "extractionError" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationDocument_knowledgeBaseId_idx" ON "OrganizationDocument"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "OrganizationDocument_extractionStatus_idx" ON "OrganizationDocument"("extractionStatus");

-- CreateIndex
CREATE INDEX "OrganizationDocument_uploadedAt_idx" ON "OrganizationDocument"("uploadedAt");

-- AddForeignKey
ALTER TABLE "OrganizationDocument" ADD CONSTRAINT "OrganizationDocument_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "OrganizationKnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
