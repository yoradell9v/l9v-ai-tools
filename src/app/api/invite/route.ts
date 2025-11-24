import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import crypto from "crypto";
import { sendInviteEmail } from "@/lib/email";

export async function POST(request: Request) {
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

    const { organizationId, email, role } = await request.json();
    if (!organizationId || !email || !role) {
      return NextResponse.json(
        {
          success: false,
          message: "Organization ID, email, and role are required.",
        },
        { status: 400 }
      );
    }

    // Validate role value
    if (role !== "ADMIN" && role !== "MEMBER") {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid role. Expected "ADMIN" or "MEMBER", got "${role}".`,
        },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now
    const token = crypto.randomBytes(32).toString("hex");

    try {
      const tenantInvite = await prisma.invitationToken.create({
        data: {
          organizationId: organizationId,
          email: email,
          role: role as any, // Type assertion needed until Prisma types are fully synced
          token: token,
          expiresAt: expiresAt,
          createdBy: decoded.userId,
        },
      });

      await sendInviteEmail(email, token);

      return NextResponse.json({
        success: true,
        invite: tenantInvite,
      });
    } catch (prismaError: any) {
      console.error("Prisma error creating invite:", prismaError);
      // Handle unique constraint violation (duplicate email for organization)
      if (prismaError.code === "P2002") {
        return NextResponse.json(
          {
            success: false,
            message: "An invitation has already been sent to this email for this organization.",
          },
          { status: 409 }
        );
      }
      throw prismaError; // Re-throw to be caught by outer catch
    }

  } catch (error: any) {
    console.error("Error creating invite:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || "Failed sending an invite. Please try again." 
      },
      { status: 500 }
    );
  }
}

// DELETE endpoint: Cancel an invitation
export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get("id");

    if (!inviteId) {
      return NextResponse.json(
        { success: false, message: "Invitation ID is required." },
        { status: 400 }
      );
    }

    // Find the invitation
    const invitation = await prisma.invitationToken.findUnique({
      where: { id: inviteId },
      include: {
        organization: {
          select: {
            id: true,
          },
        },
      },
    }) as any;

    if (!invitation) {
      return NextResponse.json(
        { success: false, message: "Invitation not found." },
        { status: 404 }
      );
    }

    // Check if already accepted
    if (invitation.acceptedAt || invitation.acceptedBy) {
      return NextResponse.json(
        { success: false, message: "Cannot cancel an invitation that has already been accepted." },
        { status: 400 }
      );
    }

    // Check if already cancelled
    if (invitation.cancelledAt) {
      return NextResponse.json(
        { success: false, message: "This invitation has already been cancelled." },
        { status: 400 }
      );
    }

    // Cancel the invitation
    await prisma.invitationToken.update({
      where: { id: inviteId },
      data: {
        cancelledAt: new Date(),
      } as any,
    });

    return NextResponse.json({
      success: true,
      message: "Invitation cancelled successfully.",
    });
  } catch (error: any) {
    console.error("Error cancelling invite:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || "Failed to cancel invitation. Please try again." 
      },
      { status: 500 }
    );
  }
}
