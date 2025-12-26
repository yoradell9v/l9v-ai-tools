export interface CompletionAnalysis {
  overallScore: number;
  tierStatus: {
    tier1Essential: TierCompletionStatus;
    tier2Context: TierCompletionStatus;
    tier3Intelligence: TierCompletionStatus;
  };
  toolReadiness: {
    jobDescriptionBuilder: ToolReadiness;
    sopGenerator: ToolReadiness;
    businessBrain: ToolReadiness;
  };
  recommendations: CompletionRecommendation[];
  missingCriticalFields: string[];
}

interface TierCompletionStatus {
  percentage: number;
  complete: boolean;
  totalFields: number;
  filledFields: number;
  fields: FieldStatus[];
}

interface FieldStatus {
  name: string;
  label: string;
  filled: boolean;
  importance: "critical" | "high" | "medium" | "low";
  affectsTools: string[];
}

interface ToolReadiness {
  ready: boolean;
  score: number;
  quality: "excellent" | "good" | "basic" | "insufficient";
  missingFields: string[];
  recommendations: string[];
  qualityScore?: number;
  qualityReadiness?: {
    score: number;
    quality: "excellent" | "good" | "basic" | "insufficient";
    blockers?: string[];
    enhancers?: string[];
  };
}

interface CompletionRecommendation {
  priority: "high" | "medium" | "low";
  category: string;
  message: string;
  fields: string[];
  benefit: string;
}

const TIER_1_ESSENTIAL = {
  name: "Essential Identity",
  description: "Minimum required for any tool to function",
  weight: 0.4, // 40% of overall score
  fields: [
    {
      name: "businessName",
      label: "Business Name",
      importance: "critical" as const,
      affectsTools: ["jd", "sop", "brain"],
    },
    {
      name: "website",
      label: "Website",
      importance: "critical" as const,
      affectsTools: ["jd", "sop", "brain"],
    },
    {
      name: "industry",
      label: "Industry",
      importance: "critical" as const,
      affectsTools: ["jd", "sop", "brain"],
    },
    {
      name: "whatYouSell",
      label: "What You Do",
      importance: "critical" as const,
      affectsTools: ["jd", "sop", "brain"],
    },
  ],
};

const TIER_2_CONTEXT = {
  name: "Business Context",
  description: "Enables basic tool functionality",
  weight: 0.3, // 30% of overall score
  fields: [
    {
      name: "monthlyRevenue",
      label: "Monthly Revenue",
      importance: "high" as const,
      affectsTools: ["brain"],
    },
    {
      name: "teamSize",
      label: "Team Size",
      importance: "high" as const,
      affectsTools: ["jd", "brain"],
    },
    {
      name: "primaryGoal",
      label: "Primary Goal",
      importance: "high" as const,
      affectsTools: ["brain"],
    },
    {
      name: "toolStack",
      label: "Tool Stack",
      importance: "high" as const,
      affectsTools: ["jd", "sop", "brain"],
    },
    {
      name: "primaryCRM",
      label: "Primary CRM",
      importance: "medium" as const,
      affectsTools: ["jd", "sop"],
    },
    {
      name: "brandVoiceStyle",
      label: "Brand Voice",
      importance: "high" as const,
      affectsTools: ["brain"],
    },
    {
      name: "defaultManagementStyle",
      label: "Management Style",
      importance: "medium" as const,
      affectsTools: ["jd"],
    },
  ],
};

const TIER_3_INTELLIGENCE = {
  name: "Deep Intelligence",
  description: "Powers advanced AI capabilities",
  weight: 0.3, // 30% of overall score
  fields: [
    {
      name: "idealCustomer",
      label: "Ideal Customer",
      importance: "high" as const,
      affectsTools: ["brain"],
    },
    {
      name: "topObjection",
      label: "Top Objection",
      importance: "high" as const,
      affectsTools: ["brain"],
    },
    {
      name: "coreOffer",
      label: "Core Offer",
      importance: "high" as const,
      affectsTools: ["brain"],
    },
    {
      name: "customerJourney",
      label: "Customer Journey",
      importance: "high" as const,
      affectsTools: ["brain"],
    },
    {
      name: "biggestBottleNeck",
      label: "Biggest Bottleneck",
      importance: "high" as const,
      affectsTools: ["brain"],
    },
    {
      name: "voiceExampleGood",
      label: "Voice Examples",
      importance: "medium" as const,
      affectsTools: ["brain"],
    },
    {
      name: "proofAssets",
      label: "Proof Assets",
      importance: "medium" as const,
      affectsTools: ["brain"],
    },
    {
      name: "forbiddenWords",
      label: "Compliance Info",
      importance: "medium" as const,
      affectsTools: ["jd", "sop", "brain"],
    },
  ],
};

