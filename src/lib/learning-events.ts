import { prisma } from "./prisma";
import { LearningEventType } from "@prisma/client";
import { isSimilar } from "./utils/similarity";
import { recordExtractionMetrics, ExtractionMetrics } from "./learning-metrics";
import { recordEventAudit, EventAuditLog } from "./event-sourcing";

export interface ExtractedInsight {
  insight: string;
  category: string;
  eventType: LearningEventType;
  confidence?: number;
  metadata?: {
    sourceSection?: string;
    evidence?: string[];
    [key: string]: any;
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
const DUPLICATE_CHECK_DAYS = 30; // Check for duplicates in last 30 days
const SIMILARITY_THRESHOLD = 0.85; // 85% similarity considered duplicate

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

  const errors: string[] = [];
  
  // Check for duplicates before creating events
  const duplicateCheckDate = new Date();
  duplicateCheckDate.setDate(duplicateCheckDate.getDate() - DUPLICATE_CHECK_DAYS);
  
  // Fetch recent events in same category for duplicate checking
  const categories = Array.from(new Set(insights.map((i) => i.category).filter(Boolean)));
  const recentEvents = await prisma.learningEvent.findMany({
    where: {
      knowledgeBaseId,
      category: {
        in: categories,
      },
      createdAt: {
        gte: duplicateCheckDate,
      },
    },
    select: {
      id: true,
      insight: true,
      category: true,
      confidence: true,
      sourceIds: true,
    },
  });
  
  // Pre-validate and prepare all insights for batch insertion (with duplicate filtering)
  const validInsights = insights
    .map((insight, index) => {
      if (!insight.insight || !insight.category || !insight.eventType) {
        errors.push(
          `Skipping invalid insight at index ${index}: missing required fields (insight: ${!!insight.insight}, category: ${!!insight.category}, eventType: ${!!insight.eventType})`
        );
        return null;
      }

      // Check for duplicates within same category
      const categoryEvents = recentEvents.filter((e) => e.category === insight.category);
      const isDuplicate = categoryEvents.some((existingEvent) =>
        isSimilar(existingEvent.insight, insight.insight, SIMILARITY_THRESHOLD)
      );

      if (isDuplicate) {
        // Option: Skip duplicate (current behavior)
        // Could also merge sourceIds or update confidence if new insight has higher confidence
        const duplicateEvent = categoryEvents.find((e) =>
          isSimilar(e.insight, insight.insight, SIMILARITY_THRESHOLD)
        );
        
        if (duplicateEvent) {
          const newConfidence = insight.confidence ?? DEFAULT_CONFIDENCE;
          const existingConfidence = duplicateEvent.confidence || 0;
          
          // If new insight has significantly higher confidence, we could update the existing event
          // For now, we skip duplicates to avoid polluting the KB
          // Future: Could implement merge/update logic here
          errors.push(
            `Skipping duplicate insight: "${insight.insight.substring(0, 50)}..." (similar to existing event ${duplicateEvent.id}, confidence: existing=${existingConfidence}, new=${newConfidence})`
          );
          return null;
        }
      }

      const confidence = insight.confidence ?? DEFAULT_CONFIDENCE;
      const normalizedConfidence = Math.max(1, Math.min(100, confidence));

      return {
        knowledgeBaseId,
        eventType: insight.eventType,
        insight: insight.insight,
        category: insight.category,
        confidence: normalizedConfidence,
        triggeredBy: triggeredBy || null,
        sourceIds: [sourceId],
        metadata: insight.metadata || undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (validInsights.length === 0) {
    return {
      success: false,
      eventsCreated: 0,
      eventIds: [],
      errors: errors.length > 0 ? errors : ["No valid insights to create"],
    };
  }

  try {
    // Batch insert all events at once
    const result = await prisma.learningEvent.createMany({
      data: validInsights,
      skipDuplicates: true,
    });

    // Query back to get the created event IDs
    // We use a combination of fields to identify the events we just created
    const createdEvents = await prisma.learningEvent.findMany({
      where: {
        knowledgeBaseId,
        sourceIds: {
          has: sourceId,
        },
        createdAt: {
          gte: new Date(Date.now() - 60000), // Created in last minute
        },
        applied: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: validInsights.length,
      select: {
        id: true,
      },
    });

    const eventIds = createdEvents.map((e) => e.id);
    const success = eventIds.length > 0;

    // Record audit logs for created events (non-blocking)
    for (const eventId of eventIds) {
      const auditLog: EventAuditLog = {
        eventId,
        action: "created",
        reason: `Created from ${sourceType}`,
        timestamp: new Date(),
      };
      recordEventAudit(knowledgeBaseId, auditLog).catch((err) => {
        console.error("Failed to record creation audit:", err);
      });
    }

    // Record extraction metrics (non-blocking)
    if (success && validInsights.length > 0) {
      const duplicateCount = insights.length - validInsights.length;
      const insightsByCategory: Record<string, number> = {};
      let totalConfidence = 0;
      let confidenceCount = 0;

      for (const insight of validInsights) {
        insightsByCategory[insight.category] = (insightsByCategory[insight.category] || 0) + 1;
        const conf = insight.confidence ?? DEFAULT_CONFIDENCE;
        totalConfidence += conf;
        confidenceCount++;
      }

      const extractionMetrics: ExtractionMetrics = {
        sourceType,
        insightsExtracted: insights.length,
        insightsCreated: result.count,
        insightsByCategory,
        averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        duplicateCount,
        timestamp: new Date(),
      };

      // Record metrics asynchronously (don't block)
      recordExtractionMetrics(knowledgeBaseId, extractionMetrics).catch((err) => {
        console.error("Failed to record extraction metrics:", err);
      });
    }

    return {
      success,
      eventsCreated: result.count,
      eventIds,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error creating learning events";
    errors.push(errorMessage);
    console.error("Error creating learning events:", error);
    
    return {
      success: false,
      eventsCreated: 0,
      eventIds: [],
      errors,
    };
  }
}

export async function createLearningEventsBatch(
  params: CreateLearningEventsParams
): Promise<CreateLearningEventsResult> {
  return createLearningEvents(params);
}