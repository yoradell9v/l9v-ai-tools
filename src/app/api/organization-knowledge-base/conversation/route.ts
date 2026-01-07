import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");
    const listAll = searchParams.get("list") === "true";

    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: { deactivatedAt: null },
        deactivatedAt: null,
      },
      select: { 
        id: true,
        organizationId: true,
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
    const organizationIds = userOrganizations.map((uo) => uo.organizationId);
    const isSuperadmin = user.globalRole === "SUPERADMIN";

    const knowledgeBase = await prisma.organizationKnowledgeBase.findFirst({
      where: {
        organizationId: { in: organizationIds },
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        {
          success: false,
          error: "Knowledge base not found. Please complete your organization profile first.",
        },
        { status: 404 }
      );
    }

    // If list=true, return all conversations for this knowledge base
    if (listAll) {
      const conversations = await prisma.businessConversation.findMany({
        where: {
          knowledgeBaseId: knowledgeBase.id,
          ...(isSuperadmin ? {} : { userOrganizationId: { in: userOrganizationIds } }),
        },
        include: {
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: {
          lastMessageAt: "desc",
        },
        take: 50, // Limit to 50 most recent conversations
      });

      return NextResponse.json({
        success: true,
        conversations: conversations.map((conv) => ({
          id: conv.id,
          title: conv.title,
          lastMessageAt: conv.lastMessageAt,
          messageCount: conv._count.messages,
          status: conv.status,
        })),
      });
    }

    // If conversationId is provided, load that specific conversation
    if (conversationId) {
      const conversation = await prisma.businessConversation.findFirst({
        where: {
          id: conversationId,
          knowledgeBaseId: knowledgeBase.id,
          ...(isSuperadmin ? {} : { userOrganizationId: { in: userOrganizationIds } }),
        },
        include: {
          messages: {
            orderBy: { sequenceNumber: "asc" },
          },
        },
      });

      if (!conversation) {
        return NextResponse.json(
          {
            success: false,
            error: "Conversation not found or access denied.",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        conversation,
      });
    }

    // No conversationId and not listing - return new conversation indicator
    return NextResponse.json({
      success: true,
      conversation: null,
      message: "New conversation",
    });
  } catch (err: any) {
    console.error("[Conversation GET] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to load conversation.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
        organization: { deactivatedAt: null },
        deactivatedAt: null,
      },
      select: { 
        id: true,
        organizationId: true,
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
    const organizationIds = userOrganizations.map((uo) => uo.organizationId);
    const isSuperadmin = user.globalRole === "SUPERADMIN";

    // Get the user's organization knowledge base
    const knowledgeBase = await prisma.organizationKnowledgeBase.findFirst({
      where: {
        organizationId: { in: organizationIds },
      },
    });

    if (!knowledgeBase) {
      return NextResponse.json(
        {
          success: false,
          error: "Knowledge base not found. Please complete your organization profile first.",
        },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const title = body.title || "New Conversation";

    // Use the first user organization (or the one associated with the KB's organization)
    const userOrganizationId = userOrganizationIds.find(
      (uoId) => {
        const uo = userOrganizations.find((uo) => uo.id === uoId);
        return uo?.organizationId === knowledgeBase.organizationId;
      }
    ) || userOrganizationIds[0];

    const conversation = await prisma.businessConversation.create({
      data: {
        organizationId: knowledgeBase.organizationId,
        knowledgeBaseId: knowledgeBase.id,
        userOrganizationId: userOrganizationId,
        title: title,
        status: "ACTIVE",
        lastMessageAt: new Date(),
        messageCount: 0,
        usedKnowledgeBaseVersion: knowledgeBase.version,
      },
      include: {
        messages: true,
      },
    });

    return NextResponse.json({
      success: true,
      conversation,
      message: "Conversation created successfully.",
    });

  } catch (err: any) {
    console.error("[Conversation POST] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to create conversation.",
      },
      { status: 500 }
    );
  }
}