export function analyzeKnowledgeBaseCompletion(
  knowledgeBase: any,
  qualityAnalysis?: any
): CompletionAnalysis {
  if (!knowledgeBase) {
    return {
      overallScore: 0,
      tierStatus: {
        tier1Essential: {
          percentage: 0,
          complete: false,
          totalFields: 4,
          filledFields: 0,
          fields: [],
        },
        tier2Context: {
          percentage: 0,
          complete: false,
          totalFields: 7,
          filledFields: 0,
          fields: [],
        },
        tier3Intelligence: {
          percentage: 0,
          complete: false,
          totalFields: 8,
          filledFields: 0,
          fields: [],
        },
      },
      toolReadiness: {
        jobDescriptionBuilder: {
          ready: false,
          score: 0,
          quality: "insufficient",
          missingFields: [],
          recommendations: [],
        },
        sopGenerator: {
          ready: false,
          score: 0,
          quality: "insufficient",
          missingFields: [],
          recommendations: [],
        },
        businessBrain: {
          ready: false,
          score: 0,
          quality: "insufficient",
          missingFields: [],
          recommendations: [],
        },
      },
      recommendations: [],
      missingCriticalFields: [
        "Business Name",
        "Website",
        "Industry",
        "What You Do",
      ],
    };
  }

  const tier1 = analyzeTier(TIER_1_ESSENTIAL, knowledgeBase);
  const tier2 = analyzeTier(TIER_2_CONTEXT, knowledgeBase);
  const tier3 = analyzeTier(TIER_3_INTELLIGENCE, knowledgeBase);

  const overallScore = Math.round(
    tier1.percentage * TIER_1_ESSENTIAL.weight +
      tier2.percentage * TIER_2_CONTEXT.weight +
      tier3.percentage * TIER_3_INTELLIGENCE.weight
  );

  const toolReadiness = {
    jobDescriptionBuilder: analyzeToolReadiness(
      "jd",
      knowledgeBase,
      [tier1, tier2, tier3],
      qualityAnalysis
    ),
    sopGenerator: analyzeToolReadiness(
      "sop",
      knowledgeBase,
      [tier1, tier2, tier3],
      qualityAnalysis
    ),
    businessBrain: analyzeToolReadiness(
      "brain",
      knowledgeBase,
      [tier1, tier2, tier3],
      qualityAnalysis
    ),
  };

  const recommendations = generateRecommendations(
    tier1,
    tier2,
    tier3,
    toolReadiness,
    knowledgeBase
  );

  const missingCriticalFields = [
    ...tier1.fields.filter((f) => !f.filled && f.importance === "critical"),
    ...tier2.fields.filter((f) => !f.filled && f.importance === "critical"),
    ...tier3.fields.filter((f) => !f.filled && f.importance === "critical"),
  ].map((f) => f.label);

  return {
    overallScore,
    tierStatus: {
      tier1Essential: tier1,
      tier2Context: tier2,
      tier3Intelligence: tier3,
    },
    toolReadiness,
    recommendations,
    missingCriticalFields,
  };
}

function analyzeTier(
  tier: {
    name: string;
    description: string;
    weight: number;
    fields: Array<{
      name: string;
      label: string;
      importance: "critical" | "high" | "medium" | "low";
      affectsTools: string[];
    }>;
  },
  knowledgeBase: any
): TierCompletionStatus {
  const fieldStatuses: FieldStatus[] = tier.fields.map((field) => ({
    name: field.name,
    label: field.label,
    filled: isFieldFilled(knowledgeBase, field.name),
    importance: field.importance,
    affectsTools: field.affectsTools,
  }));

  const filledFields = fieldStatuses.filter((f) => f.filled).length;
  const totalFields = fieldStatuses.length;
  const percentage = Math.round((filledFields / totalFields) * 100);

  return {
    percentage,
    complete: percentage === 100,
    totalFields,
    filledFields,
    fields: fieldStatuses,
  };
}

