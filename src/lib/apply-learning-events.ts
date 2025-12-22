import { prisma } from "./prisma";

/**
 * Parameters for applying learning events to knowledge base
 */
export interface ApplyLearningEventsParams {
  knowledgeBaseId: string;
  minConfidence?: number; // Default: 80 for MVP (high confidence only)
}

/**
 * Result of applying learning events to knowledge base
 */
export interface ApplyLearningEventsResult {
  success: boolean;
  eventsApplied: number;
  eventsSkipped: number;
  fieldsUpdated: string[];
  enrichmentVersion: number;
  errors?: string[];
}

/**
 * Internal structure for tracking field updates
 */
interface FieldUpdate {
  field: string;
  oldValue: any;
  newValue: any;
  eventId: string;
}

/**
 * Default minimum confidence for MVP (high confidence insights only)
 */
const DEFAULT_MIN_CONFIDENCE = 80;

/**
 * High confidence threshold for overriding existing values
 */
const HIGH_CONFIDENCE_OVERRIDE = 90;

/**
 * Applies unapplied learning events to the knowledge base.
 * 
 * For MVP, only applies high confidence insights (>= 80).
 * 
 * Process:
 * 1. Fetch unapplied learning events with confidence >= minConfidence
 * 2. Map insights to KB fields based on category and metadata
 * 3. Resolve conflicts (don't overwrite existing values unless very high confidence)
 * 4. Update KB fields
 * 5. Mark learning events as applied
 * 6. Update KB version and enrichment tracking
 * 
 * @param params - Parameters for applying learning events
 * @returns Result with success status, counts, and updated fields
 */
