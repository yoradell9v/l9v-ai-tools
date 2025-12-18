/**
 * TypeScript interface matching the OrganizationKnowledgeBase Prisma model
 * This represents the single source of truth for all organization business information
 */
export interface OrganizationKnowledgeBase {
  id: string;
  organizationId: string;

  // Core Identity Tier 1 Required
  businessName: string | null;
  website: string | null;
  industry: string | null;
  industryOther: string | null;
  whatYouSell: string | null;

  // Business Context Tier 1
  monthlyRevenue: string | null;
  teamSize: string | null;
  primaryGoal: string | null;
  biggestBottleNeck: string | null;

  // Customer and Market Tier 2
  idealCustomer: string | null;
  topObjection: string | null;
  coreOffer: string | null;
  customerJourney: string | null;

  // Operations and Tools Tier 2
  toolStack: string[];
  primaryCRM: string | null;
  defaultTimeZone: string | null;
  bookingLink: string | null;
  supportEmail: string | null;

  // Brand & Voice (Tier 2)
  brandVoiceStyle: string | null;
  riskBoldness: string | null;
  voiceExampleGood: string | null;
  voiceExamplesAvoid: string | null;
  contentLinks: string | null;

  // Compliance Tier 2
  isRegulated: boolean | null;
  regulatedIndustry: string | null;
  forbiddenWords: string | null;
  disclaimers: string | null;

  // HR Defaults
  defaultWeeklyHours: string | null;
  defaultManagementStyle: string | null;
  defaultEnglishLevel: string | null;

  // Proof & Credibility
  proofAssets: string | null;
  proofFiles: any | null; // Json type

  // Additional Context
  pipeLineStages: string | null;
  emailSignOff: string | null;

  // AI-Generated Insights
  aiInsights: any | null; // Json type

  // Knowledge Extraction (data extracted from tool usage)
  extractedKnowledge: any | null; // Json type

  // Completion and Quality
  completeness: number | null;
  completenessBreakdown: any | null; // Json type
  qualityScore: number | null;

  // Versioning
  version: number;
  lastEditedBy: string;
  lastEditedAt: Date | null;
  contributors: string[];

  // Enrichment tracking
  lastEnrichedAt: Date | null;
  enrichmentVersion: number;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Partial interface for onboarding completion calculation
 * Only includes the required Tier 1 fields
 */
export interface OnboardingProfileFields {
  businessName?: string | null;
  website?: string | null;
  industry?: string | null;
  industryOther?: string | null;
  whatYouSell?: string | null;
  requiredFieldsComplete?: boolean;
}

export interface OnboardingCompletionStatus {
  filled: number;
  total: number;
  percentage: number;
  missingFields: string[];
}

export interface OnboardingStatus {
  needsOnboarding: boolean;
  completionStatus: OnboardingCompletionStatus;
  profileExists: boolean;
  requiredFieldsComplete: boolean;
}

/**
 * Calculates onboarding completion based on required Tier 1 fields
 * Required fields: businessName, website, industry, whatYouSell
 * If industry is "other", industryOther is also required
 */
export function calculateOnboardingCompletion(
  profile: OnboardingProfileFields
): OnboardingCompletionStatus {
  const requiredFields = [
    { key: "businessName", label: "Business Name" },
    { key: "website", label: "Website" },
    { key: "industry", label: "Industry" },
    { key: "whatYouSell", label: "What You Sell" },
  ];

  let totalRequired = requiredFields.length;
  let filled = 0;
  const missingFields: string[] = [];

  if (profile.businessName && profile.businessName.trim() !== "") {
    filled++;
  } else {
    missingFields.push("Business Name");
  }

  if (profile.website && profile.website.trim() !== "") {
    filled++;
  } else {
    missingFields.push("Website");
  }

  if (profile.industry && profile.industry.trim() !== "") {
    filled++;

    if (profile.industry.toLowerCase() === "other") {
      totalRequired = 5; // Include industryOther in total
      if (profile.industryOther && profile.industryOther.trim() !== "") {
        filled++;
      } else {
        missingFields.push("Industry Description");
      }
    }
  } else {
    missingFields.push("Industry");
  }

  if (profile.whatYouSell && profile.whatYouSell.trim() !== "") {
    filled++;
  } else {
    missingFields.push("What You Sell");
  }

  const percentage = totalRequired > 0 ? Math.round((filled / totalRequired) * 100) : 0;

  return {
    filled,
    total: totalRequired,
    percentage,
    missingFields,
  };
}

/**
 * Checks the onboarding status of an organization knowledge base
 * Returns whether onboarding is needed and completion details
 */
export function checkOnboardingStatus(
  profile: OnboardingProfileFields | null
): OnboardingStatus {
  const profileExists = profile !== null;
  const requiredFieldsComplete = profile?.requiredFieldsComplete ?? false;

  const completionStatus = profile
    ? calculateOnboardingCompletion(profile)
    : {
        filled: 0,
        total: 4,
        percentage: 0,
        missingFields: ["Business Name", "Website", "Industry", "What You Sell"],
      };

  const needsOnboarding = !requiredFieldsComplete;

  return {
    needsOnboarding,
    completionStatus,
    profileExists,
    requiredFieldsComplete,
  };
}
