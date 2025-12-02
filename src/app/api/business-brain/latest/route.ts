import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
    try {
        // Get user from session
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

        // Get user's organizations to verify access
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

        if (userOrganizations.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "User does not belong to any active organization.",
                },
                { status: 403 }
            );
        }

        const userOrganizationIds = userOrganizations.map((uo) => uo.id);

        // Fetch the most recent business brain with cards
        const businessBrain = await prisma.businessBrain.findFirst({
            where: {
                userOrganizationId: {
                    in: userOrganizationIds,
                },
            },
            include: {
                cards: {
                    orderBy: {
                        orderIndex: 'asc',
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        if (!businessBrain) {
            return NextResponse.json({
                success: true,
                businessBrain: null,
                cards: [],
            });
        }

        return NextResponse.json({
            success: true,
            businessBrain: {
                id: businessBrain.id,
                createdAt: businessBrain.createdAt,
                updatedAt: businessBrain.updatedAt,
                intakeData: businessBrain.intakeData,
                fileUploads: businessBrain.fileUploads,
            },
            cards: businessBrain.cards.map((card) => ({
                ...card,
                confidence_score: (card.metadata as any)?.confidence_score || undefined,
            })),
        });
    } catch (err: any) {
        console.error("Error fetching latest business brain:", err);
        return NextResponse.json(
            {
                success: false,
                error: err.message || "Failed to fetch business brain.",
            },
            { status: 500 }
        );
    }
}

