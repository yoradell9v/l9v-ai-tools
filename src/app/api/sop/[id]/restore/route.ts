import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { markdownToHtml } from "@/lib/markdown-to-html";
import { htmlToMarkdown } from "@/lib/html-to-markdown";

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

    // Await params (Next.js 15+)
    const { id: versionSOPId } = await params; // The ID of the version to restore

    if (!versionSOPId) {
      return NextResponse.json(
        { success: false, error: "SOP ID is required." },
        { status: 400 }
      );
    }

    // Get the version to restore
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

    // Verify user has access
    if (versionToRestore.userOrganization.userId !== decoded.userId) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to restore this version." },
        { status: 403 }
      );
    }

    // If this is already the current version, no need to restore
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

    // Find current version and mark it as not current
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

    // Create a new version from the restored content
    // This preserves history while making the old version current
    const content = versionToRestore.content as any;
    const htmlContent = content?.html || "";

    // Convert HTML to markdown for editing compatibility
    let markdownContent = "";
    if (htmlContent) {
      try {
        markdownContent = htmlToMarkdown(htmlContent);
      } catch (error) {
        console.error("[SOP Restore] Error converting HTML to markdown:", error);
        // Continue without markdown - HTML is primary
      }
    }

    const newVersionNumber = (versionToRestore.versionNumber || 1) + 1;

    // Create new version from restored content
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
        // VERSIONING: Create new version from restored content
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

