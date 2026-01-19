export interface OrganizationKnowledgeBase {
  id: string;
  organizationId: string;

  businessName: string | null;
  website: string | null;
  industry: string | null;
  industryOther: string | null;
  whatYouSell: string | null;

  monthlyRevenue: string | null;
  teamSize: string | null;
  primaryGoal: string | null;
  biggestBottleNeck: string | null;

  idealCustomer: string | null;
  topObjection: string | null;
  coreOffer: string | null;
  customerJourney: string | null;

  toolStack: string[];
  primaryCRM: string | null;
  defaultTimeZone: string | null;
  bookingLink: string | null;
  supportEmail: string | null;

  brandVoiceStyle: string | null;
  riskBoldness: string | null;
  voiceExampleGood: string | null;
  voiceExamplesAvoid: string | null;
  contentLinks: string | null;

  isRegulated: boolean | null;
  regulatedIndustry: string | null;
  forbiddenWords: string | null;
  disclaimers: string | null;

  defaultWeeklyHours: string | null;
  defaultManagementStyle: string | null;
  defaultEnglishLevel: string | null;

  proofAssets: string | null;
  proofFiles: any | null;

  pipeLineStages: string | null;
  emailSignOff: string | null;

  aiInsights: any | null;

  extractedKnowledge: any | null;

  completeness: number | null;
  completenessBreakdown: any | null;
  qualityScore: number | null;

  version: number;
  lastEditedBy: string;
  lastEditedAt: Date | null;
  contributors: string[];

  lastEnrichedAt: Date | null;
  enrichmentVersion: number;

  createdAt: Date;
  updatedAt: Date;
}

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

  const percentage =
    totalRequired > 0 ? Math.round((filled / totalRequired) * 100) : 0;

  return {
    filled,
    total: totalRequired,
    percentage,
    missingFields,
  };
}

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
        missingFields: [
          "Business Name",
          "Website",
          "Industry",
          "What You Sell",
        ],
      };

  const needsOnboarding = !requiredFieldsComplete;

  return {
    needsOnboarding,
    completionStatus,
    profileExists,
    requiredFieldsComplete,
  };
}
