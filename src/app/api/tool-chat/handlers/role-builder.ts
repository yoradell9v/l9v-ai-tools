import OpenAI from "openai";
import type {
  ToolChatRequest,
  ToolChatResponse,
  ChatMessage,
} from "@/lib/tool-chat/types";
import type { AuthResult } from "@/lib/tool-chat/utils";
import {
  extractStructuredDataFromConversation,
  validateExtractedData,
  createClarificationResponse,
  createSuccessResponse,
  createErrorResponse,
  createSuggestionResponse,
} from "@/lib/tool-chat/utils";
import { jdFormConfig } from "@/components/forms/configs/jdFormConfig";
import { runJDAnalysisPipeline } from "@/lib/jd-analysis/pipeline";
import {
  normalizeTasks,
  normalizeStringArray,
} from "@/lib/jd-analysis/pipeline";

/**
 * Handler for Role Builder tool chat.
 *
 * Flow:
 * 1. Detect if this is a refinement request (user editing existing analysis)
 * 2. Extract structured data from conversation using jdFormConfig
 * 3. Validate extracted data
 * 4. If incomplete → return clarification questions or suggestions
 * 5. If complete → run JD analysis pipeline
 * 6. Return success response with action containing form data and analysis
 *
 * Supports iterative refinement: users can continue chatting to make edits,
 * and the handler will re-extract and re-analyze with updated data.
 */
export async function handleRoleBuilder(
  request: ToolChatRequest,
  auth: AuthResult,
): Promise<ToolChatResponse> {
  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Check if this is a refinement request (context contains existingAnalysis)
    const context = request.context as any;
    const existingAnalysis = context?.existingAnalysis;
    const existingIntakeData = context?.existingIntakeData;
    const isRefinementMode = !!existingAnalysis;

    // Detect if this is a refinement request from conversation
    // If conversation has multiple turns and user is asking for changes, it's likely a refinement
    const isRefinement = request.conversation.length > 2;
    const lastUserMessage =
      request.conversation
        .filter((m) => m.role === "user")
        .slice(-1)[0]
        ?.content?.toLowerCase() || "";

    const isEditRequest =
      isRefinement &&
      (lastUserMessage.includes("change") ||
        lastUserMessage.includes("update") ||
        lastUserMessage.includes("edit") ||
        lastUserMessage.includes("modify") ||
        lastUserMessage.includes("instead") ||
        lastUserMessage.includes("rather") ||
        lastUserMessage.includes("also") ||
        lastUserMessage.includes("add") ||
        lastUserMessage.includes("remove"));

    // If we have an existing analysis, use refinement logic
    if (isRefinementMode && existingAnalysis) {
      return await handleRefinement(
        openai,
        request,
        existingAnalysis,
        existingIntakeData || {},
        auth,
      );
    }

    // Step 1: Extract structured data from conversation
    // Transform conversation to full ChatMessage format (extraction only uses role/content)
    const fullConversation: ChatMessage[] = request.conversation.map(
      (msg, index) => ({
        id: `msg-${index}`,
        role: msg.role,
        content: msg.content,
        createdAt: Date.now() + index, // Dummy timestamp, not used by extraction
      }),
    );

    const extractionResult = await extractStructuredDataFromConversation(
      openai,
      fullConversation,
      jdFormConfig,
      auth.knowledgeBase,
      "role-builder",
    );

    // Handle extraction errors
    if (extractionResult.extractionErrors.length > 0) {
      console.error(
        "[Role Builder] Extraction errors:",
        extractionResult.extractionErrors,
      );
      return createErrorResponse(
        "Failed to extract data from conversation",
        extractionResult.extractionErrors.join(", "),
      );
    }

    // Handle empty extraction (no data extracted at all)
    if (
      !extractionResult.extractedData ||
      Object.keys(extractionResult.extractedData).length === 0
    ) {
      return createClarificationResponse(
        ["tasks", "outcome90Day", "requirements"],
        [
          "What tasks will this role handle?",
          "What is the 90-day outcome you want to achieve?",
          "What are the key requirements for this role?",
        ],
      );
    }

    // Step 2: Normalize and validate extracted data
    const normalizedData = normalizeExtractedDataForJD(
      extractionResult.extractedData,
    );
    const validation = validateExtractedData(normalizedData, jdFormConfig);

    // Step 3: If incomplete, return suggestions instead of clarification questions
    // This is the proactive approach - AI generates suggestions for missing fields
    if (!validation.isValid && validation.missingFields.length > 0) {
      // Check if we have AI suggestions for missing fields
      const suggestedFields = extractionResult.suggestedFields || {};
      const fieldSources = extractionResult.fieldSources || {};

      // If we have suggestions, return them; otherwise fall back to clarification
      if (Object.keys(suggestedFields).length > 0) {
        return createSuggestionResponse(
          normalizedData,
          suggestedFields,
          fieldSources,
          validation.missingFields,
        );
      } else {
        // Fallback to clarification if extraction didn't generate suggestions
        return createClarificationResponse(
          validation.missingFields,
          extractionResult.suggestedQuestions.length > 0
            ? extractionResult.suggestedQuestions
            : validation.missingFields.map(
                (field) => `Could you provide more details about ${field}?`,
              ),
        );
      }
    }

    // Step 4: Data is complete, run JD analysis pipeline
    try {
      // Prepare intake data for pipeline
      const intakeData = prepareIntakeDataForPipeline(
        normalizedData,
        auth.knowledgeBase,
      );

      // Run analysis pipeline
      // Note: SOP text and website content are not available from chat, so pass null
      const analysisResult = await runJDAnalysisPipeline(
        intakeData,
        null, // sopText - not available from chat
        auth.knowledgeBase,
        null, // websiteContent - not available from chat
      );

      // Step 5: Return success response with action
      const action = {
        formData: normalizedData,
        analysis: analysisResult,
        kbDefaultsUsed: extractionResult.kbDefaultsUsed,
        fieldSources: extractionResult.fieldSources || {},
        isDraft: false, // Complete analysis, not a draft
      };

      // Determine response message based on whether this is a refinement
      let assistantMessage: string;
      if (isEditRequest || isRefinement) {
        assistantMessage = `I've updated the analysis based on your changes. Here's the revised job description:`;
      } else {
        assistantMessage = `I've analyzed your role requirements and generated a comprehensive job description. The analysis includes service type recommendations, role architecture, detailed specifications, and risk assessment.`;
      }

      return createSuccessResponse(
        assistantMessage,
        action,
        extractionResult.kbDefaultsUsed.length > 0
          ? [
              `Used organization defaults for: ${extractionResult.kbDefaultsUsed.join(", ")}`,
            ]
          : undefined,
      );
    } catch (analysisError) {
      console.error("[Role Builder] Analysis pipeline error:", analysisError);
      return createErrorResponse(
        "Failed to generate job description analysis",
        analysisError instanceof Error
          ? analysisError.message
          : "An unexpected error occurred during analysis",
      );
    }
  } catch (error) {
    console.error("[Role Builder] Handler error:", error);
    return createErrorResponse(
      "Failed to process role builder request",
      error instanceof Error ? error.message : "An unexpected error occurred",
    );
  }
}

