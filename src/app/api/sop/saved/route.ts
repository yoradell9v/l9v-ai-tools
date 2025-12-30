import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    // Get user from session
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

    // Get user's organizations
    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null, // Only active organizations
        },
        deactivatedAt: null, // Only active user-organization relationships
      },
      select: {
        id: true,
        userId: true,
        organizationId: true,
      },
    });

    if (userOrganizations.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          sops: [],
          total: 0,
        },
      });
    }

    // Get all organization IDs the user belongs to
    const organizationIds = userOrganizations.map((uo) => uo.organizationId);

    // Get ALL userOrganization records for those organizations (all members)
    const allUserOrganizations = await prisma.userOrganization.findMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
        organization: {
          deactivatedAt: null, // Only active organizations
        },
        deactivatedAt: null, // Only active user-organization relationships
      },
      select: {
        id: true,
      },
    });

    const userOrganizationIds = allUserOrganizations.map((uo) => uo.id);

    // Get query parameters for pagination
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    // Get query parameter to include all versions (for version selector)
    const includeAllVersions = searchParams.get("includeAllVersions") === "true";
    
    // Build where clause
    const where: any = {
      userOrganizationId: {
        in: userOrganizationIds,
      },
    };
    
    // Check if versioning fields exist in the database
    // This allows backward compatibility if migration hasn't been run
    let hasVersionFields = false;
    try {
      // Check if the column exists using information_schema
      const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'SOP' AND column_name = 'versionNumber'
        LIMIT 1
      `;
      hasVersionFields = result.length > 0;
    } catch (e: any) {
      // If query fails, assume fields don't exist
      hasVersionFields = false;
      console.warn("[SOP Saved] Could not check for version fields - assuming migration not applied");
    }

    // Build where clause - only filter by isCurrentVersion if field exists
    const whereClause: any = {
      userOrganizationId: {
        in: userOrganizationIds,
      },
    };
    
    if (hasVersionFields && !includeAllVersions) {
      whereClause.isCurrentVersion = true; // Only show latest versions by default
    }

    // Build select fields - conditionally include version fields
    const baseSelect: any = {
      id: true,
      title: true,
      content: true,
      intakeData: true,
      usedKnowledgeBaseVersion: true,
      knowledgeBaseSnapshot: true,
      contributedInsights: true,
      organizationId: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
      userOrganization: {
        select: {
          userId: true,
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
    };

    // Add version fields only if they exist in the database
    if (hasVersionFields) {
      baseSelect.versionNumber = true;
      baseSelect.rootSOPId = true;
      baseSelect.isCurrentVersion = true;
    }

    // Fetch saved SOPs - wrap in try-catch as fallback
    let sops: any[];
    let total: number;
    
    try {
      [sops, total] = await Promise.all([
        prisma.sOP.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: {
            createdAt: "desc",
          },
          select: baseSelect,
        }),
        prisma.sOP.count({ where: whereClause }),
      ]);
    } catch (error: any) {
      // If query fails (e.g., field doesn't exist despite check), retry without version fields
      if (error.message?.includes("Unknown column") || 
          error.message?.includes("does not exist") || 
          error.code === "P2021" ||
          error.code === "P2001") {
        console.warn("[SOP Saved] Query failed with version fields, retrying without them");
        
        // Remove version fields from select and where
        delete baseSelect.versionNumber;
        delete baseSelect.rootSOPId;
        delete baseSelect.isCurrentVersion;
        delete whereClause.isCurrentVersion;
        
        [sops, total] = await Promise.all([
          prisma.sOP.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
              createdAt: "desc",
            },
            select: baseSelect,
          }),
          prisma.sOP.count({ where: whereClause }),
        ]);
      } else {
        throw error;
      }
    }

    // Add default version values if fields don't exist (for backward compatibility)
    const sopsWithVersions = hasVersionFields && sops[0]?.versionNumber !== undefined
      ? sops 
      : sops.map((sop: any) => ({
          ...sop,
          versionNumber: sop.versionNumber ?? 1,
          rootSOPId: sop.rootSOPId ?? sop.id,
          isCurrentVersion: sop.isCurrentVersion ?? true,
        }));

    return NextResponse.json({
      success: true,
      data: {
        sops: sopsWithVersions,
        total,
        page,
        limit,
      },
    });
  } catch (error: any) {
    console.error("[SOP Saved] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch saved SOPs",
      },
      { status: 500 }
    );
  }
}

