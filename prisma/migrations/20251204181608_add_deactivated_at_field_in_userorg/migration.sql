-- AlterTable
ALTER TABLE "UserOrganization" ADD COLUMN     "deactivatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "UserOrganization_deactivatedAt_idx" ON "UserOrganization"("deactivatedAt");
