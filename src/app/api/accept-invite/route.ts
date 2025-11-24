import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth";

export const runtime = "nodejs";

// GET endpoint: Validate token and return invite details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Token is required." },
        { status: 400 }
      );
    }

    const invitation = await prisma.invitationToken.findUnique({
      where: { token },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }) as any;

    if (!invitation) {
      return NextResponse.json(
        { success: false, message: "Invalid invitation token." },
        { status: 404 }
      );
    }

    // Check if cancelled
    if ((invitation as any).cancelledAt) {
      return NextResponse.json(
        { success: false, message: "Your invite has been cancelled." },
        { status: 400 }
      );
    }

    // Check if already accepted
    if (invitation.acceptedAt || invitation.acceptedBy) {
      return NextResponse.json(
        { success: false, message: "This invitation has already been accepted." },
        { status: 400 }
      );
    }

    // Check if expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, message: "This invitation has expired." },
        { status: 400 }
      );
    }

    // Check if organization is deactivated
    if (invitation.organization.deactivatedAt) {
      return NextResponse.json(
        { 
          success: false, 
          message: `The organization "${invitation.organization.name}" has been deactivated. Please contact your administrator.`,
          organizationDeactivated: true,
        },
        { status: 403 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email.toLowerCase() },
    });

    return NextResponse.json({
      success: true,
      invite: {
        email: invitation.email,
        role: invitation.role,
        organizationId: invitation.organizationId,
        organizationName: invitation.organization.name,
        organizationSlug: invitation.organization.slug,
        expiresAt: invitation.expiresAt,
        userExists: !!existingUser,
      },
    });
  } catch (error) {
    console.error("Error validating invite:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

// POST endpoint: Accept invite and create user account
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, firstname, lastname, password, confirmPassword } = body;

    if (!token || !firstname || !lastname || !password || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "All fields are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Passwords do not match." },
        { status: 400 }
      );
    }

    // Validate invitation token
    const invitation = await prisma.invitationToken.findUnique({
      where: { token },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            deactivatedAt: true,
          },
        },
      },
    }) as any;

    if (!invitation) {
      return NextResponse.json(
        { success: false, message: "Invalid invitation token." },
        { status: 404 }
      );
    }

    // Check if cancelled
    if ((invitation as any).cancelledAt) {
      return NextResponse.json(
        { success: false, message: "Your invite has been cancelled." },
        { status: 400 }
      );
    }

    // Check if already accepted
    if (invitation.acceptedAt || invitation.acceptedBy) {
      return NextResponse.json(
        { success: false, message: "This invitation has already been accepted." },
        { status: 400 }
      );
    }

    // Check if expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, message: "This invitation has expired." },
        { status: 400 }
      );
    }

    // Check if organization is deactivated
    if ((invitation.organization as any).deactivatedAt) {
      return NextResponse.json(
        { 
          success: false, 
          message: `The organization "${invitation.organization.name}" has been deactivated. Please contact your administrator.`,
          organizationDeactivated: true,
        },
        { status: 403 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "A user with this email already exists." },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Map invitation role to globalRole
    // Set globalRole to match the invitation role (ADMIN -> ADMIN, MEMBER -> MEMBER)
    // Note: Prisma client types may need regeneration if this fails
    const globalRole = invitation.role === "ADMIN" ? "ADMIN" : "MEMBER";

    // Create user account
    const userData: any = {
      firstname,
      lastname,
      email: invitation.email.toLowerCase(),
      password: hashedPassword,
    };

    // Only set globalRole if it has a value
    if (globalRole) {
      userData.globalRole = globalRole;
    }

    const user = await prisma.user.create({
      data: userData,
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        createdAt: true,
      },
    });

    // Create UserOrganization relationship
    await prisma.userOrganization.create({
      data: {
        userId: user.id,
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    });

    // Mark invitation as accepted
    await prisma.invitationToken.update({
      where: { id: invitation.id },
      data: {
        acceptedAt: new Date(),
        acceptedBy: user.id,
      },
    });

    // Generate tokens for automatic sign-in
    const accessToken = await generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const refreshToken = await generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    // Save refresh token to DB
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    const response = NextResponse.json({
      success: true,
      message: "Account created successfully. You have been signed in.",
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
    });

    // Set cookies for automatic sign-in
    response.cookies.set("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    response.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error accepting invite:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

