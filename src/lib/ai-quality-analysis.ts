import OpenAI from "openai";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AIQualityAnalysis {
  overallScore: number; // 0-100 weighted average
  fieldAnalysis: {
    [fieldName: string]: FieldQualityAnalysis;
  };
  crossFieldCoherence: {
    score: number; // 0-100
    issues: string[];
    strengths: string[];
  };
  toolImpact: {
    jobDescriptionBuilder: ToolQualityImpact;
    sopGenerator: ToolQualityImpact;
    businessBrain: ToolQualityImpact;
  };
  topRecommendations: QualityRecommendation[];
  analyzedAt: string;
}

export interface FieldQualityAnalysis {
  qualityScore: number; // 0-100
  specificityScore: number; // 0-100
  actionabilityScore: number; // 0-100
  overallQuality: 'excellent' | 'good' | 'basic' | 'poor';
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

export interface ToolQualityImpact {
  qualityScore: number; // 0-100
  blockers: string[]; // Fields that hurt quality
  enhancers: string[]; // Fields that help quality
  estimatedImprovement?: string; // e.g., "Will improve by 15 points if fixed"
}

export interface QualityRecommendation {
  priority: 'high' | 'medium' | 'low';
  field?: string;
  message: string;
  impact: string; // "Will improve Business Brain by 15 points"
}

// ============================================
// FIELD MAPPINGS (from completion-analysis.ts)
// ============================================

const FIELD_LABELS: Record<string, string> = {
  businessName: 'Business Name',
  website: 'Website',
  industry: 'Industry',
  industryOther: 'Industry Description',
  whatYouSell: 'What You Do',
  monthlyRevenue: 'Monthly Revenue',
  teamSize: 'Team Size',
  primaryGoal: 'Primary Goal',
  biggestBottleNeck: 'Biggest Bottleneck',
  idealCustomer: 'Ideal Customer',
  topObjection: 'Top Objection',
  coreOffer: 'Core Offer',
  customerJourney: 'Customer Journey',
  toolStack: 'Tool Stack',
  primaryCRM: 'Primary CRM',
  defaultTimeZone: 'Default Timezone',
  bookingLink: 'Booking Link',
  supportEmail: 'Support Email',
  brandVoiceStyle: 'Brand Voice',
  riskBoldness: 'Risk Boldness',
  voiceExampleGood: 'Voice Examples (Good)',
  voiceExamplesAvoid: 'Voice Examples (Avoid)',
  contentLinks: 'Content Links',
  isRegulated: 'Is Regulated',
  regulatedIndustry: 'Regulated Industry',
  forbiddenWords: 'Forbidden Words',
  disclaimers: 'Disclaimers',
  defaultWeeklyHours: 'Default Weekly Hours',
  defaultManagementStyle: 'Management Style',
  defaultEnglishLevel: 'Default English Level',
  proofAssets: 'Proof Assets',
  proofFiles: 'Proof Files',
  pipeLineStages: 'Pipeline Stages',
  emailSignOff: 'Email Sign Off',
};

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

export async function analyzeKnowledgeBaseQuality(
  openai: OpenAI,
  knowledgeBase: any
): Promise<AIQualityAnalysis> {
  if (!knowledgeBase) {
    return getEmptyAnalysis();
  }

  // Filter to only filled fields
  const filledFields = getFilledFields(knowledgeBase);
  
  if (filledFields.length === 0) {
    return getEmptyAnalysis();
  }

  // Build prompt for batch analysis
  const prompt = buildAnalysisPrompt(filledFields, knowledgeBase);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: getSystemPrompt(),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for consistent scoring
      max_tokens: 4000,
    });

    const rawResponse = response.choices[0].message.content || "{}";
    let aiResponse: any = {};

    try {
      aiResponse = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error("[AI Quality Analysis] Failed to parse AI response:", parseError);
      throw new Error("Failed to parse AI quality analysis response");
    }

    // Process and validate the response
    const analysis = processAIResponse(aiResponse, filledFields);
    
    return {
      ...analysis,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[AI Quality Analysis] OpenAI API error:", error);
    throw error;
  }
}

// ============================================
// PROMPT BUILDING
// ============================================