function isFieldFilled(knowledgeBase: any, fieldName: string): boolean {
  const value = knowledgeBase?.[fieldName];

  if (value === null || value === undefined) return false;

  if (Array.isArray(value)) {
    return (
      value.length > 0 &&
      value.some((v) => {
        if (v === null || v === undefined) return false;
        if (typeof v === "string") return v.trim() !== "";
        return Boolean(v);
      })
    );
  }

  if (typeof value === "string") {
    return value.trim() !== "";
  }

  if (typeof value === "boolean") {
    return true;
  }

  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}

function analyzeToolReadiness(
  tool: string,
  knowledgeBase: any,
  tiers: TierCompletionStatus[],
  qualityAnalysis?: any
): ToolReadiness {
  const relevantFields = tiers.flatMap((tier) =>
    tier.fields.filter((f) => f.affectsTools.includes(tool))
  );

  const totalRelevant = relevantFields.length;
  const filledRelevant = relevantFields.filter((f) => f.filled).length;
  const score = Math.round((filledRelevant / totalRelevant) * 100);

  const criticalFields = relevantFields.filter(
    (f) => f.importance === "critical"
  );
  const criticalFilled = criticalFields.filter((f) => f.filled).length;
  const criticalCoverage = criticalFilled / (criticalFields.length || 1);

  let quality: ToolReadiness["quality"];
  let ready: boolean;

  if (tool === "brain") {
    if (score >= 80 && criticalCoverage === 1) {
      quality = "excellent";
      ready = true;
    } else if (score >= 60 && criticalCoverage === 1) {
      quality = "good";
      ready = true;
    } else if (score >= 40 && criticalCoverage === 1) {
      quality = "basic";
      ready = true;
    } else {
      quality = "insufficient";
      ready = false;
    }
  } else {
    if (score >= 60 && criticalCoverage === 1) {
      quality = "excellent";
      ready = true;
    } else if (score >= 40 && criticalCoverage === 1) {
      quality = "good";
      ready = true;
    } else if (criticalCoverage === 1) {
      quality = "basic";
      ready = true;
    } else {
      quality = "insufficient";
      ready = false;
    }
  }

  const missingFields = relevantFields
    .filter((f) => !f.filled)
    .map((f) => f.label);

  const recommendations = generateToolRecommendations(
    tool,
    quality,
    missingFields
  );

  let qualityReadiness: ToolReadiness["qualityReadiness"] | undefined;
  if (qualityAnalysis?.toolImpact) {
    const toolKey =
      tool === "jd"
        ? "jobDescriptionBuilder"
        : tool === "sop"
        ? "sopGenerator"
        : "businessBrain";
    const toolQuality = qualityAnalysis.toolImpact[toolKey];

    if (toolQuality) {
      const qualityAdjustedScore = Math.round(
        score * 0.6 + toolQuality.qualityScore * 0.4
      );

      let qualityAdjustedQuality:
        | "excellent"
        | "good"
        | "basic"
        | "insufficient";
      if (tool === "brain") {
        if (qualityAdjustedScore >= 80) qualityAdjustedQuality = "excellent";
        else if (qualityAdjustedScore >= 60) qualityAdjustedQuality = "good";
        else if (qualityAdjustedScore >= 40) qualityAdjustedQuality = "basic";
        else qualityAdjustedQuality = "insufficient";
      } else {
        if (qualityAdjustedScore >= 60) qualityAdjustedQuality = "excellent";
        else if (qualityAdjustedScore >= 40) qualityAdjustedQuality = "good";
        else if (qualityAdjustedScore >= 20) qualityAdjustedQuality = "basic";
        else qualityAdjustedQuality = "insufficient";
      }

      qualityReadiness = {
        score: qualityAdjustedScore,
        quality: qualityAdjustedQuality,
        blockers: toolQuality.blockers || [],
        enhancers: toolQuality.enhancers || [],
      };
    }
  }

  return {
    ready,
    score,
    quality,
    missingFields,
    recommendations,
    qualityScore:
      qualityAnalysis?.toolImpact?.[
        tool === "jd"
          ? "jobDescriptionBuilder"
          : tool === "sop"
          ? "sopGenerator"
          : "businessBrain"
      ]?.qualityScore,
    qualityReadiness,
  };
}

