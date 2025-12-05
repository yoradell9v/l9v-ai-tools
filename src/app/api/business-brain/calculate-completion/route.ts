import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import crypto from "crypto";

export const runtime = "nodejs";

const TIER_ONE_FIELDS = [
  "businessName",
  "website",
  "whatYouSell",
  "businessType",
  "monthlyRevenue",
  "goal90Day",
  "biggestBottleneck",
  "idealCustomer",
  "topObjection",
  "coreOffer",
  "customerJourney",
  "brandVoiceStyle",
  "riskBoldnessLevel",
  "primaryCRM",
  "bookingLink",
  "supportEmail",
];

function isFieldFilled(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function calculateCompletion(brain: any) {
  const { intakeData, fileUploads } = brain;

  let parsedIntakeData = intakeData;
  if (typeof intakeData === "string") {
    try {
      parsedIntakeData = JSON.parse(intakeData);
    } catch (e) {
      console.error("Failed to parse intakeData:", e);
      parsedIntakeData = {};
    }
  }

  let parsedFileUploads: any = fileUploads || {};
  if (typeof fileUploads === "string") {
    try {
      parsedFileUploads = JSON.parse(fileUploads);
    } catch (e) {
      parsedFileUploads = {};
    }
  }

  const fileUploadsArray =
    parsedFileUploads && typeof parsedFileUploads === "object"
      ? Object.values(parsedFileUploads).flat()
      : [];

  let score = 0;
  const quickWins: any[] = [];

  const tierOneFieldsFilled = TIER_ONE_FIELDS.filter((field) =>
    isFieldFilled(parsedIntakeData[field])
  ).length;

  const tierOneComplete = tierOneFieldsFilled === TIER_ONE_FIELDS.length;
  score = Math.round((tierOneFieldsFilled / TIER_ONE_FIELDS.length) * 70);

  const tierTwo = {
    compliance: false,
    proof: false,
    voice: false,
    operations: false,
  };

  if (
    parsedIntakeData.isRegulated === "yes" &&
    isFieldFilled(parsedIntakeData.regulatedIndustryType) &&
    isFieldFilled(parsedIntakeData.forbiddenWords)
  ) {
    tierTwo.compliance = true;
    score += 5;
  } else if (
    parsedIntakeData.isRegulated === "no" ||
    (!parsedIntakeData.isRegulated &&
      isFieldFilled(parsedIntakeData.forbiddenWords))
  ) {
    tierTwo.compliance = true;
    score += 5;
  }

  if (
    parsedIntakeData.hasProofAssets === "yes" &&
    (isFieldFilled(parsedIntakeData.proofAssets) ||
      fileUploadsArray.some((f: any) => f?.field === "proofFiles"))
  ) {
    tierTwo.proof = true;
    score += 10;
  }

  if (
    isFieldFilled(parsedIntakeData.voiceExamplesGood) ||
    isFieldFilled(parsedIntakeData.contentLinks)
  ) {
    tierTwo.voice = true;
    score += 10;
  }

  if (
    isFieldFilled(parsedIntakeData.pipelineStages) ||
    isFieldFilled(parsedIntakeData.emailSignoff) ||
    isFieldFilled(parsedIntakeData.brandEmails)
  ) {
    tierTwo.operations = true;
    score += 5;
  }

  if (
    !tierTwo.voice &&
    !fileUploadsArray.some((f: any) => f?.field === "brandGuide")
  ) {
    quickWins.push({
      id: "upload_brand_guide",
      label: "Upload your brand guide",
      completed: false,
      impact: 10,
      category: "voice",
      action: "upload",
      field: "brandGuide",
    });
  }

  if (!tierTwo.proof) {
    quickWins.push({
      id: "add_proof_assets",
      label: "Add case studies or testimonials",
      completed: false,
      impact: 15,
      category: "proof",
      action: "fill_form",
      section: "proof-credibility",
    });
  }

  if (
    !tierTwo.compliance &&
    parsedIntakeData.isRegulated === "yes" &&
    !isFieldFilled(parsedIntakeData.forbiddenWords)
  ) {
    quickWins.push({
      id: "add_compliance",
      label: "Add compliance docs and forbidden words",
      completed: false,
      impact: 20,
      category: "compliance",
      action: "fill_form",
      section: "compliance-basics",
    });
  }

  if (!tierTwo.voice && !isFieldFilled(parsedIntakeData.voiceExamplesGood)) {
    quickWins.push({
      id: "add_voice_examples",
      label: "Add voice calibration examples",
      completed: false,
      impact: 15,
      category: "voice",
      action: "fill_form",
      section: "voice-calibration",
    });
  }

  if (!tierTwo.operations && !isFieldFilled(parsedIntakeData.pipelineStages)) {
    quickWins.push({
      id: "add_pipeline_stages",
      label: "Add sales pipeline stages",
      completed: false,
      impact: 10,
      category: "operations",
      action: "fill_form",
      section: "operations",
    });
  }

  return {
    score: Math.min(score, 100),
    tierOneComplete,
    tierTwoSections: tierTwo,
    quickWins: quickWins.slice(0, 4),
    lastCalculated: new Date().toISOString(),
  };
}


async function analyzeCardConfidenceWithAI(
  openai: OpenAI,
  cards: any[],
  intakeData: any,
  fileUploads: any[],
  knowledgeBase: any,
  website: string
): Promise<{
  cardAnalysis: Array<{
    cardId: string;
    cardType: string;
    cardTitle: string;
    currentConfidence: number;
    targetConfidence: number;
    missingContexts: Array<{
      name: string;
      fieldType: "text" | "textarea" | "file";
      fieldId: string;
      section: string;
      placeholder?: string;
      accept?: string;
      maxSize?: string;
      helpText?: string;
    }>;
    recommendations: string[];
    priority: "high" | "medium" | "low";
  }>;
  overallAnalysis: {
    averageConfidence: number;
    cardsBelow80: number;
    totalCards: number;
    criticalMissingFields: string[];
  };
}> {
  const fileUploadsArray =
    fileUploads && Array.isArray(fileUploads) ? fileUploads : [];

  // Prepare card summaries for AI analysis
  const cardSummaries = cards.map((card) => ({
    id: card.id,
    type: card.type,
    title: card.title,
    confidence: card.confidence_score || (card.metadata as any)?.confidence_score || 0,
    description: card.description?.substring(0, 1000) || "",
    metadata: card.metadata || {},
  }));

  // Get available form fields from intakeData
  const availableFields = Object.keys(intakeData).filter(
    (key) => isFieldFilled(intakeData[key])
  );
  const availableFiles = fileUploadsArray.map((f: any) => f?.name || "").filter(Boolean);

  const systemPrompt = `You are an expert AI analyst specializing in business intelligence and content quality assessment. Your task is to analyze business cards and recommend specific, actionable enhancements that will improve their confidence scores.

CRITICAL REQUIREMENTS:
1. Analyze each card's content, confidence score, and metadata to identify what's missing
2. Recommend SPECIFIC fields (from the form) or files that would directly improve the card's confidence
3. Base recommendations on the ACTUAL card content, not just generic form fields
4. Consider what information would make the card more accurate, complete, and useful
5. Prioritize recommendations based on impact (high confidence boost = high priority)
6. For each recommendation, specify:
   - fieldType: "text", "textarea", or "file"
   - fieldId: the exact field ID from the form (or a new logical field name)
   - section: which form section it belongs to
   - name: user-friendly label
   - placeholder: helpful placeholder text
   - helpText: brief explanation of why this helps
   - accept/maxSize: for file uploads

AVAILABLE FORM SECTIONS:
- quick-start: Basic business info
- compliance-basics: Legal and compliance
- proof-credibility: Case studies and testimonials
- voice-calibration: Brand voice examples
- operations: Pipeline and operational details

Return JSON with this structure:
{
  "cardAnalysis": [
    {
      "cardId": "string",
      "cardType": "string",
      "cardTitle": "string",
      "currentConfidence": number,
      "targetConfidence": 80,
      "missingContexts": [
        {
          "name": "string",
          "fieldType": "text" | "textarea" | "file",
          "fieldId": "string",
          "section": "string",
          "placeholder": "string",
          "accept": "string (for files)",
          "maxSize": "string (for files)",
          "helpText": "string"
        }
      ],
      "recommendations": ["string"],
      "priority": "high" | "medium" | "low"
    }
  ],
  "overallAnalysis": {
    "averageConfidence": number,
    "cardsBelow80": number,
    "totalCards": number,
    "criticalMissingFields": ["string"]
  }
}`;

  const userMessage = `Analyze these business cards and recommend enhancements:

CARDS TO ANALYZE:
${JSON.stringify(cardSummaries, null, 2)}

CURRENT INTAKE DATA (available fields):
${JSON.stringify(
  Object.fromEntries(
    Object.entries(intakeData).filter(([_, v]) => isFieldFilled(v))
  ),
  null,
  2
)}

AVAILABLE FILES:
${availableFiles.join(", ") || "None"}

WEBSITE:
${website || "Not provided"}

KNOWLEDGE BASE SUMMARY:
${knowledgeBase ? JSON.stringify(knowledgeBase, null, 2).substring(0, 2000) : "Not available"}

For each card with confidence < 80, identify:
1. What specific information is missing that would improve confidence
2. Which form fields or files would provide that information
3. Why each recommendation would help (be specific to the card's content)

Focus on recommendations that are:
- Directly related to the card's purpose and content
- Actionable (user can provide the data)
- High-impact (will meaningfully improve confidence)
- Specific to what the card actually needs (not generic suggestions)`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 4000,
    });

    const aiAnalysis = JSON.parse(response.choices[0].message.content || "{}");

    // Validate and merge with fallback analysis
    if (aiAnalysis.cardAnalysis && Array.isArray(aiAnalysis.cardAnalysis)) {
      // Ensure all cards are included
      const analyzedCardIds = new Set(aiAnalysis.cardAnalysis.map((a: any) => a.cardId));
      for (const card of cards) {
        if (!analyzedCardIds.has(card.id)) {
          // Add fallback analysis for cards not analyzed by AI
          const confidence = card.confidence_score || (card.metadata as any)?.confidence_score || 0;
          aiAnalysis.cardAnalysis.push({
            cardId: card.id,
            cardType: card.type,
            cardTitle: card.title,
            currentConfidence: confidence,
            targetConfidence: 80,
            missingContexts: [],
            recommendations: confidence < 80 ? ["Review card content and add relevant information"] : [],
            priority: confidence < 50 ? "high" : confidence < 70 ? "medium" : "low",
          });
        }
      }

      return aiAnalysis;
    }
  } catch (error) {
    console.error("Error in AI card analysis:", error);
  }

  // Fallback to rule-based analysis
  return analyzeCardConfidenceFallback(cards, intakeData, fileUploadsArray);
}

