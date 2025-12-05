import { NextResponse } from "next/server";
import { compare } from "bcrypt";
import { prisma } from "../../../../lib/prisma";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email },
      });
    } catch (dbError: any) {
      console.error("Database error:", dbError);
      // Check if it's a connection error
      if (dbError.code === "P1017" || dbError.message?.includes("connection")) {
        return NextResponse.json(
          {
            error:
              "Database connection error. Please check your DATABASE_URL and ensure the database server is running.",
          },
          { status: 503 }
        );
      }
      throw dbError; // Re-throw if it's not a connection error
    }

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const userOrganizations: any = await prisma.userOrganization.findMany({
      where: { userId: user.id },
      include: {
        organization: true,
      },
    });

    const deactivatedOrg: any = userOrganizations.find(
      (uo: any) => uo.organization && uo.organization.deactivatedAt !== null
    );

    if (deactivatedOrg) {
      return NextResponse.json(
        {
          error: "Organization deactivated",
          message: `Your organization "${deactivatedOrg.organization.name}" has been deactivated. Please contact your administrator.`,
          organizationDeactivated: true,
        },
        { status: 403 }
      );
    }

    // Check if user has at least one active organization
    // User is active if: deactivatedAt is null/undefined AND organization is not deactivated
    const hasActiveOrganization = userOrganizations.some(
      (uo: any) => {
        const isMemberActive = uo.deactivatedAt === null || uo.deactivatedAt === undefined;
        const isOrgActive = uo.organization && (uo.organization.deactivatedAt === null || uo.organization.deactivatedAt === undefined);
        return isMemberActive && isOrgActive;
      }
    );

    // Only block signin if user has organizations but none are active
    if (userOrganizations.length > 0 && !hasActiveOrganization) {
      // User is deactivated in all organizations or all organizations are deactivated
      const deactivatedMember: any = userOrganizations.find(
        (uo: any) => {
          const isDeactivated = uo.deactivatedAt !== null && uo.deactivatedAt !== undefined;
          return isDeactivated;
        }
      );
      
      const orgName = deactivatedMember?.organization?.name || userOrganizations[0]?.organization?.name || "your organization";
      
      return NextResponse.json(
        {
          error: "Account deactivated",
          message: `Your account has been deactivated in "${orgName}". Please contact your administrator.`,
          memberDeactivated: true,
        },
        { status: 403 }
      );
    }

    if (user.globalRole === "SUPERADMIN" && user.lastLoginAt === null) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      const resetTokenExpiry = new Date(Date.now() + 3600000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: hashedToken,
          resetTokenExpiry,
        },
      });

      return NextResponse.json(
        {
          error: "Password reset required",
          requiresPasswordReset: true,
          resetToken: resetToken,
          redirectTo: "/reset-password",
          message: "Please reset your password to continue",
        },
        { status: 403 }
      );
    }

    let accessToken: string;
    let refreshToken: string;

    try {
      const { generateAccessToken, generateRefreshToken } = await import(
        "@/lib/auth"
      );

      if (!generateAccessToken || !generateRefreshToken) {
        throw new Error("Failed to import JWT functions");
      }

      accessToken = await generateAccessToken({
        userId: user.id,
        email: user.email,
      });

      refreshToken = await generateRefreshToken({
        userId: user.id,
        email: user.email,
      });

      if (!accessToken || !refreshToken) {
        throw new Error("Failed to generate tokens");
      }
    } catch (jwtError: any) {
      console.error("JWT error:", jwtError);
      console.error("JWT error stack:", jwtError.stack);
      return NextResponse.json(
        {
          error:
            jwtError?.message ||
            "JWT secrets not configured. Please set JWT_SECRET and REFRESH_SECRET in your environment variables.",
        },
        { status: 500 }
      );
    }

    // Save refresh token to DB
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    // Safety check - ensure user is still defined
    if (!user || !user.id || !user.email) {
      console.error("User object is invalid:", user);
      return NextResponse.json(
        { error: "User data is invalid" },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
      },
    });

    response.cookies.set("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    response.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (error: any) {
    console.error("Signin error:", error);
    console.error("Signin error stack:", error?.stack);
    console.error("Signin error message:", error?.message);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