/**
 * Handles refinement of an existing analysis based on chat conversation.
 * Uses the same refinement logic as /api/jd/refine but adapted for chat format.
 */
async function handleRefinement(
  openai: OpenAI,
  request: ToolChatRequest,
  existingAnalysis: any,
  existingIntakeData: any,
  auth: AuthResult,
): Promise<ToolChatResponse> {
  try {
    // Build system prompt for refinement
    const systemPrompt = buildRefinementSystemPrompt(
      existingAnalysis,
      existingIntakeData,
    );

    // Get the last user message (refinement request)
    const lastUserMessage =
      request.conversation.filter((m) => m.role === "user").slice(-1)[0]
        ?.content || "";

    if (!lastUserMessage.trim()) {
      return createErrorResponse(
        "No refinement request provided",
        "Please describe what you'd like to change in the analysis.",
      );
    }

    // Build conversation for refinement
    const refinementConversation = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      {
        role: "user" as const,
        content: lastUserMessage,
      },
    ];

    // Call OpenAI to refine the analysis
    // Use maximum tokens for gpt-4o (16384) to handle large analysis structures
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: refinementConversation,
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 16384, // Maximum for gpt-4o to handle very large analysis structures
    });

    const responseText = completion.choices[0].message.content;
    const finishReason = completion.choices[0].finish_reason;

    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    // Check if response was truncated BEFORE attempting to parse
    if (finishReason === "length") {
      console.error(
        "[Role Builder] Response truncated - max_tokens limit reached",
      );
      console.error("[Role Builder] Response length:", responseText.length);
      console.error("[Role Builder] Tokens used:", completion.usage);
      return createErrorResponse(
        "Response too large",
        "The analysis is too large to refine in one pass. The response was truncated. Please try refining specific sections instead of the entire analysis, or contact support for assistance with very large analyses.",
      );
    }

    // Extract JSON from response (handle markdown code blocks or extra text)
    let jsonText = responseText.trim();

    // Remove markdown code blocks if present
    if (jsonText.includes("```json")) {
      const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonText = jsonMatch[1].trim();
      }
    } else if (jsonText.includes("```")) {
      const codeMatch = jsonText.match(/```\s*([\s\S]*?)\s*```/);
      if (codeMatch && codeMatch[1]) {
        jsonText = codeMatch[1].trim();
      }
    }

    // Find JSON object boundaries
    const firstBrace = jsonText.indexOf("{");
    const lastBrace = jsonText.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    }

    // Validate JSON structure
    if (!jsonText.startsWith("{") || !jsonText.endsWith("}")) {
      console.error(
        "[Role Builder] Response doesn't appear to be valid JSON object",
      );
      console.error("[Role Builder] Response length:", responseText.length);
      console.error(
        "[Role Builder] Finish reason:",
        completion.choices[0].finish_reason,
      );
      console.error(
        "[Role Builder] First 500 chars:",
        responseText.substring(0, 500),
      );
      console.error(
        "[Role Builder] Last 500 chars:",
        responseText.substring(Math.max(0, responseText.length - 500)),
      );
      return createErrorResponse(
        "Failed to parse refined analysis",
        "The refinement response was not valid JSON. The analysis may be too large to refine in one pass.",
      );
    }

    let refinedAnalysis: any;
    try {
      refinedAnalysis = JSON.parse(jsonText);

      // Validate that we got the expected structure
      if (!refinedAnalysis.preview && !refinedAnalysis.full_package) {
        console.error(
          "[Role Builder] Response doesn't contain expected analysis structure",
        );
        console.error(
          "[Role Builder] Response keys:",
          Object.keys(refinedAnalysis),
        );
        return createErrorResponse(
          "Failed to parse refined analysis",
          "The refinement response doesn't contain the expected analysis structure.",
        );
      }
    } catch (parseError) {
      console.error("[Role Builder] JSON parse error:", parseError);
      console.error("[Role Builder] Response length:", responseText.length);
      console.error("[Role Builder] Finish reason:", finishReason);
      console.error("[Role Builder] Tokens used:", completion.usage);
      console.error("[Role Builder] Extracted JSON length:", jsonText.length);
      console.error(
        "[Role Builder] First 500 chars of extracted JSON:",
        jsonText.substring(0, 500),
      );
      console.error(
        "[Role Builder] Last 500 chars of extracted JSON:",
        jsonText.substring(Math.max(0, jsonText.length - 500)),
      );

      // Check if JSON appears incomplete (doesn't end properly)
      if (!jsonText.endsWith("}")) {
        const lastChars = jsonText.substring(
          Math.max(0, jsonText.length - 100),
        );
        console.error(
          "[Role Builder] JSON appears incomplete. Last 100 chars:",
          lastChars,
        );
        return createErrorResponse(
          "Incomplete response",
          "The refinement response appears to be incomplete. This may happen with very large analyses. Please try refining specific sections instead of the entire analysis.",
        );
      }

      return createErrorResponse(
        "Failed to parse refined analysis",
        `The refinement response was not valid JSON: ${parseError instanceof Error ? parseError.message : "Invalid JSON"}. Please try again with a more specific refinement request.`,
      );
    }

    // Clean up service type specific fields (same as refine endpoint)
    const serviceType =
      refinedAnalysis.preview?.service_type ||
      refinedAnalysis.full_package?.service_structure?.service_type ||
      refinedAnalysis.full_package?.executive_summary?.service_recommendation
        ?.type;

    if (serviceType === "Dedicated VA") {
      if (refinedAnalysis.preview?.team_support_areas !== undefined) {
        delete refinedAnalysis.preview.team_support_areas;
      }
      if (
        refinedAnalysis.full_package?.service_structure?.team_support_areas !==
        undefined
      ) {
        delete refinedAnalysis.full_package.service_structure
          .team_support_areas;
      }
      if (refinedAnalysis.full_package?.team_support_areas !== undefined) {
        delete refinedAnalysis.full_package.team_support_areas;
      }
    }

    // Identify changes made
    const changedSections = identifyChanges(existingAnalysis, refinedAnalysis);
    const changeSummary = generateChangeSummary(changedSections);

    // Return success response with refined analysis
    const action = {
      refinedAnalysis: refinedAnalysis,
      changedSections: changedSections,
      changeSummary: changeSummary,
      isRefinement: true,
    };

    const assistantMessage =
      changedSections.length > 0
        ? `I've updated the analysis based on your feedback. ${changeSummary.summary}`
        : "I've reviewed your request. The analysis has been updated.";

    return createSuccessResponse(assistantMessage, action, undefined);
  } catch (error) {
    console.error("[Role Builder] Refinement error:", error);
    return createErrorResponse(
      "Failed to refine analysis",
      error instanceof Error
        ? error.message
        : "An unexpected error occurred during refinement",
    );
  }
}

