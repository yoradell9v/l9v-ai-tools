/**
 * Event Sourcing Utilities
 * Provides audit trail and state reconstruction capabilities
 */

import { prisma } from "./prisma";

export interface EventAuditLog {
  eventId: string;
  action: "created" | "applied" | "skipped" | "reverted";
  reason: string;
  timestamp: Date;
  resultingKBVersion?: number;
  fieldsAffected?: string[];
  previousValue?: any;
  newValue?: any;
}

export interface KBStateSnapshot {
  knowledgeBaseId: string;
  version: number;
  enrichmentVersion: number;
  snapshot: any; // Full KB state
  createdAt: Date;
  eventIds: string[]; // Events that led to this state
}

/**
 * Record an audit log entry for an event action
 */
export async function recordEventAudit(
  knowledgeBaseId: string,
  auditLog: EventAuditLog
): Promise<void> {
  try {
    const kb = await prisma.organizationKnowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      select: { extractedKnowledge: true },
    });

    if (!kb) return;

    const extractedKnowledge = (kb.extractedKnowledge as Record<string, any>) || {};

    if (!extractedKnowledge.auditLog) {
      extractedKnowledge.auditLog = [];
    }

    extractedKnowledge.auditLog.push(auditLog);

    // Keep only last 1000 audit log entries
    if (extractedKnowledge.auditLog.length > 1000) {
      extractedKnowledge.auditLog = extractedKnowledge.auditLog.slice(-1000);
    }

    await prisma.organizationKnowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: { extractedKnowledge },
    });
  } catch (error) {
    console.error("Error recording event audit:", error);
    // Don't throw - audit is non-critical
  }
}

/**
 * Create a snapshot of KB state at a specific enrichment version
 */
export async function createKBStateSnapshot(
  knowledgeBaseId: string,
  eventIds: string[]
): Promise<KBStateSnapshot | null> {
  try {
    const kb = await prisma.organizationKnowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
    });

    if (!kb) return null;

    // Get extractedKnowledge and create a copy without circular references
    const extractedKnowledge = (kb.extractedKnowledge as Record<string, any>) || {};
    
    // Create a deep copy of extractedKnowledge for the snapshot, excluding snapshots and auditLog
    // to prevent circular references
    const extractedKnowledgeForSnapshot = { ...extractedKnowledge };
    delete extractedKnowledgeForSnapshot.snapshots;
    delete extractedKnowledgeForSnapshot.auditLog;
    
    // Deep clone the remaining extractedKnowledge to ensure no shared references
    // This prevents circular references when storing the snapshot
    let clonedExtractedKnowledge: any;
    try {
      clonedExtractedKnowledge = JSON.parse(JSON.stringify(extractedKnowledgeForSnapshot));
    } catch (cloneError) {
      // If deep clone fails (e.g., due to non-serializable values), use shallow copy
      // This is a fallback to prevent the entire snapshot from failing
      console.warn('[KB Snapshot] Deep clone failed, using shallow copy:', cloneError);
      clonedExtractedKnowledge = { ...extractedKnowledgeForSnapshot };
    }

    const snapshot: KBStateSnapshot = {
      knowledgeBaseId,
      version: kb.version || 1,
      enrichmentVersion: kb.enrichmentVersion || 0,
      snapshot: {
        // Core fields
        businessName: kb.businessName,
        industry: kb.industry,
        biggestBottleNeck: kb.biggestBottleNeck,
        topObjection: kb.topObjection,
        coreOffer: kb.coreOffer,
        toolStack: kb.toolStack,
        // Extracted knowledge (without snapshots and auditLog to prevent circular references)
        extractedKnowledge: clonedExtractedKnowledge,
        // Other relevant fields
        idealCustomer: kb.idealCustomer,
        primaryGoal: kb.primaryGoal,
      },
      createdAt: new Date(),
      eventIds,
    };

    // Store snapshot in extractedKnowledge
    if (!extractedKnowledge.snapshots) {
      extractedKnowledge.snapshots = [];
    }
    extractedKnowledge.snapshots.push(snapshot);

    // Keep only last 50 snapshots
    if (extractedKnowledge.snapshots.length > 50) {
      extractedKnowledge.snapshots = extractedKnowledge.snapshots.slice(-50);
    }

    await prisma.organizationKnowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: { extractedKnowledge },
    });

    return snapshot;
  } catch (error) {
    console.error("Error creating KB state snapshot:", error);
    return null;
  }
}

