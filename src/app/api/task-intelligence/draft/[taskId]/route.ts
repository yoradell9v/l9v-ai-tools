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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const rateLimit = await withRateLimit(
      request,
      "/api/task-intelligence/draft/update",
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
      console.error("[task-intelligence/draft/[taskId]] Prisma client missing Task model. Run: npx prisma generate");
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

    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    if (typeof body?.title === "string") updateData.title = body.title.trim();
    if (typeof body?.category === "string") updateData.category = body.category.trim();
    if (typeof body?.description === "string") updateData.description = body.description.trim();
    if (typeof body?.keyConsiderations === "string")
      updateData.keyConsiderations = body.keyConsiderations.trim();
    if (Array.isArray(body?.subtasks))
      updateData.subtasks = (body.subtasks as unknown[]).map((s) => String(s).trim()).filter(Boolean);
    if (Array.isArray(body?.deliverables))
      updateData.deliverables = (body.deliverables as unknown[])
        .map((d) => String(d).trim())
        .filter(Boolean);
    if (Array.isArray(body?.qualityControlChecklist))
      updateData.qualityControlChecklist = (body.qualityControlChecklist as unknown[])
        .map((q) => String(q).trim())
        .filter(Boolean);
    if (body?.requestedCompletionAt !== undefined) {
      updateData.requestedCompletionAt =
        body.requestedCompletionAt == null || body.requestedCompletionAt === ""
          ? null
          : new Date(body.requestedCompletionAt as string);
    }
    if (Array.isArray(body?.assetLinks))
      updateData.assetLinks = (body.assetLinks as unknown[]).map((u) => String(u).trim()).filter(Boolean);
    if (body?.matchedTemplateId !== undefined) {
      updateData.matchedTemplateId =
        body.matchedTemplateId == null || body.matchedTemplateId === "" ? null : body.matchedTemplateId;
      if (updateData.matchedTemplateId === null) {
        updateData.matchReason = null;
        updateData.matchScore = null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      const taskWithTemplate = await prisma.task.findUnique({
        where: { id: taskId },
        include: { matchedTemplate: { select: { id: true, title: true } } },
      });
      return NextResponse.json({ success: true, data: taskWithTemplate ?? task });
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: { matchedTemplate: { select: { id: true, title: true } } },
    });
    const res = NextResponse.json({ success: true, data: updated });
    addRateLimitHeaders(res, rateLimit.rateLimitResult);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[task-intelligence/draft/[taskId]] Error:", error);

    const isPrismaClientMismatch =
      /Unknown arg|TaskUpdateInput|not available|Prisma client/i.test(message);

    const userMessage = isPrismaClientMismatch
      ? "Your changes could not be saved right now. Please try again in a moment, or refresh the page. If the problem continues, contact your administrator."
      : message && !message.includes("Prisma") && message.length < 200
        ? message
        : "Something went wrong saving your task. Please try again.";

    return NextResponse.json(
      { success: false, error: userMessage },
      { status: 500 }
    );
  }
}
