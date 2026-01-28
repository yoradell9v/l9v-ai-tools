import OpenAI from "openai";
import type { ToolChatRequest, ToolChatResponse, ChatMessage } from "@/lib/tool-chat/types";
import type { AuthResult } from "@/lib/tool-chat/utils";
import {
  extractStructuredDataFromConversation,
  validateExtractedData,
  createClarificationResponse,
  createSuccessResponse,
  createErrorResponse,
  createSuggestionResponse,
} from "@/lib/tool-chat/utils";
import { sopGeneratorConfig } from "@/components/forms/configs/sopGeneratorConfig";
import { generateSOP } from "@/lib/sop-generation/generate-sop";
import { markdownToHtml } from "@/lib/extraction/markdown-to-html";

/**
 * Handler for Process Builder tool chat.
 * 
 * Flow:
 * 1. Check if this is a refinement request (context contains existingSOP)
 * 2. If refinement mode → use handleSOPRefinement to refine existing SOP
 * 3. Otherwise → extract structured data from conversation using sopGeneratorConfig
 * 4. Validate extracted data
 * 5. If incomplete → return clarification questions or suggestions
 * 6. If complete → generate SOP
 * 7. Return success response with action containing form data and SOP
 * 
 * Supports chat-based refinement: users can refine existing SOPs through conversation.
 */
export async function handleProcessBuilder(
  request: ToolChatRequest,
  auth: AuthResult
): Promise<ToolChatResponse> {
  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Check if this is a refinement request (context contains existingSOP)
    const context = request.context as any;
    const existingSOP = context?.existingSOP;
    const existingFormData = context?.existingFormData;
    const isRefinementMode = !!existingSOP;

    // Check if this is a job analysis-linked request (context contains jobAnalysisId or linkedJobAnalysis)
    const jobAnalysisId = context?.jobAnalysisId;
    const linkedJobAnalysis = context?.linkedJobAnalysis;
    const hasJobAnalysisContext = !!(jobAnalysisId || linkedJobAnalysis);

    // If we have an existing SOP, use refinement logic
    if (isRefinementMode && existingSOP) {
      return await handleSOPRefinement(
        openai,
        request,
        existingSOP,
        existingFormData || {},
        auth
      );
    }

    // If we have job analysis context, fetch full analysis if only ID provided
    let jobAnalysis: { analysis: any; intakeData?: any } | null = null;
    if (hasJobAnalysisContext) {
      if (linkedJobAnalysis) {
        jobAnalysis = {
          analysis: linkedJobAnalysis.analysis,
          intakeData: linkedJobAnalysis.intakeData || {},
        };
      } else if (jobAnalysisId) {
        try {
          // Fetch the saved analysis from database
          const { prisma } = await import("@/lib/core/prisma");
          const savedAnalysis = await prisma.savedAnalysis.findUnique({
            where: { id: jobAnalysisId },
            select: {
              analysis: true,
              intakeData: true,
            },
          });
          if (savedAnalysis && savedAnalysis.analysis) {
            jobAnalysis = {
              analysis: savedAnalysis.analysis,
              intakeData: savedAnalysis.intakeData || {},
            };
          }
        } catch (error) {
          console.error("[Process Builder] Error fetching job analysis:", error);
          // Continue without job analysis if fetch fails
        }
      }
    }

    // Detect if this is a refinement request from conversation
    const isRefinement = request.conversation.length > 2;
    const lastUserMessage = request.conversation
      .filter(m => m.role === "user")
      .slice(-1)[0]?.content?.toLowerCase() || "";
    
    const isEditRequest = isRefinement && (
      lastUserMessage.includes("change") ||
      lastUserMessage.includes("update") ||
      lastUserMessage.includes("edit") ||
      lastUserMessage.includes("modify") ||
      lastUserMessage.includes("instead") ||
      lastUserMessage.includes("rather") ||
      lastUserMessage.includes("also") ||
      lastUserMessage.includes("add") ||
      lastUserMessage.includes("remove")
    );

    // Step 1: Extract structured data from conversation
    const fullConversation: ChatMessage[] = request.conversation.map((msg, index) => ({
      id: `msg-${index}`,
      role: msg.role,
      content: msg.content,
      createdAt: Date.now() + index,
    }));

    const extractionResult = await extractStructuredDataFromConversation(
      openai,
      fullConversation,
      sopGeneratorConfig,
      auth.knowledgeBase,
      "process-builder"
    );

    // Handle extraction errors
    if (extractionResult.extractionErrors.length > 0) {
      console.error("[Process Builder] Extraction errors:", extractionResult.extractionErrors);
      return createErrorResponse(
        "Failed to extract data from conversation",
        extractionResult.extractionErrors.join(", ")
      );
    }

    // Handle empty extraction
    if (!extractionResult.extractedData || Object.keys(extractionResult.extractedData).length === 0) {
      return createClarificationResponse(
        ["sopTitle", "processOverview", "mainSteps"],
        [
          "What is the name of this process?",
          "What does this process accomplish?",
          "What are the main steps in this process?",
        ]
      );
    }

    // Step 2: Normalize and validate extracted data
    const normalizedData = normalizeExtractedDataForSOP(extractionResult.extractedData);
    const validation = validateExtractedData(normalizedData, sopGeneratorConfig);

    // Step 3: If incomplete, return suggestions instead of clarification questions
    if (!validation.isValid && validation.missingFields.length > 0) {
      const suggestedFields = extractionResult.suggestedFields || {};
      const fieldSources = extractionResult.fieldSources || {};
      
      if (Object.keys(suggestedFields).length > 0) {
        return createSuggestionResponse(
          normalizedData,
          suggestedFields,
          fieldSources,
          validation.missingFields
        );
      } else {
        return createClarificationResponse(
          validation.missingFields,
          extractionResult.suggestedQuestions.length > 0
            ? extractionResult.suggestedQuestions
            : validation.missingFields.map(
                (field) => `Could you provide more details about ${field}?`
              )
        );
      }
    }

    // Step 4: Data is complete, generate SOP
    try {
      const sopResult = await generateSOP(
        normalizedData,
        auth.knowledgeBase,
        openai,
        jobAnalysis || null  // Pass job analysis context if available
      );

      // Step 5: Return success response with action
      const action = {
        formData: normalizedData,
        sop: {
          sopHtml: sopResult.sopHtml,
          sopMarkdown: sopResult.sopMarkdown,
          metadata: sopResult.metadata,
        },
        kbDefaultsUsed: extractionResult.kbDefaultsUsed,
        fieldSources: extractionResult.fieldSources || {},
        isDraft: false,
      };

      // Determine response message
      let assistantMessage: string;
      if (isEditRequest || isRefinement) {
        assistantMessage = `I've updated and regenerated the SOP based on your changes. Here's your revised Standard Operating Procedure:`;
      } else {
        assistantMessage = `I've generated a comprehensive Standard Operating Procedure based on your process description. The SOP includes step-by-step instructions, quality gates, escalation rules, and performance metrics.`;
      }

      return createSuccessResponse(
        assistantMessage,
        action,
        extractionResult.kbDefaultsUsed.length > 0
          ? [
              `Used organization defaults for: ${extractionResult.kbDefaultsUsed.join(", ")}`,
            ]
          : undefined
      );
    } catch (sopError) {
      console.error("[Process Builder] SOP generation error:", sopError);
      return createErrorResponse(
        "Failed to generate SOP",
        sopError instanceof Error
          ? sopError.message
          : "An unexpected error occurred during SOP generation"
      );
    }
  } catch (error) {
    console.error("[Process Builder] Handler error:", error);
    return createErrorResponse(
      "Failed to process process builder request",
      error instanceof Error ? error.message : "An unexpected error occurred"
    );
  }
}

