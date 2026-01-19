import { LearningEventType } from "@prisma/client";
import { ExtractedInsight } from "@/lib/learning/learning-events";
import OpenAI from "openai";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const LLM_CONFIG = {
  model: "gpt-4o-mini",
  temperature: 0.3,
  maxTokens: 2500,
  maxRetries: 2,
  retryDelay: 1000, 
} as const;


const VALID_CATEGORIES = [
  "business_context",
  "workflow_patterns",
  "process_optimization",
  "service_patterns",
  "risk_management",
  "hiring_patterns",
  "service_preferences",
  "skill_requirements",
  "workflow_needs",
] as const;


const VALID_EVENT_TYPES = [
  "INSIGHT_GENERATED",
  "PATTERN_DETECTED",
  "OPTIMIZATION_FOUND",
  "INCONSISTENCY_FIXED",
  "KNOWLEDGE_EXPANDED",
] as const;


const INSIGHT_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          insight: {
            type: "string",
            description: "Clear, specific, actionable insight statement (10-1000 characters)",
          },
          category: {
            type: "string",
            enum: VALID_CATEGORIES,
            description: "Category of the insight",
          },
          eventType: {
            type: "string",
            enum: VALID_EVENT_TYPES,
            description: "Type of learning event",
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Confidence score (0-100)",
          },
          metadata: {
            type: "object",
            description: "Additional context and metadata",
            additionalProperties: true,
          },
        },
        required: ["insight", "category", "eventType", "confidence", "metadata"],
      },
    },
  },
  required: ["insights"],
} as const;


function validateInsight(insight: ExtractedInsight): boolean {
  if (!insight.insight || !insight.category || !insight.eventType) {
    return false;
  }
  if (insight.insight.trim().length < 10 || insight.insight.trim().length > 1000) {
    return false;
  }
  if (!VALID_CATEGORIES.includes(insight.category as any)) {
    return false;
  }
  if (!VALID_EVENT_TYPES.includes(insight.eventType as any)) {
    return false;
  }
  if (insight.confidence !== undefined) {
    if (insight.confidence < 0 || insight.confidence > 100) {
      return false;
    }
  }
  return true;
}


function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractInsightsWithLLM(
  sourceType: string,
  rawData: any,
  context: string
): Promise<ExtractedInsight[]> {
  if (!rawData) {
    console.warn(`[extractInsightsWithLLM] No data provided for ${sourceType}`);
    return [];
  }

  const systemPrompt = buildSystemPrompt(sourceType, context);
  const dataString = prepareDataForAnalysis(rawData);
  const userPrompt = `Analyze the following ${context} and extract meaningful insights:

${dataString}

Focus on extracting ONLY meaningful, non-obvious insights that would be valuable for understanding the business, processes, or needs. Avoid generic statements like "user mentioned X" - focus on WHY it matters and what patterns or implications can be derived.`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= LLM_CONFIG.maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: LLM_CONFIG.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: LLM_CONFIG.temperature,
        max_tokens: LLM_CONFIG.maxTokens,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("Empty response from OpenAI");
      }

      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(responseContent);
      } catch (parseError) {
        throw new Error(`Failed to parse JSON response: ${parseError}`);
      }

      if (!parsedResponse.insights || !Array.isArray(parsedResponse.insights)) {
        throw new Error("Invalid response structure: missing insights array");
      }

      const extractedInsights: ExtractedInsight[] = parsedResponse.insights
        .map((item: any) => {
          const eventType = mapEventTypeStringToEnum(item.eventType);
          
          return {
            insight: item.insight?.trim() || "",
            category: item.category,
            eventType: eventType,
            confidence: item.confidence ?? 70,
            metadata: item.metadata || {},
          };
        })
        .filter((insight: ExtractedInsight) => validateInsight(insight));

      const usage = completion.usage;
      if (usage) {
        console.log(
          `[extractInsightsWithLLM] ${sourceType} - Tokens: ${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion = ${usage.total_tokens} total`
        );
      }

      console.log(
        `[extractInsightsWithLLM] ${sourceType} - Extracted ${extractedInsights.length} valid insights from ${parsedResponse.insights.length} total`
      );

      return extractedInsights;
    } catch (error: any) {
      lastError = error;
      const isLastAttempt = attempt === LLM_CONFIG.maxRetries;
      
      console.error(
        `[extractInsightsWithLLM] ${sourceType} - Attempt ${attempt + 1}/${LLM_CONFIG.maxRetries + 1} failed:`,
        error.message || error
      );

      if (isLastAttempt) {
        console.error(
          `[extractInsightsWithLLM] ${sourceType} - All retry attempts exhausted. Returning empty array.`
        );
        return [];
      }

      // Wait before retrying
      await sleep(LLM_CONFIG.retryDelay * (attempt + 1)); // Exponential backoff
    }
  }
  if (lastError) {
    throw lastError;
  }
  return [];
}

function mapEventTypeStringToEnum(eventTypeString: string): LearningEventType {
  const mapping: Record<string, LearningEventType> = {
    INSIGHT_GENERATED: LearningEventType.INSIGHT_GENERATED,
    PATTERN_DETECTED: LearningEventType.PATTERN_DETECTED,
    OPTIMIZATION_FOUND: LearningEventType.OPTIMIZATION_FOUND,
    INCONSISTENCY_FIXED: LearningEventType.INCONSISTENCY_FIXED,
    KNOWLEDGE_EXPANDED: LearningEventType.KNOWLEDGE_EXPANDED,
  };

  return mapping[eventTypeString] || LearningEventType.INSIGHT_GENERATED;
}

