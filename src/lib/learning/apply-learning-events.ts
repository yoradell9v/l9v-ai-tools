import { prisma } from "@/lib/core/prisma";
import {
  adjustConfidenceByAge,
  meetsConfidenceThreshold,
  getDecayInfo,
  ConfidenceDecayConfig,
} from "@/lib/utils/confidence-decay";
import {
  recordApplicationMetrics,
  ApplicationMetrics,
  updateQualityMetrics,
  QualityMetrics,
} from "@/lib/learning/learning-metrics";
import { sortEventsByPriority } from "@/lib/utils/event-priority";
import {
  recordEventAudit,
  createKBStateSnapshot,
  EventAuditLog,
} from "@/lib/learning/event-sourcing";
import { CONFIDENCE_THRESHOLDS } from "@/lib/knowledge-base/insight-confidence-thresholds";

export interface ApplyLearningEventsParams {
  knowledgeBaseId: string;
  minConfidence?: number;
  batchSize?: number;
  confidenceDecayConfig?: ConfidenceDecayConfig;
}

export interface ApplyLearningEventsResult {
  success: boolean;
  eventsApplied: number;
  eventsSkipped: number;
  fieldsUpdated: string[];
  enrichmentVersion: number;
  errors?: string[];
}

interface FieldUpdate {
  field: string;
  oldValue: any;
  newValue: any;
  eventId: string;
  resolutionStrategy?: ConflictResolutionStrategy;
}

const DEFAULT_MIN_CONFIDENCE = CONFIDENCE_THRESHOLDS.HIGH;
const DEFAULT_BATCH_SIZE = 100;

const HIGH_CONFIDENCE_OVERRIDE = 90;