function getSystemPrompt(): string {
  return `You are an expert knowledge base quality analyst. Your job is to evaluate how well an organization's knowledge base fields are filled for AI tool usage.

Evaluate each field on:
1. **Specificity** (0-100): How specific and detailed is the information? Generic answers score low.
2. **Actionability** (0-100): How useful is this for AI tools? Can AI actually use this to generate better outputs?
3. **Overall Quality** (excellent/good/basic/poor): Overall assessment

For each field, provide:
- qualityScore: Weighted average of specificity and actionability (0-100)
- specificityScore: How specific/detailed (0-100)
- actionabilityScore: How actionable for AI (0-100)
- overallQuality: excellent/good/basic/poor
- strengths: Array of what's good about this field
- gaps: Array of what's missing or vague
- recommendations: Array of specific improvement suggestions

Also evaluate:
- Cross-field coherence: Do fields make sense together? Any contradictions?
- Tool impact: Which fields help/hurt each tool (Job Descriptions, SOPs, Business Brain)?

Return a JSON object with this structure:
{
  "fieldAnalysis": {
    "fieldName": {
      "qualityScore": 75,
      "specificityScore": 80,
      "actionabilityScore": 70,
      "overallQuality": "good",
      "strengths": ["Clear age range", "Defined pain point"],
      "gaps": ["No job titles", "Missing location"],
      "recommendations": ["Add specific job titles", "Include geographic location"]
    }
  },
  "crossFieldCoherence": {
    "score": 85,
    "issues": [],
    "strengths": ["Fields align well", "Consistent messaging"]
  },
  "toolImpact": {
    "jobDescriptionBuilder": {
      "qualityScore": 78,
      "blockers": ["Field names that hurt quality"],
      "enhancers": ["Field names that help quality"]
    },
    "sopGenerator": { ... },
    "businessBrain": { ... }
  },
  "topRecommendations": [
    {
      "priority": "high",
      "field": "idealCustomer",
      "message": "Add more specific details",
      "impact": "Will improve Business Brain by 15 points"
    }
  ]
}`;
}

function buildAnalysisPrompt(filledFields: Array<{ name: string; value: any }>, knowledgeBase: any): string {
  const fieldsData = filledFields.map(field => ({
    name: field.name,
    label: FIELD_LABELS[field.name] || field.name,
    value: formatFieldValue(field.value),
  }));

  return `Analyze this organization's knowledge base for AI tool usability.

KNOWLEDGE BASE FIELDS:
${JSON.stringify(fieldsData, null, 2)}

CONTEXT:
- Business Name: ${knowledgeBase.businessName || 'Not provided'}
- Industry: ${knowledgeBase.industry || 'Not provided'}
- What They Do: ${knowledgeBase.whatYouSell || 'Not provided'}

Analyze each field for:
1. Specificity - Is it detailed enough? Generic answers like "various clients" score low.
2. Actionability - Can AI tools use this effectively? Vague descriptions score low.
3. Quality - Overall assessment

Then evaluate:
- Cross-field coherence: Do all fields make sense together?
- Tool impact: Which fields help/hurt Job Descriptions, SOPs, and Business Brain tools?

Provide specific, actionable recommendations. Be honest about quality - don't inflate scores.`;
}

function formatFieldValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ============================================
// RESPONSE PROCESSING
// ============================================

function processAIResponse(aiResponse: any, filledFields: Array<{ name: string; value: any }>): Omit<AIQualityAnalysis, 'analyzedAt'> {
  // Process field analysis
  const fieldAnalysis: Record<string, FieldQualityAnalysis> = {};
  
  if (aiResponse.fieldAnalysis && typeof aiResponse.fieldAnalysis === 'object') {
    for (const [fieldName, analysis] of Object.entries(aiResponse.fieldAnalysis)) {
      const fieldData = analysis as any;
      fieldAnalysis[fieldName] = {
        qualityScore: Math.min(100, Math.max(0, fieldData.qualityScore || 0)),
        specificityScore: Math.min(100, Math.max(0, fieldData.specificityScore || 0)),
        actionabilityScore: Math.min(100, Math.max(0, fieldData.actionabilityScore || 0)),
        overallQuality: fieldData.overallQuality || 'basic',
        strengths: Array.isArray(fieldData.strengths) ? fieldData.strengths : [],
        gaps: Array.isArray(fieldData.gaps) ? fieldData.gaps : [],
        recommendations: Array.isArray(fieldData.recommendations) ? fieldData.recommendations : [],
      };
    }
  }

  // Process cross-field coherence
  const crossFieldCoherence = {
    score: Math.min(100, Math.max(0, aiResponse.crossFieldCoherence?.score || 0)),
    issues: Array.isArray(aiResponse.crossFieldCoherence?.issues) 
      ? aiResponse.crossFieldCoherence.issues 
      : [],
    strengths: Array.isArray(aiResponse.crossFieldCoherence?.strengths)
      ? aiResponse.crossFieldCoherence.strengths
      : [],
  };

  // Process tool impact
  const toolImpact = {
    jobDescriptionBuilder: processToolImpact(aiResponse.toolImpact?.jobDescriptionBuilder),
    sopGenerator: processToolImpact(aiResponse.toolImpact?.sopGenerator),
    businessBrain: processToolImpact(aiResponse.toolImpact?.businessBrain),
  };

  // Process recommendations
  const topRecommendations: QualityRecommendation[] = Array.isArray(aiResponse.topRecommendations)
    ? aiResponse.topRecommendations
        .map((rec: any) => ({
          priority: rec.priority || 'medium',
          field: rec.field,
          message: rec.message || '',
          impact: rec.impact || '',
        }))
        .filter((rec: QualityRecommendation) => rec.message)
        .slice(0, 5) // Top 5
    : [];

  // Calculate overall score (weighted average of field quality scores)
  const fieldScores = Object.values(fieldAnalysis).map(f => f.qualityScore);
  const overallScore = fieldScores.length > 0
    ? Math.round(fieldScores.reduce((sum, score) => sum + score, 0) / fieldScores.length)
    : 0;

  return {
    overallScore,
    fieldAnalysis,
    crossFieldCoherence,
    toolImpact,
    topRecommendations,
  };
}