/**
 * Builds the system prompt for refinement, similar to /api/jd/refine
 */
function buildRefinementSystemPrompt(
  currentAnalysis: any,
  intakeData: any,
): string {
  return `You are an expert job description refinement assistant for Level 9 Virtual. You help refine job descriptions based on conversational feedback.

# Current Analysis State
${JSON.stringify(currentAnalysis, null, 2)}

# Original Intake Data (for reference)
${JSON.stringify(intakeData, null, 2)}

# Your Role
- Listen to the user's refinement requests in natural conversation
- Make ONLY the changes they request
- Maintain all other content exactly as is
- Ensure changes are consistent across related sections
- Return the COMPLETE updated analysis as valid JSON

# Rules for Changes
1. **Removal requests**: If user says "remove X" or "don't need X", remove ALL references from:
   - responsibilities
   - skills
   - tools
   - sample_week
   - kpis (if relevant)

2. **Optional/Nice-to-have**: If user says "make X optional" or "nice to have", update language:
   - Example: "Proficient in X (nice to have)"
   - Example: "Bonus: Experience with X"

3. **Emphasis changes**: If user says "focus more on Y", increase prominence of Y in:
   - core_outcomes
   - responsibilities
   - skills
   - sample_week

4. **Additions**: If user says "add Z", integrate it naturally into relevant sections

5. **Hour/service changes**: If user changes hours or service type, update:
   - roles[].hours_per_week
   - split_table[].hrs
   - service_recommendation if needed

6. **Maintain consistency**: Changes should cascade logically
   - If responsibilities change, skills might need adjustment
   - If tools are removed, remove them from sample_week too
   - Keep personality traits aligned with the actual role duties

# Response Format
Return ONLY valid JSON in the SAME structure as the current analysis. Maintain the exact same structure, only modifying the fields that need to be changed based on the user's feedback.

CRITICAL: Return the COMPLETE analysis JSON. Do not truncate any sections.`;
}