/**
 * Rebuild KB state from events up to a specific point in time
 */
export async function rebuildKBStateFromEvents(
  knowledgeBaseId: string,
  upToDate?: Date
): Promise<any | null> {
  try {
    // Get base KB
    const kb = await prisma.organizationKnowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
    });

    if (!kb) return null;

    // Start with initial state (empty or current state)
    const rebuiltState: any = {
      businessName: kb.businessName,
      industry: kb.industry,
      biggestBottleNeck: null,
      topObjection: null,
      coreOffer: null,
      toolStack: [],
      extractedKnowledge: {},
    };

    // Fetch all applied events (or up to a specific date)
    const whereClause: any = {
      knowledgeBaseId,
      applied: true,
    };

    if (upToDate) {
      whereClause.appliedAt = {
        lte: upToDate,
      };
    }

    const appliedEvents = await prisma.learningEvent.findMany({
      where: whereClause,
      orderBy: {
        appliedAt: "asc",
      },
    });

    // Replay events to rebuild state
    // This is a simplified version - full implementation would use mapInsightToKBField
    for (const event of appliedEvents) {
      const metadata = (event.metadata as Record<string, any>) || {};

      // Apply event to state (simplified - would need full mapping logic)
      if (metadata.bottleneck && !rebuiltState.biggestBottleNeck) {
        rebuiltState.biggestBottleNeck = metadata.bottleneck;
      }

      if (metadata.newTool) {
        if (!rebuiltState.toolStack) {
          rebuiltState.toolStack = [];
        }
        if (!rebuiltState.toolStack.includes(metadata.newTool)) {
          rebuiltState.toolStack.push(metadata.newTool);
        }
      }

      // Add to extractedKnowledge arrays
      if (!rebuiltState.extractedKnowledge) {
        rebuiltState.extractedKnowledge = {};
      }

      // Handle various extracted knowledge fields
      if (metadata.companyStage) {
        if (!rebuiltState.extractedKnowledge.companyStages) {
          rebuiltState.extractedKnowledge.companyStages = [];
        }
        if (!rebuiltState.extractedKnowledge.companyStages.includes(metadata.companyStage)) {
          rebuiltState.extractedKnowledge.companyStages.push(metadata.companyStage);
        }
      }
    }

    return rebuiltState;
  } catch (error) {
    console.error("Error rebuilding KB state from events:", error);
    return null;
  }
}

/**
 * Get audit log for a knowledge base
 */
export async function getAuditLog(
  knowledgeBaseId: string,
  limit: number = 100
): Promise<EventAuditLog[]> {
  try {
    const kb = await prisma.organizationKnowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      select: { extractedKnowledge: true },
    });

    if (!kb) return [];

    const extractedKnowledge = (kb.extractedKnowledge as Record<string, any>) || {};
    const auditLog = extractedKnowledge.auditLog || [];

    // Return most recent entries
    return auditLog.slice(-limit).reverse();
  } catch (error) {
    console.error("Error getting audit log:", error);
    return [];
  }
}

/**
 * Get snapshots for a knowledge base
 */
export async function getSnapshots(
  knowledgeBaseId: string
): Promise<KBStateSnapshot[]> {
  try {
    const kb = await prisma.organizationKnowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      select: { extractedKnowledge: true },
    });

    if (!kb) return [];

    const extractedKnowledge = (kb.extractedKnowledge as Record<string, any>) || {};
    return extractedKnowledge.snapshots || [];
  } catch (error) {
    console.error("Error getting snapshots:", error);
    return [];
  }
}

