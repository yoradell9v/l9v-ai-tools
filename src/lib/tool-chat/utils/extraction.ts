import OpenAI from "openai";
import type { FormConfig } from "@/components/forms/configs/jdFormConfig";
import type { ChatMessage, ToolId } from "@/lib/tool-chat/types";
import { formatKnowledgeBaseContext } from "@/lib/knowledge-base/organization-knowledge-base";
import type { OrganizationKnowledgeBase } from "@/lib/knowledge-base/organization-knowledge-base";

export interface ExtractionResult {
  extractedData: Record<string, any>;
  missingRequiredFields: string[];
  confidence: Record<string, number>;
  suggestedQuestions: string[];
  kbDefaultsUsed: string[];
  extractionErrors: string[];
  // Proactive suggestions: AI-generated values for missing fields
  suggestedFields?: Record<string, any>;
  fieldSources?: Record<string, "user" | "kb" | "suggested">; // Track where each field came from
}

/**
 * Extracts structured data from conversation using form config as schema.
 * Uses KB context to fill defaults when conversation doesn't specify.
 * 
 * @param openai - OpenAI client instance
 * @param conversation - Conversation history
 * @param formConfig - Form configuration to use as extraction schema
 * @param knowledgeBase - Organization knowledge base (can be null)
 * @param toolId - Tool ID for KB context formatting
 * @returns Extraction result with data, validation, and suggestions
 */
export async function extractStructuredDataFromConversation(
  openai: OpenAI,
  conversation: ChatMessage[],
  formConfig: FormConfig,
  knowledgeBase: OrganizationKnowledgeBase | null,
  toolId: ToolId
): Promise<ExtractionResult> {
  const kbContext = formatKnowledgeBaseContext(knowledgeBase, toolId);

  // Build extraction prompt
  const extractionPrompt = buildExtractionPrompt(
    conversation,
    formConfig,
    kbContext
  );

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting structured data from conversations and generating intelligent, context-aware suggestions for missing information. Be precise, accurate, and proactive in suggesting realistic values based on role descriptions and industry standards.",
        },
        { role: "user", content: extractionPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5, // Slightly higher for creative but still accurate suggestions
      max_tokens: 3000, // Increased to accommodate suggestions
    });

    const response = JSON.parse(
      completion.choices[0].message.content || "{}"
    );

    // Validate and normalize extraction
    return normalizeExtractionResult(response, formConfig, knowledgeBase, toolId);
  } catch (error) {
    console.error("Extraction error:", error);
    return {
      extractedData: {},
      missingRequiredFields: [],
      confidence: {},
      suggestedQuestions: ["Could you provide more details about what you need?"],
      kbDefaultsUsed: [],
      extractionErrors: [
        error instanceof Error ? error.message : "Extraction failed",
      ],
    };
  }
}

/**
 * Builds the extraction prompt with form config, conversation, and KB context.
 * Includes proactive suggestion generation for missing fields.
 */
function buildExtractionPrompt(
  conversation: ChatMessage[],
  formConfig: FormConfig,
  kbContext: string
): string {
  const conversationText = conversation
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  return `You are extracting structured data from a conversation and generating intelligent suggestions for missing fields.

FORM CONFIGURATION:
${JSON.stringify(formConfig, null, 2)}

CONVERSATION HISTORY:
${conversationText}

${kbContext ? `${kbContext}\n\n` : ""}TASK:
1. Extract structured data matching the form configuration above.
2. Use KB context values as defaults when conversation doesn't specify
3. For ANY missing required fields, generate intelligent suggestions based on:
   - The role/task description provided by the user
   - Industry standards and best practices for similar roles
   - The organization's context from the knowledge base
   - Common patterns for the type of role being described
4. Mark fields as null/empty ONLY if you cannot extract or reasonably suggest a value
5. Return JSON matching the form's defaultValues structure
6. Include confidence scores (0-1) for each extracted field
7. Identify which fields used KB defaults vs conversation values vs AI suggestions

IMPORTANT - SUGGESTION GUIDELINES:
- For "tasks" array: Suggest 3-5 realistic tasks based on the role description
- For "outcome90Day": Suggest a specific, measurable 90-day outcome relevant to the role
- For "requirements": Suggest 3-5 must-have skills/qualifications typical for this role type
- For "weeklyHours": Suggest based on role complexity (default: 40 if not specified)
- For "clientFacing": Infer from role description (Yes for customer-facing roles, No for internal)
- Make suggestions realistic, specific, and aligned with the role described
- Use your training data knowledge of similar roles to inform suggestions

RESPONSE FORMAT:
{
  "extractedData": { 
    /* All fields matching formConfig.defaultValues structure.
       Include user-provided values AND your AI suggestions for missing fields.
       For arrays, provide complete arrays with suggested items. */
  },
  "missingRequiredFields": ["field1", "field2"], // Fields that were truly missing (no user input, no KB, no reasonable suggestion)
  "confidence": { "field1": 0.9, "field2": 0.7 }, // Confidence for each field
  "suggestedQuestions": ["Question 1", "Question 2"], // Optional: questions if user wants to refine
  "kbDefaultsUsed": ["field1", "field2"], // Fields that used KB defaults
  "suggestedFields": { 
    /* Fields where you generated AI suggestions (not from user or KB).
       Key: field name, Value: the suggested value */
    "field1": "suggested value",
    "field2": ["suggested", "array", "values"]
  },
  "fieldSources": {
    /* Track the source of each field value */
    "field1": "user", // "user" = from conversation, "kb" = from knowledge base, "suggested" = AI-generated
    "field2": "suggested",
    "field3": "kb"
  }
}

Be proactive and helpful. Generate complete, usable suggestions rather than leaving fields empty.`;
}

