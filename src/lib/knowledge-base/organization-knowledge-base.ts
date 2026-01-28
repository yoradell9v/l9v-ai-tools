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

// Tool Chat utilities
import type { ToolId } from "@/lib/tool-chat/types";

/**
 * Returns which KB fields to fetch based on toolId.
 * Optimizes queries by only fetching relevant fields.
 */
export function getKBFieldsForTool(toolId: ToolId): any {
  const baseFields = {
    id: true,
    organizationId: true,
    version: true,
    businessName: true,
    industry: true,
    industryOther: true,
    whatYouSell: true,
    primaryGoal: true,
    biggestBottleNeck: true,
    toolStack: true,
  };

  switch (toolId) {
    case "role-builder":
      return {
        ...baseFields,
        defaultWeeklyHours: true,
        defaultManagementStyle: true,
        defaultEnglishLevel: true,
        idealCustomer: true,
        primaryCRM: true,
      };
    case "process-builder":
      return {
        ...baseFields,
        brandVoiceStyle: true,
        defaultManagementStyle: true,
      };
    case "organization-profile":
      // Keep this lightweight: org-profile chat only needs core identity/version.
      // (The KB update happens via LearningEvents application, which loads KB server-side.)
      return {
        id: true,
        organizationId: true,
        version: true,
      };
    default:
      return baseFields;
  }
}

/**
 * Formats knowledge base data into context string for AI prompts.
 * Tool-specific formatting ensures only relevant KB fields are included.
 * 
 * @param kb - Knowledge base data (can be null)
 * @param toolId - Tool ID to determine which fields to include
 * @returns Formatted context string for AI prompts
 */
export function formatKnowledgeBaseContext(
  kb: OrganizationKnowledgeBase | null,
  toolId: ToolId
): string {
  if (!kb) return "";

  const contextParts: string[] = [];
  contextParts.push("ORGANIZATION KNOWLEDGE BASE CONTEXT:");
  contextParts.push("Use this existing knowledge about the organization to personalize the extraction:");

  // Common fields for all tools
  if (kb.businessName) {
    contextParts.push(`- Business Name: ${kb.businessName}`);
  }
  if (kb.industry) {
    contextParts.push(
      `- Industry: ${kb.industry}${kb.industryOther ? ` (${kb.industryOther})` : ""}`
    );
  }
  if (kb.whatYouSell) {
    contextParts.push(`- What They Sell: ${kb.whatYouSell}`);
  }
  if (kb.primaryGoal) {
    contextParts.push(`- Primary Goal: ${kb.primaryGoal}`);
  }
  if (kb.biggestBottleNeck) {
    contextParts.push(`- Known Bottleneck: ${kb.biggestBottleNeck}`);
  }

  // Tool-specific fields
  switch (toolId) {
    case "role-builder":
      if (kb.toolStack && Array.isArray(kb.toolStack) && kb.toolStack.length > 0) {
        contextParts.push(`- Existing Tools: ${kb.toolStack.join(", ")}`);
      }
      if (kb.primaryCRM) {
        contextParts.push(`- Primary CRM: ${kb.primaryCRM}`);
      }
      if (kb.defaultWeeklyHours) {
        contextParts.push(`- Default Weekly Hours: ${kb.defaultWeeklyHours}`);
      }
      if (kb.defaultManagementStyle) {
        contextParts.push(`- Default Management Style: ${kb.defaultManagementStyle}`);
      }
      if (kb.defaultEnglishLevel) {
        contextParts.push(`- Default English Level: ${kb.defaultEnglishLevel}`);
      }
      if (kb.idealCustomer) {
        contextParts.push(`- Ideal Customer: ${kb.idealCustomer}`);
      }
      break;

    case "process-builder":
      if (kb.toolStack && Array.isArray(kb.toolStack) && kb.toolStack.length > 0) {
        contextParts.push(`- Existing Tools: ${kb.toolStack.join(", ")}`);
      }
      if (kb.brandVoiceStyle) {
        contextParts.push(`- Brand Voice Style: ${kb.brandVoiceStyle}`);
      }
      if (kb.defaultManagementStyle) {
        contextParts.push(`- Default Management Style: ${kb.defaultManagementStyle}`);
      }
      break;

    case "organization-profile":
      // Include all relevant fields for KB updates
      if (kb.idealCustomer) contextParts.push(`- Ideal Customer: ${kb.idealCustomer}`);
      if (kb.topObjection) contextParts.push(`- Top Objection: ${kb.topObjection}`);
      if (kb.coreOffer) contextParts.push(`- Core Offer: ${kb.coreOffer}`);
      if (kb.customerJourney) contextParts.push(`- Customer Journey: ${kb.customerJourney}`);
      if (kb.monthlyRevenue) contextParts.push(`- Monthly Revenue: ${kb.monthlyRevenue}`);
      if (kb.teamSize) contextParts.push(`- Team Size: ${kb.teamSize}`);
      break;
  }

  contextParts.push(
    "\nWhen extracting data:"
  );
  contextParts.push(
    "- Use KB values as defaults when conversation doesn't specify"
  );
  contextParts.push(
    "- If conversation contradicts KB, prioritize conversation data"
  );
  contextParts.push(
    "- Note which fields used KB defaults vs conversation values"
  );

  return contextParts.join("\n");
}
