import { LearningEventType } from "@prisma/client";

export enum EventPriority {
  CRITICAL = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4,
}

export interface PriorityFactors {
  confidence: number;
  category: string;
  eventType: LearningEventType;
  sourceType?: string;
  metadata?: any;
}

export function calculateEventPriority(
  factors: PriorityFactors
): EventPriority {
  const { confidence, category, eventType, sourceType, metadata } = factors;

  if (confidence >= 90) {
    if (
      category === "risk_management" ||
      (category === "business_context" && metadata?.bottleneck) ||
      eventType === "INCONSISTENCY_FIXED"
    ) {
      return EventPriority.CRITICAL;
    }

    if (
      sourceType === "JOB_DESCRIPTION" ||
      sourceType === "CHAT_CONVERSATION"
    ) {
      return EventPriority.HIGH;
    }
  }

  if (confidence >= 85) {
    if (
      category === "business_context" ||
      category === "process_optimization" ||
      category === "risk_management"
    ) {
      return EventPriority.HIGH;
    }

    if (
      eventType === "INSIGHT_GENERATED" ||
      eventType === "OPTIMIZATION_FOUND"
    ) {
      return EventPriority.HIGH;
    }
  }

  if (confidence >= 80) {
    return EventPriority.MEDIUM;
  }

  return EventPriority.LOW;
}

export function sortEventsByPriority<
  T extends {
    confidence: number;
    category: string;
    eventType: LearningEventType;
    metadata?: any;
  }
>(events: T[], sourceType?: string): T[] {
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

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return b.confidence - a.confidence;
  });
}
export function groupEventsByPriority<
  T extends {
    confidence: number;
    category: string;
    eventType: LearningEventType;
    metadata?: any;
  }
>(events: T[], sourceType?: string): Map<EventPriority, T[]> {
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

export function isCriticalEvent(factors: PriorityFactors): boolean {
  return calculateEventPriority(factors) === EventPriority.CRITICAL;
}