export async function applyLearningEventsToKB(
  params: ApplyLearningEventsParams
): Promise<ApplyLearningEventsResult> {
  const { knowledgeBaseId, minConfidence = DEFAULT_MIN_CONFIDENCE } = params;

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
    // 1. Fetch unapplied learning events with sufficient confidence
    const unappliedEvents = await prisma.learningEvent.findMany({
      where: {
        knowledgeBaseId,
        applied: false,
        confidence: {
          gte: minConfidence,
        },
      },
      orderBy: {
        createdAt: "asc", // Process oldest first
      },
    });

    if (unappliedEvents.length === 0) {
      return {
        success: true,
        eventsApplied: 0,
        eventsSkipped: 0,
        fieldsUpdated: [],
        enrichmentVersion: 0,
      };
    }

    // 2. Load current KB state
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

    // 3. Process each event and map to KB fields
    const updateData: any = {};
    const extractedKnowledge = (knowledgeBase.extractedKnowledge as Record<string, any>) || {};
    const toolStack = knowledgeBase.toolStack || [];

    for (const event of unappliedEvents) {
      try {
        const mapping = mapInsightToKBField(event, knowledgeBase);

        if (!mapping) {
          skippedEventIds.push(event.id);
          continue;
        }

        const { field, value, shouldApply } = mapping;

        if (!shouldApply) {
          skippedEventIds.push(event.id);
          continue;
        }

        // Track the update
        fieldUpdates.push({
          field,
          oldValue: getFieldValue(knowledgeBase, field),
          newValue: value,
          eventId: event.id,
        });

        // Apply the update
        if (field === "toolStack") {
          // Merge unique tools
          const currentTools = Array.isArray(knowledgeBase.toolStack)
            ? knowledgeBase.toolStack
            : [];
          const newTools = Array.isArray(value) ? value : [value];
          updateData.toolStack = mergeUniqueStrings(currentTools, newTools);
        } else if (field === "extractedKnowledge") {
          // Merge JSON object
          extractedKnowledge[value.key] = mergeArrayField(
            extractedKnowledge[value.key] || [],
            value.items
          );
          updateData.extractedKnowledge = extractedKnowledge;
        } else {
          // Direct field update
          updateData[field] = value;
        }

        appliedEventIds.push(event.id);
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

    // 4. Update KB if there are any changes
    if (Object.keys(updateData).length > 0) {
      const newEnrichmentVersion = (knowledgeBase.enrichmentVersion || 0) + 1;

      await prisma.organizationKnowledgeBase.update({
        where: { id: knowledgeBaseId },
        data: {
          ...updateData,
          enrichmentVersion: newEnrichmentVersion,
          lastEnrichedAt: new Date(),
          version: (knowledgeBase.version || 1) + 1,
        },
      });

      // 5. Mark learning events as applied
      if (appliedEventIds.length > 0) {
        const fieldsUpdatedList = Array.from(
          new Set(fieldUpdates.map((u) => u.field))
        );

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
      }

      return {
        success: true,
        eventsApplied: appliedEventIds.length,
        eventsSkipped: skippedEventIds.length,
        fieldsUpdated: Array.from(new Set(fieldUpdates.map((u) => u.field))),
        enrichmentVersion: newEnrichmentVersion,
        errors: errors.length > 0 ? errors : undefined,
      };
    } else {
      // No updates to apply, but mark events as skipped
      return {
        success: true,
        eventsApplied: 0,
        eventsSkipped: skippedEventIds.length,
        fieldsUpdated: [],
        enrichmentVersion: knowledgeBase.enrichmentVersion || 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    }
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
 * Maps a learning event insight to a KB field based on category and metadata.
 * 
 * @param event - The learning event to map
 * @param kb - Current knowledge base state
 * @returns Mapping result with field, value, and whether to apply
 */
function mapInsightToKBField(
  event: any,
  kb: any
): { field: string; value: any; shouldApply: boolean } | null {
  const { category, insight, confidence, metadata } = event;

  // Metadata is stored as JSON in the database and Prisma returns it as an object
  const parsedMetadata: any = metadata || {};

  switch (category) {
    case "business_context": {
      // Primary bottleneck -> biggestBottleNeck
      if (parsedMetadata.bottleneck) {
        const currentValue = kb.biggestBottleNeck;
        const newValue = parsedMetadata.bottleneck;
        const shouldApply = resolveConflict(
          currentValue,
          newValue,
          confidence
        );
        return {
          field: "biggestBottleNeck",
          value: newValue,
          shouldApply,
        };
      }

      // Company stage -> extractedKnowledge
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

      // Growth indicators -> extractedKnowledge
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

      // Hidden complexity -> extractedKnowledge
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
      // Extract tools from insight text or metadata
      const tools = extractToolsFromInsight(insight, parsedMetadata);
      if (tools.length > 0) {
        return {
          field: "toolStack",
          value: tools,
          shouldApply: true,
        };
      }

      // Implicit needs -> extractedKnowledge
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

      // Task clusters -> extractedKnowledge
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
      // Pain points -> extractedKnowledge
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

      // Documentation gaps -> extractedKnowledge
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

      // Process complexity -> extractedKnowledge
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
      // Service type patterns -> extractedKnowledge
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
      // Risks -> extractedKnowledge
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
      // Unknown category, skip
      return null;
  }

  return null;
}

/**
 * Resolves conflicts between existing KB value and new insight value.
 * 
 * Rules:
 * - If KB field is null/empty -> Apply insight
 * - If KB field has value:
 *   - For string fields: Only apply if confidence >= 90 (high confidence override)
 *   - For array/JSON fields: Always merge (handled separately)
 * 
 * @param currentValue - Current value in KB
 * @param newValue - New value from insight
 * @param confidence - Confidence level of the insight
 * @returns Whether to apply the new value
 */
function resolveConflict(
  currentValue: any,
  newValue: any,
  confidence: number
): boolean {
  // If field is empty, always apply
  if (
    currentValue === null ||
    currentValue === undefined ||
    currentValue === "" ||
    (Array.isArray(currentValue) && currentValue.length === 0)
  ) {
    return true;
  }

  // For string fields with existing values, only override with very high confidence
  if (typeof currentValue === "string" && currentValue.trim() !== "") {
    return confidence >= HIGH_CONFIDENCE_OVERRIDE;
  }

  // For other types, be conservative
  return false;
}

/**
 * Extracts tool names from insight text or metadata.
 * 
 * @param insight - The insight text
 * @param metadata - The metadata object
 * @returns Array of tool names
 */
function extractToolsFromInsight(insight: string, metadata: any): string[] {
  const tools: string[] = [];

  // Check metadata first
  if (metadata.tools && Array.isArray(metadata.tools)) {
    tools.push(...metadata.tools);
  } else if (metadata.tools && typeof metadata.tools === "string") {
    tools.push(metadata.tools);
  }

  // Extract from insight text (simple pattern matching)
  // Look for common tool patterns like "Tool Name", "ToolName", etc.
  const toolPatterns = [
    /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/g, // Capitalized words
  ];

  for (const pattern of toolPatterns) {
    const matches = insight.match(pattern);
    if (matches) {
      // Filter out common false positives
      const commonWords = [
        "The",
        "This",
        "That",
        "These",
        "Those",
        "Company",
        "Business",
        "Organization",
      ];
      const validTools = matches.filter(
        (match) => !commonWords.includes(match) && match.length > 2
      );
      tools.push(...validTools);
    }
  }

  // Remove duplicates and normalize
  return Array.from(
    new Set(
      tools
        .map((tool) => tool.trim())
        .filter((tool) => tool.length > 0)
    )
  );
}

/**
 * Merges two arrays, removing duplicates.
 * 
 * @param currentArray - Current array in KB
 * @param newItems - New items to merge
 * @returns Merged array with unique items
 */
function mergeArrayField(currentArray: any[], newItems: any[]): any[] {
  const merged = [...(currentArray || [])];

  for (const item of newItems) {
    // Check if item already exists (simple equality check)
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

/**
 * Merges unique strings from two arrays.
 * 
 * @param currentArray - Current array
 * @param newItems - New items to merge
 * @returns Merged array with unique strings (case-insensitive)
 */
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

  // Return original case from currentArray, or use newItems if not found
  const result: string[] = [];
  const seen = new Set<string>();

  // First, add all from currentArray
  for (const item of currentArray) {
    const normalized = item.toLowerCase().trim();
    if (!seen.has(normalized)) {
      result.push(item);
      seen.add(normalized);
    }
  }

  // Then, add new items (preserving their original case)
  for (const item of newItems) {
    const normalized = item.toLowerCase().trim();
    if (normalized && !seen.has(normalized)) {
      result.push(item);
      seen.add(normalized);
    }
  }

  return result;
}

/**
 * Gets the current value of a field from the knowledge base.
 * 
 * @param kb - Knowledge base object
 * @param field - Field name
 * @returns Current field value
 */
function getFieldValue(kb: any, field: string): any {
  return kb[field];
}

