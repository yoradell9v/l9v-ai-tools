/**
 * Event Priority Calculation
 * Determines processing priority for learning events based on multiple factors
 */

import { LearningEventType } from "@prisma/client";

export enum EventPriority {
  CRITICAL = 1, // Process immediately (bottlenecks, red flags, high confidence critical insights)
  HIGH = 2, // Process in first batch (high confidence, important categories)
  MEDIUM = 3, // Process in normal batches
  LOW = 4, // Process last (low confidence, less critical)
}

export interface PriorityFactors {
  confidence: number;
  category: string;
  eventType: LearningEventType;
  sourceType?: string;
  metadata?: any;
}

/**
 * Calculate event priority based on multiple factors
 */
export function calculateEventPriority(factors: PriorityFactors): EventPriority {
  const { confidence, category, eventType, sourceType, metadata } = factors;

  // CRITICAL: High-confidence bottlenecks, red flags, or critical business insights
  if (confidence >= 90) {
    // Critical categories
    if (
      category === "risk_management" ||
      (category === "business_context" && metadata?.bottleneck) ||
      eventType === "INCONSISTENCY_FIXED"
    ) {
      return EventPriority.CRITICAL;
    }

    // High-value source types
    if (sourceType === "JOB_DESCRIPTION" || sourceType === "CHAT_CONVERSATION") {
      return EventPriority.HIGH;
    }
  }

  // HIGH: Important insights with good confidence
  if (confidence >= 85) {
    // Important categories
    if (
      category === "business_context" ||
      category === "process_optimization" ||
      category === "risk_management"
    ) {
      return EventPriority.HIGH;
    }

    // Important event types
    if (
      eventType === "INSIGHT_GENERATED" ||
      eventType === "OPTIMIZATION_FOUND"
    ) {
      return EventPriority.HIGH;
    }
  }

  // MEDIUM: Standard insights
  if (confidence >= 80) {
    return EventPriority.MEDIUM;
  }

  // LOW: Lower confidence or less critical
  return EventPriority.LOW;
}

/**
 * Sort events by priority (critical first, then by confidence)
 */
export function sortEventsByPriority<T extends { confidence: number; category: string; eventType: LearningEventType; metadata?: any }>(
  events: T[],
  sourceType?: string
): T[] {
  return [...events].sort((a, b) => {
    const priorityA = calculateEventPriority({
      confidence: a.confidence,
      category: a.category,
      eventType: a.eventType,
      sourceType,
      metadata: a.metadata,
    });

    const priorityB = calculateEventPriority({
      confidence: b.confidence,
      category: b.category,
      eventType: b.eventType,
      sourceType,
      metadata: b.metadata,
    });

    // First sort by priority
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Then by confidence (higher first)
    return b.confidence - a.confidence;
  });
}

/**
 * Group events by priority for batch processing
 */
export function groupEventsByPriority<T extends { confidence: number; category: string; eventType: LearningEventType; metadata?: any }>(
  events: T[],
  sourceType?: string
): Map<EventPriority, T[]> {
  const grouped = new Map<EventPriority, T[]>();

  for (const event of events) {
    const priority = calculateEventPriority({
      confidence: event.confidence,
      category: event.category,
      eventType: event.eventType,
      sourceType,
      metadata: event.metadata,
    });

    if (!grouped.has(priority)) {
      grouped.set(priority, []);
    }
    grouped.get(priority)!.push(event);
  }

  return grouped;
}

/**
 * Check if event should be processed immediately (critical priority)
 */
export function isCriticalEvent(factors: PriorityFactors): boolean {
  return calculateEventPriority(factors) === EventPriority.CRITICAL;
}

