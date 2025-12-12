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
          analyses: [],
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

    // Get query parameters for pagination and filtering
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const finalized = searchParams.get("finalized");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      userOrganizationId: {
        in: userOrganizationIds,
      },
    };

    if (finalized !== null) {
      where.isFinalized = finalized === "true";
    }

    // Fetch all saved analyses with refinement count
    const allAnalyses = await prisma.savedAnalysis.findMany({
      where,
      include: {
        refinements: {
          select: {
            id: true,
          },
        },
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
      orderBy: {
        createdAt: "desc",
      },
    });

    // Group analyses by parentAnalysisId (or id if no parent)
    // For analyses with refinements, only keep the latest version
    const analysisMap = new Map<string, typeof allAnalyses[0]>();
    
    for (const analysis of allAnalyses) {
      const key = analysis.parentAnalysisId || analysis.id;
      
      if (!analysisMap.has(key)) {
        // First time seeing this analysis or its parent
        analysisMap.set(key, analysis);
      } else {
        // Compare version numbers - keep the one with higher version
        const existing = analysisMap.get(key)!;
        const existingVersion = existing.versionNumber || 1;
        const currentVersion = analysis.versionNumber || 1;
        
        if (currentVersion > existingVersion) {
          analysisMap.set(key, analysis);
        }
      }
    }

    // Convert map values to array and sort by createdAt
    const filteredAnalyses = Array.from(analysisMap.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const total = filteredAnalyses.length;
    const paginatedAnalyses = filteredAnalyses.slice(skip, skip + limit);

    // Map to expected format
    const analyses = paginatedAnalyses.map((analysis) => ({
      id: analysis.id,
      userId: analysis.userOrganization.userId,
      title: analysis.title,
      intakeData: analysis.intakeData as any,
      analysis: analysis.analysis as any,
      isFinalized: analysis.isFinalized || false,
      finalizedAt: analysis.finalizedAt?.toISOString() || null,
      createdAt: analysis.createdAt.toISOString(),
      updatedAt: analysis.updatedAt.toISOString(),
      refinementCount: analysis.refinements.length,
      createdBy: {
        id: analysis.userOrganization.user.id,
        firstname: analysis.userOrganization.user.firstname,
        lastname: analysis.userOrganization.user.lastname,
        email: analysis.userOrganization.user.email,
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        analyses,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error("Error fetching saved analyses:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to fetch saved analyses.",
      },
      { status: 500 }
    );
  }
}

