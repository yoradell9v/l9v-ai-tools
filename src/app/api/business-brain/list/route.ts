import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
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

    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null,
        },
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    const userOrganizationIds = userOrganizations.map((uo) => uo.id);
    const currentUserOrganizationIds = userOrganizations.map(
      (uo) => uo.organizationId
    );

    let businessBrains;

    if (user.globalRole === "SUPERADMIN") {
      businessBrains = await prisma.businessBrain.findMany({
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
                  firstname: true,
                  lastname: true,
                  email: true,
                },
              },
            },
          },
          cards: {
            select: {
              id: true,
            },
            take: 1,
          },
          _count: {
            select: {
              cards: true,
              conversations: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } else {
      businessBrains = await prisma.businessBrain.findMany({
        where: {
          userOrganizationId: {
            in: userOrganizationIds,
          },
        },
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
                  firstname: true,
                  lastname: true,
                  email: true,
                },
              },
            },
          },
          cards: {
            select: {
              id: true,
            },
            take: 1,
          },
          _count: {
            select: {
              cards: true,
              conversations: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    const formattedBrains = businessBrains.map((brain) => {
      const intakeData = brain.intakeData as any;
      return {
        id: brain.id,
        businessName: intakeData?.businessName || "Unnamed Business",
        createdAt: brain.createdAt,
        updatedAt: brain.updatedAt,
        completionScore: brain.completionScore,
        organization: brain.userOrganization.organization,
        createdBy: brain.userOrganization.user,
        hasCards: brain._count.cards > 0,
        cardsCount: brain._count.cards,
        conversationsCount: brain._count.conversations,
      };
    });

    return NextResponse.json({
      success: true,
      businessBrains: formattedBrains,
      currentUserOrganizationIds,
      currentUserGlobalRole: user.globalRole,
    });
  } catch (err: any) {
    console.error("Error fetching business brains list:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to fetch business brains.",
      },
      { status: 500 }
    );
  }
}
