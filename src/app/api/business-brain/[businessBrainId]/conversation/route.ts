import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessBrainId: string }> }
) {
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

    const { businessBrainId } = await params;

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");
    const listAll = searchParams.get("list") === "true";

    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: { deactivatedAt: null },
      },
      select: { id: true },
    });

    const userOrganizationIds = userOrganizations.map((uo) => uo.id);
    const isSuperadmin = user.globalRole === "SUPERADMIN";

    // Verify access to business brain
    const businessBrain = await prisma.businessBrain.findFirst({
      where: {
        id: businessBrainId,
        ...(isSuperadmin ? {} : { userOrganizationId: { in: userOrganizationIds } }),
      },
    });

    if (!businessBrain) {
      return NextResponse.json(
        {
          success: false,
          error: "Business brain not found or access denied.",
        },
        { status: 404 }
      );
    }

    // If list=true, return all conversations for this brain
    if (listAll) {
      const conversations = await prisma.businessConversation.findMany({
        where: {
          brainId: businessBrainId,
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
          brainId: businessBrainId,
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


export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessBrainId: string }> }
) {
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

    const { businessBrainId } = await params;

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
      },
      select: { id: true },
    });

    const userOrganizationIds = userOrganizations.map((uo) => uo.id);
    const isSuperadmin = user.globalRole === "SUPERADMIN";

    const businessBrain = await prisma.businessBrain.findFirst({
      where: {
        id: businessBrainId,
        ...(isSuperadmin ? {} : { userOrganizationId: { in: userOrganizationIds } }),
      },
    });

    if (!businessBrain) {
      return NextResponse.json(
        {
          success: false,
          error: "Business brain not found or access denied.",
        },
        { status: 404 }
      );
    }

    if (!isSuperadmin && userOrganizations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User does not belong to any active organization.",
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const title = body.title || "New Conversation";

    // For superadmins, attach the conversation to the brain's organization so access works consistently
    const userOrganizationId = isSuperadmin
      ? businessBrain.userOrganizationId
      : userOrganizationIds[0];

    const conversation = await prisma.businessConversation.create({
      data: {
        brainId: businessBrainId,
        userOrganizationId: userOrganizationId,
        title: title,
        status: "ACTIVE",
        lastMessageAt: new Date(),
        messageCount: 0,
        activeCardIds: [],
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