export async function applyLearningEventsToKB(
  params: ApplyLearningEventsParams,
): Promise<ApplyLearningEventsResult> {
  const startTime = Date.now();
  const {
    knowledgeBaseId,
    minConfidence = DEFAULT_MIN_CONFIDENCE,
    batchSize = DEFAULT_BATCH_SIZE,
    confidenceDecayConfig,
  } = params;

  if (!knowledgeBaseId) {
    return {
      success: false,
      eventsApplied: 0,
      eventsSkipped: 0,
      fieldsUpdated: [],
      enrichmentVersion: 0,
      errors: ["Missing required parameter: knowledgeBaseId"],
    };
  }

  const errors: string[] = [];
  const fieldUpdates: FieldUpdate[] = [];
  const appliedEventIds: string[] = [];
  const skippedEventIds: string[] = [];

  try {
    const knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
    });

    if (!knowledgeBase) {
      return {
        success: false,
        eventsApplied: 0,
        eventsSkipped: 0,
        fieldsUpdated: [],
        enrichmentVersion: 0,
        errors: [`Knowledge base not found: ${knowledgeBaseId}`],
      };
    }

    let cursor: string | undefined;
    let hasMoreEvents = true;
    let totalProcessed = 0;

    while (hasMoreEvents) {
      const batchEvents = await prisma.learningEvent.findMany({
        where: {
          knowledgeBaseId,
          applied: false,
          confidence: {
            gte: minConfidence,
          },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: {
          createdAt: "asc",
        },
        take: batchSize,
      });

      if (batchEvents.length === 0) {
        hasMoreEvents = false;
        break;
      }

      const validEvents = batchEvents.filter((event) =>
        meetsConfidenceThreshold(
          event.confidence,
          event.createdAt,
          minConfidence,
          confidenceDecayConfig,
        ),
      );

      const sortedEvents = sortEventsByPriority(validEvents);

      const validEventIds = new Set(validEvents.map((e) => e.id));
      const decayedEvents = batchEvents.filter(
        (event) => !validEventIds.has(event.id),
      );
      skippedEventIds.push(...decayedEvents.map((e) => e.id));

      for (const event of decayedEvents) {
        const decayInfo = getDecayInfo(
          event.confidence,
          event.createdAt,
          confidenceDecayConfig,
        );
        const auditLog = {
          eventId: event.id,
          action: "skipped" as const,
          reason: `Confidence decayed from ${decayInfo.originalConfidence}% to ${decayInfo.adjustedConfidence}% after ${decayInfo.ageInDays} days (${decayInfo.decayPercentage}% decay). Below threshold of ${minConfidence}%`,
          timestamp: new Date(),
        };
        recordEventAudit(knowledgeBaseId, auditLog).catch((err: any) => {
          console.error("Failed to record skip audit:", err);
        });
      }

      if (sortedEvents.length > 0) {
        const eventsToProcess = sortedEvents;

        const batchResult = await processEventBatch(
          eventsToProcess,
          knowledgeBase,
          fieldUpdates,
          appliedEventIds,
          skippedEventIds,
          errors,
        );

        if (
          batchResult.updateData &&
          Object.keys(batchResult.updateData).length > 0
        ) {
          await prisma.organizationKnowledgeBase.update({
            where: { id: knowledgeBaseId },
            data: {
              ...batchResult.updateData,
              enrichmentVersion: (knowledgeBase.enrichmentVersion || 0) + 1,
              lastEnrichedAt: new Date(),
              version: (knowledgeBase.version || 1) + 1,
            },
          });

          const updatedKB = await prisma.organizationKnowledgeBase.findUnique({
            where: { id: knowledgeBaseId },
          });
          if (updatedKB) {
            Object.assign(knowledgeBase, updatedKB);
          }
        }
      }

      totalProcessed += batchEvents.length;

      if (batchEvents.length < batchSize) {
        hasMoreEvents = false;
      } else {
        cursor = batchEvents[batchEvents.length - 1].id;
      }
    }

    const processingTimeMs = Date.now() - startTime;
    const fieldsUpdatedList = Array.from(
      new Set(fieldUpdates.map((u) => u.field)),
    );

    if (appliedEventIds.length > 0) {
      await prisma.learningEvent.updateMany({
        where: {
          id: {
            in: appliedEventIds,
          },
        },
        data: {
          applied: true,
          appliedAt: new Date(),
          appliedToFields: fieldsUpdatedList,
        },
      });

      for (const eventId of appliedEventIds) {
        const fieldUpdate = fieldUpdates.find((u) => u.eventId === eventId);
        const auditLog: EventAuditLog = {
          eventId,
          action: "applied",
          reason:
            fieldUpdate?.resolutionStrategy?.reason ||
            "Applied to knowledge base",
          timestamp: new Date(),
          resultingKBVersion: knowledgeBase.enrichmentVersion || 0,
          fieldsAffected: fieldUpdate ? [fieldUpdate.field] : [],
          previousValue: fieldUpdate?.oldValue,
          newValue: fieldUpdate?.newValue,
        };

        recordEventAudit(knowledgeBaseId, auditLog).catch((err: any) => {
          console.error("Failed to record event audit:", err);
        });
      }

      createKBStateSnapshot(knowledgeBaseId, appliedEventIds).catch(
        (err: any) => {
          console.error("Failed to create KB state snapshot:", err);
        },
      );
    }

    let avgConfidence = 0;
    if (appliedEventIds.length > 0) {
      const appliedEvents = await prisma.learningEvent.findMany({
        where: { id: { in: appliedEventIds } },
        select: { confidence: true },
      });
      avgConfidence =
        appliedEvents.length > 0
          ? appliedEvents.reduce((sum, e) => sum + e.confidence, 0) /
            appliedEvents.length
          : 0;
    }

    if (skippedEventIds.length > 0) {
      const decayedEvents = await prisma.learningEvent.findMany({
        where: { id: { in: skippedEventIds } },
        select: { confidence: true, createdAt: true },
      });

      const decayStats = decayedEvents
        .map((event) =>
          getDecayInfo(
            event.confidence,
            event.createdAt,
            confidenceDecayConfig,
          ),
        )
        .filter((info) => info.adjustedConfidence < minConfidence); // Only count actual decayed events

      if (decayStats.length > 0) {
        const avgDecayPercentage =
          decayStats.reduce((sum, info) => sum + info.decayPercentage, 0) /
          decayStats.length;
        const avgDecayedAge =
          decayStats.reduce((sum, info) => sum + info.ageInDays, 0) /
          decayStats.length;
        console.log(
          `[Decay Stats] ${decayStats.length} events decayed: avg ${avgDecayPercentage.toFixed(1)}% decay, avg age ${avgDecayedAge.toFixed(1)} days`,
        );
      }
    }

    const applicationMetrics: ApplicationMetrics = {
      knowledgeBaseId,
      eventsProcessed: totalProcessed,
      eventsApplied: appliedEventIds.length,
      eventsSkipped: skippedEventIds.length,
      eventsDecayed: skippedEventIds.length,
      fieldsUpdated: fieldsUpdatedList,
      averageConfidence: avgConfidence,
      processingTimeMs,
      timestamp: new Date(),
    };

    recordApplicationMetrics(knowledgeBaseId, applicationMetrics).catch(
      (err) => {
        console.error("Failed to record application metrics:", err);
      },
    );

    const conflictOutcomes = {
      replaced: fieldUpdates.filter(
        (u) => u.resolutionStrategy?.strategy === "replace",
      ).length,
      merged: fieldUpdates.filter(
        (u) => u.resolutionStrategy?.strategy === "merge",
      ).length,
      kept: fieldUpdates.filter(
        (u) => u.resolutionStrategy?.strategy === "keep",
      ).length,
      appended: fieldUpdates.filter(
        (u) => u.resolutionStrategy?.strategy === "append",
      ).length,
    };

    const confidenceDistribution = {
      high: 0,
      medium: 0,
      low: 0,
    };

    if (appliedEventIds.length > 0) {
      const appliedEvents = await prisma.learningEvent.findMany({
        where: { id: { in: appliedEventIds } },
        select: { confidence: true },
      });
      confidenceDistribution.high = appliedEvents.filter(
        (e) => e.confidence >= 90,
      ).length;
      confidenceDistribution.medium = appliedEvents.filter(
        (e) => e.confidence >= 80 && e.confidence < 90,
      ).length;
      confidenceDistribution.low = appliedEvents.filter(
        (e) => e.confidence < 80,
      ).length;
    }

    const qualityMetrics: QualityMetrics = {
      knowledgeBaseId,
      duplicateDetectionRate: 0,
      conflictResolutionOutcomes: conflictOutcomes,
      confidenceDistribution: confidenceDistribution,
      sourceTypeEffectiveness: {},
      timestamp: new Date(),
    };

    updateQualityMetrics(knowledgeBaseId, qualityMetrics).catch((err) => {
      console.error("Failed to update quality metrics:", err);
    });

    if (totalProcessed === 0) {
      return {
        success: true,
        eventsApplied: 0,
        eventsSkipped: skippedEventIds.length,
        fieldsUpdated: [],
        enrichmentVersion: knowledgeBase.enrichmentVersion || 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    }

    return {
      success: true,
      eventsApplied: appliedEventIds.length,
      eventsSkipped: skippedEventIds.length,
      fieldsUpdated: fieldsUpdatedList,
      enrichmentVersion: knowledgeBase.enrichmentVersion || 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error applying learning events";
    console.error("Error applying learning events:", error);
    return {
      success: false,
      eventsApplied: appliedEventIds.length,
      eventsSkipped: skippedEventIds.length,
      fieldsUpdated: Array.from(new Set(fieldUpdates.map((u) => u.field))),
      enrichmentVersion: 0,
      errors: [errorMessage, ...errors],
    };
  }
}

async function processEventBatch(
  events: any[],
  knowledgeBase: any,
  fieldUpdates: FieldUpdate[],
  appliedEventIds: string[],
  skippedEventIds: string[],
  errors: string[],
): Promise<{ updateData: any }> {
  const eventsByField = new Map<
    string,
    Array<{
      event: any;
      mapping: {
        field: string;
        value: any;
        shouldApply: boolean;
        resolutionStrategy?: ConflictResolutionStrategy;
      };
    }>
  >();

  for (const event of events) {
    try {
      const mapping = mapInsightToKBField(event, knowledgeBase);

      if (!mapping) {
        skippedEventIds.push(event.id);
        continue;
      }

      const { field, shouldApply } = mapping;

      if (!shouldApply) {
        skippedEventIds.push(event.id);
        continue;
      }

      const existing = eventsByField.get(field) || [];
      existing.push({ event, mapping });
      eventsByField.set(field, existing);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Unknown error processing event ${event.id}`;
      errors.push(errorMessage);
      skippedEventIds.push(event.id);
      console.error(`Error processing learning event ${event.id}:`, error);
    }
  }

  if (eventsByField.size === 0) {
    return { updateData: {} };
  }

  const updateData: any = {};
  const extractedKnowledge =
    (knowledgeBase.extractedKnowledge as Record<string, any>) || {};
  const currentToolStack = Array.isArray(knowledgeBase.toolStack)
    ? knowledgeBase.toolStack
    : [];

  for (const [field, fieldEvents] of eventsByField.entries()) {
    try {
      if (field === "toolStack") {
        let mergedTools = [...currentToolStack];
        for (const { event, mapping } of fieldEvents) {
          const newTools = Array.isArray(mapping.value)
            ? mapping.value
            : [mapping.value];
          mergedTools = mergeUniqueStrings(mergedTools, newTools);
          appliedEventIds.push(event.id);
          fieldUpdates.push({
            field,
            oldValue: currentToolStack,
            newValue: mergedTools,
            eventId: event.id,
          });
        }
        updateData.toolStack = mergedTools;
      } else if (field === "extractedKnowledge") {
        for (const { event, mapping } of fieldEvents) {
          const key = mapping.value.key;
          const items = mapping.value.items;
          extractedKnowledge[key] = mergeArrayField(
            extractedKnowledge[key] || [],
            items,
          );
          appliedEventIds.push(event.id);
          fieldUpdates.push({
            field: `extractedKnowledge.${key}`,
            oldValue: extractedKnowledge[key] || [],
            newValue: extractedKnowledge[key],
            eventId: event.id,
          });
        }
        updateData.extractedKnowledge = extractedKnowledge;
      } else {
        let bestMapping = fieldEvents[0].mapping;
        let bestConfidence = fieldEvents[0].event.confidence || 0;
        const currentValue = getFieldValue(knowledgeBase, field);

        for (const { event, mapping } of fieldEvents) {
          const eventConfidence = event.confidence || 0;
          if (eventConfidence > bestConfidence) {
            bestConfidence = eventConfidence;
            bestMapping = mapping;
          }
          appliedEventIds.push(event.id);

          const resolutionStrategy = mapping.resolutionStrategy;

          fieldUpdates.push({
            field,
            oldValue: currentValue,
            newValue: mapping.value,
            eventId: event.id,
            resolutionStrategy,
          });
        }

        const bestResolution = bestMapping.resolutionStrategy;
        if (bestResolution?.trackHistory && currentValue) {
          if (!extractedKnowledge.fieldHistory) {
            extractedKnowledge.fieldHistory = {};
          }
          trackFieldHistory(
            extractedKnowledge,
            field,
            currentValue,
            bestMapping.value,
            fieldEvents.find((fe) => fe.mapping === bestMapping)?.event.id ||
              "",
          );
          updateData.extractedKnowledge = extractedKnowledge;
        }

        updateData[field] = bestMapping.value;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Unknown error processing field ${field}`;
      errors.push(errorMessage);
      for (const { event } of fieldEvents) {
        skippedEventIds.push(event.id);
        const index = appliedEventIds.indexOf(event.id);
        if (index > -1) {
          appliedEventIds.splice(index, 1);
        }
      }
      console.error(`Error processing field ${field}:`, error);
    }
  }

  return { updateData };
}

function mapInsightToKBField(
  event: any,
  kb: any,
): {
  field: string;
  value: any;
  shouldApply: boolean;
  resolutionStrategy?: ConflictResolutionStrategy;
} | null {
  const { category, insight, confidence, metadata } = event;

  const parsedMetadata: any = metadata || {};

  switch (category) {
    case "business_context": {
      if (parsedMetadata.bottleneck) {
        const currentValue = kb.biggestBottleNeck;
        const newValue = parsedMetadata.bottleneck;
        const resolution = resolveConflict(
          currentValue,
          newValue,
          confidence,
          "biggestBottleNeck",
        );
        return {
          field: "biggestBottleNeck",
          value: newValue,
          shouldApply: resolution.shouldApply,
          resolutionStrategy: resolution,
        };
      }

      if (parsedMetadata.companyStage) {
        return {
          field: "extractedKnowledge",
          value: {
            key: "companyStages",
            items: [parsedMetadata.companyStage],
          },
          shouldApply: true,
        };
      }

      if (parsedMetadata.growthIndicators) {
        return {
          field: "extractedKnowledge",
          value: {
            key: "growthIndicators",
            items: [parsedMetadata.growthIndicators],
          },
          shouldApply: true,
        };
      }

      if (parsedMetadata.hiddenComplexity) {
        return {
          field: "extractedKnowledge",
          value: {
            key: "hiddenComplexities",
            items: [parsedMetadata.hiddenComplexity],
          },
          shouldApply: true,
        };
      }

      return {
        field: "extractedKnowledge",
        value: {
          key: "businessContextInsights",
          items: [
            {
              insight: insight,
              evidence: parsedMetadata.evidence,
              sourceSection: parsedMetadata.sourceSection,
              confidence: confidence,
            },
          ],
        },
        shouldApply: true,
      };
    }

    case "workflow_patterns": {
      const existingToolStack = Array.isArray(kb.toolStack) ? kb.toolStack : [];
      const tools = extractToolsFromInsight(
        insight,
        parsedMetadata,
        existingToolStack,
      );
      if (tools.length > 0) {
        return {
          field: "toolStack",
          value: tools,
          shouldApply: true,
        };
      }

      if (parsedMetadata.implicitNeed) {
        return {
          field: "extractedKnowledge",
          value: {
            key: "implicitNeeds",
            items: [parsedMetadata.implicitNeed],
          },
          shouldApply: true,
        };
      }

      if (parsedMetadata.clusterName) {
        return {
          field: "extractedKnowledge",
          value: {
            key: "taskClusters",
            items: [
              {
                name: parsedMetadata.clusterName,
                workflowType: parsedMetadata.workflowType,
                complexityScore: parsedMetadata.complexityScore,
              },
            ],
          },
          shouldApply: true,
        };
      }

      return {
        field: "extractedKnowledge",
        value: {
          key: "workflowPatterns",
          items: [
            {
              insight: insight,
              evidence: parsedMetadata.evidence,
              sourceSection: parsedMetadata.sourceSection,
              confidence: confidence,
            },
          ],
        },
        shouldApply: true,
      };
    }

    case "process_optimization": {
      if (parsedMetadata.painPoint) {
        return {
          field: "extractedKnowledge",
          value: {
            key: "painPoints",
            items: [parsedMetadata.painPoint],
          },
          shouldApply: true,
        };
      }

      if (parsedMetadata.documentationGap) {
        return {
          field: "extractedKnowledge",
          value: {
            key: "documentationGaps",
            items: [parsedMetadata.documentationGap],
          },
          shouldApply: true,
        };
      }

      if (parsedMetadata.processComplexity) {
        return {
          field: "extractedKnowledge",
          value: {
            key: "processComplexities",
            items: [parsedMetadata.processComplexity],
          },
          shouldApply: true,
        };
      }

      return {
        field: "extractedKnowledge",
        value: {
          key: "processOptimizations",
          items: [
            {
              insight: insight,
              evidence: parsedMetadata.evidence,
              sourceSection: parsedMetadata.sourceSection,
              confidence: confidence,
            },
          ],
        },
        shouldApply: true,
      };
    }

    case "service_patterns": {
      if (parsedMetadata.recommendedService || parsedMetadata.serviceType) {
        return {
          field: "extractedKnowledge",
          value: {
            key: "servicePatterns",
            items: [
              {
                serviceType:
                  parsedMetadata.recommendedService ||
                  parsedMetadata.serviceType,
                confidence: parsedMetadata.confidence,
                decisionLogic: parsedMetadata.decisionLogic,
              },
            ],
          },
          shouldApply: true,
        };
      }

      return {
        field: "extractedKnowledge",
        value: {
          key: "servicePatterns",
          items: [
            {
              insight: insight,
              evidence: parsedMetadata.evidence,
              sourceSection: parsedMetadata.sourceSection,
              confidence: confidence,
            },
          ],
        },
        shouldApply: true,
      };
    }

    case "risk_management": {
      if (parsedMetadata.risk) {
        return {
          field: "extractedKnowledge",
          value: {
            key: "identifiedRisks",
            items: [
              {
                risk: parsedMetadata.risk,
                category: parsedMetadata.category,
                severity: parsedMetadata.severity,
              },
            ],
          },
          shouldApply: true,
        };
      }

      return {
        field: "extractedKnowledge",
        value: {
          key: "identifiedRisks",
          items: [
            {
              insight: insight,
              evidence: parsedMetadata.evidence,
              sourceSection: parsedMetadata.sourceSection,
              confidence: confidence,
            },
          ],
        },
        shouldApply: true,
      };
    }

    case "service_preferences": {
      if (parsedMetadata.recommendedService || parsedMetadata.serviceType) {
        return {
          field: "extractedKnowledge",
          value: {
            key: "servicePatterns",
            items: [
              {
                serviceType:
                  parsedMetadata.recommendedService ||
                  parsedMetadata.serviceType,
                confidence: parsedMetadata.confidence,
                decisionLogic: parsedMetadata.decisionLogic,
              },
            ],
          },
          shouldApply: true,
        };
      }

      return {
        field: "extractedKnowledge",
        value: {
          key: "servicePatterns",
          items: [
            {
              insight: insight,
              evidence: parsedMetadata.evidence,
              sourceSection: parsedMetadata.sourceSection,
              confidence: confidence,
            },
          ],
        },
        shouldApply: true,
      };
    }

    case "skill_requirements": {
      return {
        field: "extractedKnowledge",
        value: {
          key: "skillRequirements",
          items: [
            {
              insight: insight,
              evidence: parsedMetadata.evidence,
              sourceSection: parsedMetadata.sourceSection,
              confidence: confidence,
            },
          ],
        },
        shouldApply: true,
      };
    }

    case "hiring_patterns": {
      return {
        field: "extractedKnowledge",
        value: {
          key: "hiringPatterns",
          items: [
            {
              insight: insight,
              evidence: parsedMetadata.evidence,
              sourceSection: parsedMetadata.sourceSection,
              confidence: confidence,
            },
          ],
        },
        shouldApply: true,
      };
    }

    case "workflow_needs": {
      return {
        field: "extractedKnowledge",
        value: {
          key: "workflowNeeds",
          items: [
            {
              insight: insight,
              evidence: parsedMetadata.evidence,
              sourceSection: parsedMetadata.sourceSection,
              confidence: confidence,
            },
          ],
        },
        shouldApply: true,
      };
    }

    default:
      return {
        field: "extractedKnowledge",
        value: {
          key: `${category}Insights`,
          items: [
            {
              insight: insight,
              evidence: parsedMetadata.evidence,
              sourceSection: parsedMetadata.sourceSection,
              confidence: confidence,
            },
          ],
        },
        shouldApply: true,
      };
  }
}

export interface ConflictResolutionStrategy {
  shouldApply: boolean;
  strategy: "replace" | "merge" | "keep" | "append";
  reason: string;
  trackHistory?: boolean;
}

function resolveConflict(
  currentValue: any,
  newValue: any,
  confidence: number,
  fieldName?: string,
): ConflictResolutionStrategy {
  if (
    currentValue === null ||
    currentValue === undefined ||
    currentValue === "" ||
    (Array.isArray(currentValue) && currentValue.length === 0)
  ) {
    return {
      shouldApply: true,
      strategy: "replace",
      reason: "Field is empty, applying new value",
      trackHistory: false,
    };
  }

  if (Array.isArray(currentValue) && Array.isArray(newValue)) {
    return {
      shouldApply: true,
      strategy: "merge",
      reason: "Both values are arrays, merging with deduplication",
      trackHistory: false,
    };
  }

  if (typeof currentValue === "string" && typeof newValue === "string") {
    const currentTrimmed = currentValue.trim();
    const newTrimmed = newValue.trim();

    if (currentTrimmed.toLowerCase() === newTrimmed.toLowerCase()) {
      return {
        shouldApply: false,
        strategy: "keep",
        reason: "New value is identical to current value",
        trackHistory: false,
      };
    }

    if (confidence >= HIGH_CONFIDENCE_OVERRIDE) {
      return {
        shouldApply: true,
        strategy: "replace",
        reason: `High confidence (${confidence}%) override, replacing existing value`,
        trackHistory: true,
      };
    } else {
      return {
        shouldApply: false,
        strategy: "keep",
        reason: `Confidence (${confidence}%) below threshold (${HIGH_CONFIDENCE_OVERRIDE}%), keeping existing value`,
        trackHistory: false,
      };
    }
  }

  if (
    typeof currentValue === "object" &&
    typeof newValue === "object" &&
    !Array.isArray(currentValue) &&
    !Array.isArray(newValue)
  ) {
    return {
      shouldApply: true,
      strategy: "merge",
      reason: "Both values are objects, merging properties",
      trackHistory: false,
    };
  }

  return {
    shouldApply: false,
    strategy: "keep",
    reason: `Confidence (${confidence}%) not sufficient to override existing value`,
    trackHistory: false,
  };
}

function trackFieldHistory(
  extractedKnowledge: Record<string, any>,
  fieldName: string,
  previousValue: any,
  newValue: any,
  eventId: string,
): void {
  if (!extractedKnowledge.fieldHistory) {
    extractedKnowledge.fieldHistory = {};
  }

  if (!extractedKnowledge.fieldHistory[fieldName]) {
    extractedKnowledge.fieldHistory[fieldName] = [];
  }

  extractedKnowledge.fieldHistory[fieldName].push({
    previousValue,
    newValue,
    changedAt: new Date().toISOString(),
    eventId,
  });

  if (extractedKnowledge.fieldHistory[fieldName].length > 10) {
    extractedKnowledge.fieldHistory[fieldName] =
      extractedKnowledge.fieldHistory[fieldName].slice(-10);
  }
}

function extractToolsFromInsight(
  insight: string,
  metadata: any,
  existingToolStack: string[] = [],
): string[] {
  const tools: Set<string> = new Set();
  const existingToolsLower = new Set(
    existingToolStack.map((t) => t.toLowerCase().trim()),
  );

  const normalizeToolName = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/\.(com|io|co|app|dev|net|org)$/i, "") // Remove common TLDs
      .replace(/[^\w\s]/g, "") // Remove special chars
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();
  };

  const findMatchingExistingTool = (toolName: string): string | null => {
    const normalized = normalizeToolName(toolName);
    for (const existingTool of existingToolStack) {
      if (normalizeToolName(existingTool) === normalized) {
        return existingTool; // Return existing format for consistency
      }
    }
    return null;
  };

  const isValidToolName = (name: string): boolean => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 50) return false;

    const commonWords = new Set([
      "the",
      "this",
      "that",
      "these",
      "those",
      "company",
      "business",
      "organization",
      "organization",
      "we",
      "they",
      "our",
      "your",
      "their",
      "using",
      "with",
      "through",
      "via",
    ]);

    const lower = trimmed.toLowerCase();
    if (commonWords.has(lower)) return false;

    if (!/[a-zA-Z]/.test(trimmed)) return false;

    return true;
  };

  if (metadata.newTool) {
    const toolName =
      typeof metadata.newTool === "string"
        ? metadata.newTool.trim()
        : String(metadata.newTool).trim();

    if (isValidToolName(toolName)) {
      const matching = findMatchingExistingTool(toolName);
      if (matching) {
        tools.add(matching);
      } else {
        tools.add(toolName);
      }
    }
  }

  if (metadata.tools) {
    const toolArray = Array.isArray(metadata.tools)
      ? metadata.tools
      : [metadata.tools];

    for (const tool of toolArray) {
      const toolName =
        typeof tool === "string" ? tool.trim() : String(tool).trim();

      if (isValidToolName(toolName)) {
        const matching = findMatchingExistingTool(toolName);
        if (matching) {
          tools.add(matching);
        } else {
          tools.add(toolName);
        }
      }
    }
  }

  if (tools.size === 0 && insight) {
    const toolPattern =
      /\b([A-Z][a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)?(?:\s+[A-Z][a-zA-Z0-9]+)*)\b/g;
    const matches = insight.match(toolPattern);

    if (matches) {
      for (const match of matches) {
        const trimmed = match.trim();
        if (isValidToolName(trimmed)) {
          const matching = findMatchingExistingTool(trimmed);
          if (matching) {
            tools.add(matching);
          } else {
            if (trimmed.length >= 3 && /^[A-Za-z]/.test(trimmed)) {
              tools.add(trimmed);
            }
          }
        }
      }
    }
  }

  return Array.from(tools)
    .map((tool) => tool.trim())
    .filter((tool) => tool.length > 0);
}

