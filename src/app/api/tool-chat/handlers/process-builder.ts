import OpenAI from "openai";
import type { ToolChatRequest, ToolChatResponse } from "@/lib/tool-chat/types";
import type { AuthResult } from "@/lib/tool-chat/utils";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/tool-chat/utils";
import { generateSOP } from "@/lib/sop-generation/generate-sop";
import { markdownToHtml } from "@/lib/extraction/markdown-to-html";

const VALID_FREQUENCIES = ["Daily", "Weekly", "Monthly", "Quarterly", "As-needed", "One-time"];

/**
 * Handler for Process Builder tool chat.
 *
 * Flow:
 * - If context contains existingSOP (refinement): run handleSOPRefinement.
 * - Otherwise (Generate with AI): build minimal intake from user prompt (one light LLM call),
 *   then generateSOP. No full form extraction or validation.
 */
export async function handleProcessBuilder(
  request: ToolChatRequest,
  auth: AuthResult
): Promise<ToolChatResponse> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const context = request.context as any;
    const existingSOP = context?.existingSOP;
    const existingFormData = context?.existingFormData;
    const isRefinementMode = !!existingSOP;

    if (isRefinementMode && existingSOP) {
      return await handleSOPRefinement(
        openai,
        request,
        existingSOP,
        existingFormData || {},
        auth
      );
    }

    return runProcessBuilderGenerateWithProgress(request, auth, openai, undefined);
  } catch (error) {
    console.error("[Process Builder] Handler error:", error);
    return createErrorResponse(
      "Failed to process process builder request",
      error instanceof Error ? error.message : "An unexpected error occurred"
    );
  }
}

/**
 * Generate-with-AI path with optional progress callback (for streaming).
 * Builds minimal intake from user message, then calls generateSOP.
 */
export async function runProcessBuilderGenerateWithProgress(
  request: ToolChatRequest,
  auth: AuthResult,
  openai: OpenAI,
  onProgress?: (stage: string) => void
): Promise<ToolChatResponse> {
  const lastUserContent =
    request.conversation
      .filter((m: { role: string }) => m.role === "user")
      .slice(-1)[0]?.content?.trim() || "";

  if (!lastUserContent) {
    return createErrorResponse(
      "No message provided",
      "Please describe the process you want to document (e.g. How we onboard new clients)."
    );
  }

  // Job analysis context (if linked from role-builder)
  const context = request.context as any;
  const jobAnalysisId = context?.jobAnalysisId;
  const linkedJobAnalysis = context?.linkedJobAnalysis;
  let jobAnalysis: { analysis: any; intakeData?: any } | null = null;
  if (linkedJobAnalysis) {
    jobAnalysis = {
      analysis: linkedJobAnalysis.analysis,
      intakeData: linkedJobAnalysis.intakeData || {},
    };
  } else if (jobAnalysisId) {
    try {
      const { prisma } = await import("@/lib/core/prisma");
      const savedAnalysis = await prisma.savedAnalysis.findUnique({
        where: { id: jobAnalysisId },
        select: { analysis: true, intakeData: true },
      });
      if (savedAnalysis?.analysis) {
        jobAnalysis = {
          analysis: savedAnalysis.analysis,
          intakeData: savedAnalysis.intakeData || {},
        };
      }
    } catch (err) {
      console.error("[Process Builder] Error fetching job analysis:", err);
    }
  }

  onProgress?.("Preparing your SOP...");
  const minimalIntake = await buildMinimalIntakeFromPrompt(
    openai,
    lastUserContent,
    auth.knowledgeBase
  );

  onProgress?.("Generating SOP...");
  const sopResult = await generateSOP(
    minimalIntake,
    auth.knowledgeBase,
    openai,
    jobAnalysis || null
  );

  const formData = minimalIntakeToFormData(minimalIntake, auth.knowledgeBase);
  const action = {
    formData,
    sop: {
      sopHtml: sopResult.sopHtml,
      sopMarkdown: sopResult.sopMarkdown,
      metadata: sopResult.metadata,
    },
    isDraft: false,
  };

  return createSuccessResponse(
    "I've generated a Standard Operating Procedure based on your description. You can apply it below or refine it using Refine.",
    action,
    undefined
  );
}

