import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/core/auth";
import { prisma } from "@/lib/core/prisma";
import type { ToolId } from "@/lib/tool-chat/types";
import type { OrganizationKnowledgeBase } from "@/lib/knowledge-base/organization-knowledge-base";
import { getKBFieldsForTool } from "@/lib/knowledge-base/organization-knowledge-base";

export interface AuthResult {
  userId: string | null;
  organizationId: string | null;
  userOrgId: string | null;
  knowledgeBase: OrganizationKnowledgeBase | null;
  knowledgeBaseVersion: number | null;
  knowledgeBaseSnapshot: any | null;
}

/**
 * Fetches authentication and knowledge base data for tool chat requests.
 * Returns null values if not authenticated (non-blocking).
 *
 * @param toolId - Tool ID to determine which KB fields to fetch
 * @returns AuthResult with user, org, and KB data
 */
export async function getToolChatAuth(toolId: ToolId): Promise<AuthResult> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;

  if (!accessToken) {
    return {
      userId: null,
      organizationId: null,
      userOrgId: null,
      knowledgeBase: null,
      knowledgeBaseVersion: null,
      knowledgeBaseSnapshot: null,
    };
  }

  try {
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return {
        userId: null,
        organizationId: null,
        userOrgId: null,
        knowledgeBase: null,
        knowledgeBaseVersion: null,
        knowledgeBaseSnapshot: null,
      };
    }

    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: decoded.userId,
        organization: { deactivatedAt: null },
        deactivatedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!userOrg) {
      return {
        userId: decoded.userId,
        organizationId: null,
        userOrgId: null,
        knowledgeBase: null,
        knowledgeBaseVersion: null,
        knowledgeBaseSnapshot: null,
      };
    }

    // Fetch KB with tool-specific fields (using function from KB file)
    const kbFieldsRaw = getKBFieldsForTool(toolId);
    let kbFields: Record<string, any> | undefined =
      kbFieldsRaw && typeof kbFieldsRaw === "object" ? kbFieldsRaw : undefined;
    if (kbFields && Object.keys(kbFields).length === 0) {
      // Prisma does not allow an empty select.
      kbFields = { id: true, organizationId: true, version: true };
    }
    const knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
      where: { organizationId: userOrg.organizationId },
      ...(kbFields ? { select: kbFields } : {}),
    });

    if (!knowledgeBase) {
      return {
        userId: decoded.userId,
        organizationId: userOrg.organizationId,
        userOrgId: userOrg.id,
        knowledgeBase: null,
        knowledgeBaseVersion: null,
        knowledgeBaseSnapshot: null,
      };
    }

    const kbVersion = knowledgeBase.version;
    const kbSnapshot = createKBSnapshot(knowledgeBase);

    return {
      userId: decoded.userId,
      organizationId: userOrg.organizationId,
      userOrgId: userOrg.id,
      knowledgeBase: knowledgeBase as any,
      knowledgeBaseVersion: kbVersion,
      knowledgeBaseSnapshot: kbSnapshot,
    };
  } catch (error) {
    console.warn("Failed to fetch KB for tool chat (non-blocking):", error);
    return {
      userId: null,
      organizationId: null,
      userOrgId: null,
      knowledgeBase: null,
      knowledgeBaseVersion: null,
      knowledgeBaseSnapshot: null,
    };
  }
}

/**
 * Creates a snapshot of KB state for audit trail.
 * Excludes large JSON fields to optimize storage.
 */
function createKBSnapshot(kb: any): any {
  const {
    aiInsights,
    extractedKnowledge,
    proofFiles,
    completenessBreakdown,
    aiQualityAnalysis,
    ...snapshot
  } = kb;
  return {
    ...snapshot,
    snapshotAt: new Date().toISOString(),
  };
}