/**
 * Normalizes and validates extraction result against form config.
 */
function normalizeExtractionResult(
  response: any,
  formConfig: FormConfig,
  knowledgeBase: OrganizationKnowledgeBase | null,
  toolId: ToolId
): ExtractionResult {
  const extractedData = response.extractedData || {};
  const confidence = response.confidence || {};
  const kbDefaultsUsed = response.kbDefaultsUsed || [];
  const suggestedQuestions = response.suggestedQuestions || [];
  const suggestedFields = response.suggestedFields || {};
  const fieldSources = response.fieldSources || {};

  // Normalize data types
  normalizeExtractedData(extractedData, formConfig);

  // Apply KB defaults for missing fields (if KB available)
  // Only apply KB defaults if field wasn't already suggested by AI
  if (knowledgeBase) {
    applyKBDefaults(extractedData, formConfig, knowledgeBase, toolId, kbDefaultsUsed, suggestedFields);
  }

  // Merge AI suggestions into extractedData if they're not already there
  // This ensures suggestedFields are included in the final extractedData
  Object.keys(suggestedFields).forEach((field) => {
    if (!extractedData[field] || (typeof extractedData[field] === "string" && !extractedData[field].trim())) {
      extractedData[field] = suggestedFields[field];
      if (!fieldSources[field]) {
        fieldSources[field] = "suggested";
      }
    }
  });

  // Validate against form config
  const missingRequiredFields = validateRequiredFields(
    extractedData,
    formConfig
  );

  return {
    extractedData,
    missingRequiredFields,
    confidence,
    suggestedQuestions,
    kbDefaultsUsed,
    extractionErrors: [],
    suggestedFields,
    fieldSources,
  };
}

/**
 * Validates required fields against form config.
 */
function validateRequiredFields(
  data: Record<string, any>,
  formConfig: FormConfig
): string[] {
  const missing: string[] = [];

  formConfig.sections.forEach((section) => {
    section.fields.forEach((field) => {
      if (field.required) {
        const value = data[field.id];
        if (!value || (typeof value === "string" && !value.trim())) {
          missing.push(field.id);
        } else if (field.type === "array") {
          const arrayValue = Array.isArray(value) ? value : [];
          const minItems = field.minItems || 0;
          const filledItems = arrayValue.filter((item: string) => item?.trim()).length;
          if (filledItems < minItems) {
            missing.push(field.id);
          }
        }
      }
    });
  });

  return missing;
}

/**
 * Normalizes extracted data types to match form config expectations.
 */
function normalizeExtractedData(
  data: Record<string, any>,
  formConfig: FormConfig
): void {
  formConfig.sections.forEach((section) => {
    section.fields.forEach((field) => {
      const value = data[field.id];
      if (value === undefined || value === null) return;

      switch (field.type) {
        case "array":
          if (!Array.isArray(value)) {
            data[field.id] = typeof value === "string" ? [value] : [];
          }
          break;
        case "slider":
          if (typeof value !== "number") {
            data[field.id] = Number(value) || 50;
          }
          break;
        // Add other type normalizations as needed
      }
    });
  });
}

/**
 * Applies KB defaults to missing fields.
 * This is a basic implementation - can be enhanced later with more sophisticated mapping.
 * Only applies KB defaults if field wasn't already suggested by AI.
 */
function applyKBDefaults(
  data: Record<string, any>,
  formConfig: FormConfig,
  kb: OrganizationKnowledgeBase,
  toolId: ToolId,
  kbDefaultsUsed: string[],
  suggestedFields?: Record<string, any>
): void {
  // Tool-specific KB field mapping
  if (toolId === "role-builder") {
    // Map KB fields to form fields
    // Only apply if not already suggested by AI
    if (!data.weeklyHours && !suggestedFields?.weeklyHours && kb.defaultWeeklyHours) {
      data.weeklyHours = kb.defaultWeeklyHours;
      kbDefaultsUsed.push("weeklyHours");
    }
    if (!data.managementStyle && !suggestedFields?.managementStyle && kb.defaultManagementStyle) {
      data.managementStyle = "__ORG_DEFAULT__";
      kbDefaultsUsed.push("managementStyle");
    }
    if (!data.englishLevel && !suggestedFields?.englishLevel && kb.defaultEnglishLevel) {
      data.englishLevel = "__ORG_DEFAULT__";
      kbDefaultsUsed.push("englishLevel");
    }
    if (!data.businessGoal && !suggestedFields?.businessGoal && kb.primaryGoal) {
      data.businessGoal = "__ORG_DEFAULT__";
      kbDefaultsUsed.push("businessGoal");
    }
    // Tools are automatically included from KB, but can add role-specific tools
    if (kb.toolStack && Array.isArray(kb.toolStack) && kb.toolStack.length > 0) {
      // Note: tools field in form is a textarea, so we don't auto-populate it
      // but the KB tools will be used in analysis
    }
  } else if (toolId === "process-builder") {
    // For process builder, KB tools are automatically included
    if (kb.toolStack && Array.isArray(kb.toolStack) && kb.toolStack.length > 0) {
      // Similar note - toolsUsed is a textarea, KB tools are used in analysis
    }
  }
  // Add more tool-specific mappings as needed
}
