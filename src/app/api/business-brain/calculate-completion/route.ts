import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import crypto from "crypto";
import { businessBrainFormConfig } from "@/components/forms/configs/businessBrainFormConfig";

export const runtime = "nodejs";

/**
 * Get all valid field IDs from the form config
 */
function getAllValidFieldIds(): Set<string> {
  const fieldIds = new Set<string>();
  businessBrainFormConfig.sections.forEach((section) => {
    section.fields.forEach((field) => {
      fieldIds.add(field.id);
    });
  });
  return fieldIds;
}

/**
 * Map AI-suggested field name to actual form field ID
 * Returns null if no match found
 */
function mapFieldNameToFieldId(suggestedField: string): string | null {
  const validFields = getAllValidFieldIds();
  const suggestedLower = suggestedField.toLowerCase().trim();

  // Exact match
  if (validFields.has(suggestedField)) {
    return suggestedField;
  }

  // Common mappings for variations
  const fieldMappings: Record<string, string> = {
    // Brand voice related
    "brandvoice": "brandVoiceStyle",
    "brand voice": "brandVoiceStyle",
    "voice style": "brandVoiceStyle",
    "voice examples": "voiceExamplesGood",
    "voice samples": "voiceExamplesGood",
    "good voice examples": "voiceExamplesGood",
    "voice examples good": "voiceExamplesGood",
    "voice examples avoid": "voiceExamplesAvoid",
    "avoid examples": "voiceExamplesAvoid",
    "content links": "contentLinks",
    "content examples": "contentLinks",
    "example content": "contentLinks",
    "style guide": "contentLinks", // Map style guide requests to content links
    "brand guide": "contentLinks", // Map brand guide requests to content links

    // Positioning related
    "ideal customer": "idealCustomer",
    "customer profile": "idealCustomer",
    "target customer": "idealCustomer",
    "top objection": "topObjection",
    "objection": "topObjection",
    "core offer": "coreOffer",
    "main offer": "coreOffer",
    "offer": "coreOffer",
    "competitor analysis": "idealCustomer", // Map to idealCustomer as it helps refine positioning
    "competitive analysis": "idealCustomer",
    "competitors": "idealCustomer",
    "market positioning": "idealCustomer",
    "value proposition": "coreOffer",

    // Compliance related
    "forbidden words": "forbiddenWords",
    "restricted words": "forbiddenWords",
    "disclaimers": "disclaimers",
    "legal disclaimers": "disclaimers",
    "required disclaimers": "disclaimers",

    // Proof related
    "proof assets": "proofAssets",
    "proof": "proofAssets",
    "testimonials": "proofAssets",
    "case studies": "proofAssets",
    "proof files": "proofFiles",
    "proof documents": "proofFiles",

    // Operations related
    "pipeline stages": "pipelineStages",
    "pipeline": "pipelineStages",
    "sales pipeline": "pipelineStages",
    "workflow": "pipelineStages",
    "customer journey": "customerJourney",
    "journey": "customerJourney",
    "email signoff": "emailSignoff",
    "email sign-off": "emailSignoff",
    "signoff": "emailSignoff",
    "brand emails": "brandEmails",
    "email addresses": "brandEmails",

    // Other
    "description": "whatYouSell", // Generic "description" maps to whatYouSell
  };

  // Check mappings
  for (const [key, fieldId] of Object.entries(fieldMappings)) {
    if (suggestedLower.includes(key) || key.includes(suggestedLower)) {
      if (validFields.has(fieldId)) {
        return fieldId;
      }
    }
  }

  // Fuzzy match: find field ID that contains the suggested text or vice versa
  for (const fieldId of validFields) {
    const fieldIdLower = fieldId.toLowerCase();
    if (fieldIdLower.includes(suggestedLower) || suggestedLower.includes(fieldIdLower)) {
      return fieldId;
    }
  }

  // Try matching against field labels from config
  for (const section of businessBrainFormConfig.sections) {
    for (const field of section.fields) {
      const labelLower = (field.label || "").toLowerCase();
      if (labelLower.includes(suggestedLower) || suggestedLower.includes(labelLower)) {
        return field.id;
      }
    }
  }

  return null;
}

/**
 * Validate and map strategic recommendations to valid fields
 */
function validateAndMapStrategicRecommendations(
  recommendations: Array<{
    recommendation: string;
    targetField?: string;
    why?: string;
    actionType?: "fill_form" | "upload" | "external";
  }>
): Array<{
  recommendation: string;
  targetField: string;
  why?: string;
  actionType: "fill_form" | "upload" | "external";
}> {
  const validFields = getAllValidFieldIds();
  const validRecommendations: Array<{
    recommendation: string;
    targetField: string;
    why?: string;
    actionType: "fill_form" | "upload" | "external";
  }> = [];

  for (const rec of recommendations) {
    if (!rec || !rec.recommendation) continue;

    // If actionType is "external", allow it but don't require targetField
    if (rec.actionType === "external") {
      validRecommendations.push({
        recommendation: rec.recommendation,
        targetField: rec.targetField || "",
        why: rec.why,
        actionType: "external",
      });
      continue;
    }

    // For "fill_form" or "upload", targetField is required and must be valid
    if (!rec.targetField) {
      console.warn(`[Enhancement] Dropping strategic recommendation without targetField: ${rec.recommendation}`);
      continue;
    }

    // STRICT VALIDATION: First check if it's an exact match (preferred)
    let mappedFieldId: string | null = null;
    if (validFields.has(rec.targetField)) {
      // Exact match - use it directly (this is what we want)
      mappedFieldId = rec.targetField;
    } else {
      // Not an exact match - try mapping as fallback (should rarely happen if AI follows instructions)
      console.warn(`[Enhancement] targetField "${rec.targetField}" is not an exact field ID. Attempting mapping as fallback...`);
      mappedFieldId = mapFieldNameToFieldId(rec.targetField);
      
      if (mappedFieldId) {
        console.warn(`[Enhancement] Mapped "${rec.targetField}" to "${mappedFieldId}". AI should use exact field IDs.`);
      }
    }

    if (!mappedFieldId) {
      console.warn(`[Enhancement] Dropping strategic recommendation with invalid/unmappable targetField "${rec.targetField}": ${rec.recommendation}`);
      continue;
    }

    // Validate actionType matches field type
    const fieldConfig = businessBrainFormConfig.sections
      .flatMap((s) => s.fields)
      .find((f) => f.id === mappedFieldId);

    // Determine the correct actionType based on field type
    let finalActionType: "fill_form" | "upload";
    if (fieldConfig) {
      finalActionType = fieldConfig.type === "file" ? "upload" : "fill_form";
    } else {
      // Fallback: use provided actionType or default to fill_form
      finalActionType = (rec.actionType === "upload" ? "upload" : "fill_form");
    }

    validRecommendations.push({
      recommendation: rec.recommendation,
      targetField: mappedFieldId,
      why: rec.why,
      actionType: finalActionType,
    });
  }

  return validRecommendations;
}

