import OpenAI from "openai";
import type { ToolChatRequest, ToolChatResponse } from "@/lib/tool-chat/types";
import type { AuthResult } from "@/lib/tool-chat/utils";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/tool-chat/utils";
import {
  runJDAnalysisPipeline,
  normalizeTasks,
  normalizeStringArray,
} from "@/lib/jd-analysis/pipeline";

/**
 * Handler for Role Builder tool chat.
 *
 * Flow:
 * - If context contains existingAnalysis (refinement): run handleRefinement (one LLM call).
 * - Otherwise (Generate with AI): build minimal intake from user prompt (one light LLM call),
 *   run JD pipeline, return analysis. No full form extraction or form-field mapping.
 */
export async function handleRoleBuilder(
  request: ToolChatRequest,
  auth: AuthResult,
): Promise<ToolChatResponse> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const context = request.context as any;
    const existingAnalysis = context?.existingAnalysis;
    const existingIntakeData = context?.existingIntakeData;
    const isRefinementMode = !!existingAnalysis;

    if (isRefinementMode && existingAnalysis) {
      return await handleRefinement(
        openai,
        request,
        existingAnalysis,
        existingIntakeData || {},
        auth,
      );
    }

    // Generate with AI: minimal intake → pipeline → return analysis (optional onProgress for streaming)
    return runRoleBuilderGenerateWithProgress(request, auth, openai, undefined);
  } catch (error) {
    console.error("[Role Builder] Handler error:", error);
    return createErrorResponse(
      "Failed to process role builder request",
      error instanceof Error ? error.message : "An unexpected error occurred",
    );
  }
}

/**
 * Generate-with-AI path with optional progress callback (for streaming).
 * Used by handleRoleBuilder (onProgress undefined) and by tool-chat route when streaming.
 */
export async function runRoleBuilderGenerateWithProgress(
  request: ToolChatRequest,
  auth: AuthResult,
  openai: OpenAI,
  onProgress?: (stage: string) => void,
): Promise<ToolChatResponse> {
  const lastUserContent =
    request.conversation
      .filter((m: { role: string }) => m.role === "user")
      .slice(-1)[0]?.content?.trim() || "";

  if (!lastUserContent) {
    return createErrorResponse(
      "No message provided",
      "Please describe the role you need (e.g. I need a social media manager).",
    );
  }

  onProgress?.("Preparing your role description...");
  const minimalIntake = await buildMinimalIntakeFromPrompt(
    openai,
    lastUserContent,
    auth.knowledgeBase,
  );

  const analysisResult = await runJDAnalysisPipeline(
    minimalIntake,
    null,
    auth.knowledgeBase,
    null,
    onProgress,
  );

  const formData = minimalIntakeToFormData(minimalIntake, auth.knowledgeBase);

  const action = {
    analysis: analysisResult,
    formData,
    isDraft: false,
  };

  return createSuccessResponse(
    "I've generated a job description analysis based on your request. You can apply it below or refine it using Refine Analysis.",
    action,
    undefined,
  );
}

/**
 * One lightweight LLM call: user prompt → minimal JSON for pipeline.
 * No full form schema or field-by-field extraction.
 */
async function buildMinimalIntakeFromPrompt(
  openai: OpenAI,
  userMessage: string,
  knowledgeBase: any | null,
): Promise<any> {
  const kbHint = knowledgeBase?.businessName
    ? `If the user doesn't specify a company, use "${knowledgeBase.businessName}".`
    : "If the user doesn't specify a company, use a generic placeholder like 'Company'.";
  const defaultHours = knowledgeBase?.defaultWeeklyHours
    ? String(knowledgeBase.defaultWeeklyHours)
    : "40";

  const prompt = `The user wants to create a job description. They said: "${userMessage}"

${kbHint}
Default weekly hours if not specified: ${defaultHours}

Output JSON only, no markdown:
{
  "company_name": "string (business/company name)",
  "role_summary": "one short phrase (e.g. Social Media Manager)",
  "tasks": ["task 1", "task 2", ...] (1-5 concrete tasks inferred from their message)",
  "outcome_90d": "one sentence 90-day outcome",
  "weekly_hours": number
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You output minimal JSON for a job description intake. Be concise. Infer tasks from the user's role description.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 500,
  });

  const raw = completion.choices[0].message.content;
  if (!raw) throw new Error("Empty response from minimal intake");

  let parsed: { company_name?: string; role_summary?: string; tasks?: string[]; outcome_90d?: string; weekly_hours?: number };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON from minimal intake");
  }

  const tasks = Array.isArray(parsed.tasks)
    ? parsed.tasks.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean).slice(0, 5)
    : [];
  if (tasks.length === 0) {
    tasks.push(parsed.role_summary?.trim() || userMessage.slice(0, 200));
  }

  const normalizedTasks = normalizeTasks(tasks);
  const companyName =
    (typeof parsed.company_name === "string" && parsed.company_name.trim()) ||
    knowledgeBase?.businessName ||
    "Company";
  const weeklyHours = Number(parsed.weekly_hours) || Number(defaultHours) || 40;

  return {
    brand: { name: companyName },
    tasks_top5: normalizedTasks,
    outcome_90d: typeof parsed.outcome_90d === "string" ? parsed.outcome_90d.trim() : "",
    weekly_hours: weeklyHours,
    tools: [],
    requirements: [],
    client_facing: true,
    business_goal: knowledgeBase?.primaryGoal || "",
    english_level: knowledgeBase?.defaultEnglishLevel || "Excellent",
    existing_sops: "No",
    reporting_expectations: "",
    management_style: knowledgeBase?.defaultManagementStyle || "Async",
    security_needs: "",
    deal_breakers: "",
    nice_to_have_skills: "",
  };
}

/**
 * Map minimal pipeline intake to form-like shape for UI (businessName, tasks, outcome90Day, weeklyHours).
 */
function minimalIntakeToFormData(
  intake: any,
  knowledgeBase: any | null,
): Record<string, any> {
  return {
    businessName: intake.brand?.name || knowledgeBase?.businessName || "",
    tasks: Array.isArray(intake.tasks_top5) ? intake.tasks_top5 : [],
    outcome90Day: intake.outcome_90d || "",
    weeklyHours: String(intake.weekly_hours ?? knowledgeBase?.defaultWeeklyHours ?? "40"),
    clientFacing: "Yes",
    tools: "",
    requirements: [],
    existingSOPs: "No",
    reportingExpectations: "",
    managementStyle: knowledgeBase?.defaultManagementStyle || "Async",
    securityNeeds: "",
    dealBreakers: "",
    niceToHaveSkills: "",
  };
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