/**
 * Identifies which sections changed between old and new analysis
 */
function identifyChanges(oldAnalysis: any, newAnalysis: any): string[] {
  const changes: string[] = [];

  const compareObjects = (obj1: any, obj2: any, path = "") => {
    if (obj1 === obj2) return;
    if (
      obj1 === null ||
      obj1 === undefined ||
      obj2 === null ||
      obj2 === undefined
    ) {
      if (obj1 !== obj2 && path) {
        changes.push(path);
      }
      return;
    }

    if (Array.isArray(obj2)) {
      if (
        !Array.isArray(obj1) ||
        JSON.stringify(obj1) !== JSON.stringify(obj2)
      ) {
        changes.push(path);
      }
      return;
    }

    if (typeof obj2 === "object") {
      for (const key in obj2) {
        const currentPath = path ? `${path}.${key}` : key;
        compareObjects(obj1?.[key], obj2[key], currentPath);
      }
      return;
    }

    if (obj1 !== obj2 && path) {
      changes.push(path);
    }
  };

  compareObjects(oldAnalysis, newAnalysis);
  return deduplicatePaths(changes);
}

function deduplicatePaths(paths: string[]): string[] {
  const sorted = [...paths].sort((a, b) => a.length - b.length);
  const deduplicated: string[] = [];

  for (const path of sorted) {
    const hasParent = deduplicated.some((parent) =>
      path.startsWith(parent + "."),
    );
    if (!hasParent) {
      deduplicated.push(path);
    }
  }

  return deduplicated;
}

function generateChangeSummary(changedSections: string[]): {
  sections: string[];
  summary: string;
} {
  if (changedSections.length === 0) {
    return {
      sections: [],
      summary: "No changes were made to the analysis.",
    };
  }
  const sectionGroups: Record<string, string[]> = {};

  changedSections.forEach((path) => {
    const topLevel = path.split(".")[0];
    if (!sectionGroups[topLevel]) {
      sectionGroups[topLevel] = [];
    }
    sectionGroups[topLevel].push(path);
  });

  const sections = Object.keys(sectionGroups).map((section) => {
    return section.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  });

  const summaries = Object.entries(sectionGroups).map(([section, paths]) => {
    const humanSection = section
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    if (paths.length === 1) {
      return `• **${humanSection}**: Updated`;
    }
    return `• **${humanSection}**: ${paths.length} changes made`;
  });

  return {
    sections,
    summary: `These sections had been updated: ${
      Object.keys(sectionGroups).length
    } section${
      Object.keys(sectionGroups).length > 1 ? "s" : ""
    } based on your feedback:\n\n${summaries.join("\n")}`,
  };
}

