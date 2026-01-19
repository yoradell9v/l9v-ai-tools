import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/core/prisma";
import { verifyAccessToken } from "@/lib/core/auth";
import { processDocumentExtraction } from "@/lib/extraction/document-extraction";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: "Invalid token." },
        { status: 401 }
      );
    }

    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null,
        },
        deactivatedAt: null,
      },
      select: {
        organizationId: true,
      },
    });

    if (!userOrg) {
      return NextResponse.json(
        { success: false, message: "No organization found." },
        { status: 404 }
      );
    }

    const knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
      where: {
        organizationId: userOrg.organizationId,
      },
      select: {
        id: true,
        aiInsights: true,
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        { success: false, message: "Knowledge base not found." },
        { status: 404 }
      );
    }

    let documents;
    try {
      documents = await (prisma as any).organizationDocument.findMany({
        where: {
          knowledgeBaseId: knowledgeBase.id,
        },
        orderBy: {
          uploadedAt: "desc",
        },
      });
    } catch (error: any) {
      if (error?.code === "P2021") {
        return NextResponse.json({
          success: true,
          documents: [],
        });
      }
      throw error;
    }
    const insightsMap: Record<string, any[]> = {};
    if (
      knowledgeBase.aiInsights &&
      typeof knowledgeBase.aiInsights === "object"
    ) {
      const aiInsights = knowledgeBase.aiInsights as any;
      if (
        aiInsights.documentInsights &&
        Array.isArray(aiInsights.documentInsights)
      ) {
        aiInsights.documentInsights.forEach((insight: any) => {
          if (!insightsMap[insight.documentId]) {
            insightsMap[insight.documentId] = [];
          }
          insightsMap[insight.documentId].push({
            field: insight.field,
            insight: insight.insight,
            confidence: insight.confidence,
            extractedAt: insight.extractedAt,
          });
        });
      }
    }

    return NextResponse.json({
      success: true,
      documents: documents.map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        url: doc.url,
        key: doc.key,
        type: doc.type,
        size: doc.size,
        uploadedAt: doc.uploadedAt.toISOString(),
        extractedAt: doc.extractedAt?.toISOString() || null,
        extractionStatus: doc.extractionStatus,
        extractionError: doc.extractionError || null,
        extractedContent: doc.extractedContent
          ? {
              summary: (doc.extractedContent as any).summary || null,
              keyPoints: (doc.extractedContent as any).keyPoints || [],
            }
          : null,
        insights: insightsMap[doc.id] || [],
      })),
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch documents." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: "Invalid token." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, url, key, type, size } = body;

    if (!name || !url || !key || !type) {
      return NextResponse.json(
        { success: false, message: "Missing required fields." },
        { status: 400 }
      );
    }
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null,
        },
        deactivatedAt: null,
      },
      select: {
        organizationId: true,
      },
    });

    if (!userOrg) {
      return NextResponse.json(
        { success: false, message: "No organization found." },
        { status: 404 }
      );
    }

    let knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
      where: {
        organizationId: userOrg.organizationId,
      },
    });

    if (!knowledgeBase) {
      knowledgeBase = await prisma.organizationKnowledgeBase.create({
        data: {
          organizationId: userOrg.organizationId,
          lastEditedBy: decoded.userId,
          contributors: [decoded.userId],
          enrichmentVersion: 1,
          customerJourney: "",
          toolStack: [], 
        },
      });
    }

    let document;
    try {
      document = await (prisma as any).organizationDocument.create({
        data: {
          knowledgeBaseId: knowledgeBase.id,
          name,
          url,
          key,
          type,
          size: size || null,
          uploadedBy: decoded.userId,
          extractionStatus: "PENDING",
        },
      });
    } catch (error: any) {
      if (error?.code === "P2021") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Database migration not applied. Please run: npx prisma migrate dev",
          },
          { status: 500 }
        );
      }
      throw error;
    }
    setTimeout(() => {
      processDocumentExtraction(document.id).catch((error) => {
        console.error(
          `Error processing document extraction for ${document.id}:`,
          error
        );
      });
    }, 0);

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        name: document.name,
        url: document.url,
        key: document.key,
        type: document.type,
        size: document.size,
        uploadedAt: document.uploadedAt.toISOString(),
        extractionStatus: document.extractionStatus,
      },
    });
  } catch (error) {
    console.error("Error creating document:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create document." },
      { status: 500 }
    );
  }
}