function isFieldFilled(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Build a map of refinement question IDs to their relatedFieldId
 * This helps us recognize when a refinement question has been answered
 */
function buildRefinementAnswerMap(
  intakeData: any,
  previousEnhancementAnalysis?: any
): Map<string, string> {
  const refinementMap = new Map<string, string>();
  
  // If we have previous enhancement analysis, extract refinement question mappings
  if (previousEnhancementAnalysis?.cardAnalysis) {
    previousEnhancementAnalysis.cardAnalysis.forEach((card: any) => {
      if (card.refinementQuestions && Array.isArray(card.refinementQuestions)) {
        card.refinementQuestions.forEach((q: any) => {
          if (q.id && q.relatedFieldId) {
            refinementMap.set(q.id, q.relatedFieldId);
          }
        });
      }
    });
  }
  
  // Also check intakeData for any refinement answer keys that might match known patterns
  // Refinement answers are saved with question IDs as keys
  if (intakeData) {
    Object.keys(intakeData).forEach((key) => {
      // Check if this looks like a refinement answer ID (contains underscore patterns)
      if (key.includes("_") && typeof intakeData[key] === "string" && intakeData[key].trim().length > 0) {
        // Try to infer relatedFieldId from common patterns
        if (key.includes("voice") && !refinementMap.has(key)) {
          refinementMap.set(key, "brandVoiceStyle");
        } else if (key.includes("positioning") && !refinementMap.has(key)) {
          refinementMap.set(key, "idealCustomer");
        } else if (key.includes("compliance") && !refinementMap.has(key)) {
          refinementMap.set(key, "forbiddenWords");
        } else if (key.includes("ghl") && !refinementMap.has(key)) {
          refinementMap.set(key, "pipelineStages");
        }
      }
    });
  }
  
  return refinementMap;
}

/**
 * Check if a field has been refined (has a refinement answer)
 */
function hasRefinementAnswer(
  fieldId: string,
  intakeData: any,
  refinementAnswerMap: Map<string, string>
): boolean {
  // Check if any refinement answer exists for this field
  for (const [questionId, relatedFieldId] of refinementAnswerMap.entries()) {
    if (relatedFieldId === fieldId && intakeData?.[questionId] && isFieldFilled(intakeData[questionId])) {
      return true;
    }
  }
  return false;
}

function buildFilledFieldsContext(
  intakeData: any,
  fileUploads: any[],
  previousEnhancementAnalysis?: any
): {
  filledTextFields: Record<string, string>;
  filledFiles: Array<{ fieldId: string; fileName: string }>;
  emptyFields: string[];
  refinementAnswerMap: Map<string, string>;
  fieldsWithRefinementAnswers: Set<string>;
} {
  const filledTextFields: Record<string, string> = {};
  const emptyFields: string[] = [];
  const fieldsWithRefinementAnswers = new Set<string>();

  // Build refinement answer mapping
  const refinementAnswerMap = buildRefinementAnswerMap(intakeData, previousEnhancementAnalysis);

  // Dynamically get all fields from businessBrainFormConfig
  const allFields: any[] = [];
  businessBrainFormConfig.sections.forEach((section) => {
    section.fields.forEach((field) => {
      // Only include fields that should be checked (respect conditional logic)
      if (shouldIncludeField(field, intakeData, fileUploads || [])) {
        allFields.push(field);
      }
    });
  });

  console.log(`[buildFilledFieldsContext] Checking ${allFields.length} fields dynamically from config`);

  // Check each field
  allFields.forEach((field) => {
    const fieldId = field.id;
    const value = intakeData?.[fieldId];
    
    if (isFieldFilled(value)) {
      filledTextFields[fieldId] = typeof value === "string" ? value : JSON.stringify(value);
    } else {
      emptyFields.push(fieldId);
      
      // Check if this field has a refinement answer (even if the field itself is empty)
      if (hasRefinementAnswer(fieldId, intakeData, refinementAnswerMap)) {
        fieldsWithRefinementAnswers.add(fieldId);
        console.log(`[buildFilledFieldsContext] Field ${fieldId} has refinement answer`);
      }
    }
  });

  const filledFiles: Array<{ fieldId: string; fileName: string }> = [];
  const fileArray = Array.isArray(fileUploads) ? fileUploads : [];

  fileArray.forEach((file: any) => {
    if (file && file.name) {
      let fieldId = file.field || "unknown";
      if (!file.field && file.url) {
        const urlMatch = file.url.match(/\/([^_]+)_\d+_/);
        if (urlMatch) {
          fieldId = urlMatch[1];
        }
      }
      filledFiles.push({
        fieldId,
        fileName: file.name,
      });
    }
  });

  console.log(`[buildFilledFieldsContext] Found ${Object.keys(filledTextFields).length} filled fields, ${emptyFields.length} empty fields, ${fieldsWithRefinementAnswers.size} fields with refinement answers`);

  return { 
    filledTextFields, 
    filledFiles, 
    emptyFields,
    refinementAnswerMap,
    fieldsWithRefinementAnswers
  };
}

function shouldIncludeField(
  field: any,
  intakeData: any,
  fileUploadsArray: any[]
): boolean {
  if (field.showIf) {
    const { field: conditionField, value: conditionValue } = field.showIf;
    const fieldValue = intakeData[conditionField];
    if (fieldValue !== conditionValue) {
      return false;
    }
  }
  return true;
}


function isFieldFilledWithFiles(
  field: any,
  intakeData: any,
  fileUploadsArray: any[]
): boolean {
  if (field.type === "file") {
    const hasFile = fileUploadsArray.some((f: any) => {
      if (!f) return false;
      if (f.field === field.id) return true;
      if (f.url && f.url.includes(`/${field.id}_`)) return true;
      if (f.name && f.name.toLowerCase().includes(field.id.toLowerCase())) return true;
      return false;
    });
    return hasFile;
  }
  return isFieldFilled(intakeData[field.id]);
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
      ? Array.isArray(parsedFileUploads)
        ? parsedFileUploads
        : Object.values(parsedFileUploads).flat()
      : [];

  const allFields: any[] = [];

  businessBrainFormConfig.sections.forEach((section) => {
    section.fields.forEach((field) => {
      allFields.push(field);
    });
  });

  const fieldsToCheck = allFields.filter((field) =>
    shouldIncludeField(field, parsedIntakeData, fileUploadsArray)
  );

  const filledFields = fieldsToCheck.filter((field) =>
    isFieldFilledWithFiles(field, parsedIntakeData, fileUploadsArray)
  );

  const totalFields = fieldsToCheck.length;
  const filledCount = filledFields.length;
  const score = totalFields > 0 ? Math.round((filledCount / totalFields) * 100) : 0;

  const quickWins: any[] = [];

  const missingFields = fieldsToCheck.filter(
    (field) => !isFieldFilledWithFiles(field, parsedIntakeData, fileUploadsArray)
  );

  const sectionPriority: Record<string, number> = {
    "quick-start": 5,
    "compliance-basics": 4,
    "proof-credibility": 3,
    "voice-calibration": 2,
    "operations": 1,
  };

  missingFields
    .sort((a, b) => {
      const sectionA = businessBrainFormConfig.sections.find((s) =>
        s.fields.some((f) => f.id === a.id)
      );
      const sectionB = businessBrainFormConfig.sections.find((s) =>
        s.fields.some((f) => f.id === b.id)
      );
      const priorityA = sectionPriority[sectionA?.id || ""] || 0;
      const priorityB = sectionPriority[sectionB?.id || ""] || 0;
      return priorityB - priorityA;
    })
    .slice(0, 4)
    .forEach((field) => {
      const section = businessBrainFormConfig.sections.find((s) =>
        s.fields.some((f) => f.id === field.id)
      );
      quickWins.push({
        id: `fill_${field.id}`,
        label: field.label || field.id,
        completed: false,
        impact: sectionPriority[section?.id || ""] || 1,
        category: section?.id || "other",
        action: field.type === "file" ? "upload" : "fill_form",
        field: field.id,
        section: section?.id,
      });
    });

  const tierOneFields = fieldsToCheck.filter(
    (field) =>
      businessBrainFormConfig.sections
        .find((s) => s.id === "quick-start")
        ?.fields.some((f) => f.id === field.id)
  );
  const tierOneComplete =
    tierOneFields.every((field) =>
      isFieldFilledWithFiles(field, parsedIntakeData, fileUploadsArray)
    ) && tierOneFields.length > 0;

  const tierTwo = {
    compliance: fieldsToCheck
      .filter(
        (field) =>
          businessBrainFormConfig.sections
            .find((s) => s.id === "compliance-basics")
            ?.fields.some((f) => f.id === field.id)
      )
      .every((field) =>
        isFieldFilledWithFiles(field, parsedIntakeData, fileUploadsArray)
      ),
    proof: fieldsToCheck
      .filter(
        (field) =>
          businessBrainFormConfig.sections
            .find((s) => s.id === "proof-credibility")
            ?.fields.some((f) => f.id === field.id)
      )
      .every((field) =>
        isFieldFilledWithFiles(field, parsedIntakeData, fileUploadsArray)
      ),
    voice: fieldsToCheck
      .filter(
        (field) =>
          businessBrainFormConfig.sections
            .find((s) => s.id === "voice-calibration")
            ?.fields.some((f) => f.id === field.id)
      )
      .every((field) =>
        isFieldFilledWithFiles(field, parsedIntakeData, fileUploadsArray)
      ),
    operations: fieldsToCheck
      .filter(
        (field) =>
          businessBrainFormConfig.sections
            .find((s) => s.id === "operations")
            ?.fields.some((f) => f.id === field.id)
      )
      .every((field) =>
        isFieldFilledWithFiles(field, parsedIntakeData, fileUploadsArray)
      ),
  };

  return {
    score: Math.min(score, 100),
    tierOneComplete,
    tierTwoSections: tierTwo,
    quickWins: quickWins.slice(0, 4),
    lastCalculated: new Date().toISOString(),
    totalFields,
    filledCount,
    missingFields: missingFields.map((f) => f.id),
  };
}


async function analyzeCardConfidenceWithAI(
  openai: OpenAI,
  cards: any[],
  intakeData: any,
  fileUploads: any[],
  knowledgeBase: any,
  website: string,
  previousEnhancementAnalysis?: any
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
    refinementQuestions: Array<{
      id: string;
      question: string;
      category: string;
      fieldType: "text" | "textarea";
      placeholder?: string;
      helpText?: string;
      priority: "high" | "medium" | "low";
      relatedFieldId?: string;
    }>;
    strategicRecommendations: Array<{
      recommendation: string;
      targetField?: string;
      why?: string;
      actionType?: "fill_form" | "upload" | "external";
    }>;
    priority: "high" | "medium" | "low";
  }>;
  overallAnalysis: {
    averageConfidence: number;
    cardsBelow80: number;
    totalCards: number;
    criticalMissingFields: string[];
    totalRefinementQuestions: number;
  };
}> {

  console.log(`[analyzeCardConfidenceWithAI] Starting analysis for ${cards.length} cards`);
  
  const { 
    filledTextFields, 
    filledFiles, 
    emptyFields,
    refinementAnswerMap,
    fieldsWithRefinementAnswers
  } = buildFilledFieldsContext(
    intakeData,
    fileUploads,
    previousEnhancementAnalysis
  );
  
  console.log(`[analyzeCardConfidenceWithAI] Context: ${Object.keys(filledTextFields).length} filled, ${emptyFields.length} empty, ${fieldsWithRefinementAnswers.size} with refinement answers`);

  const fileUploadsArray =
    fileUploads && Array.isArray(fileUploads) ? fileUploads : [];

  const cardSummaries = cards.map((card) => ({
    id: card.id,
    type: card.type,
    title: card.title,
    confidence: card.confidence_score || (card.metadata as any)?.confidence_score || 0,
    description: card.description?.substring(0, 1000) || "",
    metadata: card.metadata || {},
  }));

  // Build comprehensive field list with descriptions for the prompt
  const fieldDescriptions: Array<{ id: string; label: string; type: string; section: string; description: string }> = [];
  businessBrainFormConfig.sections.forEach((section) => {
    section.fields.forEach((field) => {
      fieldDescriptions.push({
        id: field.id,
        label: field.label || field.id,
        type: field.type || "text",
        section: section.title || section.id,
        description: field.helpText || field.placeholder || field.label || field.id,
      });
    });
  });

  const textFieldsList = fieldDescriptions
    .filter((f) => f.type !== "file")
    .map((f) => `  - "${f.id}" (${f.type}): ${f.label} - ${f.description}`)
    .join("\n");

  const fileFieldsList = fieldDescriptions
    .filter((f) => f.type === "file")
    .map((f) => `  - "${f.id}" (file): ${f.label} - ${f.description}`)
    .join("\n");

  const systemPrompt = `You are an expert AI analyst specializing in business intelligence and content quality assessment. Your task is to analyze business cards and provide smart, actionable recommendations. Respond with a JSON object only.

**CRITICAL RULES:**

1. **DO NOT ASK FOR FIELDS THAT ARE ALREADY FILLED**

   The user has already provided these fields:

   ${Object.keys(filledTextFields).join(", ")}

   

   And uploaded these files:

   ${filledFiles.map(f => `${f.fileName} (field: ${f.fieldId})`).join(", ") || "None"}

2. **FOR FILLED FIELDS WITH LOW CONFIDENCE:**

   Ask SPECIFIC CLARIFYING QUESTIONS, not "add more to this field"

   

   ❌ BAD: "Add more voice examples to voiceExamplesGood field"

   ✅ GOOD: "Your brand voice is 'professional but friendly.' How does this tone shift when addressing different audiences (new leads vs. existing clients vs. customer support)?"

3. **TIER 1 (MISSING FIELDS):** ONLY include TRULY EMPTY fields in missingContexts. 

   - The fieldId MUST be an EXACT field ID from the available fields list below
   - ONLY include fields from this EMPTY fields list: ${emptyFields.join(", ") || "None"}
   - Never include a filled field or an uploaded file here
   - Use EXACT field IDs - no variations or approximations

4. **TIER 2 (REFINEMENT QUESTIONS):** Only for FILLED fields. Ask nuance/clarification questions. Each question should reference the filled field via relatedFieldId. Do NOT ask for more of an empty field.

5. **TIER 3 (STRATEGIC RECOMMENDATIONS):** High-level strategic advice. MUST include a targetField and actionType.

   **CRITICAL: targetField MUST BE AN EXACT FIELD ID FROM THE LIST BELOW. NO VARIATIONS, NO APPROXIMATIONS.**
   
   - If your recommendation maps to a field below, use the EXACT field ID (case-sensitive)
   - If your recommendation doesn't map to any field below, use actionType: "external" and leave targetField empty
   - DO NOT invent field names or use variations like "styleGuide", "brandGuide", "competitorAnalysis" - use the EXACT IDs below

   **AVAILABLE TEXT/TEXTAREA FIELDS (for actionType: "fill_form"):**
   Use these EXACT field IDs (copy them exactly as shown):
${textFieldsList}

   **AVAILABLE FILE FIELDS (for actionType: "upload"):**
   Use these EXACT field IDs (copy them exactly as shown):
${fileFieldsList}

   **EXAMPLES:**
   ❌ BAD: { "recommendation": "Create a style guide", "targetField": "styleGuide", "actionType": "upload" }
   (styleGuide doesn't exist - should be "contentLinks" or "external")
   
   ❌ BAD: { "recommendation": "Add competitor analysis", "targetField": "competitorAnalysis", "actionType": "fill_form" }
   (competitorAnalysis doesn't exist - should be "idealCustomer" or "external")
   
   ✅ GOOD: { "recommendation": "Add more voice examples from different contexts", "targetField": "voiceExamplesGood", "actionType": "fill_form", "why": "Varied samples improve tone matching" }
   (voiceExamplesGood is an exact field ID from the list)
   
   ✅ GOOD: { "recommendation": "Add links to content examples you like", "targetField": "contentLinks", "actionType": "fill_form", "why": "Content examples help calibrate voice" }
   (contentLinks is an exact field ID from the list)
   
   ✅ GOOD: { "recommendation": "Develop partnerships with influencers", "targetField": "", "actionType": "external", "why": "External action not captured in form" }
   (No matching field, so use external)

4. **FOCUS ON NUANCE AND CONTEXT:**

   - Edge cases ("When is X not appropriate?")

   - Audience variations ("How does X change for Y audience?")

   - Situational context ("In what scenarios should we avoid X?")

   - Competitive differentiation ("How is your X different from competitors?")

6. **MAKE QUESTIONS ACTIONABLE:**

   - User should know exactly what to answer

   - Include examples in placeholder text

   - Tie question to specific card improvement

**RESPONSE STRUCTURE:**

{
  "cardAnalysis": [
    {
      "cardId": "string",
      "cardType": "string",
      "cardTitle": "string",
      "currentConfidence": number,
      "targetConfidence": 80,
      
      "missingContexts": [
        // ONLY fields that are TRULY EMPTY (in emptyFields list)
        // fieldId MUST be an EXACT field ID from the available fields list (see field list above)
        {
          "name": "string",
          "fieldType": "text" | "textarea" | "file",
          "fieldId": "string", // MUST be exact field ID from available fields list
          "section": "string",
          "placeholder": "string",
          "helpText": "string"
        }
      ],
      
      "refinementQuestions": [
        // SPECIFIC questions to improve existing data or add nuance
        {
          "id": "unique_question_id",
          "question": "Specific, actionable question with context from their filled data",
          "category": "voice_nuance" | "positioning_clarity" | "compliance_edge_cases" | "style_preferences" | "implementation_details",
          "fieldType": "textarea" | "text",
          "placeholder": "Example answer to guide the user",
          "helpText": "Why this helps improve the card (one sentence)",
          "priority": "high" | "medium" | "low",
          "relatedFieldId": "optional - if clarifying existing field"
        }
      ],
      
      "strategicRecommendations": [
        {
          "recommendation": "High-level strategic advice (not a missing field, not a refinement ask)",
          "targetField": "EXACT field ID from available fields list, or empty string if external",
          "actionType": "fill_form | upload | external",
          "why": "short rationale"
        }
      ],
      
      "priority": "high" | "medium" | "low"
    }
  ],
  
  "overallAnalysis": {
    "averageConfidence": number,
    "cardsBelow80": number,
    "totalCards": number,
    "criticalMissingFields": ["field1", "field2"],
    "totalRefinementQuestions": number
  }
}

**QUESTION CATEGORIES:**

- **voice_nuance**: Tone variations, audience-specific language, formality shifts

- **positioning_clarity**: Competitive differentiation, value prop refinement, audience segmentation

- **compliance_edge_cases**: Situational restrictions, industry-specific rules, safe phrasing alternatives

- **style_preferences**: Formatting choices, structural patterns, visual preferences

- **implementation_details**: CRM workflows, automation triggers, operational specifics

**EXAMPLE REFINEMENT QUESTIONS:**

Brand Voice (when brandVoiceStyle is filled):

{
  "id": "voice_audience_shift",
  "question": "Your brand voice is '${filledTextFields.brandVoiceStyle || "professional but friendly"}.' How does this tone shift when addressing: (1) cold leads who've never heard of you, (2) warm leads in your email sequence, and (3) existing customers needing support?",
  "category": "voice_nuance",
  "fieldType": "textarea",
  "placeholder": "Example: For cold leads, we're more educational and build credibility. For warm leads, we're persuasive and address objections. For customers, we're warmer and assume shared context...",
  "helpText": "Understanding tone variations helps the AI match your voice in different contexts",
  "priority": "high",
  "relatedFieldId": "brandVoiceStyle"
}

Positioning (when idealCustomer is filled):

{
  "id": "positioning_competitive_edge",
  "question": "You target '${(filledTextFields.idealCustomer || "").substring(0, 80)}'. What do your top 2-3 competitors say to this same audience, and what makes someone choose YOU over them?",
  "category": "positioning_clarity",
  "fieldType": "textarea",
  "placeholder": "Example: Competitor A focuses on low prices and DIY. Competitor B focuses on enterprise features. We focus on speed + hand-holding for mid-market. Clients choose us because they're overwhelmed by DIY but can't afford enterprise pricing...",
  "helpText": "Competitive positioning clarifies your unique angle and differentiates messaging",
  "priority": "high",
  "relatedFieldId": "idealCustomer"
}

Compliance (when forbiddenWords is filled):

{
  "id": "compliance_gray_areas",
  "question": "You've listed forbidden words: '${filledTextFields.forbiddenWords || ""}'. Are there 'gray area' terms that are risky but sometimes acceptable? Can you say 'most clients see results' or 'typically effective' or must everything be heavily qualified?",
  "category": "compliance_edge_cases",
  "fieldType": "textarea",
  "placeholder": "Example: We can say 'most clients' IF we add 'results not typical' disclaimer. 'Effective' is OK when describing mechanism, not promising outcome. 'Usually' requires qualification...",
  "helpText": "Understanding compliance gray areas helps balance persuasive copy with legal safety",
  "priority": "medium",
  "relatedFieldId": "forbiddenWords"
}

Style (when website content exists):

{
  "id": "style_formatting_consistency",
  "question": "Looking at your website, you use both bullet lists and numbered lists. When do you prefer bullets vs. numbers? Are there specific patterns (e.g., bullets for benefits, numbers for steps)?",
  "category": "style_preferences",
  "fieldType": "textarea",
  "placeholder": "Example: Bullets for features/benefits (no hierarchy needed). Numbers for step-by-step instructions or ranked items. Never mix both in the same section...",
  "helpText": "Consistent formatting rules maintain brand consistency across content",
  "priority": "low"
}

GHL (when customerJourney is filled):

{
  "id": "ghl_automation_triggers",
  "question": "Your customer journey is '${filledTextFields.customerJourney || ""}'. What should happen automatically at each stage? For example, when someone books a call, what triggers in the next 24 hours?",
  "category": "implementation_details",
  "fieldType": "textarea",
  "placeholder": "Example: Call booked → immediate SMS confirmation → 24hrs before: reminder SMS + email with prep questions → 1hr before: final reminder → if no-show: wait 2hrs then start follow-up sequence...",
  "helpText": "Specific automation triggers help create detailed GHL workflows",
  "priority": "high",
  "relatedFieldId": "customerJourney"
}

**REMEMBER:**

- Reference their actual filled data in questions (use ${Object.keys(filledTextFields).map(k => `filledTextFields.${k}`).join(", ")})

- Ask about nuances, not just "add more"

- Every refinementQuestion should feel like a conversation, not a form

- missingContexts should ONLY include truly empty fields from emptyFields list

- **CRITICAL: Use EXACT field IDs only. Copy them exactly from the field list above. No variations, no approximations.**
`;

  // Build list of answered refinement questions to avoid repeating
  const answeredRefinementQuestions: string[] = [];
  refinementAnswerMap.forEach((relatedFieldId, questionId) => {
    if (intakeData?.[questionId] && isFieldFilled(intakeData[questionId])) {
      answeredRefinementQuestions.push(questionId);
    }
  });

  // Build list of fields that have refinement answers (should not get new refinement questions)
  const fieldsWithRefinementAnswersList = Array.from(fieldsWithRefinementAnswers);

  const userMessage = `Analyze these business cards and generate smart enhancement recommendations.

**CARDS TO ANALYZE:**

${JSON.stringify(cardSummaries, null, 2)}

**FILLED TEXT FIELDS (with sample data):**

${JSON.stringify(
  Object.keys(filledTextFields).reduce((acc, key) => {
    acc[key] = filledTextFields[key].substring(0, 200); // Include samples for context
    return acc;
  }, {} as Record<string, string>),
  null,
  2
)}

**UPLOADED FILES:**
 
${JSON.stringify(filledFiles, null, 2)}

**EMPTY FIELDS (you can recommend these):**

${emptyFields.join(", ") || "None"}

**FIELDS WITH REFINEMENT ANSWERS (DO NOT ask refinement questions for these):**

${fieldsWithRefinementAnswersList.length > 0 ? fieldsWithRefinementAnswersList.join(", ") : "None"}

**ALREADY ANSWERED REFINEMENT QUESTIONS (DO NOT repeat these):**

${answeredRefinementQuestions.length > 0 ? answeredRefinementQuestions.join(", ") : "None"}

**WEBSITE:**

${website || "Not provided"}

**KNOWLEDGE BASE:**

${knowledgeBase ? JSON.stringify(knowledgeBase, null, 2).substring(0, 1500) : "Not available"}

For each card with confidence < 80%:

1. **missingContexts**: Only include fields from EMPTY FIELDS list. Use EXACT field IDs from the available fields list. DO NOT include fields that are already filled.

2. **refinementQuestions**: 
   - Ask 2-4 SPECIFIC questions that reference their actual data
   - DO NOT ask questions for fields in "FIELDS WITH REFINEMENT ANSWERS" list
   - DO NOT repeat questions from "ALREADY ANSWERED REFINEMENT QUESTIONS" list
   - Each question must have a unique ID and relatedFieldId

3. **strategicRecommendations**: 
   - Strategic advice (not field requests). 
   - Use EXACT field IDs for targetField, or use "external" if no field matches.
   - DO NOT recommend fields that are already filled (check FILLED TEXT FIELDS list)
   - DO NOT recommend fields that are in EMPTY FIELDS (those should be in missingContexts instead)

**CRITICAL REMINDER: All field IDs (fieldId in missingContexts, targetField in strategicRecommendations) MUST be EXACT matches from the available fields list provided in the system prompt. Copy them exactly - no variations or approximations.**

Generate smart, conversational questions that help refine their business profile.`;

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

    // Validate and ensure all cards are included
    if (aiAnalysis.cardAnalysis && Array.isArray(aiAnalysis.cardAnalysis)) {
      const analyzedCardIds = new Set(aiAnalysis.cardAnalysis.map((a: any) => a.cardId));
      for (const card of cards) {
        if (!analyzedCardIds.has(card.id)) {
          const confidence = card.confidence_score || (card.metadata as any)?.confidence_score || 0;
          aiAnalysis.cardAnalysis.push({
            cardId: card.id,
            cardType: card.type,
            cardTitle: card.title,
            currentConfidence: confidence,
            targetConfidence: 80,
            missingContexts: [],
            refinementQuestions: [],
            strategicRecommendations: confidence < 80 ? [
              { 
                recommendation: `Review ${card.title} for opportunities to add more specific detail.`, 
                targetField: card.type === "BRAND_VOICE_CARD" ? "voiceExamplesGood" : card.type === "POSITIONING_CARD" ? "idealCustomer" : card.type === "STYLE_RULES" ? "voiceExamplesGood" : card.type === "COMPLIANCE_RULES" ? "forbiddenWords" : card.type === "GHL_IMPLEMENTATION_NOTES" ? "pipelineStages" : "", 
                actionType: "fill_form" as const,
                why: "Adding more detail improves card accuracy and confidence"
              }
            ] : [],
            priority: confidence < 50 ? "high" : confidence < 70 ? "medium" : "low",
          });
        }
      }
      
      // CRITICAL: Filter out filled fields from missingContexts
      // This is a safety check in case AI still includes filled fields
      aiAnalysis.cardAnalysis.forEach((analysis: any) => {
        if (analysis.missingContexts && Array.isArray(analysis.missingContexts)) {
          analysis.missingContexts = analysis.missingContexts.filter((context: any) => {
            // Check if field is in filled text fields
            if (filledTextFields[context.fieldId]) {
              console.warn(`[Enhancement] Filtered out filled field from missingContexts: ${context.fieldId}`);
              return false;
            }
            // Check if it's a file field that's already uploaded
            if (context.fieldType === "file") {
              const hasFile = filledFiles.some(f => {
                if (f.fieldId === context.fieldId) return true;
                // Check URL pattern match
                if (fileUploadsArray.some((uf: any) => uf?.url && uf.url.includes(`/${context.fieldId}_`))) return true;
                return false;
              });
              if (hasFile) {
                console.warn(`[Enhancement] Filtered out uploaded file field from missingContexts: ${context.fieldId}`);
                return false;
              }
            }
            // Only include if field is in emptyFields list
            if (!emptyFields.includes(context.fieldId)) {
              console.warn(`[Enhancement] Filtered out unknown/filled field from missingContexts: ${context.fieldId}`);
              return false;
            }
            return true;
          });
        }
        // Ensure refinementQuestions exists and filter out answered questions
        if (!analysis.refinementQuestions) {
          analysis.refinementQuestions = [];
        } else if (Array.isArray(analysis.refinementQuestions)) {
          const initialCount = analysis.refinementQuestions.length;
          analysis.refinementQuestions = analysis.refinementQuestions.filter((q: any) => {
            // Must have an ID
            if (!q?.id) {
              console.warn(`[Enhancement] Filtered out refinement question without ID`);
              return false;
            }
            
            // Check if this question has already been answered
            if (intakeData?.[q.id] && isFieldFilled(intakeData[q.id])) {
              console.log(`[Enhancement] Filtered out already-answered refinement question: ${q.id}`);
              return false;
            }
            
            // Must have relatedFieldId and the field must be filled (for refinement questions)
            if (!q?.relatedFieldId) {
              console.warn(`[Enhancement] Filtered out refinement question without relatedFieldId: ${q.id}`);
              return false;
            }
            
            // The related field must be filled to ask a refinement question
            if (!filledTextFields[q.relatedFieldId]) {
              console.warn(`[Enhancement] Filtered out refinement question for unfilled field ${q.relatedFieldId}: ${q.id}`);
              return false;
            }
            
            // Don't ask if this field already has a refinement answer
            if (fieldsWithRefinementAnswers.has(q.relatedFieldId)) {
              console.log(`[Enhancement] Filtered out refinement question for field ${q.relatedFieldId} that already has refinement answer: ${q.id}`);
              return false;
            }
            
            return true;
          });
          
          const filteredCount = analysis.refinementQuestions.length;
          if (initialCount !== filteredCount) {
            console.log(`[Enhancement] Filtered ${initialCount - filteredCount} refinement questions for card ${analysis.cardId}`);
          }
        }
        
        // Validate and map strategicRecommendations to valid fields, and filter out already-filled fields
        if (!Array.isArray(analysis.strategicRecommendations)) {
          analysis.strategicRecommendations = [];
        } else {
          const initialCount = analysis.strategicRecommendations.length;
          const validated = validateAndMapStrategicRecommendations(
            analysis.strategicRecommendations
          );
          
          // Filter out strategic recommendations for fields that are already filled
          analysis.strategicRecommendations = validated.filter((rec: any) => {
            // External recommendations are always allowed
            if (rec.actionType === "external") {
              return true;
            }
            
            // For fill_form/upload, check if field is already filled
            if (rec.targetField) {
              // Check if field is filled
              if (filledTextFields[rec.targetField]) {
                console.log(`[Enhancement] Filtered out strategic recommendation for already-filled field: ${rec.targetField}`);
                return false;
              }
              
              // Check if it's a file field that's already uploaded
              if (rec.actionType === "upload") {
                const hasFile = filledFiles.some(f => f.fieldId === rec.targetField);
                if (hasFile) {
                  console.log(`[Enhancement] Filtered out strategic recommendation for already-uploaded file field: ${rec.targetField}`);
                  return false;
                }
              }
              
              // Don't recommend fields that are in missingContexts (those should be in missing fields, not strategic)
              if (analysis.missingContexts?.some((ctx: any) => ctx.fieldId === rec.targetField)) {
                console.log(`[Enhancement] Filtered out strategic recommendation for field already in missingContexts: ${rec.targetField}`);
                return false;
              }
            }
            
            return true;
          });
          
          const filteredCount = analysis.strategicRecommendations.length;
          if (initialCount !== filteredCount) {
            console.log(`[Enhancement] Filtered ${initialCount - filteredCount} strategic recommendations for card ${analysis.cardId}`);
          }
        }
      });
      
      // Calculate totals
      if (!aiAnalysis.overallAnalysis) {
        aiAnalysis.overallAnalysis = {
          averageConfidence: 0,
          cardsBelow80: 0,
          totalCards: cards.length,
          criticalMissingFields: [],
          totalRefinementQuestions: 0,
        };
      }
      
      aiAnalysis.overallAnalysis.totalRefinementQuestions = aiAnalysis.cardAnalysis.reduce(
        (sum: number, card: any) => sum + (card.refinementQuestions?.length || 0),
        0
      );

      return aiAnalysis;
    }
  } catch (error) {
    console.error("Error in AI card analysis:", error);
  }

  // Fallback to rule-based analysis
  return analyzeCardConfidenceFallback(cards, intakeData, fileUploadsArray, previousEnhancementAnalysis);
}

