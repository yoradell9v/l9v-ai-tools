import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessBrainId: string }> }
) {
  try {
    const { businessBrainId } = await params;

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

    // Get user with globalRole
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        globalRole: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    // Get user's organizations
    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null,
        },
      },
      select: {
        id: true,
      },
    });

    const userOrganizationIds = userOrganizations.map((uo) => uo.id);

    // Fetch the business brain
    const businessBrain = await prisma.businessBrain.findUnique({
      where: { id: businessBrainId },
      include: {
        userOrganization: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            user: {
              select: {
                id: true,
              },
            },
          },
        },
        cards: {
          orderBy: {
            orderIndex: "asc",
          },
        },
      },
    });

    if (!businessBrain) {
      return NextResponse.json(
        { success: false, error: "Business brain not found." },
        { status: 404 }
      );
    }

    // Check access: SUPERADMIN can access all, others only their org's brains
    if (
      user.globalRole !== "SUPERADMIN" &&
      !userOrganizationIds.includes(businessBrain.userOrganizationId)
    ) {
      return NextResponse.json(
        { success: false, error: "Access denied." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      businessBrain: {
        id: businessBrain.id,
        createdAt: businessBrain.createdAt,
        updatedAt: businessBrain.updatedAt,
        intakeData: businessBrain.intakeData,
        fileUploads: businessBrain.fileUploads,
        completionScore: businessBrain.completionScore,
        completionData: businessBrain.completionData,
        organization: businessBrain.userOrganization.organization,
      },
      cards: businessBrain.cards.map((card) => ({
        ...card,
        confidence_score: (card.metadata as any)?.confidence_score || undefined,
      })),
    });
  } catch (err: any) {
    console.error("Error fetching business brain:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to fetch business brain.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ businessBrainId: string }> }
) {
  try {
    const { businessBrainId } = await params;

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

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        globalRole: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    const businessBrain = await prisma.businessBrain.findUnique({
      where: { id: businessBrainId },
      include: {
        userOrganization: {
          include: {
            user: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!businessBrain) {
      return NextResponse.json(
        { success: false, error: "Business brain not found." },
        { status: 404 }
      );
    }

    // Only the creator can delete, even if SUPERADMIN
    if (businessBrain.userOrganization.user.id !== decoded.userId) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own business brains." },
        { status: 403 }
      );
    }

    await prisma.businessBrain.delete({
      where: { id: businessBrainId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting business brain:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to delete business brain.",
      },
      { status: 500 }
    );
  }
}