function analyzeCardConfidenceFallback(
  cards: any[],
  intakeData: any,
  fileUploads: any[]
): {
  cardAnalysis: Array<{
    cardId: string;
    cardType: string;
    cardTitle: string;
    currentConfidence: number;
    targetConfidence: number;
    missingContexts: Array<{
      name: string;
      fieldType: "text" | "textarea" | "file";
      fieldId: string;
      section: string;
      placeholder?: string;
      accept?: string;
      maxSize?: string;
      helpText?: string;
    }>;
    recommendations: string[];
    priority: "high" | "medium" | "low";
  }>;
  overallAnalysis: {
    averageConfidence: number;
    cardsBelow80: number;
    totalCards: number;
    criticalMissingFields: string[];
  };
} {
  const cardAnalysis: any[] = [];
  let totalConfidence = 0;
  let cardsBelow80 = 0;

  const fileUploadsArray =
    fileUploads && Array.isArray(fileUploads) ? fileUploads : [];

  for (const card of cards) {
    const confidence = card.confidence_score || (card.metadata as any)?.confidence_score || 0;
    totalConfidence += confidence;
    if (confidence < 80) cardsBelow80++;

    const missingContexts: Array<{
      name: string;
      fieldType: "text" | "textarea" | "file";
      fieldId: string;
      section: string;
      placeholder?: string;
      accept?: string;
      maxSize?: string;
      helpText?: string;
    }> = [];
    const recommendations: string[] = [];
    let priority: "high" | "medium" | "low" = "medium";

    // Analyze based on card type and confidence
    if (confidence < 80) {
      switch (card.type) {
        case "BRAND_VOICE_CARD":
          if (!isFieldFilled(intakeData.voiceExamplesGood)) {
            missingContexts.push({
              name: "Voice examples (good)",
              fieldType: "textarea",
              fieldId: "voiceExamplesGood",
              section: "voice-calibration",
              placeholder: "Paste 2-3 paragraphs you've written that sound like YOU",
              helpText: "Examples of your best writing that captures your voice",
            });
            recommendations.push("Add 2-3 paragraphs of your best writing that captures your voice");
          }
          if (!fileUploadsArray.some((f: any) => f?.name?.toLowerCase().includes("brand") || f?.name?.toLowerCase().includes("voice"))) {
            missingContexts.push({
              name: "Brand guide document",
              fieldType: "file",
              fieldId: "brandGuide",
              section: "voice-calibration",
              accept: ".pdf,.doc,.docx,.txt",
              maxSize: "10MB",
              helpText: "Upload a brand guide or style guide document",
            });
            recommendations.push("Upload a brand guide or style guide document");
          }
          if (confidence < 50) priority = "high";
          else if (confidence < 70) priority = "medium";
          break;

        case "POSITIONING_CARD":
          const idealCustomerQuality = getFieldQuality(intakeData.idealCustomer);
          if (idealCustomerQuality === "missing" || idealCustomerQuality === "poor") {
            missingContexts.push({
              name: "Ideal customer description",
              fieldType: "textarea",
              fieldId: "idealCustomer",
              section: "quick-start",
              placeholder: "Describe your ideal customer in 2–3 sentences (who they are, their situation, what they want).",
              helpText: idealCustomerQuality === "missing" 
                ? "Detailed ideal customer profile with pain points and desired outcomes"
                : "Expand your ideal customer description with more detail (50+ words)",
            });
            recommendations.push(idealCustomerQuality === "missing"
              ? "Provide detailed ideal customer profile with pain points and desired outcomes"
              : "Expand your ideal customer description with more detail");
          }
          if (confidence < 50) priority = "high";
          else if (confidence < 70) priority = "medium";
          break;

        case "STYLE_RULES":
          if (!isFieldFilled(intakeData.voiceExamplesGood)) {
            missingContexts.push({
              name: "Writing samples",
              fieldType: "textarea",
              fieldId: "voiceExamplesGood",
              section: "voice-calibration",
              placeholder: "Paste 2-3 paragraphs you've written that sound like YOU",
              helpText: "Examples of your writing style",
            });
            recommendations.push("Add examples of your writing style");
          }
          if (!fileUploadsArray.some((f: any) => f?.name?.toLowerCase().includes("style") || f?.name?.toLowerCase().includes("guide"))) {
            missingContexts.push({
              name: "Style guide document",
              fieldType: "file",
              fieldId: "styleGuide",
              section: "voice-calibration",
              accept: ".pdf,.doc,.docx,.txt",
              maxSize: "10MB",
              helpText: "Upload a style guide or content guidelines document",
            });
            recommendations.push("Upload a style guide or content guidelines document");
          }
          if (confidence < 50) priority = "high";
          else if (confidence < 70) priority = "medium";
          break;

        case "COMPLIANCE_RULES":
          if (!isFieldFilled(intakeData.forbiddenWords)) {
            missingContexts.push({
              name: "Forbidden words/claims",
              fieldType: "textarea",
              fieldId: "forbiddenWords",
              section: "compliance-basics",
              placeholder: "guaranteed, 100% success, cure, etc.",
              helpText: "Comma-separated list of forbidden words or claims",
            });
            recommendations.push("List words or claims you absolutely cannot use");
          }
          if (!isFieldFilled(intakeData.disclaimers)) {
            missingContexts.push({
              name: "Required disclaimers",
              fieldType: "textarea",
              fieldId: "disclaimers",
              section: "compliance-basics",
              placeholder: "Results may vary. Individual results not guaranteed.",
              helpText: "Paste exact legal disclaimers that must appear in content",
            });
            recommendations.push("Add any required legal disclaimers");
          }
          if (confidence < 50) priority = "high";
          else if (confidence < 70) priority = "medium";
          break;

        case "GHL_IMPLEMENTATION_NOTES":
          if (!isFieldFilled(intakeData.pipelineStages)) {
            missingContexts.push({
              name: "Pipeline stages",
              fieldType: "textarea",
              fieldId: "pipelineStages",
              section: "operations",
              placeholder: "Lead → Qualified → Meeting Booked → Proposal Sent → Closed Won/Lost",
              helpText: "Define your sales pipeline stages",
            });
            recommendations.push("Define your sales pipeline stages");
          }
          if (confidence < 50) priority = "high";
          else if (confidence < 70) priority = "medium";
          break;
      }
    }

    cardAnalysis.push({
      cardId: card.id,
      cardType: card.type,
      cardTitle: card.title,
      currentConfidence: confidence,
      targetConfidence: 80,
      missingContexts,
      recommendations,
      priority,
    });
  }

  const averageConfidence = cards.length > 0 ? totalConfidence / cards.length : 0;

  // Identify critical missing fields across all cards
  const criticalMissingFields: string[] = [];
  if (!isFieldFilled(intakeData.voiceExamplesGood) && !isFieldFilled(intakeData.contentLinks)) {
    criticalMissingFields.push("Voice calibration examples");
  }
  if (!isFieldFilled(intakeData.proofAssets) && !fileUploadsArray.some((f: any) => f?.name?.toLowerCase().includes("proof") || f?.name?.toLowerCase().includes("testimonial"))) {
    criticalMissingFields.push("Proof assets (case studies/testimonials)");
  }
  if (!isFieldFilled(intakeData.forbiddenWords) && intakeData.isRegulated === "yes") {
    criticalMissingFields.push("Compliance information (forbidden words)");
  }

  return {
    cardAnalysis,
    overallAnalysis: {
      averageConfidence: Math.round(averageConfidence),
      cardsBelow80,
      totalCards: cards.length,
      criticalMissingFields,
    },
  };
}