/**
 * Normalizes extracted data to match SOP form expectations.
 * Handles string normalization and type conversions.
 */
function normalizeExtractedDataForSOP(data: Record<string, any>): Record<string, any> {
  const normalized = { ...data };

  // Normalize all text fields to strings
  const textFields = [
    "sopTitle",
    "processOverview",
    "primaryRole",
    "mainSteps",
    "toolsUsed",
    "frequency",
    "trigger",
    "successCriteria",
    "department",
    "estimatedTime",
    "decisionPoints",
    "commonMistakes",
    "requiredResources",
    "supportingRoles",
    "qualityStandards",
    "complianceRequirements",
    "relatedProcesses",
    "tipsBestPractices",
    "additionalContext",
  ];

  textFields.forEach((field) => {
    if (normalized[field] === undefined || normalized[field] === null) {
      normalized[field] = "";
    } else if (typeof normalized[field] !== "string") {
      // Handle arrays (e.g., if mainSteps comes as array)
      if (Array.isArray(normalized[field])) {
        normalized[field] = normalized[field].join("\n");
      } else {
        normalized[field] = String(normalized[field]);
      }
    }
  });

  // Ensure frequency is a valid option
  if (normalized.frequency && typeof normalized.frequency === "string") {
    const validFrequencies = ["Daily", "Weekly", "Monthly", "Quarterly", "As-needed", "One-time"];
    if (!validFrequencies.includes(normalized.frequency)) {
      // Try to match partial
      const matched = validFrequencies.find(f => 
        f.toLowerCase().includes(normalized.frequency.toLowerCase()) ||
        normalized.frequency.toLowerCase().includes(f.toLowerCase())
      );
      if (matched) {
        normalized.frequency = matched;
      } else {
        normalized.frequency = "As-needed"; // Default
      }
    }
  }

  return normalized;
}

/**
 * Handles refinement of an existing SOP based on chat conversation.
 */
