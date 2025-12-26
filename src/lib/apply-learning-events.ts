import { prisma } from "./prisma";
import {
  adjustConfidenceByAge,
  meetsConfidenceThreshold,
  ConfidenceDecayConfig,
} from "./utils/confidence-decay";
import {
  recordApplicationMetrics,
  ApplicationMetrics,
  updateQualityMetrics,
  QualityMetrics,
} from "./learning-metrics";
import {
  sortEventsByPriority,
  groupEventsByPriority,
  EventPriority,
} from "./utils/event-priority";
import {
  recordEventAudit,
  createKBStateSnapshot,
  EventAuditLog,
} from "./event-sourcing";

export interface ApplyLearningEventsParams {
  knowledgeBaseId: string;
  minConfidence?: number;
  batchSize?: number; // Number of events to process per batch (default: 100)
  confidenceDecayConfig?: ConfidenceDecayConfig; // Confidence decay configuration
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

const DEFAULT_MIN_CONFIDENCE = 80;
const DEFAULT_BATCH_SIZE = 100; // Process 100 events at a time

const HIGH_CONFIDENCE_OVERRIDE = 90;

export async function applyLearningEventsToKB(
  params: ApplyLearningEventsParams
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
    // Load knowledge base once (will be used for all batches)
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

    // Process events in batches using cursor-based pagination
    let cursor: string | undefined;
    let hasMoreEvents = true;
    let totalProcessed = 0;

    while (hasMoreEvents) {
      // Fetch next batch of events
      const batchEvents = await prisma.learningEvent.findMany({
        where: {
          knowledgeBaseId,
          applied: false,
          confidence: {
            gte: minConfidence, // Initial filter (will apply decay check later)
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

      // Apply confidence decay and filter events that still meet threshold
      const validEvents = batchEvents
        .map((event) => {
          const adjustedConfidence = adjustConfidenceByAge(
            event.confidence,
            event.createdAt,
            confidenceDecayConfig
          );
          return {
            ...event,
            adjustedConfidence, // Store adjusted confidence for priority calculation
          };
        })
        .filter((event) => event.adjustedConfidence >= minConfidence);

      // Sort events by priority (critical first, then by confidence)
      const sortedEvents = sortEventsByPriority(validEvents);

      // Track skipped events due to confidence decay
      const validEventIds = new Set(validEvents.map((e) => e.id));
      const decayedEvents = batchEvents.filter((event) => !validEventIds.has(event.id));
      skippedEventIds.push(...decayedEvents.map((e) => e.id));

      // Record audit logs for skipped events (non-blocking)
      for (const event of decayedEvents) {
        const auditLog = {
          eventId: event.id,
          action: "skipped" as const,
          reason: "Confidence below threshold after decay",
          timestamp: new Date(),
        };
        recordEventAudit(knowledgeBaseId, auditLog).catch((err: any) => {
          console.error("Failed to record skip audit:", err);
        });
      }

      // Process valid events in this batch (sorted by priority)
      if (sortedEvents.length > 0) {
        // Extract original events (without adjustedConfidence) for processing
        const eventsToProcess = sortedEvents.map(({ adjustedConfidence, ...event }) => event);
        
        const batchResult = await processEventBatch(
          eventsToProcess,
          knowledgeBase,
          fieldUpdates,
          appliedEventIds,
          skippedEventIds,
          errors
        );

        // Update knowledge base after each batch to keep it current
        // (needed for conflict resolution in subsequent batches)
        if (batchResult.updateData && Object.keys(batchResult.updateData).length > 0) {
          await prisma.organizationKnowledgeBase.update({
            where: { id: knowledgeBaseId },
            data: {
              ...batchResult.updateData,
              enrichmentVersion: (knowledgeBase.enrichmentVersion || 0) + 1,
              lastEnrichedAt: new Date(),
              version: (knowledgeBase.version || 1) + 1,
            },
          });

          // Reload knowledge base for next batch
          const updatedKB = await prisma.organizationKnowledgeBase.findUnique({
            where: { id: knowledgeBaseId },
          });
          if (updatedKB) {
            Object.assign(knowledgeBase, updatedKB);
          }
        }
      }

      totalProcessed += batchEvents.length;

      // Set cursor for next batch
      if (batchEvents.length < batchSize) {
        hasMoreEvents = false;
      } else {
        cursor = batchEvents[batchEvents.length - 1].id;
      }
    }

    const processingTimeMs = Date.now() - startTime;
    const fieldsUpdatedList = Array.from(new Set(fieldUpdates.map((u) => u.field)));

    // If we processed any events, mark them as applied in a transaction
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

      // Record audit logs for applied events (non-blocking)
      for (const eventId of appliedEventIds) {
        const fieldUpdate = fieldUpdates.find((u) => u.eventId === eventId);
        const auditLog: EventAuditLog = {
          eventId,
          action: "applied",
          reason: fieldUpdate?.resolutionStrategy?.reason || "Applied to knowledge base",
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

      // Create snapshot after applying events (non-blocking)
      createKBStateSnapshot(knowledgeBaseId, appliedEventIds).catch((err: any) => {
        console.error("Failed to create KB state snapshot:", err);
      });
    }

    // Calculate average confidence of applied events
    let avgConfidence = 0;
    if (appliedEventIds.length > 0) {
      const appliedEvents = await prisma.learningEvent.findMany({
        where: { id: { in: appliedEventIds } },
        select: { confidence: true },
      });
      avgConfidence =
        appliedEvents.length > 0
          ? appliedEvents.reduce((sum, e) => sum + e.confidence, 0) / appliedEvents.length
          : 0;
    }

    // Record application metrics (non-blocking)
    const applicationMetrics: ApplicationMetrics = {
      knowledgeBaseId,
      eventsProcessed: totalProcessed,
      eventsApplied: appliedEventIds.length,
      eventsSkipped: skippedEventIds.length,
      eventsDecayed: skippedEventIds.length, // Simplified - all skipped are counted
      fieldsUpdated: fieldsUpdatedList,
      averageConfidence: avgConfidence,
      processingTimeMs,
      timestamp: new Date(),
    };

    recordApplicationMetrics(knowledgeBaseId, applicationMetrics).catch((err) => {
      console.error("Failed to record application metrics:", err);
    });

    // Calculate conflict resolution outcomes
    const conflictOutcomes = {
      replaced: fieldUpdates.filter((u) => u.resolutionStrategy?.strategy === "replace").length,
      merged: fieldUpdates.filter((u) => u.resolutionStrategy?.strategy === "merge").length,
      kept: fieldUpdates.filter((u) => u.resolutionStrategy?.strategy === "keep").length,
      appended: fieldUpdates.filter((u) => u.resolutionStrategy?.strategy === "append").length,
    };

    // Calculate confidence distribution (if we have applied events)
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
      confidenceDistribution.high = appliedEvents.filter((e) => e.confidence >= 90).length;
      confidenceDistribution.medium = appliedEvents.filter((e) => e.confidence >= 80 && e.confidence < 90).length;
      confidenceDistribution.low = appliedEvents.filter((e) => e.confidence < 80).length;
    }

    // Update quality metrics (non-blocking)
    const qualityMetrics: QualityMetrics = {
      knowledgeBaseId,
      duplicateDetectionRate: 0, // Would need to track this separately from extraction metrics
      conflictResolutionOutcomes: conflictOutcomes,
      confidenceDistribution: confidenceDistribution,
      sourceTypeEffectiveness: {}, // Would need to aggregate from extraction metrics
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

/**
 * Process a batch of events and return update data
 * Helper function for cursor-based pagination
 */
async function processEventBatch(
  events: any[],
  knowledgeBase: any,
  fieldUpdates: FieldUpdate[],
  appliedEventIds: string[],
  skippedEventIds: string[],
  errors: string[]
): Promise<{ updateData: any }> {
  // Group events by target field for batch processing
  const eventsByField = new Map<
    string,
    Array<{ event: any; mapping: { field: string; value: any; shouldApply: boolean; resolutionStrategy?: ConflictResolutionStrategy } }>
  >();

  // First pass: Map all events to their target fields
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

      // Group events by field
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

  // Second pass: Process all events for each field together
  const updateData: any = {};
  const extractedKnowledge = (knowledgeBase.extractedKnowledge as Record<string, any>) || {};
  const currentToolStack = Array.isArray(knowledgeBase.toolStack) ? knowledgeBase.toolStack : [];

  for (const [field, fieldEvents] of eventsByField.entries()) {
    try {
      if (field === "toolStack") {
        // Merge all tools from all events targeting toolStack
        let mergedTools = [...currentToolStack];
        for (const { event, mapping } of fieldEvents) {
          const newTools = Array.isArray(mapping.value) ? mapping.value : [mapping.value];
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
        // Merge all extractedKnowledge updates
        for (const { event, mapping } of fieldEvents) {
          const key = mapping.value.key;
          const items = mapping.value.items;
          extractedKnowledge[key] = mergeArrayField(
            extractedKnowledge[key] || [],
            items
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
          // Direct field updates: use highest confidence value
          // For conflicts, prefer higher confidence and track history
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
            
            // Get resolution strategy if available
            const resolutionStrategy = mapping.resolutionStrategy;
            
            fieldUpdates.push({
              field,
              oldValue: currentValue,
              newValue: mapping.value,
              eventId: event.id,
              resolutionStrategy,
            });
          }

          // Apply best value and track history if needed
          const bestResolution = bestMapping.resolutionStrategy;
          if (bestResolution?.trackHistory && currentValue) {
            // Track history in extractedKnowledge
            if (!extractedKnowledge.fieldHistory) {
              extractedKnowledge.fieldHistory = {};
            }
            trackFieldHistory(
              extractedKnowledge,
              field,
              currentValue,
              bestMapping.value,
              fieldEvents.find((fe) => fe.mapping === bestMapping)?.event.id || ""
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
      // Mark events for this field as skipped
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
  kb: any
): { field: string; value: any; shouldApply: boolean; resolutionStrategy?: ConflictResolutionStrategy } | null {
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
          "biggestBottleNeck"
        );
        return {
          field: "biggestBottleNeck",
          value: newValue,
          shouldApply: resolution.shouldApply,
          resolutionStrategy: resolution, // Include strategy for history tracking
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

      break;
    }

    case "workflow_patterns": {
      // Pass existing toolStack for normalization reference
      const existingToolStack = Array.isArray(kb.toolStack) ? kb.toolStack : [];
      const tools = extractToolsFromInsight(insight, parsedMetadata, existingToolStack);
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

      break;
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

      break;
    }

    case "service_patterns": {
      if (parsedMetadata.recommendedService || parsedMetadata.serviceType) {
        return {
          field: "extractedKnowledge",
          value: {
            key: "servicePatterns",
            items: [
              {
                serviceType: parsedMetadata.recommendedService || parsedMetadata.serviceType,
                confidence: parsedMetadata.confidence,
                decisionLogic: parsedMetadata.decisionLogic,
              },
            ],
          },
          shouldApply: true,
        };
      }

      break;
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

      break;
    }

    default:
      return null;
  }

  return null;
}

export interface ConflictResolutionStrategy {
  shouldApply: boolean;
  strategy: "replace" | "merge" | "keep" | "append";
  reason: string;
  trackHistory?: boolean; // Whether to track previous value in history
}

/**
 * Enhanced conflict resolution with strategy-based approach
 * Returns strategy object instead of simple boolean
 */
function resolveConflict(
  currentValue: any,
  newValue: any,
  confidence: number,
  fieldName?: string
): ConflictResolutionStrategy {
  // Empty current value: always replace
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

  // Arrays: always merge (deduplicate)
  if (Array.isArray(currentValue) && Array.isArray(newValue)) {
    return {
      shouldApply: true,
      strategy: "merge",
      reason: "Both values are arrays, merging with deduplication",
      trackHistory: false,
    };
  }

  // String conflicts: track history and replace if high confidence
  if (typeof currentValue === "string" && typeof newValue === "string") {
    const currentTrimmed = currentValue.trim();
    const newTrimmed = newValue.trim();

    // Same value: keep existing
    if (currentTrimmed.toLowerCase() === newTrimmed.toLowerCase()) {
      return {
        shouldApply: false,
        strategy: "keep",
        reason: "New value is identical to current value",
        trackHistory: false,
      };
    }

    // Different value: replace if high confidence, otherwise keep
    if (confidence >= HIGH_CONFIDENCE_OVERRIDE) {
      return {
        shouldApply: true,
        strategy: "replace",
        reason: `High confidence (${confidence}%) override, replacing existing value`,
        trackHistory: true, // Track previous value in history
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

  // Object conflicts: merge if possible, otherwise replace with high confidence
  if (typeof currentValue === "object" && typeof newValue === "object" && !Array.isArray(currentValue) && !Array.isArray(newValue)) {
    return {
      shouldApply: true,
      strategy: "merge",
      reason: "Both values are objects, merging properties",
      trackHistory: false,
    };
  }

  // Default: keep existing if confidence not high enough
  return {
    shouldApply: false,
    strategy: "keep",
    reason: `Confidence (${confidence}%) not sufficient to override existing value`,
    trackHistory: false,
  };
}

/**
 * Track field history in extractedKnowledge for conflict resolution
 */
function trackFieldHistory(
  extractedKnowledge: Record<string, any>,
  fieldName: string,
  previousValue: any,
  newValue: any,
  eventId: string
): void {
  if (!extractedKnowledge.fieldHistory) {
    extractedKnowledge.fieldHistory = {};
  }

  if (!extractedKnowledge.fieldHistory[fieldName]) {
    extractedKnowledge.fieldHistory[fieldName] = [];
  }

  // Add history entry
  extractedKnowledge.fieldHistory[fieldName].push({
    previousValue,
    newValue,
    changedAt: new Date().toISOString(),
    eventId,
  });

  // Keep only last 10 history entries per field to prevent unbounded growth
  if (extractedKnowledge.fieldHistory[fieldName].length > 10) {
    extractedKnowledge.fieldHistory[fieldName] = extractedKnowledge.fieldHistory[fieldName].slice(-10);
  }
}

/**
 * Extract tools from insight text and metadata
 * Priority: metadata.newTool (from AI extraction) > metadata.tools > regex fallback
 * Uses existing KB toolStack for normalization reference
 */
function extractToolsFromInsight(
  insight: string,
  metadata: any,
  existingToolStack: string[] = []
): string[] {
  const tools: Set<string> = new Set();
  const existingToolsLower = new Set(
    existingToolStack.map((t) => t.toLowerCase().trim())
  );

  /**
   * Normalize tool name for comparison
   * - Lowercase, trim
   * - Remove common suffixes (.com, .io, etc.)
   * - Remove special characters
   */
  const normalizeToolName = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/\.(com|io|co|app|dev|net|org)$/i, "") // Remove common TLDs
      .replace(/[^\w\s]/g, "") // Remove special chars
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();
  };

  /**
   * Check if tool name matches existing tool in KB (case-insensitive, normalized)
   */
  const findMatchingExistingTool = (toolName: string): string | null => {
    const normalized = normalizeToolName(toolName);
    for (const existingTool of existingToolStack) {
      if (normalizeToolName(existingTool) === normalized) {
        return existingTool; // Return existing format for consistency
      }
    }
    return null;
  };

  /**
   * Validate if a string looks like a legitimate tool name
   */
  const isValidToolName = (name: string): boolean => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 50) return false;

    // Common words to exclude
    const commonWords = new Set([
      "the", "this", "that", "these", "those",
      "company", "business", "organization", "organization",
      "we", "they", "our", "your", "their",
      "using", "with", "through", "via",
    ]);

    const lower = trimmed.toLowerCase();
    if (commonWords.has(lower)) return false;

    // Should contain at least one letter
    if (!/[a-zA-Z]/.test(trimmed)) return false;

    return true;
  };

  // Priority 1: metadata.newTool (from structured AI extraction - highest confidence)
  // This comes from the AI's structured insight extraction, so we trust it
  if (metadata.newTool) {
    const toolName = typeof metadata.newTool === "string" 
      ? metadata.newTool.trim() 
      : String(metadata.newTool).trim();
    
    if (isValidToolName(toolName)) {
      // Check if it matches an existing tool format
      const matching = findMatchingExistingTool(toolName);
      if (matching) {
        tools.add(matching); // Use existing format
      } else {
        tools.add(toolName); // Trust AI extraction
      }
    }
  }

  // Priority 2: metadata.tools array (if provided)
  if (metadata.tools) {
    const toolArray = Array.isArray(metadata.tools) 
      ? metadata.tools 
      : [metadata.tools];
    
    for (const tool of toolArray) {
      const toolName = typeof tool === "string" 
        ? tool.trim() 
        : String(tool).trim();
      
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

  // Priority 3: Regex fallback (only if no tools found via metadata)
  // This is less reliable, so we use stricter patterns
  if (tools.size === 0 && insight) {
    // Pattern 1: Capitalized words that look like tool names
    // Matches: "Slack", "Monday.com", "GoHighLevel" but not "The Company"
    const toolPattern = /\b([A-Z][a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)?(?:\s+[A-Z][a-zA-Z0-9]+)*)\b/g;
    const matches = insight.match(toolPattern);
    
    if (matches) {
      for (const match of matches) {
        const trimmed = match.trim();
        if (isValidToolName(trimmed)) {
          // Check against existing tools first
          const matching = findMatchingExistingTool(trimmed);
          if (matching) {
            tools.add(matching);
          } else {
            // Only add if it looks like a real tool (not a common word)
            // Additional validation: should have at least 3 chars and start with letter
            if (trimmed.length >= 3 && /^[A-Za-z]/.test(trimmed)) {
              tools.add(trimmed);
            }
          }
        }
      }
    }
  }

  // Return array of unique, validated tools
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

function mergeUniqueStrings(currentArray: string[], newItems: string[]): string[] {
  const merged = new Set(
    currentArray.map((item) => item.toLowerCase().trim())
  );

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

