/**
 * Learning Events Metrics Tracking
 * Tracks extraction and application metrics for observability
 */

import { prisma } from "./prisma";

export interface ExtractionMetrics {
  sourceType: string;
  insightsExtracted: number;
  insightsCreated: number;
  insightsByCategory: Record<string, number>;
  averageConfidence: number;
  duplicateCount: number;
  timestamp: Date;
}

export interface ApplicationMetrics {
  knowledgeBaseId: string;
  eventsProcessed: number;
  eventsApplied: number;
  eventsSkipped: number;
  eventsDecayed: number; // Events filtered out due to confidence decay
  fieldsUpdated: string[];
  averageConfidence: number;
  processingTimeMs: number;
  timestamp: Date;
}

export interface QualityMetrics {
  knowledgeBaseId: string;
  duplicateDetectionRate: number; // Percentage of duplicates detected
  conflictResolutionOutcomes: {
    replaced: number;
    merged: number;
    kept: number;
    appended: number;
  };
  confidenceDistribution: {
    high: number; // >= 90
    medium: number; // 80-89
    low: number; // < 80
  };
  sourceTypeEffectiveness: Record<string, {
    extracted: number;
    applied: number;
    applicationRate: number;
  }>;
  timestamp: Date;
}

/**
 * Store extraction metrics in KB's extractedKnowledge
 */
export async function recordExtractionMetrics(
  knowledgeBaseId: string,
  metrics: ExtractionMetrics
): Promise<void> {
  try {
    const kb = await prisma.organizationKnowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      select: { extractedKnowledge: true },
    });

    if (!kb) return;

    const extractedKnowledge = (kb.extractedKnowledge as Record<string, any>) || {};
    
    if (!extractedKnowledge.metrics) {
      extractedKnowledge.metrics = {
        extraction: [],
        application: [],
        quality: null,
      };
    }

    // Add extraction metric
    if (!extractedKnowledge.metrics.extraction) {
      extractedKnowledge.metrics.extraction = [];
    }
    extractedKnowledge.metrics.extraction.push(metrics);

    // Keep only last 100 extraction metrics
    if (extractedKnowledge.metrics.extraction.length > 100) {
      extractedKnowledge.metrics.extraction = extractedKnowledge.metrics.extraction.slice(-100);
    }

    await prisma.organizationKnowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: { extractedKnowledge },
    });
  } catch (error) {
    console.error("Error recording extraction metrics:", error);
    // Don't throw - metrics are non-critical
  }
}

/**
 * Store application metrics in KB's extractedKnowledge
 */
export async function recordApplicationMetrics(
  knowledgeBaseId: string,
  metrics: ApplicationMetrics
): Promise<void> {
  try {
    const kb = await prisma.organizationKnowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      select: { extractedKnowledge: true },
    });

    if (!kb) return;

    const extractedKnowledge = (kb.extractedKnowledge as Record<string, any>) || {};
    
    if (!extractedKnowledge.metrics) {
      extractedKnowledge.metrics = {
        extraction: [],
        application: [],
        quality: null,
      };
    }

    // Add application metric
    if (!extractedKnowledge.metrics.application) {
      extractedKnowledge.metrics.application = [];
    }
    extractedKnowledge.metrics.application.push(metrics);

    // Keep only last 100 application metrics
    if (extractedKnowledge.metrics.application.length > 100) {
      extractedKnowledge.metrics.application = extractedKnowledge.metrics.application.slice(-100);
    }

    await prisma.organizationKnowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: { extractedKnowledge },
    });
  } catch (error) {
    console.error("Error recording application metrics:", error);
    // Don't throw - metrics are non-critical
  }
}

/**
 * Update quality metrics (aggregated)
 */
export async function updateQualityMetrics(
  knowledgeBaseId: string,
  qualityMetrics: QualityMetrics
): Promise<void> {
  try {
    const kb = await prisma.organizationKnowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      select: { extractedKnowledge: true },
    });

    if (!kb) return;

    const extractedKnowledge = (kb.extractedKnowledge as Record<string, any>) || {};
    
    if (!extractedKnowledge.metrics) {
      extractedKnowledge.metrics = {
        extraction: [],
        application: [],
        quality: null,
      };
    }

    // Update quality metrics (overwrite previous)
    extractedKnowledge.metrics.quality = qualityMetrics;

    await prisma.organizationKnowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: { extractedKnowledge },
    });
  } catch (error) {
    console.error("Error updating quality metrics:", error);
    // Don't throw - metrics are non-critical
  }
}

/**
 * Get metrics for a knowledge base
 */
export async function getMetrics(knowledgeBaseId: string): Promise<{
  extraction: ExtractionMetrics[];
  application: ApplicationMetrics[];
  quality: QualityMetrics | null;
} | null> {
  try {
    const kb = await prisma.organizationKnowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      select: { extractedKnowledge: true },
    });

    if (!kb) return null;

    const extractedKnowledge = (kb.extractedKnowledge as Record<string, any>) || {};
    const metrics = extractedKnowledge.metrics || {
      extraction: [],
      application: [],
      quality: null,
    };

    return {
      extraction: metrics.extraction || [],
      application: metrics.application || [],
      quality: metrics.quality || null,
    };
  } catch (error) {
    console.error("Error getting metrics:", error);
    return null;
  }
}

