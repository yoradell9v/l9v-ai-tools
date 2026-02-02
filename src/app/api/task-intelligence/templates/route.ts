import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/core/prisma";
import { verifyAccessToken } from "@/lib/core/auth";
import { withRateLimit, addRateLimitHeaders } from "@/lib/rate-limiting/rate-limit-utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const rateLimit = await withRateLimit(request, "/api/task-intelligence/templates", {
      requireAuth: true,
    });
    if (!rateLimit.allowed) return rateLimit.response!;

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
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    if (typeof prisma.taskTemplate === "undefined") {
      return NextResponse.json(
        { success: false, error: "Templates not available." },
        { status: 503 }
      );
    }

    const templates = await prisma.taskTemplate.findMany({
      orderBy: [{ category: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        category: true,
        description: true,
        keyConsiderations: true,
        subtasks: true,
        deliverables: true,
        qualityControlChecklist: true,
      },
    });

    const data = templates.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      description: t.description,
      keyConsiderations: t.keyConsiderations ?? "",
      subtasks: t.subtasks ?? [],
      deliverables: t.deliverables ?? [],
      qualityControlChecklist: t.qualityControlChecklist ?? [],
      subtaskCount: t.subtasks?.length ?? 0,
    }));

    const res = NextResponse.json({ success: true, data: { templates: data } });
    addRateLimitHeaders(res, rateLimit.rateLimitResult);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[task-intelligence/templates] Error:", error);
    return NextResponse.json(
      { success: false, error: message || "Failed to list templates." },
      { status: 500 }
    );
  }
}
