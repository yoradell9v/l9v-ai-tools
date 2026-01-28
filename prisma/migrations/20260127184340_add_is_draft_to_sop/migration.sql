-- AlterTable
ALTER TABLE "SOP" ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "SOP_isDraft_idx" ON "SOP"("isDraft");

-- CreateIndex
CREATE INDEX "SOP_userOrganizationId_isDraft_idx" ON "SOP"("userOrganizationId", "isDraft");
