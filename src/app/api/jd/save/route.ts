import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export async function POST(request: Request) {
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

    const body = await request.json();
    const {
      title,
      intakeData,
      analysis,
      isFinalized,
      finalizedAt,
      organizationId,
    } = body;

    if (!title || !intakeData || !analysis) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: title, intakeData, and analysis are required.",
        },
        { status: 400 }
      );
    }

    // Get user's organizations
    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null, // Only active organizations
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            deactivatedAt: true,
          },
        },
      },
    });

    if (userOrganizations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User does not belong to any active organization.",
        },
        { status: 403 }
      );
    }

    // Use provided organizationId if valid, otherwise use the first organization
    let userOrganizationId: string;
    if (organizationId) {
      const userOrg = userOrganizations.find(
        (uo) => uo.organizationId === organizationId
      );
      if (!userOrg) {
        return NextResponse.json(
          {
            success: false,
            error: "User does not have access to the specified organization.",
          },
          { status: 403 }
        );
      }
      userOrganizationId = userOrg.id;
    } else {
      // Use the first organization
      userOrganizationId = userOrganizations[0].id;
    }

    const savedAnalysis = await prisma.savedAnalysis.create({
      data: {
        userOrganizationId,
        title,
        intakeData,
        analysis,
        versionNumber: 1,
      } as any,
    });

    return NextResponse.json({ success: true, savedAnalysis });
  } catch (err: any) {
    console.error("Error saving analysis", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save analysis." },
      { status: 500 }
    );
  }
}
