import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/core/prisma";
import { verifyAccessToken } from "@/lib/core/auth";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
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

    const { documentId } = await params;

    let document;
    try {
      document = await (prisma as any).organizationDocument.findUnique({
        where: { id: documentId },
        include: {
          knowledgeBase: {
            include: {
              organization: {
                include: {
                  users: {
                    where: {
                      userId: decoded.userId,
                      deactivatedAt: null,
                    },
                  },
                },
              },
            },
          },
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

    if (!document) {
      return NextResponse.json(
        { success: false, message: "Document not found." },
        { status: 404 }
      );
    }

    if (document.knowledgeBase.organization.users.length === 0) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 403 }
      );
    }

    let insights: any[] = [];
    if (
      document.knowledgeBase.aiInsights &&
      typeof document.knowledgeBase.aiInsights === "object"
    ) {
      const aiInsights = document.knowledgeBase.aiInsights as any;
      if (
        aiInsights.documentInsights &&
        Array.isArray(aiInsights.documentInsights)
      ) {
        insights = aiInsights.documentInsights
          .filter((insight: any) => insight.documentId === documentId)
          .map((insight: any) => ({
            field: insight.field,
            insight: insight.insight,
            confidence: insight.confidence,
            extractedAt: insight.extractedAt,
          }));
      }
    }

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
        extractedAt: document.extractedAt?.toISOString() || null,
        extractionStatus: document.extractionStatus,
        extractionError: document.extractionError || null,
        extractedContent: document.extractedContent
          ? {
              summary: (document.extractedContent as any).summary || null,
              keyPoints: (document.extractedContent as any).keyPoints || [],
            }
          : null,
        insights: insights,
      },
    });
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch document." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
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

    const { documentId } = await params;

    let document;
    try {
      document = await (prisma as any).organizationDocument.findUnique({
        where: { id: documentId },
        include: {
          knowledgeBase: {
            include: {
              organization: {
                include: {
                  users: {
                    where: {
                      userId: decoded.userId,
                      deactivatedAt: null,
                    },
                  },
                },
              },
            },
          },
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

    if (!document) {
      return NextResponse.json(
        { success: false, message: "Document not found." },
        { status: 404 }
      );
    }
    if (document.knowledgeBase.organization.users.length === 0) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 403 }
      );
    }
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: document.key,
      });
      await s3Client.send(deleteCommand);
    } catch (s3Error) {
      console.error("Error deleting file from S3:", s3Error);
    }

    await prisma.organizationDocument.delete({
      where: { id: documentId },
    });

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete document." },
      { status: 500 }
    );
  }
}