function generateToolRecommendations(
  tool: string,
  quality: string,
  missingFields: string[]
): string[] {
  const recommendations: string[] = [];

  if (quality === "insufficient") {
    recommendations.push(`Complete critical fields to use this tool`);
  }

  if (tool === "brain") {
    if (quality === "basic") {
      recommendations.push(
        `Add customer and market info for smarter conversations`
      );
    }
    if (missingFields.includes("Ideal Customer")) {
      recommendations.push(
        `Define your ideal customer for personalized insights`
      );
    }
    if (missingFields.includes("Brand Voice")) {
      recommendations.push(`Set your brand voice for consistent messaging`);
    }
  }

  if (tool === "jd" && quality === "basic") {
    recommendations.push(
      `Add management style and tools for better job descriptions`
    );
  }

  if (tool === "sop" && quality === "basic") {
    recommendations.push(
      `Add tool stack and compliance info for detailed SOPs`
    );
  }

  return recommendations;
}

function generateRecommendations(
  tier1: TierCompletionStatus,
  tier2: TierCompletionStatus,
  tier3: TierCompletionStatus,
  toolReadiness: Record<string, ToolReadiness>,
  knowledgeBase: any
): CompletionRecommendation[] {
  const recommendations: CompletionRecommendation[] = [];
  if (!tier1.complete) {
    recommendations.push({
      priority: "high",
      category: "Essential Setup",
      message: "Complete essential fields to activate all tools",
      fields: tier1.fields.filter((f) => !f.filled).map((f) => f.label),
      benefit: "Enables basic functionality across all AI tools",
    });
  }

  if (!toolReadiness.businessBrain.ready) {
    recommendations.push({
      priority: "high",
      category: "Business Brain",
      message: "Add more context for intelligent conversations",
      fields: toolReadiness.businessBrain.missingFields.slice(0, 3),
      benefit: "Get personalized, context-aware AI assistance",
    });
  }

  if (tier2.percentage < 50 && tier1.complete) {
    recommendations.push({
      priority: "medium",
      category: "Business Context",
      message: "Add business context for better AI outputs",
      fields: tier2.fields
        .filter((f) => !f.filled && f.importance === "high")
        .map((f) => f.label)
        .slice(0, 3),
      benefit: "Tools will generate more relevant, customized content",
    });
  }

  if (tier3.percentage < 50 && tier1.complete && tier2.percentage >= 70) {
    recommendations.push({
      priority: "low",
      category: "Advanced Intelligence",
      message: "Unlock advanced AI capabilities",
      fields: tier3.fields
        .filter((f) => !f.filled)
        .map((f) => f.label)
        .slice(0, 3),
      benefit: "Maximum AI intelligence with deep business understanding",
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export function getCompletionDataForStorage(analysis: CompletionAnalysis): any {
  return {
    overallScore: analysis.overallScore,
    tiers: {
      tier1: {
        percentage: analysis.tierStatus.tier1Essential.percentage,
        complete: analysis.tierStatus.tier1Essential.complete,
      },
      tier2: {
        percentage: analysis.tierStatus.tier2Context.percentage,
        complete: analysis.tierStatus.tier2Context.complete,
      },
      tier3: {
        percentage: analysis.tierStatus.tier3Intelligence.percentage,
        complete: analysis.tierStatus.tier3Intelligence.complete,
      },
    },
    toolReadiness: {
      jd: {
        ready: analysis.toolReadiness.jobDescriptionBuilder.ready,
        score: analysis.toolReadiness.jobDescriptionBuilder.score,
        quality: analysis.toolReadiness.jobDescriptionBuilder.quality,
      },
      sop: {
        ready: analysis.toolReadiness.sopGenerator.ready,
        score: analysis.toolReadiness.sopGenerator.score,
        quality: analysis.toolReadiness.sopGenerator.quality,
      },
      brain: {
        ready: analysis.toolReadiness.businessBrain.ready,
        score: analysis.toolReadiness.businessBrain.score,
        quality: analysis.toolReadiness.businessBrain.quality,
      },
    },
    topRecommendations: analysis.recommendations.slice(0, 3),
    lastCalculated: new Date().toISOString(),
  };
}
