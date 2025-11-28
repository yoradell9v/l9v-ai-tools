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
                organizationId: true,
                role: true,
            },
        });

        const userOrganizationIds = userOrganizations.map((uo) => uo.id);
        const organizationIds = userOrganizations.map((uo) => uo.organizationId);

        let stats: any = {};

        if (user.globalRole === "SUPERADMIN") {
            // SUPERADMIN sees global stats
            const [
                totalOrganizations,
                totalUsers,
                totalAnalyses,
                totalBusinessBrains,
                totalSOPs,
                pendingInvitations,
            ] = await Promise.all([
                prisma.organization.count({
                    where: { deactivatedAt: null },
                }),
                prisma.user.count(),
                prisma.savedAnalysis.count(),
                prisma.businessBrain.count(),
                prisma.sOP.count(),
                prisma.invitationToken.count({
                    where: {
                        acceptedAt: null,
                        cancelledAt: null,
                        expiresAt: { gt: new Date() },
                    },
                }),
            ]);

            stats = {
                totalOrganizations,
                totalUsers,
                totalAnalyses,
                totalBusinessBrains,
                totalSOPs,
                pendingInvitations,
            };
        } else if (userOrganizations.some((uo) => uo.role === "ADMIN")) {
            // ADMIN sees organization stats
            const [
                organizationMembers,
                organizationAnalyses,
                organizationBusinessBrains,
                organizationSOPs,
                pendingInvitations,
            ] = await Promise.all([
                prisma.userOrganization.count({
                    where: {
                        organizationId: { in: organizationIds },
                    },
                }),
                prisma.savedAnalysis.count({
                    where: {
                        userOrganizationId: { in: userOrganizationIds },
                    },
                }),
                prisma.businessBrain.count({
                    where: {
                        userOrganizationId: { in: userOrganizationIds },
                    },
                }),
                prisma.sOP.count({
                    where: {
                        userOrganizationId: { in: userOrganizationIds },
                    },
                }),
                prisma.invitationToken.count({
                    where: {
                        organizationId: { in: organizationIds },
                        acceptedAt: null,
                        cancelledAt: null,
                        expiresAt: { gt: new Date() },
                    },
                }),
            ]);

            stats = {
                organizationMembers,
                organizationAnalyses,
                organizationBusinessBrains,
                organizationSOPs,
                pendingInvitations,
            };
        } else {
            // MEMBER sees only their own stats
            const [myAnalyses, myBusinessBrains, mySOPs] = await Promise.all([
                prisma.savedAnalysis.count({
                    where: {
                        userOrganizationId: { in: userOrganizationIds },
                    },
                }),
                prisma.businessBrain.count({
                    where: {
                        userOrganizationId: { in: userOrganizationIds },
                    },
                }),
                prisma.sOP.count({
                    where: {
                        userOrganizationId: { in: userOrganizationIds },
                    },
                }),
            ]);

            stats = {
                myAnalyses,
                myBusinessBrains,
                mySOPs,
            };
        }

        return NextResponse.json({
            success: true,
            stats,
            role: user.globalRole || "MEMBER",
        });
    } catch (error: any) {
        console.error("Error fetching dashboard stats:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Failed to fetch dashboard stats.",
            },
            { status: 500 }
        );
    }
}

