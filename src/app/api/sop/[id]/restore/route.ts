import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/core/prisma";
import { verifyAccessToken } from "@/lib/core/auth";
import { markdownToHtml } from "@/lib/extraction/markdown-to-html";
import { htmlToMarkdown } from "@/lib/extraction/html-to-markdown";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Invalid token." },
        { status: 401 }
      );
    }

    const { id: versionSOPId } = await params; 

    if (!versionSOPId) {
      return NextResponse.json(
        { success: false, error: "SOP ID is required." },
        { status: 400 }
      );
    }

    const versionToRestore = await prisma.sOP.findUnique({
      where: { id: versionSOPId },
      include: {
        userOrganization: {
          select: {
            userId: true,
            organizationId: true,
          },
        },
      },
    });

    if (!versionToRestore) {
      return NextResponse.json(
        { success: false, error: "SOP version not found." },
        { status: 404 }
      );
    }

    if (versionToRestore.userOrganization.userId !== decoded.userId) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to restore this version." },
        { status: 403 }
      );
    }

    if (versionToRestore.isCurrentVersion) {
      return NextResponse.json({
        success: true,
        message: "This version is already the current version.",
        sop: {
          id: versionToRestore.id,
          versionNumber: versionToRestore.versionNumber,
        },
      });
    }

    const rootSOPId = versionToRestore.rootSOPId || versionToRestore.id;

    const currentVersion = await prisma.sOP.findFirst({
      where: {
        rootSOPId: rootSOPId,
        isCurrentVersion: true,
      },
    });

    if (currentVersion) {
      await prisma.sOP.update({
        where: { id: currentVersion.id },
        data: { isCurrentVersion: false },
      });
    }

    const content = versionToRestore.content as any;
    const htmlContent = content?.html || "";

    let markdownContent = "";
    if (htmlContent) {
      try {
        markdownContent = htmlToMarkdown(htmlContent);
      } catch (error) {
        console.error("[SOP Restore] Error converting HTML to markdown:", error);
      }
    }

    const newVersionNumber = (versionToRestore.versionNumber || 1) + 1;

    const restoredSOP = await prisma.sOP.create({
      data: {
        userOrganizationId: versionToRestore.userOrganizationId,
        organizationId: versionToRestore.organizationId,
        title: versionToRestore.title,
        content: {
          html: htmlContent,
          version: newVersionNumber.toString(),
          generatedAt: content?.generatedAt || new Date().toISOString(),
          lastEditedAt: new Date().toISOString(),
        },
        intakeData: versionToRestore.intakeData ?? undefined,
        usedKnowledgeBaseVersion: versionToRestore.usedKnowledgeBaseVersion ?? undefined,
        knowledgeBaseSnapshot: versionToRestore.knowledgeBaseSnapshot ?? undefined,
        contributedInsights: versionToRestore.contributedInsights ?? undefined,
        versionNumber: newVersionNumber,
        rootSOPId: rootSOPId,
        isCurrentVersion: true,
        versionCreatedBy: decoded.userId,
        versionCreatedAt: new Date(),
        metadata: {
          ...(versionToRestore.metadata as any),
          restoredFromVersion: versionToRestore.versionNumber,
          restoredAt: new Date().toISOString(),
          restoredBy: decoded.userId,
        },
      } as any,
      select: {
        id: true,
        title: true,
        content: true,
        versionNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Version ${versionToRestore.versionNumber} has been restored as version ${newVersionNumber}.`,
      sop: {
        id: restoredSOP.id,
        title: restoredSOP.title,
        versionNumber: restoredSOP.versionNumber,
        content: restoredSOP.content,
        sopHtml: (restoredSOP.content as any)?.html || "",
      },
    });
  } catch (error: any) {
    console.error("[SOP Restore] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to restore SOP version",
      },
      { status: 500 }
    );
  }
}

