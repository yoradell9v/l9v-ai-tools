import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/core/prisma";
import { verifyAccessToken } from "@/lib/core/auth";

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
        role: true,
      },
    });

    const userOrganizationIds = userOrganizations.map(
      (uo: (typeof userOrganizations)[0]) => uo.id
    );
    const organizationIds = userOrganizations.map(
      (uo: (typeof userOrganizations)[0]) => uo.organizationId
    );

    // Submitted tasks (task-intelligence): non-draft, actually submitted
    let submittedTasksCount = 0;
    if (typeof (prisma as any).task !== "undefined") {
      submittedTasksCount = await (prisma as any).task.count({
        where: {
          userOrganizationId: { in: userOrganizationIds },
          status: "SUBMITTED",
        },
      });
    }

    let stats: any = {};

    if (user.globalRole === "SUPERADMIN") {
      const [
        totalOrganizations,
        totalUsers,
        totalAnalyses,
        totalSOPs,
        totalKnowledgeBases,
        pendingInvitations,
        totalConversations,
      ] = await Promise.all([
        prisma.organization.count({
          where: { deactivatedAt: null },
        }),
        prisma.user.count(),
        prisma.savedAnalysis.count(),
        prisma.sOP.count(),
        prisma.organizationKnowledgeBase.count(),
        prisma.invitationToken.count({
          where: {
            acceptedAt: null,
            cancelledAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
        prisma.businessConversation.count({
          where: {
            messageCount: { gt: 0 },
          },
        }),
      ]);

      stats = {
        totalOrganizations,
        totalUsers,
        totalAnalyses,
        totalSOPs,
        totalKnowledgeBases,
        pendingInvitations,
        totalConversations,
        submittedTasksCount,
      };
    } else if (
      userOrganizations.some(
        (uo: (typeof userOrganizations)[0]) => uo.role === "ADMIN"
      )
    ) {
      const [
        organizationMembers,
        organizationAnalyses,
        organizationSOPs,
        organizationKnowledgeBases,
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
        prisma.sOP.count({
          where: {
            userOrganizationId: { in: userOrganizationIds },
          },
        }),
        prisma.organizationKnowledgeBase.count({
          where: {
            organizationId: { in: organizationIds },
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

      // Get knowledge base for conversation count
      const knowledgeBase = await prisma.organizationKnowledgeBase.findFirst({
        where: {
          organizationId: { in: organizationIds },
        },
        select: { id: true },
      });

      const organizationConversations = knowledgeBase
        ? await prisma.businessConversation.count({
            where: {
              knowledgeBaseId: knowledgeBase.id,
              userOrganizationId: { in: userOrganizationIds },
              messageCount: { gt: 0 },
            },
          })
        : 0;

      stats = {
        organizationMembers,
        organizationAnalyses,
        organizationSOPs,
        organizationKnowledgeBases,
        pendingInvitations,
        organizationConversations,
        submittedTasksCount,
      };
    } else {
      // Get knowledge base for conversation count
      const knowledgeBase = await prisma.organizationKnowledgeBase.findFirst({
        where: {
          organizationId: { in: organizationIds },
        },
        select: { id: true },
      });

      const [myAnalyses, mySOPs, myConversations] = await Promise.all([
        prisma.savedAnalysis.count({
          where: {
            userOrganizationId: { in: userOrganizationIds },
          },
        }),
        prisma.sOP.count({
          where: {
            userOrganizationId: { in: userOrganizationIds },
          },
        }),
        knowledgeBase
          ? prisma.businessConversation.count({
              where: {
                knowledgeBaseId: knowledgeBase.id,
                userOrganizationId: { in: userOrganizationIds },
                messageCount: { gt: 0 },
              },
            })
          : Promise.resolve(0),
      ]);

      stats = {
        myAnalyses,
        mySOPs,
        myConversations,
        submittedTasksCount,
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
