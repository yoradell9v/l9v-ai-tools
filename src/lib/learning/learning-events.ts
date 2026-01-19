import { prisma } from "@/lib/core/prisma";
import { LearningEventType } from "@prisma/client";
import { isSimilar } from "@/lib/utils/similarity";
import { recordExtractionMetrics, ExtractionMetrics } from "@/lib/learning/learning-metrics";
import { recordEventAudit, EventAuditLog } from "@/lib/learning/event-sourcing";
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
  areSemanticallySimilar,
  getSimilarityThreshold,
} from "@/lib/ai/embeddings";

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
  sourceType:
    | "JOB_DESCRIPTION"
    | "SOP_GENERATION"
    | "CHAT_CONVERSATION"
    | "INITIAL_ONBOARDING"
    | "MANUAL_UPDATE"
    | "FILE_UPLOAD"
    | "AI_ENRICHMENT";
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
const DUPLICATE_CHECK_DAYS = 30;
const SIMILARITY_THRESHOLD = 0.85;
const EMBEDDING_MODEL = "text-embedding-3-small";

export async function createLearningEvents(
  params: CreateLearningEventsParams
): Promise<CreateLearningEventsResult> {
  const { knowledgeBaseId, sourceType, sourceId, insights, triggeredBy } =
    params;

  if (!knowledgeBaseId || !sourceId || !insights || insights.length === 0) {
    return {
      success: false,
      eventsCreated: 0,
      eventIds: [],
      errors: [
        "Missing required parameters: knowledgeBaseId, sourceId, or insights",
      ],
    };
  }

  const errors: string[] = [];

  const duplicateCheckDate = new Date();
  duplicateCheckDate.setDate(
    duplicateCheckDate.getDate() - DUPLICATE_CHECK_DAYS
  );

  const categories = Array.from(
    new Set(insights.map((i) => i.category).filter(Boolean))
  );
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
      embedding: true,
      embeddingModel: true,
    } as any,
  });

  const insightTexts = insights.map((i) => i.insight);
  let newInsightEmbeddings: (number[] | null)[] = [];
  let embeddingGenerationFailed = false;

  try {
    newInsightEmbeddings = await generateEmbeddingsBatch(insightTexts);
  } catch (embeddingError) {
    console.error(
      "[createLearningEvents] Failed to generate embeddings, falling back to string similarity:",
      embeddingError
    );
    embeddingGenerationFailed = true;
  }

  const validInsights = await Promise.all(
    insights.map(async (insight, index) => {
      if (!insight.insight || !insight.category || !insight.eventType) {
        errors.push(
          `Skipping invalid insight at index ${index}: missing required fields (insight: ${!!insight.insight}, category: ${!!insight.category}, eventType: ${!!insight.eventType})`
        );
        return null;
      }

      const categoryEvents = recentEvents.filter(
        (e) => e.category === insight.category
      );
      let isDuplicate = false;
      let duplicateEvent: (typeof recentEvents)[0] | undefined;
      let similarityMethod = "unknown";

      if (!embeddingGenerationFailed && newInsightEmbeddings[index]) {
        const newEmbedding = newInsightEmbeddings[index]!;

        for (const existingEvent of categoryEvents) {
          let existingEmbedding: number[] | null = null;

          const eventEmbedding = (existingEvent as any).embedding;
          if (
            eventEmbedding &&
            Array.isArray(eventEmbedding) &&
            eventEmbedding.length > 0
          ) {
            existingEmbedding = eventEmbedding as number[];
          } else {
            try {
              existingEmbedding = await generateEmbedding(
                existingEvent.insight
              );

              prisma.learningEvent
                .update({
                  where: { id: existingEvent.id },
                  data: {
                    embedding: existingEmbedding,
                    embeddingModel: EMBEDDING_MODEL,
                  } as any,
                })
                .catch((err) => {
                  console.error(
                    `[createLearningEvents] Failed to update embedding for event ${existingEvent.id}:`,
                    err
                  );
                });
            } catch (embedError) {
              console.warn(
                `[createLearningEvents] Failed to generate embedding for existing event ${existingEvent.id}, falling back to string similarity:`,
                embedError
              );
            }
          }

          if (existingEmbedding) {
            try {
              const similarity = cosineSimilarity(
                newEmbedding,
                existingEmbedding
              );
              const threshold = getSimilarityThreshold(); 

              if (similarity >= threshold) {
                isDuplicate = true;
                duplicateEvent = existingEvent;
                similarityMethod = "semantic";
                break;
              }
            } catch (simError) {
              console.warn(
                `[createLearningEvents] Error calculating cosine similarity, falling back to string similarity:`,
                simError
              );
            }
          }
        }
      }

      if (!isDuplicate) {
        const stringDuplicate = categoryEvents.find((e) =>
          isSimilar(e.insight, insight.insight, SIMILARITY_THRESHOLD)
        );

        if (stringDuplicate) {
          isDuplicate = true;
          duplicateEvent = stringDuplicate;
          similarityMethod = "string";
        }
      }

      if (isDuplicate && duplicateEvent) {
        const newConfidence = insight.confidence ?? DEFAULT_CONFIDENCE;
        const existingConfidence = duplicateEvent.confidence || 0;

        errors.push(
          `Skipping duplicate insight (${similarityMethod}): "${insight.insight.substring(
            0,
            50
          )}..." (similar to existing event ${
            duplicateEvent.id
          }, confidence: existing=${existingConfidence}, new=${newConfidence})`
        );
        return null;
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
        embedding: newInsightEmbeddings[index] || [],
        embeddingModel: newInsightEmbeddings[index] ? EMBEDDING_MODEL : null,
      };
    })
  );

  const filteredInsights = validInsights.filter(
    (item): item is NonNullable<typeof item> => item !== null
  );

  if (filteredInsights.length === 0) {
    return {
      success: false,
      eventsCreated: 0,
      eventIds: [],
      errors: errors.length > 0 ? errors : ["No valid insights to create"],
    };
  }

  try {
    const result = await prisma.learningEvent.createMany({
      data: filteredInsights,
      skipDuplicates: true,
    });

    const createdEvents = await prisma.learningEvent.findMany({
      where: {
        knowledgeBaseId,
        sourceIds: {
          has: sourceId,
        },
        createdAt: {
          gte: new Date(Date.now() - 60000),
        },
        applied: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: filteredInsights.length,
      select: {
        id: true,
      },
    });

    const eventIds = createdEvents.map((e) => e.id);
    const success = eventIds.length > 0;
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

    if (success && filteredInsights.length > 0) {
      const duplicateCount = insights.length - filteredInsights.length;
      const insightsByCategory: Record<string, number> = {};
      let totalConfidence = 0;
      let confidenceCount = 0;

      for (const insight of filteredInsights) {
        insightsByCategory[insight.category] =
          (insightsByCategory[insight.category] || 0) + 1;
        const conf = insight.confidence ?? DEFAULT_CONFIDENCE;
        totalConfidence += conf;
        confidenceCount++;
      }

      const extractionMetrics: ExtractionMetrics = {
        sourceType,
        insightsExtracted: insights.length,
        insightsCreated: result.count,
        insightsByCategory,
        averageConfidence:
          confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        duplicateCount,
        timestamp: new Date(),
      };

      recordExtractionMetrics(knowledgeBaseId, extractionMetrics).catch(
        (err) => {
          console.error("Failed to record extraction metrics:", err);
        }
      );
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
