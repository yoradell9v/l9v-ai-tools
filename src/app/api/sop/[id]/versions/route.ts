import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export async function GET(
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
    const { id: sopId } = await params;

    if (!sopId) {
      return NextResponse.json(
        { success: false, error: "SOP ID is required." },
        { status: 400 }
      );
    }

    // Check if versioning fields exist
    let hasVersionFields = false;
    try {
      const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'SOP' AND column_name = 'versionNumber'
        LIMIT 1
      `;
      hasVersionFields = result.length > 0;
    } catch (e: any) {
      hasVersionFields = false;
    }

    // Get the SOP to find its rootSOPId
    const sopSelect: any = {
      id: true,
      userOrganization: {
        select: {
          userId: true,
          organizationId: true,
        },
      },
    };

    if (hasVersionFields) {
      sopSelect.rootSOPId = true;
    }

    const sop = await prisma.sOP.findUnique({
      where: { id: sopId },
      select: sopSelect,
    }) as any;

    if (!sop) {
      return NextResponse.json(
        { success: false, error: "SOP not found." },
        { status: 404 }
      );
    }

    // Verify user has access to this SOP
    if (sop.userOrganization?.userId !== decoded.userId) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to view this SOP." },
        { status: 403 }
      );
    }

    // If versioning fields don't exist, return just this SOP as version 1
    if (!hasVersionFields) {
      return NextResponse.json({
        success: true,
        versions: [
          {
            id: sop.id,
            versionNumber: 1,
            isCurrentVersion: true,
            createdBy: {
              id: sop.userOrganization.userId,
              firstname: "",
              lastname: "",
              email: "",
            },
            createdAt: new Date().toISOString(),
            versionCreatedAt: new Date().toISOString(),
          },
        ],
      });
    }

    // Get rootSOPId (either from the SOP itself or use its ID if it's the root)
    const rootSOPId = (sop as any).rootSOPId || sop.id;

    // Fetch all versions of this SOP
    let versions: any[];
    try {
      versions = await prisma.sOP.findMany({
        where: {
          rootSOPId: rootSOPId,
        },
        orderBy: {
          versionNumber: "desc", // Latest first
        },
        select: {
          id: true,
          versionNumber: true,
          isCurrentVersion: true,
          versionCreatedBy: true,
          versionCreatedAt: true,
          createdAt: true,
          updatedAt: true,
          userOrganization: {
            select: {
              user: {
                select: {
                  id: true,
                  firstname: true,
                  lastname: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    } catch (error: any) {
      // If query fails, return just this SOP
      return NextResponse.json({
        success: true,
        versions: [
          {
            id: sop.id,
            versionNumber: 1,
            isCurrentVersion: true,
            createdBy: {
              id: sop.userOrganization.userId,
              firstname: "",
              lastname: "",
              email: "",
            },
            createdAt: new Date().toISOString(),
            versionCreatedAt: new Date().toISOString(),
          },
        ],
      });
    }

    return NextResponse.json({
      success: true,
      versions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        isCurrentVersion: v.isCurrentVersion,
        createdBy: {
          id: v.userOrganization.user.id,
          firstname: v.userOrganization.user.firstname,
          lastname: v.userOrganization.user.lastname,
          email: v.userOrganization.user.email,
        },
        createdAt: v.createdAt.toISOString(),
        versionCreatedAt: v.versionCreatedAt?.toISOString() || v.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("[SOP Versions] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch SOP versions",
      },
      { status: 500 }
    );
  }
}