/**
 * Normalizes extracted data to match JD form expectations.
 * Handles array fields, string normalization, and type conversions.
 */
function normalizeExtractedDataForJD(
  data: Record<string, any>,
): Record<string, any> {
  const normalized = { ...data };

  // Normalize tasks array
  if (normalized.tasks !== undefined) {
    normalized.tasks = normalizeTasks(normalized.tasks);
  }

  // Normalize requirements array
  if (normalized.requirements !== undefined) {
    normalized.requirements = normalizeStringArray(normalized.requirements);
  }

  // Normalize tools (textarea -> string)
  if (normalized.tools && Array.isArray(normalized.tools)) {
    normalized.tools = normalized.tools.join(", ");
  }

  // Ensure weeklyHours is a string (select field)
  if (
    normalized.weeklyHours !== undefined &&
    typeof normalized.weeklyHours !== "string"
  ) {
    normalized.weeklyHours = String(normalized.weeklyHours);
  }

  // Ensure clientFacing is a string (select field)
  if (
    normalized.clientFacing !== undefined &&
    typeof normalized.clientFacing !== "string"
  ) {
    normalized.clientFacing = String(normalized.clientFacing);
  }

  // Normalize optional fields
  if (normalized.existingSOPs === undefined) {
    normalized.existingSOPs = "No";
  }

  // Ensure all required fields have defaults if missing
  if (!normalized.tasks || normalized.tasks.length === 0) {
    normalized.tasks = [""];
  }
  if (!normalized.requirements || normalized.requirements.length === 0) {
    normalized.requirements = [""];
  }

  // Normalize outcome90Day (required textarea)
  if (!normalized.outcome90Day || typeof normalized.outcome90Day !== "string") {
    normalized.outcome90Day = normalized.outcome90Day || "";
  }

  // Normalize optional text fields to empty strings if undefined
  const optionalTextFields = [
    "businessName",
    "tools",
    "reportingExpectations",
    "securityNeeds",
    "dealBreakers",
    "niceToHaveSkills",
  ];
  optionalTextFields.forEach((field) => {
    if (normalized[field] === undefined || normalized[field] === null) {
      normalized[field] = "";
    } else if (typeof normalized[field] !== "string") {
      normalized[field] = String(normalized[field]);
    }
  });

  return normalized;
}

/**
 * Prepares intake data for JD analysis pipeline.
 * Maps form data structure to pipeline's expected intake format.
 * The pipeline expects snake_case fields and specific structure.
 */
function prepareIntakeDataForPipeline(
  formData: Record<string, any>,
  knowledgeBase: any | null,
): any {
  const normalizedTasks = normalizeTasks(formData.tasks);
  const normalizedRequirements = normalizeStringArray(formData.requirements);
  const normalizedTools = normalizeStringArray(formData.tools);

  // Convert weeklyHours to number
  const weeklyHours = Number(
    formData.weeklyHours || knowledgeBase?.defaultWeeklyHours || "40",
  );

  // Convert clientFacing to boolean (Yes/No -> true/false)
  const clientFacing = formData.clientFacing === "Yes";

  // Map form fields to pipeline's expected intake format (snake_case)
  const intakeData: any = {
    // Brand/Company info
    brand: {
      name: formData.businessName || knowledgeBase?.businessName || "",
    },

    // Business context
    business_goal:
      formData.businessGoal === "__ORG_DEFAULT__"
        ? knowledgeBase?.primaryGoal || ""
        : formData.businessGoal || "",
    outcome_90d: formData.outcome90Day || "",

    // Tasks and requirements
    tasks_top5: normalizedTasks, // Pipeline expects this field name
    requirements: normalizedRequirements,

    // Work details
    weekly_hours: weeklyHours,
    client_facing: clientFacing,

    // Skills and tools
    tools: normalizedTools,
    english_level:
      formData.englishLevel === "__ORG_DEFAULT__"
        ? knowledgeBase?.defaultEnglishLevel || "Excellent"
        : formData.englishLevel || "Excellent",

    // Additional details
    existing_sops: formData.existingSOPs || "No",
    reporting_expectations: formData.reportingExpectations || "",
    management_style:
      formData.managementStyle === "__ORG_DEFAULT__"
        ? knowledgeBase?.defaultManagementStyle || "Async"
        : formData.managementStyle || "Async",
    security_needs: formData.securityNeeds || "",
    deal_breakers: formData.dealBreakers || "",
    nice_to_have_skills: formData.niceToHaveSkills || "",
  };

  return intakeData;
}