function processToolImpact(toolData: any): ToolQualityImpact {
  if (!toolData || typeof toolData !== 'object') {
    return {
      qualityScore: 0,
      blockers: [],
      enhancers: [],
    };
  }

  return {
    qualityScore: Math.min(100, Math.max(0, toolData.qualityScore || 0)),
    blockers: Array.isArray(toolData.blockers) ? toolData.blockers : [],
    enhancers: Array.isArray(toolData.enhancers) ? toolData.enhancers : [],
    estimatedImprovement: toolData.estimatedImprovement,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getFilledFields(knowledgeBase: any): Array<{ name: string; value: any }> {
  const fields: Array<{ name: string; value: any }> = [];
  
  // List of all fields to check
  const allFields = [
    'businessName', 'website', 'industry', 'industryOther', 'whatYouSell',
    'monthlyRevenue', 'teamSize', 'primaryGoal', 'biggestBottleNeck',
    'idealCustomer', 'topObjection', 'coreOffer', 'customerJourney',
    'toolStack', 'primaryCRM', 'defaultTimeZone', 'bookingLink', 'supportEmail',
    'brandVoiceStyle', 'riskBoldness', 'voiceExampleGood', 'voiceExamplesAvoid', 'contentLinks',
    'isRegulated', 'regulatedIndustry', 'forbiddenWords', 'disclaimers',
    'defaultWeeklyHours', 'defaultManagementStyle', 'defaultEnglishLevel',
    'proofAssets', 'proofFiles', 'pipeLineStages', 'emailSignOff',
  ];

  for (const fieldName of allFields) {
    const value = knowledgeBase[fieldName];
    if (isFieldFilled(value)) {
      fields.push({ name: fieldName, value });
    }
  }

  return fields;
}

function isFieldFilled(value: any): boolean {
  if (value === null || value === undefined) return false;
  
  if (Array.isArray(value)) {
    return value.length > 0 && value.some(v => {
      if (v === null || v === undefined) return false;
      if (typeof v === 'string') return v.trim() !== '';
      return Boolean(v);
    });
  }
  
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  
  if (typeof value === 'boolean') {
    return true;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  
  return true;
}

function getEmptyAnalysis(): AIQualityAnalysis {
  return {
    overallScore: 0,
    fieldAnalysis: {},
    crossFieldCoherence: {
      score: 0,
      issues: [],
      strengths: [],
    },
    toolImpact: {
      jobDescriptionBuilder: { qualityScore: 0, blockers: [], enhancers: [] },
      sopGenerator: { qualityScore: 0, blockers: [], enhancers: [] },
      businessBrain: { qualityScore: 0, blockers: [], enhancers: [] },
    },
    topRecommendations: [],
    analyzedAt: new Date().toISOString(),
  };
}

// ============================================
// HELPER FOR API ROUTE
// ============================================

export function getQualityDataForStorage(
  analysis: AIQualityAnalysis
): any {
  return {
    overallScore: analysis.overallScore,
    fieldAnalysis: analysis.fieldAnalysis,
    crossFieldCoherence: analysis.crossFieldCoherence,
    toolImpact: analysis.toolImpact,
    topRecommendations: analysis.topRecommendations,
    analyzedAt: analysis.analyzedAt,
  };
}
