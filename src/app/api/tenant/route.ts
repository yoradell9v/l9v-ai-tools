import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export async function GET() {
  try {
    // Try to determine the current user's organization (if authenticated)
    let currentTenantId: string | null = null;

    try {
      const cookieStore = await cookies();
      const accessToken = cookieStore.get("accessToken")?.value;

      if (accessToken) {
        const decoded = await verifyAccessToken(accessToken);
        if (decoded) {
          const userOrg = await prisma.userOrganization.findFirst({
            where: { userId: decoded.userId },
            select: { organizationId: true },
          });

          if (userOrg) {
            currentTenantId = userOrg.organizationId;
          }
        }
      }
    } catch (authError) {
      // Auth-related issues should not break tenant listing; just log them
      console.error("Error resolving current tenant for user:", authError);
    }

    const tenants = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        deactivatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      tenants,
      currentTenantId,
    });
  } catch (error) {
    console.error("Error fetching tenants:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, slug } = await request.json();

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, message: "Name and slug are required." },
        { status: 400 }
      );
    }

    const existingTenant = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existingTenant) {
      return NextResponse.json(
        { success: false, message: "Tenant already exists." },
        { status: 409 }
      );
    }

    const newTenant = await prisma.organization.create({
      data: {
        name,
        slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      { success: true, tenant: newTenant },
      { status: 201 }
    );
  } catch (error) {
    console.error("Tenant creation error:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
