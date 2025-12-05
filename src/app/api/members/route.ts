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
          deactivatedAt: m.deactivatedAt?.toISOString() || null,
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

export async function PATCH(request: Request) {
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

    const body = await request.json();
    const { memberId, action } = body;

    if (!memberId || !action) {
      return NextResponse.json(
        { success: false, message: "Member ID and action are required." },
        { status: 400 }
      );
    }

    if (action !== "deactivate" && action !== "activate") {
      return NextResponse.json(
        { success: false, message: "Invalid action. Must be 'deactivate' or 'activate'." },
        { status: 400 }
      );
    }

    // Verify the requester is an ADMIN of the organization
    const memberToUpdate = await prisma.userOrganization.findUnique({
      where: { id: memberId },
      include: {
        organization: true,
      },
    });

    if (!memberToUpdate) {
      return NextResponse.json(
        { success: false, message: "Member not found." },
        { status: 404 }
      );
    }

    // Check if requester is SUPERADMIN or ADMIN of the same organization
    const requester = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { globalRole: true },
    });

    const isSuperAdmin = requester?.globalRole === "SUPERADMIN";

    const requesterOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: decoded.userId,
        organizationId: memberToUpdate.organizationId,
        role: "ADMIN",
        deactivatedAt: null,
        organization: {
          deactivatedAt: null,
        },
      },
    });

    if (!isSuperAdmin && !requesterOrg) {
      return NextResponse.json(
        { success: false, message: "You must be a super admin or an admin of this organization to perform this action." },
        { status: 403 }
      );
    }

    // Prevent deactivating yourself (unless you're a SUPERADMIN deactivating someone else)
    if (!isSuperAdmin) {
      const currentUserOrg = await prisma.userOrganization.findFirst({
        where: {
          userId: decoded.userId,
          organizationId: memberToUpdate.organizationId,
        },
      });

      if (currentUserOrg && memberToUpdate.id === currentUserOrg.id && action === "deactivate") {
        return NextResponse.json(
          { success: false, message: "You cannot deactivate yourself." },
          { status: 400 }
        );
      }
    }

    // Update member
    const updatedMember = await prisma.userOrganization.update({
      where: { id: memberId },
      data: {
        deactivatedAt: action === "deactivate" ? new Date() : null,
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
      },
    });

    return NextResponse.json({
      success: true,
      member: {
        id: updatedMember.id,
        userId: updatedMember.user.id,
        firstname: updatedMember.user.firstname,
        lastname: updatedMember.user.lastname,
        email: updatedMember.user.email,
        role: updatedMember.role,
        joinedAt: updatedMember.createdAt.toISOString(),
        deactivatedAt: updatedMember.deactivatedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
