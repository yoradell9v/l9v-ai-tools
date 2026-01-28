import type { ToolChatRequest, ToolChatResponse } from "@/lib/tool-chat/types";
import type { AuthResult } from "@/lib/tool-chat/utils";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/tool-chat/utils";
import { extractInsights } from "@/lib/analysis/extractInsights";
import { createLearningEvents } from "@/lib/learning/learning-events";
import { applyLearningEventsToKB } from "@/lib/learning/apply-learning-events";
import { CONFIDENCE_THRESHOLDS } from "@/lib/knowledge-base/insight-confidence-thresholds";

/**
 * Handler for Organization Profile tool chat.
 * 
 * Flow:
 * 1. Extract insights from conversation using extractInsights
 * 2. Create learning events from extracted insights
 * 3. Apply high-confidence learning events to knowledge base (auto-apply ≥80%)
 * 4. Return success response with information about what was learned
 * 
 * This allows users to tell the AI about their business, and the information
 * will be automatically extracted and applied to improve the knowledge base.
 */
export async function handleOrganizationProfile(
  request: ToolChatRequest,
  auth: AuthResult
): Promise<ToolChatResponse> {
  try {
    // Check if user has a knowledge base
    if (!auth.knowledgeBase) {
      return createErrorResponse(
        "Knowledge base not found",
        "Please set up your organization profile first before using this feature."
      );
    }

    // Convert conversation to a format suitable for insight extraction
    // The conversation is already in the request, we just need to format it
    const conversationText = request.conversation
      .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n\n");

    // Step 1: Extract insights from conversation
    let extractedInsights: any[] = [];
    try {
      extractedInsights = await extractInsights(
        "CHAT_CONVERSATION",
        {
          conversation: request.conversation,
          conversationText: conversationText,
          context: "organization knowledge base setup",
        }
      );

      if (extractedInsights.length === 0) {
        return createSuccessResponse(
          "I've received your information. While I couldn't extract specific insights from this conversation, I'm here to help you set up your knowledge base. Feel free to tell me more about your business, tools, processes, or any other relevant information.",
          undefined
        );
      }
    } catch (extractionError) {
      console.error("[Organization Profile] Error extracting insights:", extractionError);
      // Continue even if extraction fails - return a helpful message
      return createSuccessResponse(
        "I've received your information. I'm processing it to improve your knowledge base. You can continue telling me more about your business, and I'll learn from our conversation.",
        undefined
      );
    }

    // Step 2: Create learning events
    let learningEventsResult = null;
    try {
      // Generate a unique source ID for this conversation
      const conversationId = `org-profile-chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      learningEventsResult = await createLearningEvents({
        knowledgeBaseId: auth.knowledgeBase.id,
        sourceType: "CHAT_CONVERSATION",
        sourceId: conversationId,
        insights: extractedInsights,
        triggeredBy: auth.userOrgId || undefined,
      });

      if (learningEventsResult.success) {
        console.log(
          `[Organization Profile] Created ${learningEventsResult.eventsCreated} learning events`
        );
      } else {
        console.warn(
          `[Organization Profile] Failed to create some learning events:`,
          learningEventsResult.errors
        );
      }
    } catch (learningError) {
      console.error("[Organization Profile] Error creating learning events (non-blocking):", learningError);
      // Don't fail the request if learning events fail
    }

    // Step 3: Apply high-confidence learning events to KB
    let appliedCount = 0;
    let fieldsUpdated: string[] = [];
    if (learningEventsResult && learningEventsResult.success && auth.knowledgeBase) {
      try {
        const applyResult = await applyLearningEventsToKB({
          knowledgeBaseId: auth.knowledgeBase.id,
          minConfidence: CONFIDENCE_THRESHOLDS.HIGH, // Auto-apply high confidence (≥80%)
        });

        if (applyResult.success) {
          appliedCount = applyResult.eventsApplied;
          fieldsUpdated = applyResult.fieldsUpdated || [];
          console.log(
            `[Organization Profile] Applied ${applyResult.eventsApplied} learning events to KB. ` +
            `Updated fields: ${fieldsUpdated.join(", ") || "none"}`
          );
        } else {
          console.warn(
            `[Organization Profile] Failed to apply some learning events:`,
            applyResult.errors
          );
        }
      } catch (applyError) {
        console.error("[Organization Profile] Error applying learning events (non-blocking):", applyError);
        // Don't fail the request if application fails
      }
    }

    // Step 4: Construct response message with actual insights displayed
    let assistantMessage = "Thank you for sharing that information! I've extracted the following insights from our conversation:\n\n";
    
    if (extractedInsights.length > 0) {
      // Separate insights by confidence level
      const highConfidenceInsights = extractedInsights.filter(
        (insight) => (insight.confidence || 70) >= CONFIDENCE_THRESHOLDS.HIGH
      );
      const mediumLowInsights = extractedInsights.filter(
        (insight) => (insight.confidence || 70) < CONFIDENCE_THRESHOLDS.HIGH
      );

      // Display high-confidence insights (auto-applied)
      if (highConfidenceInsights.length > 0) {
        assistantMessage += `AUTO-APPLIED INSIGHTS (${highConfidenceInsights.length}):\n`;
        assistantMessage += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        highConfidenceInsights.forEach((insight, idx) => {
          const confidence = insight.confidence || 70;
          const category = insight.category.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
          assistantMessage += `\n${idx + 1}. [${category}] (${confidence}% confidence)\n`;
          assistantMessage += `   ${insight.insight}\n`;
        });
        assistantMessage += "\n";
      }

      // Display medium/low confidence insights (saved for review)
      if (mediumLowInsights.length > 0) {
        assistantMessage += `SAVED FOR REVIEW (${mediumLowInsights.length}):\n`;
        assistantMessage += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        mediumLowInsights.forEach((insight, idx) => {
          const confidence = insight.confidence || 70;
          const category = insight.category.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
          assistantMessage += `\n${idx + 1}. [${category}] (${confidence}% confidence)\n`;
          assistantMessage += `   ${insight.insight}\n`;
        });
        assistantMessage += "\n";
      }

      // Summary
      if (appliedCount > 0) {
        assistantMessage += `\n✓ I've automatically applied ${appliedCount} high-confidence insight${appliedCount > 1 ? "s" : ""} to your knowledge base.`;
        if (fieldsUpdated.length > 0) {
          assistantMessage += ` Updated fields: ${fieldsUpdated.slice(0, 3).join(", ")}${fieldsUpdated.length > 3 ? `, and ${fieldsUpdated.length - 3} more` : ""}.`;
        }
        assistantMessage += "\n";
      }

      if (mediumLowInsights.length > 0) {
        assistantMessage += `\n• ${mediumLowInsights.length} insight${mediumLowInsights.length > 1 ? "s have" : " has"} been saved for review (medium confidence).`;
        assistantMessage += "\n";
      }
    }

    assistantMessage += "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    assistantMessage += "Please review the insights above. If anything is incorrect or needs adjustment, just let me know and I'll update it!";

    // Build action payload with summary of what was learned
    const action = {
      insightsExtracted: extractedInsights.length,
      eventsCreated: learningEventsResult?.eventsCreated || 0,
      eventsApplied: appliedCount,
      fieldsUpdated: fieldsUpdated,
      insights: extractedInsights.slice(0, 5).map((insight) => ({
        category: insight.category,
        confidence: insight.confidence || 70,
        summary: insight.insight.substring(0, 100) + (insight.insight.length > 100 ? "..." : ""),
      })),
    };

    return createSuccessResponse(
      assistantMessage,
      action,
      learningEventsResult?.eventsCreated && learningEventsResult.eventsCreated > 0
        ? [`Extracted ${extractedInsights.length} insight${extractedInsights.length > 1 ? "s" : ""} from conversation`]
        : undefined
    );
  } catch (error) {
    console.error("[Organization Profile] Handler error:", error);
    return createErrorResponse(
      "Failed to process organization profile chat request",
      error instanceof Error ? error.message : "An unexpected error occurred"
    );
  }
}
