import OpenAI from "openai";
import { ExtractedFileContent } from "@/lib/extract-content";
import { OrganizationKnowledgeBase } from "@prisma/client";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AI_MODEL = "gpt-4o-mini";

export interface FieldMapping {
  field: string;
  insight: string;
  confidence: number;
  action: "REPLACE" | "APPEND" | "NEW_INSIGHT";
  reasoning: string;
}

export interface NewInsight {
  category: string;
  insight: string;
  confidence: number;
  reasoning: string;
}

export interface FieldMappingResult {
  fieldMappings: FieldMapping[];
  newInsights: NewInsight[];
}

export async function mapInsightsToFields(
  extractedContent: ExtractedFileContent,
  knowledgeBase: OrganizationKnowledgeBase
): Promise<FieldMappingResult> {
  const kbState = {
    businessName: knowledgeBase.businessName,
    whatYouSell: knowledgeBase.whatYouSell,
    idealCustomer: knowledgeBase.idealCustomer,
    topObjection: knowledgeBase.topObjection,
    coreOffer: knowledgeBase.coreOffer,
    customerJourney: knowledgeBase.customerJourney,
    primaryGoal: knowledgeBase.primaryGoal,
    biggestBottleNeck: knowledgeBase.biggestBottleNeck,
    brandVoiceStyle: knowledgeBase.brandVoiceStyle,
    riskBoldness: knowledgeBase.riskBoldness,
    voiceExampleGood: knowledgeBase.voiceExampleGood,
    voiceExamplesAvoid: knowledgeBase.voiceExamplesAvoid,
    toolStack: knowledgeBase.toolStack,
    primaryCRM: knowledgeBase.primaryCRM,
    defaultManagementStyle: knowledgeBase.defaultManagementStyle,
    forbiddenWords: knowledgeBase.forbiddenWords,
    disclaimers: knowledgeBase.disclaimers,
  };

  const prompt = `You are analyzing a business document to extract insights for an organization knowledge base.

CURRENT KNOWLEDGE BASE STATE:
${JSON.stringify(kbState, null, 2)}

EXTRACTED DOCUMENT CONTENT:
Summary: ${extractedContent.summary || "N/A"}
Key Points: ${JSON.stringify(extractedContent.keyPoints || [], null, 2)}
Important Sections: ${JSON.stringify(extractedContent.importantSections || [], null, 2)}

AVAILABLE KNOWLEDGE BASE FIELDS:
- businessName: Organization's business name
- whatYouSell: Description of products/services sold
- idealCustomer: Target customer profile (demographics, psychographics, pain points)
- topObjection: Main reason prospects say no
- coreOffer: Primary product/service that drives revenue
- customerJourney: How customers discover, evaluate, and buy
- primaryGoal: Main business objective
- biggestBottleNeck: Main obstacle preventing growth
- brandVoiceStyle: Communication style (Professional but friendly, Casual, Bold, etc.)
- riskBoldness: Marketing boldness level (Low, Medium, High)
- voiceExampleGood: Examples of messaging that matches brand voice
- voiceExamplesAvoid: Examples of messaging to avoid
- toolStack: Array of tools/software used
- primaryCRM: Main CRM platform
- defaultManagementStyle: Preferred management approach
- forbiddenWords: Words/claims that cannot be used
- disclaimers: Required legal disclaimer text

TASK:
Analyze the document content and map insights to KB fields. For each insight:
1. Determine which KB field(s) it relates to
2. Assign confidence score (0-100) - be conservative
3. Determine action: REPLACE (if field is empty or insight is clearly better), APPEND (if adds value to existing), or NEW_INSIGHT (if doesn't map to existing fields)

Return JSON format:
{
  "fieldMappings": [
    {
      "field": "idealCustomer",
      "insight": "Target customers are small business owners aged 35-50...",
      "confidence": 85,
      "action": "APPEND",
      "reasoning": "Document provides detailed customer profile that complements existing data"
    }
  ],
  "newInsights": [
    {
      "category": "customerPatterns",
      "insight": "Customers prefer email communication over phone",
      "confidence": 75,
      "reasoning": "Not directly mappable to existing fields but valuable insight"
    }
  ]
}

Guidelines:
- Only map insights with confidence >= 50
- Be conservative with confidence scores
- REPLACE only if existing field is empty or new insight is clearly superior
- APPEND when insight adds complementary information
- NEW_INSIGHT for valuable insights that don't fit existing fields
- Maximum 15 field mappings and 10 new insights`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing business documents and mapping insights to knowledge base fields. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000,
    });

    const rawResponse = response.choices[0].message.content || "{}";
    const result = JSON.parse(rawResponse);

    const fieldMappings: FieldMapping[] = Array.isArray(result.fieldMappings)
      ? result.fieldMappings
          .filter((m: any) => m.field && m.insight && m.confidence >= 50)
          .map((m: any) => ({
            field: m.field,
            insight: m.insight,
            confidence: Math.min(100, Math.max(0, m.confidence || 50)),
            action: m.action || "APPEND",
            reasoning: m.reasoning || "",
          }))
          .slice(0, 15)
      : [];

    const newInsights: NewInsight[] = Array.isArray(result.newInsights)
      ? result.newInsights
          .filter((i: any) => i.category && i.insight && i.confidence >= 50)
          .map((i: any) => ({
            category: i.category,
            insight: i.insight,
            confidence: Math.min(100, Math.max(0, i.confidence || 50)),
            reasoning: i.reasoning || "",
          }))
          .slice(0, 10)
      : [];

    return {
      fieldMappings,
      newInsights,
    };
  } catch (error) {
    console.error("Error mapping insights to fields:", error);
    return {
      fieldMappings: [],
      newInsights: [],
    };
  }
}