function analyzeCardConfidenceFallback(
  cards: any[],
  intakeData: any,
  fileUploads: any[],
  previousEnhancementAnalysis?: any
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
    refinementQuestions: Array<{
      id: string;
      question: string;
      category: string;
      fieldType: "text" | "textarea";
      placeholder?: string;
      helpText?: string;
      priority: "high" | "medium" | "low";
      relatedFieldId?: string;
    }>;
    strategicRecommendations: Array<{
      recommendation: string;
      targetField?: string;
      why?: string;
    }>;
    priority: "high" | "medium" | "low";
  }>;
  overallAnalysis: {
    averageConfidence: number;
    cardsBelow80: number;
    totalCards: number;
    criticalMissingFields: string[];
    totalRefinementQuestions: number;
  };
} {
  const cardAnalysis: any[] = [];
  let totalConfidence = 0;
  let cardsBelow80 = 0;

  const fileUploadsArray =
    fileUploads && Array.isArray(fileUploads) ? fileUploads : [];
  const { 
    filledTextFields, 
    filledFiles, 
    emptyFields,
    refinementAnswerMap,
    fieldsWithRefinementAnswers
  } = buildFilledFieldsContext(
    intakeData,
    fileUploadsArray,
    previousEnhancementAnalysis
  );
  
  console.log(`[analyzeCardConfidenceFallback] Using fallback analysis with ${Object.keys(filledTextFields).length} filled fields`);

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
    const refinementQuestions: Array<{
      id: string;
      question: string;
      category: string;
      fieldType: "text" | "textarea";
      placeholder?: string;
      helpText?: string;
      priority: "high" | "medium" | "low";
      relatedFieldId?: string;
    }> = [];
    const strategicRecommendations: Array<{
      recommendation: string;
      targetField?: string;
      why?: string;
      actionType?: "fill_form" | "upload" | "external";
    }> = [];
    let priority: "high" | "medium" | "low" = "medium";

    // Analyze based on card type and confidence
    if (confidence < 80) {
      switch (card.type) {
        case "BRAND_VOICE_CARD":
          if (emptyFields.includes("voiceExamplesGood")) {
            missingContexts.push({
              name: "Voice examples (good)",
              fieldType: "textarea",
              fieldId: "voiceExamplesGood",
              section: "voice-calibration",
              placeholder: "Paste 2-3 paragraphs you've written that sound like YOU",
              helpText: "Examples of your best writing that captures your voice",
            });
          }
          if (emptyFields.includes("contentLinks")) {
            missingContexts.push({
              name: "Example Content You Like (Links)",
              fieldType: "textarea",
              fieldId: "contentLinks",
              section: "voice-calibration",
              placeholder: "Drop 2-3 links to content that matches your desired voice",
              helpText: "Links help the business brain understand your voice preferences",
            });
          }

          if (isFieldFilled(intakeData.brandVoiceStyle)) {
            refinementQuestions.push({
              id: "voice_audience_shift_fallback",
              question: `Your brand voice is '${intakeData.brandVoiceStyle}'. How should this tone shift for cold leads, existing customers, and support requests?`,
              category: "voice_nuance",
              fieldType: "textarea",
              placeholder: "Cold leads: educational; Existing: warmer; Support: reassuring...",
              helpText: "Clarifies tone variations across contexts",
              priority: "high",
              relatedFieldId: "brandVoiceStyle",
            });
          }

          strategicRecommendations.push({
            recommendation: "Add voice examples from multiple contexts (email, social, long-form) to widen tone coverage.",
            targetField: "voiceExamplesGood",
            why: "Varied samples improve tone matching across channels.",
            actionType: "fill_form",
          });
          strategicRecommendations.push({
            recommendation: "Include a couple of 'avoid' examples to set clear negatives.",
            targetField: "voiceExamplesAvoid",
            actionType: "fill_form",
          });
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
          }
          if (!isFieldFilled(intakeData.topObjection)) {
            missingContexts.push({
              name: "Top customer objection",
              fieldType: "text",
              fieldId: "topObjection",
              section: "quick-start",
              placeholder: "What is the most common objection or hesitation you hear before someone buys?",
              helpText: "Be specific about the exact hesitation or concern you hear most often. This helps the business brain understand what objections to address in content.",
            });
          }
          if (!isFieldFilled(intakeData.coreOffer)) {
            missingContexts.push({
              name: "Core offer summary",
              fieldType: "textarea",
              fieldId: "coreOffer",
              section: "quick-start",
              placeholder: "Sales Accelerator – 8-week group program that helps coaches double close rates – $4,000.",
              helpText: "Include: the exact name of your offer, what it promises/delivers, the transformation it provides, and the price.",
            });
          }

          // Tier 2 refinement (only if filled)
          if (isFieldFilled(intakeData.idealCustomer)) {
            refinementQuestions.push({
              id: "positioning_competitive_edge_fallback",
              question: `For your ideal customer, what do your top competitors say, and why do buyers choose you instead?`,
              category: "positioning_clarity",
              fieldType: "textarea",
              placeholder: "Competitor A: low price/DIY; Competitor B: enterprise; we win on quality + transparency...",
              helpText: "Sharpens differentiation against alternatives",
              priority: "high",
              relatedFieldId: "idealCustomer",
            });
          }

          // Tier 3 strategic recs
          strategicRecommendations.push({
            recommendation: "Add a concise competitor snapshot to reinforce differentiation.",
            targetField: "competitorAnalysis",
            why: "Helps position your offer versus alternatives.",
            actionType: "fill_form",
          });
          strategicRecommendations.push({
            recommendation: "Map objections to proof points (reviews, awards) to strengthen persuasion.",
            targetField: "topObjection",
            actionType: "fill_form",
          });
          if (confidence < 50) priority = "high";
          else if (confidence < 70) priority = "medium";
          break;

        case "STYLE_RULES":
          if (emptyFields.includes("voiceExamplesGood")) {
            missingContexts.push({
              name: "Writing samples",
              fieldType: "textarea",
              fieldId: "voiceExamplesGood",
              section: "voice-calibration",
              placeholder: "Paste 2-3 paragraphs you've written that sound like YOU",
              helpText: "Examples of your writing style",
            });
          }

          if (isFieldFilled(intakeData.voiceExamplesGood)) {
            refinementQuestions.push({
              id: "style_formatting_consistency_fallback",
              question: "When do you prefer bullets vs. numbered lists, and how long should paragraphs typically be?",
              category: "style_preferences",
              fieldType: "textarea",
              placeholder: "Bullets for benefits; numbers for steps; paragraphs ~3 sentences...",
              helpText: "Sets consistent formatting rules",
              priority: "medium",
              relatedFieldId: "voiceExamplesGood",
            });
          }

          strategicRecommendations.push({
            recommendation: "Include a short formatting guide (bullets vs. numbers, headings, emphasis) to reduce style drift.",
            targetField: "voiceExamplesGood",
            why: "Codifies visual/structural preferences for generated content.",
            actionType: "fill_form",
          });
          if (confidence < 50) priority = "high";
          else if (confidence < 70) priority = "medium";
          break;

        case "COMPLIANCE_RULES":
          if (emptyFields.includes("forbiddenWords")) {
            missingContexts.push({
              name: "Forbidden words/claims",
              fieldType: "textarea",
              fieldId: "forbiddenWords",
              section: "compliance-basics",
              placeholder: "guaranteed, 100% success, cure, etc.",
              helpText: "Comma-separated list of forbidden words or claims",
            });
          }
          if (emptyFields.includes("disclaimers")) {
            missingContexts.push({
              name: "Required disclaimers",
              fieldType: "textarea",
              fieldId: "disclaimers",
              section: "compliance-basics",
              placeholder: "Results may vary. Individual results not guaranteed.",
              helpText: "Paste exact legal disclaimers that must appear in content",
            });
          }
          if (isFieldFilled(intakeData.forbiddenWords)) {
            refinementQuestions.push({
              id: "compliance_gray_areas_fallback",
              question: "Are there 'gray area' claims sometimes allowed with qualifiers (e.g., 'typically effective', 'most clients')?",
              category: "compliance_edge_cases",
              fieldType: "textarea",
              placeholder: "We can say 'most clients' with a disclaimer; avoid 'guaranteed' entirely...",
              helpText: "Clarifies safe-but-risky phrasing boundaries",
              priority: "medium",
              relatedFieldId: "forbiddenWords",
            });
          }

          strategicRecommendations.push({
            recommendation: "Document when each disclaimer should be applied (sales pages, emails, ads).",
            targetField: "disclaimers",
            why: "Enables consistent, context-aware compliance.",
            actionType: "fill_form",
          });
          if (confidence < 50) priority = "high";
          else if (confidence < 70) priority = "medium";
          break;

        case "GHL_IMPLEMENTATION_NOTES":
          if (emptyFields.includes("pipelineStages")) {
            missingContexts.push({
              name: "Pipeline stages",
              fieldType: "textarea",
              fieldId: "pipelineStages",
              section: "operations",
              placeholder: "Lead → Qualified → Meeting Booked → Proposal Sent → Closed Won/Lost",
              helpText: "Define your sales pipeline stages",
            });
          }
          if (isFieldFilled(intakeData.pipelineStages)) {
            refinementQuestions.push({
              id: "ghl_automation_triggers_fallback",
              question: "For each pipeline stage, what should trigger automatically (notifications, follow-ups, tasks)?",
              category: "implementation_details",
              fieldType: "textarea",
              placeholder: "When call booked: SMS confirm + reminder; No-show: follow-up sequence...",
              helpText: "Enables precise automation design",
              priority: "high",
              relatedFieldId: "pipelineStages",
            });
          }

          strategicRecommendations.push({
            recommendation: "Specify SLA/response times per stage to improve workflow automation.",
            targetField: "pipelineStages",
            why: "Helps craft time-bound automations and alerts.",
            actionType: "fill_form",
          });
          if (confidence < 50) priority = "high";
          else if (confidence < 70) priority = "medium";
          break;
      }
    }

    // Filter out answered refinement questions
    const filteredRefinementQuestions = refinementQuestions.filter((q) => {
      // Check if this question has already been answered
      if (intakeData?.[q.id] && isFieldFilled(intakeData[q.id])) {
        console.log(`[Fallback] Filtered out already-answered refinement question: ${q.id}`);
        return false;
      }
      
      // Don't ask if this field already has a refinement answer
      if (q.relatedFieldId && fieldsWithRefinementAnswers.has(q.relatedFieldId)) {
        console.log(`[Fallback] Filtered out refinement question for field ${q.relatedFieldId} that already has refinement answer: ${q.id}`);
        return false;
      }
      
      return true;
    });

    // Validate and map strategic recommendations to valid fields, then filter out already-filled
    const validatedStrategicRecommendations = validateAndMapStrategicRecommendations(
      strategicRecommendations
    ).filter((rec: any) => {
      // External recommendations are always allowed
      if (rec.actionType === "external") {
        return true;
      }
      
      // For fill_form/upload, check if field is already filled
      if (rec.targetField) {
        // Check if field is filled
        if (filledTextFields[rec.targetField]) {
          console.log(`[Fallback] Filtered out strategic recommendation for already-filled field: ${rec.targetField}`);
          return false;
        }
        
        // Check if it's a file field that's already uploaded
        if (rec.actionType === "upload") {
          const hasFile = filledFiles.some(f => f.fieldId === rec.targetField);
          if (hasFile) {
            console.log(`[Fallback] Filtered out strategic recommendation for already-uploaded file field: ${rec.targetField}`);
            return false;
          }
        }
        
        // Don't recommend fields that are in missingContexts
        if (missingContexts.some((ctx: any) => ctx.fieldId === rec.targetField)) {
          console.log(`[Fallback] Filtered out strategic recommendation for field already in missingContexts: ${rec.targetField}`);
          return false;
        }
      }
      
      return true;
    });

    cardAnalysis.push({
      cardId: card.id,
      cardType: card.type,
      cardTitle: card.title,
      currentConfidence: confidence,
      targetConfidence: 80,
      missingContexts,
      refinementQuestions: filteredRefinementQuestions,
      strategicRecommendations: validatedStrategicRecommendations,
      priority,
    });
  }

  const averageConfidence = cards.length > 0 ? totalConfidence / cards.length : 0;
  const totalRefinementQuestions = cardAnalysis.reduce(
    (sum, card) => sum + (card.refinementQuestions?.length || 0),
    0
  );

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
      totalRefinementQuestions,
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

