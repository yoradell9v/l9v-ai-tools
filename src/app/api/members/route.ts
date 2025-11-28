import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export async function GET() {
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

    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        role: "ADMIN",
        organization: {
          deactivatedAt: null,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (userOrganizations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "You must be a tenant admin to view members.",
        },
        { status: 403 }
      );
    }

    const organizationIds = userOrganizations.map((uo) => uo.organizationId);

    const members = await prisma.userOrganization.findMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const pendingInvites = await prisma.invitationToken.findMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
        cancelledAt: null,
        acceptedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const organizationData = userOrganizations.map((userOrg) => {
      const orgId = userOrg.organizationId;
      const orgMembers = members.filter((m) => m.organizationId === orgId);
      const orgInvites = pendingInvites.filter(
        (inv) => inv.organizationId === orgId
      );

      return {
        organization: userOrg.organization,
        members: orgMembers.map((m) => ({
          id: m.id,
          userId: m.user.id,
          firstname: m.user.firstname,
          lastname: m.user.lastname,
          email: m.user.email,
          role: m.role,
          joinedAt: m.createdAt.toISOString(),
        })),
        pendingInvites: orgInvites.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          createdAt: inv.createdAt.toISOString(),
          expiresAt: inv.expiresAt.toISOString(),
        })),
      };
    });

    return NextResponse.json({
      success: true,
      organizations: organizationData,
    });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
