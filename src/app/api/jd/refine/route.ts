import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RefineRequestBody {
  userId: string;
  analysisId?: string;
  message: string;
}

export async function POST(req: NextRequest) {
  try {
    // Get user from session
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Invalid token." },
        { status: 401 }
      );
    }

    const { userId, message, analysisId }: RefineRequestBody = await req.json();

    if (!message?.trim() || !analysisId) {
      return NextResponse.json(
        {
          success: false,
          error: "Message and analysisId are required",
        },
        { status: 400 }
      );
    }

    // Get user's organizations to verify access
    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null,
        },
      },
      select: {
        id: true,
      },
    });

    if (userOrganizations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User does not belong to any active organization.",
        },
        { status: 403 }
      );
    }

    const userOrganizationIds = userOrganizations.map((uo) => uo.id);

    const savedAnalysis = await prisma.savedAnalysis.findFirst({
      where: {
        ...(analysisId ? { id: analysisId } : {}),
        ...(analysisId ? {} : { 
          userOrganizationId: { in: userOrganizationIds },
        }),
      },
      include: {
        refinements: {
          orderBy: { sequenceNumber: "asc" },
        },
        userOrganization: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
      orderBy: analysisId ? undefined : { createdAt: "desc" },
    });

    if (!savedAnalysis) {
      return NextResponse.json(
        { success: false, error: "Analysis not found" },
        { status: 404 }
      );
    }

    // if (savedAnalysis.isFinalized) {
    //   return NextResponse.json(
    //     { success: false, error: "Cannot refine a finalized analysis" },
    //     { status: 400 }
    //   );
    // }

    // 2. Build conversation context for AI
    const conversationHistory = [
      {
        role: "system" as const,
        content: buildSystemPrompt(
          savedAnalysis.analysis,
          savedAnalysis.intakeData
        ),
      },
      // Add all previous refinement messages for full context
      ...savedAnalysis.refinements.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      // Add new user message
      {
        role: "user" as const,
        content: message,
      },
    ];

    // 3. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: conversationHistory,
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4000,
    });

    const responseText = completion.choices[0].message.content;
    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    const updatedAnalysis = JSON.parse(responseText);

    // Clean team_support_areas for Dedicated VA before processing
    const serviceType = 
      updatedAnalysis.preview?.service_type ||
      updatedAnalysis.full_package?.service_structure?.service_type ||
      updatedAnalysis.full_package?.executive_summary?.service_recommendation?.type;

    if (serviceType === "Dedicated VA") {
      // Remove team_support_areas from preview
      if (updatedAnalysis.preview?.team_support_areas !== undefined) {
        delete updatedAnalysis.preview.team_support_areas;
      }

      // Remove from full_package.service_structure
      if (updatedAnalysis.full_package?.service_structure?.team_support_areas !== undefined) {
        delete updatedAnalysis.full_package.service_structure.team_support_areas;
      }

      // Also check if it's directly in full_package
      if (updatedAnalysis.full_package?.team_support_areas !== undefined) {
        delete updatedAnalysis.full_package.team_support_areas;
      }
    }

    // 4. Detect what changed
    const changedSections = identifyChanges(
      savedAnalysis.analysis,
      updatedAnalysis
    );

    // 5. Generate change summary
    const changeSummary = generateChangeSummary(changedSections);

    // 6. Get next sequence number
    const nextSequence = savedAnalysis.refinements.length + 1;

    // 7. Save both messages (user + assistant) + update analysis in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Verify user has access
      if (!userOrganizationIds.includes(savedAnalysis.userOrganizationId)) {
        throw new Error("You do not have access to this analysis.");
      }

      // Save user message
      await tx.refinementMessage.create({
        data: {
          analysisId: savedAnalysis.id,
          userOrganizationId: savedAnalysis.userOrganizationId,
          role: "user",
          content: message,
          changedSections: [],
          sequenceNumber: nextSequence,
          analysisSnapshot: savedAnalysis.analysis as any,
        },
      });

      // Save assistant message
      await tx.refinementMessage.create({
        data: {
          analysisId: savedAnalysis.id,
          userOrganizationId: savedAnalysis.userOrganizationId,
          role: "assistant",
          content: responseText,
          changedSections,
          sequenceNumber: nextSequence + 1,
          analysisSnapshot: updatedAnalysis as any,
        },
      });

      // Update SavedAnalysis with latest state (for POST handler - keeping original behavior)
      const updated = await tx.savedAnalysis.update({
        where: { id: savedAnalysis.id },
        data: {
          analysis: updatedAnalysis,
          updatedAt: new Date(),
        },
        include: {
          refinements: {
            orderBy: { sequenceNumber: "asc" },
          },
        },
      });

      return updated;
    });

    // Clean team_support_areas for Dedicated VA in the response
    const cleanedAnalysis = JSON.parse(JSON.stringify(result.analysis)); // Deep clone
    const postServiceType = 
      cleanedAnalysis.preview?.service_type ||
      cleanedAnalysis.full_package?.service_structure?.service_type ||
      cleanedAnalysis.full_package?.executive_summary?.service_recommendation?.type;

    if (postServiceType === "Dedicated VA") {
      if (cleanedAnalysis.preview?.team_support_areas !== undefined) {
        delete cleanedAnalysis.preview.team_support_areas;
      }
      if (cleanedAnalysis.full_package?.service_structure?.team_support_areas !== undefined) {
        delete cleanedAnalysis.full_package.service_structure.team_support_areas;
      }
      if (cleanedAnalysis.full_package?.team_support_areas !== undefined) {
        delete cleanedAnalysis.full_package.team_support_areas;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        messages: result.refinements,
        updatedAnalysis: cleanedAnalysis,
        changedSections,
        changedSectionNames: changeSummary.sections,
        summary: changeSummary.summary,
        timestamp: result.updatedAt.toISOString(),
        tokensUsed: completion.usage?.total_tokens || 0,
      },
    });
  } catch (error) {
    console.error("Refinement error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to refine job description";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to refine analysis",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// VALIDATION LAYER: Assess feedback quality before processing
// ============================================================================

async function validateFeedback(
  openai: OpenAI,
  feedback: string,
  refinementAreas: string[],
  originalPackage: any
) {
  const validationPrompt = `You are a feedback quality validator. Assess if the provided feedback is actionable and relevant.

ORIGINAL PACKAGE CONTEXT:
Service Type: ${originalPackage?.executive_summary?.service_recommendation?.type || originalPackage?.service_structure?.service_type || "Unknown"}
Role: ${originalPackage?.detailed_specifications?.core_va_jd?.title || originalPackage?.service_structure?.core_va_role?.title || originalPackage?.detailed_specifications?.projects?.[0]?.project_name || "Unknown"}

CLIENT FEEDBACK:
"${feedback}"

REFINEMENT AREAS REQUESTED:
${JSON.stringify(refinementAreas, null, 2)}

Assess the feedback quality and respond with JSON:

{
  "is_valid": true or false,
  "quality_score": 1-10,
  "feedback_type": "substantive | vague | irrelevant | spam",
  "concerns": [
    "Specific issues with the feedback if any"
  ],
  "actionable_points": [
    "Extract specific, actionable points from the feedback"
  ],
  "clarification_needed": [
    {
      "question": "What to ask client for clarity",
      "why": "Why this matters for refinement"
    }
  ],
  "recommendation": "proceed | request_clarification | reject"
}

VALIDATION RULES:
- "test", gibberish, or single-word inputs = INVALID (spam)
- Vague statements without context = request_clarification
- Specific concerns or requested changes = VALID (proceed)
- Feedback unrelated to the package = INVALID (irrelevant)`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a feedback quality validator." },
      { role: "user", content: validationPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 1000,
  });

  return JSON.parse(completion.choices[0].message.content || "{}");
}

// PATCH handler for RefinementForm structured feedback
interface RefinementFormRequest {
  analysisId: string;
  userId: string;
  feedback: string;
  refinement_areas: string[];
}

export async function PATCH(req: NextRequest) {
  try {
    // Get user from session
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Invalid token." },
        { status: 401 }
      );
    }

    const {
      analysisId,
      userId,
      feedback,
      refinement_areas,
    }: RefinementFormRequest = await req.json();

    if (!feedback?.trim() || !analysisId) {
      return NextResponse.json(
        {
          success: false,
          error: "Feedback and analysisId are required",
        },
        { status: 400 }
      );
    }

    if (!refinement_areas || refinement_areas.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one refinement area must be selected",
        },
        { status: 400 }
      );
    }

    // Get user's organizations to verify access
    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null,
        },
      },
      select: {
        id: true,
      },
    });

    if (userOrganizations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User does not belong to any active organization.",
        },
        { status: 403 }
      );
    }

    const userOrganizationIds = userOrganizations.map((uo) => uo.id);

    // Get the original/parent analysis
    const parentAnalysis = await prisma.savedAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        refinements: {
          orderBy: { sequenceNumber: "asc" },
        },
        userOrganization: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    // If analysis doesn't exist
    if (!parentAnalysis) {
      return NextResponse.json(
        {
          success: false,
          error: "Analysis not found. Please save your analysis first.",
        },
        { status: 404 }
      );
    }

    // Verify user has access to this analysis
    if (!userOrganizationIds.includes(parentAnalysis.userOrganizationId)) {
      return NextResponse.json(
        {
          success: false,
          error: "You do not have access to this analysis.",
        },
        { status: 403 }
      );
    }

    // Get the latest refined version separately
    // Note: Using 'as any' because Prisma client may need regeneration after schema changes
    const latestRefinedVersion = await prisma.savedAnalysis.findFirst({
      where: {
        parentAnalysisId: analysisId,
      } as any,
      orderBy: { versionNumber: 'desc' } as any,
      take: 1,
    });

    // Use parentAnalysis as savedAnalysis for the rest of the logic
    const savedAnalysis = parentAnalysis;

    const originalPackage = (savedAnalysis.analysis as any)?.full_package;
    if (!originalPackage) {
      return NextResponse.json(
        {
          success: false,
          error: "Original package not found in analysis",
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // STEP 1: Validate feedback quality
    // ========================================================================
    console.log("Validating feedback quality...");
    const validation = await validateFeedback(
      openai,
      feedback,
      refinement_areas,
      originalPackage
    );

    // Handle invalid feedback
    if (validation.recommendation === "reject") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid feedback",
          feedback_type: validation.feedback_type,
          concerns: validation.concerns,
          message:
            validation.feedback_type === "spam"
              ? "Please provide meaningful feedback about the analysis."
              : "The feedback provided doesn't appear to be relevant to this analysis. Please provide specific concerns or changes you'd like to see.",
        },
        { status: 400 }
      );
    }

    // Request clarification if feedback is vague
    if (validation.recommendation === "request_clarification") {
      return NextResponse.json(
        {
          status: "clarification_needed",
          message: "Your feedback needs more detail. Please clarify:",
          questions: validation.clarification_needed || [],
          quality_score: validation.quality_score,
        },
        { status: 200 } // Not an error, just needs more info
      );
    }

    // Validation passed - proceed with refinement
    console.log(`Feedback validation passed. Quality score: ${validation.quality_score}, Type: ${validation.feedback_type}`);

    // ========================================================================
    // STEP 2: Build structured message from RefinementForm data
    // ========================================================================
    const areasText = refinement_areas
      .map((area) => {
        const labels: Record<string, string> = {
          service_type: "Service Type",
          role_title: "Role Title",
          responsibilities: "Responsibilities",
          kpis: "KPIs",
          hours: "Weekly Hours",
          tools: "Tools Required",
          timeline: "Timeline & Onboarding",
          team_support: "Team Support Areas",
          outcomes: "90-Day Outcomes",
        };
        return labels[area] || area;
      })
      .join(", ");

    // Use actionable points from validation if available, otherwise use original feedback
    const feedbackToUse = validation.actionable_points && validation.actionable_points.length > 0
      ? validation.actionable_points.join("\n")
      : feedback;
    
    const message = `Please refine the following areas: ${areasText}.\n\nFeedback: ${feedbackToUse}`;

    // ========================================================================
    // STEP 3: Build conversation context and perform refinement
    // ========================================================================
    // Build conversation context
    const conversationHistory = [
      {
        role: "system" as const,
        content: buildSystemPrompt(
          savedAnalysis.analysis,
          savedAnalysis.intakeData
        ),
      },
      ...savedAnalysis.refinements.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: message,
      },
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: conversationHistory,
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 16000, // Increased significantly to handle full analysis package
    });

    const responseText = completion.choices[0].message.content;
    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    // Check if response was truncated
    const finishReason = completion.choices[0].finish_reason;
    if (finishReason === "length") {
      console.error("OpenAI response was truncated due to token limit");
      throw new Error("The analysis is too large to refine in one pass. Please try refining smaller sections at a time.");
    }

    // Parse JSON with better error handling
    let updatedAnalysis;
    try {
      // Validate JSON structure before parsing
      const trimmedResponse = responseText.trim();
      
      // Check if response looks complete (starts with { and ends with })
      if (!trimmedResponse.startsWith('{') || !trimmedResponse.endsWith('}')) {
        console.error("Response doesn't appear to be valid JSON object");
        console.error("Response length:", trimmedResponse.length);
        console.error("Finish reason:", finishReason);
        console.error("First 200 chars:", trimmedResponse.substring(0, 200));
        console.error("Last 200 chars:", trimmedResponse.substring(Math.max(0, trimmedResponse.length - 200)));
        throw new Error("OpenAI response is incomplete or malformed. The analysis may be too large to refine in one pass.");
      }

      updatedAnalysis = JSON.parse(trimmedResponse);
      
      // Validate that we got the expected structure
      if (!updatedAnalysis.preview && !updatedAnalysis.full_package) {
        console.error("Response doesn't contain expected analysis structure");
        console.error("Response keys:", Object.keys(updatedAnalysis));
        throw new Error("OpenAI response doesn't contain the expected analysis structure.");
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Response length:", responseText.length);
      console.error("Finish reason:", finishReason);
      console.error("Response preview (first 500 chars):", responseText.substring(0, 500));
      console.error("Response preview (last 500 chars):", responseText.substring(Math.max(0, responseText.length - 500)));
      throw new Error(`Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`);
    }

    // Clean team_support_areas for Dedicated VA before processing
    const serviceType = 
      updatedAnalysis.preview?.service_type ||
      updatedAnalysis.full_package?.service_structure?.service_type ||
      updatedAnalysis.full_package?.executive_summary?.service_recommendation?.type;

    if (serviceType === "Dedicated VA") {
      // Remove team_support_areas from preview
      if (updatedAnalysis.preview?.team_support_areas !== undefined) {
        delete updatedAnalysis.preview.team_support_areas;
      }

      // Remove from full_package.service_structure
      if (updatedAnalysis.full_package?.service_structure?.team_support_areas !== undefined) {
        delete updatedAnalysis.full_package.service_structure.team_support_areas;
      }

      // Also check if it's directly in full_package
      if (updatedAnalysis.full_package?.team_support_areas !== undefined) {
        delete updatedAnalysis.full_package.team_support_areas;
      }
    }

    // Detect changes
    const changedSections = identifyChanges(
      savedAnalysis.analysis,
      updatedAnalysis
    );

    // Determine version number
    const nextVersion = latestRefinedVersion 
      ? (latestRefinedVersion as any).versionNumber + 1
      : 2;

    // Get next sequence number for refinement messages (on parent)
    const nextSequence = savedAnalysis.refinements.length + 1;

    // Save messages and create new version
    const result = await prisma.$transaction(async (tx) => {
      // Save user message on parent analysis
      await tx.refinementMessage.create({
        data: {
          analysisId: parentAnalysis.id,
          userOrganizationId: parentAnalysis.userOrganizationId,
          role: "user",
          content: message,
          changedSections: [],
          sequenceNumber: nextSequence,
          analysisSnapshot: savedAnalysis.analysis as any,
        },
      });

      // Save assistant message on parent analysis
      await tx.refinementMessage.create({
        data: {
          analysisId: parentAnalysis.id,
          userOrganizationId: parentAnalysis.userOrganizationId,
          role: "assistant",
          content: responseText,
          changedSections,
          sequenceNumber: nextSequence + 1,
          analysisSnapshot: updatedAnalysis as any,
        },
      });

      // Create refined version (new SavedAnalysis)
      const refinedAnalysis = await tx.savedAnalysis.create({
        data: {
          userOrganizationId: parentAnalysis.userOrganizationId,
          title: parentAnalysis.title,  // Keep same title
          intakeData: parentAnalysis.intakeData as any,
          analysis: updatedAnalysis as any,
          parentAnalysisId: parentAnalysis.id,
          versionNumber: nextVersion,
        } as any,
        include: {
          refinements: {
            orderBy: { sequenceNumber: "asc" },
          },
        },
      });

      return refinedAnalysis;
    });

    // Build changes summary for RefinementForm
    const changes_made = changedSections.map((section) => ({
      section: section.split(".")[0].replace(/_/g, " "),
      change_description: `Updated ${section}`,
    }));

    // Ensure team_support_areas is removed for Dedicated VA in the response
    // (already cleaned above, but double-check before returning)
    const finalResponse = JSON.parse(JSON.stringify(updatedAnalysis)); // Deep clone
    const finalServiceType = 
      finalResponse.preview?.service_type ||
      finalResponse.full_package?.service_structure?.service_type ||
      finalResponse.full_package?.executive_summary?.service_recommendation?.type;

    if (finalServiceType === "Dedicated VA") {
      if (finalResponse.preview?.team_support_areas !== undefined) {
        delete finalResponse.preview.team_support_areas;
      }
      if (finalResponse.full_package?.service_structure?.team_support_areas !== undefined) {
        delete finalResponse.full_package.service_structure.team_support_areas;
      }
      if (finalResponse.full_package?.team_support_areas !== undefined) {
        delete finalResponse.full_package.team_support_areas;
      }
    }

    return NextResponse.json({
      status: "success",
      refined_package: finalResponse,
      iteration: nextVersion,
      changes_made,
      message: `Analysis refined successfully! (Version ${nextVersion})`,
      newAnalysisId: result.id,
    });
  } catch (error) {
    console.error("Refinement PATCH error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to refine analysis";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to refine analysis",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

function buildSystemPrompt(currentAnalysis: any, intakeData: any): string {
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
Return ONLY valid JSON in the SAME structure as the current analysis:
{
  "preview": {
    "summary": {...},
    "service_type": "...",
    "service_confidence": "...",
    "service_reasoning": "...",
    "confidence": "...",
    "key_risks": [...],
    "critical_questions": [...],
    "core_va_title": "...",
    "core_va_hours": "...",
    "team_support_areas": number,
    "primary_outcome": "..."
  },
  "full_package": {
    "service_structure": {...},
    "executive_summary": {...},
    "detailed_specifications": {...},
    "role_architecture": {...},
    "implementation_plan": {...},
    "risk_management": {...},
    "questions_for_you": [...],
    "validation_report": {...},
    "appendix": {...}
  },
  "metadata": {...}
}

Maintain the exact same structure, only modifying the fields that need to be changed based on the user's feedback.

# Conversation Style
- Be conversational and helpful in acknowledging changes
- Explain what you're changing and why
- Ask clarifying questions if the request is ambiguous
- But always return the complete JSON structure

CRITICAL: Return the COMPLETE analysis JSON. Do not truncate any sections.`;
}

// Identify what changed between old and new analysis
function identifyChanges(oldAnalysis: any, newAnalysis: any): string[] {
  const changes: string[] = [];

  const compareObjects = (obj1: any, obj2: any, path = "") => {
    // Handle null/undefined
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

    // Handle arrays
    if (Array.isArray(obj2)) {
      if (
        !Array.isArray(obj1) ||
        JSON.stringify(obj1) !== JSON.stringify(obj2)
      ) {
        changes.push(path);
      }
      return;
    }

    // Handle objects
    if (typeof obj2 === "object") {
      for (const key in obj2) {
        const currentPath = path ? `${path}.${key}` : key;
        compareObjects(obj1?.[key], obj2[key], currentPath);
      }
      return;
    }

    // Handle primitives
    if (obj1 !== obj2 && path) {
      changes.push(path);
    }
  };

  compareObjects(oldAnalysis, newAnalysis);

  // Deduplicate parent paths (if "roles.0.skills" changed, don't also list "roles.0.skills.0")
  return deduplicatePaths(changes);
}

// Remove child paths if parent path is already included
function deduplicatePaths(paths: string[]): string[] {
  const sorted = [...paths].sort((a, b) => a.length - b.length);
  const deduplicated: string[] = [];

  for (const path of sorted) {
    const hasParent = deduplicated.some((parent) =>
      path.startsWith(parent + ".")
    );
    if (!hasParent) {
      deduplicated.push(path);
    }
  }

  return deduplicated;
}

// Generate a human-readable summary of changes
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

  // Group changes by major section
  const sectionGroups: Record<string, string[]> = {};

  changedSections.forEach((path) => {
    const topLevel = path.split(".")[0];
    if (!sectionGroups[topLevel]) {
      sectionGroups[topLevel] = [];
    }
    sectionGroups[topLevel].push(path);
  });

  // Convert section names to human-readable format
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
