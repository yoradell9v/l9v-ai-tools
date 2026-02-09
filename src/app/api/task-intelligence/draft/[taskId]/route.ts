import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/core/prisma";
import { verifyAccessToken } from "@/lib/core/auth";
import { withRateLimit, addRateLimitHeaders } from "@/lib/rate-limiting/rate-limit-utils";

export const runtime = "nodejs";

async function getAuthContext() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) return null;
  const decoded = await verifyAccessToken(accessToken);
  if (!decoded) return null;
  const userOrgs = await prisma.userOrganization.findMany({
    where: {
      userId: decoded.userId,
      deactivatedAt: null,
      organization: { deactivatedAt: null },
    },
    select: { id: true },
  });
  const userOrganizationIds = userOrgs.map((uo) => uo.id);
  return { userOrganizationIds };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const rateLimit = await withRateLimit(
      _request,
      "/api/task-intelligence/draft/[taskId]",
      { requireAuth: true }
    );
    if (!rateLimit.allowed) return rateLimit.response!;

    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json(
        { success: false, error: "taskId is required." },
        { status: 400 }
      );
    }

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    if (typeof prisma.task === "undefined") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Task model not available. Stop the dev server, run 'npx prisma generate', then restart.",
        },
        { status: 503 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        matchedTemplate: { select: { id: true, title: true } },
      },
    });
    if (!task) {
      return NextResponse.json(
        { success: false, error: "Task not found." },
        { status: 404 }
      );
    }
    if (!auth.userOrganizationIds.includes(task.userOrganizationId)) {
      return NextResponse.json(
        { success: false, error: "Not authorized to view this task." },
        { status: 403 }
      );
    }

    const data = {
      id: task.id,
      userPrompt: task.userPrompt,
      title: task.title,
      category: task.category,
      description: task.description,
      keyConsiderations: task.keyConsiderations,
      subtasks: task.subtasks,
      deliverables: task.deliverables,
      qualityControlChecklist: task.qualityControlChecklist,
      status: task.status,
      submittedAt: task.submittedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      matchReason: task.matchReason,
      matchedTemplateId: task.matchedTemplateId,
      matchedTemplate: task.matchedTemplate,
      requestedCompletionAt: task.requestedCompletionAt?.toISOString() ?? null,
      assetLinks: task.assetLinks ?? [],
    };

    const res = NextResponse.json({ success: true, data });
    addRateLimitHeaders(res, rateLimit.rateLimitResult);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[task-intelligence/draft/[taskId] GET] Error:", error);
    return NextResponse.json(
      { success: false, error: message || "Failed to load task." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const rateLimit = await withRateLimit(
      request,
      "/api/task-intelligence/draft/[taskId]",
      { requireAuth: true }
    );
    if (!rateLimit.allowed) return rateLimit.response!;

    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json(
        { success: false, error: "taskId is required." },
        { status: 400 }
      );
    }

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    if (typeof prisma.task === "undefined") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Task model not available. Stop the dev server, run 'npx prisma generate', then restart.",
        },
        { status: 503 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      return NextResponse.json(
        { success: false, error: "Task not found." },
        { status: 404 }
      );
    }
    if (!auth.userOrganizationIds.includes(task.userOrganizationId)) {
      return NextResponse.json(
        { success: false, error: "Not authorized to update this task." },
        { status: 403 }
      );
    }
    if (task.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: "Only draft tasks can be updated." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const updateData: {
      title?: string;
      category?: string;
      description?: string;
      keyConsiderations?: string;
      subtasks?: string[];
      deliverables?: string[];
      qualityControlChecklist?: string[];
      requestedCompletionAt?: Date | null;
      assetLinks?: string[];
      matchedTemplateId?: null;
    } = {};

    if (body.matchedTemplateId === null) {
      updateData.matchedTemplateId = null;
    }
    if (typeof body.title === "string") updateData.title = body.title.trim();
    if (typeof body.category === "string") updateData.category = body.category.trim();
    if (typeof body.description === "string") updateData.description = body.description.trim();
    if (typeof body.keyConsiderations === "string") updateData.keyConsiderations = body.keyConsiderations.trim();
    if (Array.isArray(body.subtasks)) updateData.subtasks = body.subtasks.filter((s: unknown) => typeof s === "string").map((s: string) => s.trim()).filter(Boolean);
    if (Array.isArray(body.deliverables)) updateData.deliverables = body.deliverables.filter((d: unknown) => typeof d === "string").map((d: string) => d.trim()).filter(Boolean);
    if (Array.isArray(body.qualityControlChecklist)) updateData.qualityControlChecklist = body.qualityControlChecklist.filter((q: unknown) => typeof q === "string").map((q: string) => q.trim()).filter(Boolean);
    if (body.requestedCompletionAt === null || body.requestedCompletionAt === "") {
      updateData.requestedCompletionAt = null;
    } else if (typeof body.requestedCompletionAt === "string" && body.requestedCompletionAt.trim()) {
      const d = new Date(body.requestedCompletionAt.trim());
      if (!Number.isNaN(d.getTime())) updateData.requestedCompletionAt = d;
    }
    if (Array.isArray(body.assetLinks)) updateData.assetLinks = body.assetLinks.filter((u: unknown) => typeof u === "string").map((u: string) => u.trim()).filter(Boolean);

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        matchedTemplate: { select: { id: true, title: true } },
      },
    });

    const data = {
      id: updated.id,
      userPrompt: updated.userPrompt,
      title: updated.title,
      category: updated.category,
      description: updated.description,
      keyConsiderations: updated.keyConsiderations,
      subtasks: updated.subtasks,
      deliverables: updated.deliverables,
      qualityControlChecklist: updated.qualityControlChecklist,
      status: updated.status,
      submittedAt: updated.submittedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      matchReason: updated.matchReason,
      matchedTemplateId: updated.matchedTemplateId,
      matchedTemplate: updated.matchedTemplate,
      requestedCompletionAt: updated.requestedCompletionAt?.toISOString() ?? null,
      assetLinks: updated.assetLinks ?? [],
    };

    const res = NextResponse.json({ success: true, data });
    addRateLimitHeaders(res, rateLimit.rateLimitResult);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[task-intelligence/draft/[taskId] PATCH] Error:", error);
    return NextResponse.json(
      { success: false, error: message || "Failed to update task." },
      { status: 500 }
    );
  }
}