function mergeArrayField(currentArray: any[], newItems: any[]): any[] {
  const merged = [...(currentArray || [])];

  for (const item of newItems) {
    const exists = merged.some((existing) => {
      if (typeof existing === "string" && typeof item === "string") {
        return existing.toLowerCase() === item.toLowerCase();
      }
      if (typeof existing === "object" && typeof item === "object") {
        return JSON.stringify(existing) === JSON.stringify(item);
      }
      return existing === item;
    });

    if (!exists) {
      merged.push(item);
    }
  }

  return merged;
}

function mergeUniqueStrings(
  currentArray: string[],
  newItems: string[],
): string[] {
  const merged = new Set(currentArray.map((item) => item.toLowerCase().trim()));

  for (const item of newItems) {
    const normalized = item.toLowerCase().trim();
    if (normalized && !merged.has(normalized)) {
      merged.add(normalized);
    }
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of currentArray) {
    const normalized = item.toLowerCase().trim();
    if (!seen.has(normalized)) {
      result.push(item);
      seen.add(normalized);
    }
  }

  for (const item of newItems) {
    const normalized = item.toLowerCase().trim();
    if (normalized && !seen.has(normalized)) {
      result.push(item);
      seen.add(normalized);
    }
  }

  return result;
}

function getFieldValue(kb: any, field: string): any {
  return kb[field];
}
