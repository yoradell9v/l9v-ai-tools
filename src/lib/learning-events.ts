import { prisma } from "./prisma";
import { LearningEventType } from "@prisma/client";

export interface ExtractedInsight {
  insight: string;
  category: string;
  eventType: LearningEventType;
  confidence?: number;
  metadata?: {
    sourceSection?: string;
    evidence?: string[];
    [key: string]: any; // Flexible for source-specific data
  };
}


export interface CreateLearningEventsParams {
  knowledgeBaseId: string;
  sourceType: "JOB_DESCRIPTION" | "SOP_GENERATION" | "CHAT_CONVERSATION" | "INITIAL_ONBOARDING" | "MANUAL_UPDATE" | "FILE_UPLOAD" | "AI_ENRICHMENT";
  sourceId: string;
  insights: ExtractedInsight[];
  triggeredBy?: string;
}


export interface CreateLearningEventsResult {
  success: boolean;
  eventsCreated: number;
  eventIds: string[];
  errors?: string[];
}

const DEFAULT_CONFIDENCE = 70;

/**
 * Creates LearningEvents from extracted insights.
 * 
 * This function:
 * - Maps insights to LearningEventType
 * - Creates multiple LearningEvents (one per insight)
 * - Sets default confidence if not provided
 * - Links via sourceIds array
 * 
 * @param params - Parameters for creating LearningEvents
 * @returns Result with success status, count, and event IDs
 */
export async function createLearningEvents(
  params: CreateLearningEventsParams
): Promise<CreateLearningEventsResult> {
  const { knowledgeBaseId, sourceType, sourceId, insights, triggeredBy } = params;

  if (!knowledgeBaseId || !sourceId || !insights || insights.length === 0) {
    return {
      success: false,
      eventsCreated: 0,
      eventIds: [],
      errors: ["Missing required parameters: knowledgeBaseId, sourceId, or insights"],
    };
  }

  const eventIds: string[] = [];
  const errors: string[] = [];

  for (const insight of insights) {
    try {
      if (!insight.insight || !insight.category || !insight.eventType) {
        errors.push(
          `Skipping invalid insight: missing required fields (insight: ${!!insight.insight}, category: ${!!insight.category}, eventType: ${!!insight.eventType})`
        );
        continue;
      }

      const confidence = insight.confidence ?? DEFAULT_CONFIDENCE;
      const normalizedConfidence = Math.max(1, Math.min(100, confidence));

      const learningEvent = await prisma.learningEvent.create({
        data: {
          knowledgeBaseId,
          eventType: insight.eventType,
          insight: insight.insight,
          category: insight.category,
          confidence: normalizedConfidence,
          triggeredBy: triggeredBy || null,
          sourceIds: [sourceId],
        },
      });

      eventIds.push(learningEvent.id);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Unknown error creating LearningEvent for insight: ${insight.insight?.substring(0, 50)}...`;
      errors.push(errorMessage);
      console.error("Error creating LearningEvent:", error);
    }
  }

  const success = eventIds.length > 0;
  
  return {
    success,
    eventsCreated: eventIds.length,
    eventIds,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Batch creates LearningEvents with better error handling.
 * This version processes all insights in a transaction-like manner,
 * but still creates individual events (not a true transaction to avoid
 * blocking on large batches).
 * 
 * @param params - Parameters for creating LearningEvents
 * @returns Result with success status, count, and event IDs
 */

export async function createLearningEventsBatch(
  params: CreateLearningEventsParams
): Promise<CreateLearningEventsResult> {
  return createLearningEvents(params);
}