function calculateDataHash(
  cards: any[],
  intakeData: any,
  fileUploads: any[]
): string {
  // Create a stable representation of the data
  const cardData = cards
    .map((c: any) => {
      const confidence = c.confidence_score || (c.metadata as any)?.confidence_score || 0;
      return `${c.id}:${confidence}`;
    })
    .sort()
    .join("|");
  
  const intakeDataStr = JSON.stringify(intakeData);
  const fileUploadsStr = JSON.stringify(fileUploads);
  
  const combined = `${cardData}|${intakeDataStr}|${fileUploadsStr}`;
  
  // Create SHA-256 hash
  return crypto.createHash("sha256").update(combined).digest("hex");
}

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

    console.log(`[calculate-completion] Starting for businessBrainId: ${businessBrainId}, forceRefresh: ${forceRefresh}`);

    const completionData = calculateCompletion(brain);
    console.log(`[calculate-completion] Completion score: ${completionData.score}%, filled: ${completionData.filledCount}/${completionData.totalFields}`);

    let parsedIntakeData = brain.intakeData;

    if (typeof parsedIntakeData === "string") {
      try {
        parsedIntakeData = JSON.parse(parsedIntakeData);
      } catch (e) {
        console.error(`[calculate-completion] Failed to parse intakeData as JSON:`, e);
        parsedIntakeData = {};
      }
    }

    let parsedFileUploads: any = brain.fileUploads || [];
    if (typeof brain.fileUploads === "string") {
      try {
        parsedFileUploads = JSON.parse(brain.fileUploads);
      } catch (e) {
        console.error(`[calculate-completion] Failed to parse fileUploads as JSON:`, e);
        parsedFileUploads = [];
      }
    }

    const fileUploadsArray = Array.isArray(parsedFileUploads)
      ? parsedFileUploads
      : parsedFileUploads && typeof parsedFileUploads === "object"
      ? Object.values(parsedFileUploads).flat()
      : [];

    const cards = brain.cards || [];
    console.log(`[calculate-completion] Found ${cards.length} cards with confidences: ${cards.map((c: any) => c.confidence_score || (c.metadata as any)?.confidence_score || 0).join(", ")}`);
    
    const website = (parsedIntakeData as Record<string, any>)?.website || "";
    const knowledgeBase = brain.knowledgeBase || null;

    // Get previous enhancement analysis to map refinement answers
    let previousEnhancementAnalysis: any = null;
    try {
      const previousAnalysis = await (prisma as any).enhancementAnalysis.findFirst({
        where: { brainId: businessBrainId },
        orderBy: { generatedAt: "desc" },
      });
      if (previousAnalysis) {
        previousEnhancementAnalysis = previousAnalysis.analysis;
        console.log(`[calculate-completion] Found previous enhancement analysis with ${previousEnhancementAnalysis?.cardAnalysis?.length || 0} cards analyzed`);
      }
    } catch (error) {
      console.error(`[calculate-completion] Error fetching previous analysis:`, error);
      // Continue without previous analysis
    }

    const dataHash = calculateDataHash(cards, parsedIntakeData, fileUploadsArray);
    console.log(`[calculate-completion] Data hash: ${dataHash.substring(0, 16)}...`);

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

    if (!enhancementAnalysis) {
      console.log(`[calculate-completion] Generating new enhancement analysis (forceRefresh: ${forceRefresh})`);
      
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
            website,
            previousEnhancementAnalysis
          );
          
          console.log(`[calculate-completion] AI analysis complete: ${enhancementAnalysis?.cardAnalysis?.length || 0} cards analyzed`);
        } catch (error) {
          console.error("[calculate-completion] Error in AI-powered card analysis:", error);
          enhancementAnalysis = analyzeCardConfidenceFallback(
            cards,
            parsedIntakeData,
            fileUploadsArray,
            previousEnhancementAnalysis
          );
          console.log(`[calculate-completion] Using fallback analysis: ${enhancementAnalysis?.cardAnalysis?.length || 0} cards analyzed`);
        }
      } else {
        console.log(`[calculate-completion] No OpenAI API key, using fallback analysis`);
        enhancementAnalysis = analyzeCardConfidenceFallback(
          cards,
          parsedIntakeData,
          fileUploadsArray,
          previousEnhancementAnalysis
        );
        console.log(`[calculate-completion] Fallback analysis complete: ${enhancementAnalysis?.cardAnalysis?.length || 0} cards analyzed`);
      }

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
