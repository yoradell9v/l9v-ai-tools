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

    // Build where clause
    const where: any = {
      userOrganizationId: {
        in: userOrganizationIds,
      },
    };

    // Fetch saved SOPs
    const [sops, total] = await Promise.all([
      prisma.sOP.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        select: {
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
        },
      }),
      prisma.sOP.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        sops,
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