/**
 * One lightweight LLM call: user prompt → minimal SOP form fields.
 * Uses gpt-4o-mini for speed.
 */
async function buildMinimalIntakeFromPrompt(
  openai: OpenAI,
  userMessage: string,
  knowledgeBase: any | null
): Promise<Record<string, any>> {
  const toolsHint =
    knowledgeBase?.toolStack && Array.isArray(knowledgeBase.toolStack) && knowledgeBase.toolStack.length > 0
      ? `If the user doesn't specify tools, consider: ${knowledgeBase.toolStack.slice(0, 5).join(", ")}.`
      : "Infer tools from the process description if not specified.";

  const prompt = `The user wants to create a Standard Operating Procedure. They said: "${userMessage}"

${toolsHint}

Output JSON only, no markdown:
{
  "sopTitle": "short process name (e.g. Client Onboarding Process)",
  "processOverview": "2-3 sentences on what this process accomplishes",
  "primaryRole": "who performs it (e.g. Operations Coordinator)",
  "mainSteps": "numbered or bullet steps, one per line - 3-7 main steps",
  "toolsUsed": "comma-separated or newline list of tools/software",
  "frequency": "one of: Daily, Weekly, Monthly, Quarterly, As-needed, One-time",
  "trigger": "what starts this process (e.g. New signup, End of month)",
  "successCriteria": "how we know it's done correctly (2-3 points)"
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You output minimal JSON for an SOP intake. Be concise. Infer steps and details from the user's process description.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 600,
  });

  const raw = completion.choices[0].message.content;
  if (!raw) throw new Error("Empty response from minimal SOP intake");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON from minimal SOP intake");
  }

  const toStr = (v: unknown): string =>
    v == null ? "" : Array.isArray(v) ? v.map((x) => String(x)).join("\n") : String(v);

  let frequency = toStr(parsed.frequency).trim();
  if (!VALID_FREQUENCIES.includes(frequency)) {
    const lower = frequency.toLowerCase();
    const match = VALID_FREQUENCIES.find(
      (f) => f.toLowerCase() === lower || f.toLowerCase().includes(lower) || lower.includes(f.toLowerCase())
    );
    frequency = match || "As-needed";
  }

  return {
    sopTitle: toStr(parsed.sopTitle).trim() || "SOP",
    processOverview: toStr(parsed.processOverview).trim(),
    primaryRole: toStr(parsed.primaryRole).trim() || "Process Performer",
    mainSteps: toStr(parsed.mainSteps).trim(),
    toolsUsed: toStr(parsed.toolsUsed).trim(),
    frequency,
    trigger: toStr(parsed.trigger).trim(),
    successCriteria: toStr(parsed.successCriteria).trim(),
    department: "",
    estimatedTime: "",
    decisionPoints: "",
    commonMistakes: "",
    requiredResources: "",
    supportingRoles: "",
    qualityStandards: "",
    complianceRequirements: "",
    relatedProcesses: "",
    tipsBestPractices: "",
    additionalContext: "",
  };
}

function minimalIntakeToFormData(
  intake: Record<string, any>,
  knowledgeBase: any | null
): Record<string, any> {
  return {
    ...intake,
    // Ensure all optional fields exist for UI
    department: intake.department ?? "",
    estimatedTime: intake.estimatedTime ?? "",
    decisionPoints: intake.decisionPoints ?? "",
    commonMistakes: intake.commonMistakes ?? "",
    requiredResources: intake.requiredResources ?? "",
    supportingRoles: intake.supportingRoles ?? "",
    qualityStandards: intake.qualityStandards ?? "",
    complianceRequirements: intake.complianceRequirements ?? "",
    relatedProcesses: intake.relatedProcesses ?? "",
    tipsBestPractices: intake.tipsBestPractices ?? "",
    additionalContext: intake.additionalContext ?? "",
  };
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