function getFieldQuality(value: any): "missing" | "poor" | "good" | "excellent" {
  if (!isFieldFilled(value)) return "missing";
  if (typeof value === "string") {
    const length = value.trim().length;
    if (length < 20) return "poor";
    if (length < 50) return "good";
    return "excellent";
  }
  return "good";
}

/**
 * Calculate a hash of the data that affects enhancement analysis
 * This is used to detect when cache should be invalidated
 */
function calculateDataHash(
  cards: any[],
  intakeData: any,
  fileUploads: any[]
): string {
  // Create a stable representation of the data
  const cardData = cards
    .map((c) => `${c.id}:${c.confidence_score || 0}`)
    .sort()
    .join("|");
  
  const intakeDataStr = JSON.stringify(intakeData);
  const fileUploadsStr = JSON.stringify(fileUploads);
  
  const combined = `${cardData}|${intakeDataStr}|${fileUploadsStr}`;
  
  // Create SHA-256 hash
  return crypto.createHash("sha256").update(combined).digest("hex");
}

/**
 * Get cached enhancement analysis if it exists and is still valid
 */
async function getCachedAnalysis(
  brainId: string,
  currentDataHash: string
): Promise<any | null> {
  try {
    const cached = await (prisma as any).enhancementAnalysis.findFirst({
      where: {
        brainId,
        dataHash: currentDataHash,
      },
      orderBy: {
        generatedAt: "desc",
      },
    });

    if (cached) {
      // Check if cache is still fresh (optional: could add TTL here)
      return cached.analysis;
    }
  } catch (error) {
    console.error("Error fetching cached analysis:", error);
  }
  
  return null;
}

