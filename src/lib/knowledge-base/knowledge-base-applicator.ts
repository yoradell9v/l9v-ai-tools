import { prisma } from "@/lib/core/prisma";
import { FieldMapping, NewInsight } from "@/lib/extraction/document-field-mapping";
import { ExtractedFileContent } from "@/lib/extraction/extract-content";
import { CONFIDENCE_THRESHOLDS } from "./insight-confidence-thresholds";
import { createLearningEvents, ExtractedInsight } from "@/lib/learning/learning-events";
import { applyLearningEventsToKB } from "@/lib/learning/apply-learning-events";
import { LearningEventType } from "@prisma/client";

const HIGH_CONFIDENCE_THRESHOLD = CONFIDENCE_THRESHOLDS.HIGH; 
const MEDIUM_CONFIDENCE_THRESHOLD = CONFIDENCE_THRESHOLDS.MEDIUM; 

export async function applyInsightsToKnowledgeBase(
  knowledgeBaseId: string,
  documentId: string,
  userId: string,
  mappingResult: { fieldMappings: FieldMapping[]; newInsights: NewInsight[] },
  extractedContent: ExtractedFileContent
): Promise<void> {
  const knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
    where: { id: knowledgeBaseId },
  });

  if (!knowledgeBase) {
    throw new Error(`Knowledge base ${knowledgeBaseId} not found`);
  }

  let documentName = "Unknown";
  try {
    const document = await (prisma as any).organizationDocument.findUnique({
      where: { id: documentId },
      select: { name: true },
    });
    documentName = document?.name || "Unknown";
  } catch (error) {
    console.error("Error fetching document name:", error);
  }

  const highConfidenceMappings: FieldMapping[] = [];
  const mediumConfidenceMappings: FieldMapping[] = [];
  const lowConfidenceMappings: FieldMapping[] = [];

  mappingResult.fieldMappings.forEach((mapping) => {
    if (mapping.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
      highConfidenceMappings.push(mapping);
    } else if (mapping.confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
      mediumConfidenceMappings.push(mapping);
    } else {
      lowConfidenceMappings.push(mapping);
    }
  });

  const fieldsToUpdate: string[] = [];
  const updateData: any = {};

  for (const mapping of highConfidenceMappings) {
    const kbField = mapping.field as keyof typeof knowledgeBase;
    const currentValue = knowledgeBase[kbField] as string | string[] | null | undefined;

    if (mapping.action === "REPLACE") {
      if (!currentValue || (typeof currentValue === "string" && currentValue.trim() === "")) {
        updateData[mapping.field] = mapping.insight;
        fieldsToUpdate.push(mapping.field);
      } else {
        updateData[mapping.field] = mapping.insight;
        fieldsToUpdate.push(mapping.field);
      }
    } else if (mapping.action === "APPEND") {
      if (currentValue && typeof currentValue === "string") {
        updateData[mapping.field] = `${currentValue}\n\n--- From Document ---\n${mapping.insight}`;
      } else {
        updateData[mapping.field] = mapping.insight;
      }
      fieldsToUpdate.push(mapping.field);
    } else if (mapping.action === "NEW_INSIGHT") {
      const existingInsights = (knowledgeBase.aiInsights as any) || {};
      const documentInsights = existingInsights.documentInsights || [];
      documentInsights.push({
        documentId,
        insight: mapping.insight,
        field: mapping.field,
        confidence: mapping.confidence,
        extractedAt: new Date().toISOString(),
      });
      updateData.aiInsights = {
        ...existingInsights,
        documentInsights,
      };
    }
  }

  if (mappingResult.newInsights.length > 0) {
    const existingInsights = (knowledgeBase.aiInsights as any) || {};
    const patterns = existingInsights.patterns || [];
    mappingResult.newInsights.forEach((insight) => {
      patterns.push({
        source: "document",
        documentId,
        pattern: insight.insight,
        category: insight.category,
        confidence: insight.confidence,
        extractedAt: new Date().toISOString(),
      });
    });
    updateData.aiInsights = {
      ...existingInsights,
      patterns,
    };
  }

  if (Object.keys(updateData).length > 0) {
    updateData.version = knowledgeBase.version + 1;
    updateData.lastEditedAt = new Date();
    updateData.lastEditedBy = userId;
    
    const contributors = knowledgeBase.contributors || [];
    if (!contributors.includes(userId)) {
      updateData.contributors = [...contributors, userId];
    }

    await prisma.organizationKnowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: updateData,
    });
  }

  const averageConfidence = highConfidenceMappings.length > 0
    ? highConfidenceMappings.reduce((sum, m) => sum + m.confidence, 0) / highConfidenceMappings.length
    : 0;

  await prisma.knowledgeSource.create({
    data: {
      knowledgeBaseId,
      sourceType: "FILE_UPLOAD",
      sourceId: documentId,
      contributeFields: fieldsToUpdate,
      extractedData: {
        fieldMappings: highConfidenceMappings.map((m) => ({
          field: m.field,
          insight: m.insight,
          confidence: m.confidence,
          action: m.action,
        })),
        documentSummary: extractedContent.summary,
        keyPoints: extractedContent.keyPoints,
        newInsights: mappingResult.newInsights.map((i) => ({
          category: i.category,
          insight: i.insight,
          confidence: i.confidence,
          reasoning: i.reasoning,
        })),
      } as any,
      confidence: Math.round(averageConfidence),
      contributedBy: userId,
    },
  });

  if (mediumConfidenceMappings.length > 0) {
    try {
      const extractedInsights: ExtractedInsight[] = mediumConfidenceMappings.map((mapping) => {
        const kbField = mapping.field as keyof typeof knowledgeBase;
        const currentValue = knowledgeBase[kbField] as string | string[] | null | undefined;
        
        return {
          insight: mapping.insight,
          category: mapping.field,
          eventType: LearningEventType.KNOWLEDGE_EXPANDED,
          confidence: mapping.confidence,
          metadata: {
            sourceSection: "document.field_mapping",
            suggestedField: mapping.field,
            action: mapping.action,
            reasoning: mapping.reasoning,
            documentName: documentName,
            documentId: documentId,
            currentValue: currentValue ? String(currentValue) : null,
            suggestedValue: mapping.insight,
          },
        };
      });

      const learningEventsResult = await createLearningEvents({
        knowledgeBaseId,
        sourceType: "FILE_UPLOAD",
        sourceId: documentId,
        insights: extractedInsights,
        triggeredBy: userId,
      });

      if (learningEventsResult.success) {
        console.log(
          `[Document Extraction] Created ${learningEventsResult.eventsCreated} learning events for document ${documentId}`
        );

        if (learningEventsResult.eventsCreated > 0) {
          try {
            const enrichmentResult = await applyLearningEventsToKB({
              knowledgeBaseId,
              minConfidence: CONFIDENCE_THRESHOLDS.HIGH,
            });

            if (enrichmentResult.success) {
              console.log(
                `[Document Extraction] Applied ${enrichmentResult.eventsApplied} learning events to KB ${knowledgeBaseId}`
              );
            }
          } catch (applyError) {
            console.error(
              "[Document Extraction] Error applying learning events (non-blocking):",
              applyError
            );
          }
        }
      } else {
        console.warn(
          `[Document Extraction] Failed to create some learning events:`,
          learningEventsResult.errors
        );
      }
    } catch (learningEventError) {
      console.error(
        "[Document Extraction] Error creating learning events (non-critical):",
        learningEventError
      );
    }
  }
  
  if (lowConfidenceMappings.length > 0) {
    const existingInsights = (knowledgeBase.aiInsights as any) || {};
    const documentInsights = existingInsights.documentInsights || [];
    lowConfidenceMappings.forEach((mapping) => {
      documentInsights.push({
        documentId,
        insight: mapping.insight,
        field: mapping.field,
        confidence: mapping.confidence,
        status: "low_confidence",
        extractedAt: new Date().toISOString(),
      });
    });

    await prisma.organizationKnowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: {
        aiInsights: {
          ...existingInsights,
          documentInsights,
        },
      },
    });
  }
}