async function handleSOPRefinement(
  openai: OpenAI,
  request: ToolChatRequest,
  existingSOP: any,
  existingFormData: any,
  auth: AuthResult
): Promise<ToolChatResponse> {
  try {
    // Get the existing SOP content
    const existingSOPHtml = existingSOP.sopHtml || "";
    const existingSOPMarkdown = existingSOP.sopMarkdown || "";
    const existingMetadata = existingSOP.metadata || {};

    if (!existingSOPHtml && !existingSOPMarkdown) {
      return createErrorResponse(
        "No SOP content found",
        "The existing SOP does not have content to refine."
      );
    }

    // Get the last user message (refinement request)
    const lastUserMessage = request.conversation
      .filter(m => m.role === "user")
      .slice(-1)[0]?.content || "";

    if (!lastUserMessage.trim()) {
      return createErrorResponse(
        "No refinement request provided",
        "Please describe what you'd like to change in the SOP."
      );
    }

    // Build system prompt for refinement
    const systemPrompt = buildSOPRefinementSystemPrompt(
      existingSOPHtml || existingSOPMarkdown,
      existingFormData
    );

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

    // Call OpenAI to refine the SOP
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: refinementConversation,
      temperature: 0.7,
      max_tokens: 16384, // Maximum for gpt-4o to handle large SOPs
    });

    const responseText = completion.choices[0].message.content;
    const finishReason = completion.choices[0].finish_reason;

    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    // Check if response was truncated
    if (finishReason === "length") {
      console.error("[Process Builder] Response truncated - max_tokens limit reached");
      console.error("[Process Builder] Response length:", responseText.length);
      return createErrorResponse(
        "Response too large",
        "The SOP is too large to refine in one pass. Please try refining specific sections instead of the entire SOP, or be more specific about which parts you want to change."
      );
    }

    // Extract markdown from response (handle code blocks if present)
    let refinedMarkdown = responseText.trim();
    
    // Remove markdown code blocks if present
    if (refinedMarkdown.includes("```markdown")) {
      const markdownMatch = refinedMarkdown.match(/```markdown\s*([\s\S]*?)\s*```/);
      if (markdownMatch && markdownMatch[1]) {
        refinedMarkdown = markdownMatch[1].trim();
      }
    } else if (refinedMarkdown.includes("```")) {
      const codeMatch = refinedMarkdown.match(/```\s*([\s\S]*?)\s*```/);
      if (codeMatch && codeMatch[1]) {
        refinedMarkdown = codeMatch[1].trim();
      }
    }

    // Convert refined markdown to HTML
    let refinedHtml: string;
    try {
      refinedHtml = await markdownToHtml(refinedMarkdown);
    } catch (htmlError) {
      console.error("[Process Builder] HTML conversion error:", htmlError);
      // Fallback: use existing HTML if conversion fails
      refinedHtml = existingSOPHtml;
    }

    // Return success response with refined SOP
    const action = {
      refinedSOP: {
        sopHtml: refinedHtml,
        sopMarkdown: refinedMarkdown,
        metadata: existingMetadata,
      },
      formData: existingFormData,
      isRefinement: true,
    };

    const assistantMessage = `I've updated the SOP based on your feedback. Here's your revised Standard Operating Procedure:`;

    return createSuccessResponse(
      assistantMessage,
      action,
      undefined
    );
  } catch (error) {
    console.error("[Process Builder] Refinement error:", error);
    return createErrorResponse(
      "Failed to refine SOP",
      error instanceof Error ? error.message : "An unexpected error occurred during refinement"
    );
  }
}

/**
 * Builds the system prompt for SOP refinement.
 */
function buildSOPRefinementSystemPrompt(currentSOPContent: string, formData: any): string {
  return `You are an expert Standard Operating Procedure (SOP) refinement assistant for Level 9 Virtual. You help refine SOPs based on conversational feedback.

# Current SOP Content
${currentSOPContent}

# Original Form Data (for reference)
${JSON.stringify(formData, null, 2)}

# Your Role
- Listen to the user's refinement requests in natural conversation
- Make ONLY the changes they request
- Maintain all other content exactly as is
- Ensure changes are consistent across related sections
- Return the COMPLETE updated SOP in markdown format

# Rules for Changes
1. **Removal requests**: If user says "remove X" or "don't need X", remove ALL references from the SOP
2. **Additions**: If user says "add Z", integrate it naturally into relevant sections
3. **Modifications**: If user says "change Y to X", update the specific content
4. **Emphasis changes**: If user says "focus more on Y", increase prominence of Y in relevant sections
5. **Maintain structure**: Keep the same SOP structure and formatting
6. **Maintain consistency**: Changes should cascade logically across related sections

# Response Format
Return ONLY the refined SOP markdown content. Do NOT wrap it in code fences. Return the raw markdown text directly without any code block markers.

CRITICAL: Return the COMPLETE SOP markdown. Do not truncate any sections. Maintain the exact same structure and formatting as the original, only modifying the parts that need to be changed based on the user's feedback.`;
}
