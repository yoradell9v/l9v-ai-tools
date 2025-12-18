-- CreateTable
CREATE TABLE "OrganizationProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessName" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "industryOther" TEXT,
    "primaryTools" TEXT,
    "primaryCRM" TEXT,
    "monthlyRevenue" TEXT,
    "teamSize" TEXT,
    "brandVoiceStyle" TEXT,
    "riskBoldnessLevel" TEXT,
    "managementStyle" TEXT,
    "defaultTimezone" TEXT,
    "isRegulated" TEXT,
    "regulatedIndustryType" TEXT,
    "forbiddenWords" TEXT,
    "disclaimers" TEXT,
    "lastEditedBy" TEXT,
    "lastEditedAt" TIMESTAMP(3),
    "contributorsCount" INTEGER NOT NULL DEFAULT 0,
    "requiredFieldsComplete" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationProfile_organizationId_key" ON "OrganizationProfile"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationProfile_organizationId_idx" ON "OrganizationProfile"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationProfile_requiredFieldsComplete_idx" ON "OrganizationProfile"("requiredFieldsComplete");

-- CreateIndex
CREATE INDEX "OrganizationProfile_lastEditedBy_idx" ON "OrganizationProfile"("lastEditedBy");

-- AddForeignKey
ALTER TABLE "OrganizationProfile" ADD CONSTRAINT "OrganizationProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

