import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tenant = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
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
        },
        invitations: {
          where: {
            acceptedAt: null,
            acceptedBy: null,
            cancelledAt: null,
          } as any,
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    }) as any;

    if (!tenant) {
      return NextResponse.json(
        { success: false, message: "Tenant not found." },
        { status: 404 }
      );
    }

    // Format collaborators
    const collaborators = (tenant.users || []).map((userOrg: any) => ({
      id: userOrg.id,
      userId: userOrg.user.id,
      firstname: userOrg.user.firstname,
      lastname: userOrg.user.lastname,
      email: userOrg.user.email,
      role: userOrg.role,
      joinedAt: userOrg.createdAt,
      deactivatedAt: userOrg.deactivatedAt?.toISOString() || null,
    }));

    // Format pending invites
    const pendingInvites = (tenant.invitations || []).map((invite: any) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
    }));

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        deactivatedAt: (tenant as any).deactivatedAt,
        collaborators,
        pendingInvites,
      },
    });
  } catch (error) {
    console.error("Error fetching tenant details:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

// PATCH endpoint: Deactivate tenant
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get user from session
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

    const { id } = await params;
    const { action } = await request.json();

    if (action !== "deactivate" && action !== "activate") {
      return NextResponse.json(
        { success: false, message: "Invalid action." },
        { status: 400 }
      );
    }

    // Check if tenant exists
    const tenant = await prisma.organization.findUnique({
      where: { id },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, message: "Tenant not found." },
        { status: 404 }
      );
    }

    if (action === "deactivate") {
      // Check if already deactivated
      if ((tenant as any).deactivatedAt) {
        return NextResponse.json(
          { success: false, message: "Tenant is already deactivated." },
          { status: 400 }
        );
      }

      // Deactivate the tenant
      await prisma.organization.update({
        where: { id },
        data: {
          deactivatedAt: new Date(),
        } as any,
      });

      return NextResponse.json({
        success: true,
        message: "Tenant deactivated successfully.",
      });
    } else if (action === "activate") {
      // Check if already activated
      if (!(tenant as any).deactivatedAt) {
        return NextResponse.json(
          { success: false, message: "Tenant is already active." },
          { status: 400 }
        );
      }

      // Activate the tenant
      await prisma.organization.update({
        where: { id },
        data: {
          deactivatedAt: null,
        } as any,
      });

      return NextResponse.json({
        success: true,
        message: "Tenant activated successfully.",
      });
    }
  } catch (error) {
    console.error("Error deactivating tenant:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