function buildSystemPrompt(sourceType: string, context: string): string {
  const basePrompt = `You are an expert business analyst specializing in extracting actionable insights from ${context} for a virtual assistant staffing company.

Your task is to analyze the provided data and extract meaningful insights that would help understand:
- Business context, goals, and challenges
- Workflow patterns and process optimization opportunities
- Service preferences and hiring patterns
- Skill requirements and workflow needs
- Risk factors and compliance issues

**CRITICAL REQUIREMENTS:**
1. Extract ONLY meaningful, non-obvious insights - avoid generic statements
2. Focus on WHY insights matter, not just WHAT was mentioned
3. Provide clear, specific, actionable statements (10-1000 characters)
4. Assign appropriate confidence scores (0-100) based on data quality and certainty
5. Include relevant metadata for context

**Valid Categories:**
${VALID_CATEGORIES.map((cat) => `- ${cat}`).join("\n")}

**Valid Event Types:**
${VALID_EVENT_TYPES.map((type) => `- ${type}`).join("\n")}

**Confidence Guidelines:**
- 90-100: Explicitly stated, high certainty (e.g., "Role requested: Social Media Manager")
- 80-89: Strong evidence, high confidence (e.g., "Service type recommended: Dedicated VA")
- 70-79: Good evidence, medium-high confidence (e.g., "Technical skills required: Canva, Photoshop")
- 60-69: Some evidence, medium confidence (e.g., inferred patterns)
- Below 60: Weak evidence, low confidence (avoid unless significant)

**Response Format:**
Return a JSON object with an "insights" array. Each insight must have:
- insight: string (clear, specific statement)
- category: one of the valid categories
- eventType: one of the valid event types
- confidence: number (0-100)
- metadata: object with relevant context (sourceSection, evidence, etc.)

If no meaningful insights are found, return an empty insights array.`;

  switch (sourceType) {
    case "JOB_DESCRIPTION":
      return basePrompt + `

**JD Analysis Specific Guidance:**
- Extract hiring patterns (role titles, service types, hours)
- Identify service preferences (recommended service, fit scores)
- Extract skill requirements (technical, soft, domain)
- Identify workflow needs (task clusters, implicit needs)
- Note business context (bottlenecks, company stage, growth indicators)
- Flag risks and validation needs (high-severity risks, red flags)`;

    case "SOP_GENERATION":
      return basePrompt + `

**SOP Generation Specific Guidance:**
- Extract workflow patterns (tools used, frequency, triggers)
- Identify process optimization opportunities (pain points, complexity)
- Note compliance requirements and risk factors
- Extract business context (department, decision points)
- Identify documentation gaps and process improvements`;

    case "CHAT_CONVERSATION":
      return basePrompt + `

**Chat Conversation Specific Guidance:**
- Extract business context (bottlenecks, pain points, growth indicators)
- Identify process optimization needs (new tools, process changes)
- Note customer/market insights (objections, feedback)
- Identify knowledge gaps (questions indicating missing info)
- Flag compliance mentions (regulatory, forbidden claims)
- Focus on NEW information not already in knowledge base`;

    default:
      return basePrompt;
  }
}

function prepareDataForAnalysis(data: any): string {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    const MAX_DATA_LENGTH = 15000;
    
    if (jsonString.length > MAX_DATA_LENGTH) {
      const truncated = jsonString.substring(0, MAX_DATA_LENGTH);
      return truncated + "\n\n[Data truncated due to size limits...]";
    }
    
    return jsonString;
  } catch (error) {
    console.error("[prepareDataForAnalysis] Error stringifying data:", error);
    return String(data).substring(0, 15000);
  }
}

async function extractFromJdAnalysis(analysisData: any): Promise<ExtractedInsight[]> {
  if (!analysisData) {
    return [];
  }

  try {
    return await extractInsightsWithLLM(
      "JOB_DESCRIPTION",
      analysisData,
      "job description analysis package"
    );
  } catch (error) {
    console.error("[extractFromJdAnalysis] Error:", error);
    return [];
  }
}

async function extractFromSopGeneration(sopData: any): Promise<ExtractedInsight[]> {
  if (!sopData) {
    return [];
  }

  try {
    return await extractInsightsWithLLM(
      "SOP_GENERATION",
      sopData,
      "SOP generation data"
    );
  } catch (error) {
    console.error("[extractFromSopGeneration] Error:", error);
    return [];
  }
}

async function extractFromConversation(conversationData: any): Promise<ExtractedInsight[]> {
  if (!conversationData) {
    return [];
  }

  try {
    return await extractInsightsWithLLM(
      "CHAT_CONVERSATION",
      conversationData,
      "chat conversation between user and assistant"
    );
  } catch (error) {
    console.error("[extractFromConversation] Error:", error);
    return [];
  }
}

export async function extractInsights(
  sourceType: "JOB_DESCRIPTION" | "SOP_GENERATION" | "CHAT_CONVERSATION",
  sourceData: any
): Promise<ExtractedInsight[]> {
  switch (sourceType) {
    case "JOB_DESCRIPTION":
      return extractFromJdAnalysis(sourceData);
    case "SOP_GENERATION":
      return extractFromSopGeneration(sourceData);
    case "CHAT_CONVERSATION":
      return extractFromConversation(sourceData);
    default:
      console.warn(`[extractInsights] Unknown source type: ${sourceType}`);
      return [];
  }
}