/**
 * Save enhancement analysis to cache
 */
async function saveCachedAnalysis(
  brainId: string,
  analysis: any,
  dataHash: string,
  cards: any[],
  userOrganizationId?: string
): Promise<void> {
  try {
    const cardIds = cards.map((c) => c.id);
    const cardConfidences = cards.map(
      (c) => c.confidence_score || (c.metadata as any)?.confidence_score || 0
    );

    await (prisma as any).enhancementAnalysis.create({
      data: {
        brainId,
        analysis: analysis as any,
        dataHash,
        cardIds,
        cardConfidences,
        generatedBy: userOrganizationId || null,
      },
    });

    // Optional: Clean up old analyses (keep only last 5 per brain)
    const oldAnalyses = await (prisma as any).enhancementAnalysis.findMany({
      where: { brainId },
      orderBy: { generatedAt: "desc" },
      skip: 5,
      select: { id: true },
    });

    if (oldAnalyses.length > 0) {
      await (prisma as any).enhancementAnalysis.deleteMany({
        where: {
          id: { in: oldAnalyses.map((a: { id: string }) => a.id) },
        },
      });
    }
  } catch (error) {
    console.error("Error saving cached analysis:", error);
    // Don't throw - caching is optional
  }
}

export async function POST(req: Request) {
  try {
    const { businessBrainId, forceRefresh } = await req.json();

    if (!businessBrainId) {
      return NextResponse.json(
        { success: false, error: "businessBrainId is required" },
        { status: 400 }
      );
    }

    const brain = await prisma.businessBrain.findUnique({
      where: { id: businessBrainId },
      include: {
        cards: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!brain) {
      return NextResponse.json(
        { success: false, error: "Business brain not found" },
        { status: 404 }
      );
    }

    const completionData = calculateCompletion(brain);

    // Analyze card confidence and missing contexts
    let parsedIntakeData = brain.intakeData;
    if (typeof parsedIntakeData === "string") {
      try {
        parsedIntakeData = JSON.parse(parsedIntakeData);
      } catch (e) {
        parsedIntakeData = {};
      }
    }

    let parsedFileUploads: any = brain.fileUploads || [];
    if (typeof brain.fileUploads === "string") {
      try {
        parsedFileUploads = JSON.parse(brain.fileUploads);
      } catch (e) {
        parsedFileUploads = [];
      }
    }

    const fileUploadsArray = Array.isArray(parsedFileUploads)
      ? parsedFileUploads
      : parsedFileUploads && typeof parsedFileUploads === "object"
      ? Object.values(parsedFileUploads).flat()
      : [];

    const cards = brain.cards || [];
    const website = (parsedIntakeData as Record<string, any>)?.website || "";
    const knowledgeBase = brain.knowledgeBase || null;

    // Calculate data hash for cache invalidation
    const dataHash = calculateDataHash(cards, parsedIntakeData, fileUploadsArray);

    // Check for cached analysis (unless force refresh is requested)
    let enhancementAnalysis;
    let fromCache = false;
    let lastAnalyzedAt: string | null = null;

    if (!forceRefresh) {
      const cached = await getCachedAnalysis(businessBrainId, dataHash);
      if (cached) {
        enhancementAnalysis = cached;
        fromCache = true;

        // Get the timestamp of the cached analysis
        const cachedRecord = await (prisma as any).enhancementAnalysis.findFirst({
          where: {
            brainId: businessBrainId,
            dataHash: dataHash,
          },
          orderBy: { generatedAt: "desc" },
          select: { generatedAt: true },
        });
        if (cachedRecord) {
          lastAnalyzedAt = cachedRecord.generatedAt.toISOString();
        }
      }
    }

    // Generate new analysis if not cached or force refresh
    if (!enhancementAnalysis) {
      if (process.env.OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
          });

          enhancementAnalysis = await analyzeCardConfidenceWithAI(
            openai,
            cards,
            parsedIntakeData,
            fileUploadsArray,
            knowledgeBase,
            website
          );
        } catch (error) {
          console.error("Error in AI-powered card analysis:", error);
          // Fallback to rule-based analysis
          enhancementAnalysis = analyzeCardConfidenceFallback(
            cards,
            parsedIntakeData,
            fileUploadsArray
          );
        }
      } else {
        // Fallback to rule-based analysis
        enhancementAnalysis = analyzeCardConfidenceFallback(
          cards,
          parsedIntakeData,
          fileUploadsArray
        );
      }

      // Save to cache (async, don't wait)
      saveCachedAnalysis(
        businessBrainId,
        enhancementAnalysis,
        dataHash,
        cards,
        brain.userOrganizationId
      ).catch((err) => console.error("Error saving cache:", err));
    }

    await prisma.businessBrain.update({
      where: { id: businessBrainId },
      data: {
        completionScore: completionData.score,
        completionData: completionData,
      } as any,
    });

    return NextResponse.json({
      success: true,
      completionData,
      enhancementAnalysis,
      fromCache,
      lastAnalyzedAt,
    });
  } catch (error: any) {
    console.error("Error calculating completion:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to calculate completion",
      },
      { status: 500 }
    );
  }
}
