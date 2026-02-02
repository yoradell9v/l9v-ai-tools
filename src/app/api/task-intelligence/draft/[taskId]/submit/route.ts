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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const rateLimit = await withRateLimit(
      request,
      "/api/task-intelligence/draft/submit",
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
      console.error("[task-intelligence/draft/[taskId]/submit] Prisma client missing Task model. Run: npx prisma generate");
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
        { success: false, error: "Not authorized to submit this task." },
        { status: 403 }
      );
    }
    if (task.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: "Only draft tasks can be submitted." },
        { status: 400 }
      );
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });
    const res = NextResponse.json({ success: true, data: updated });
    addRateLimitHeaders(res, rateLimit.rateLimitResult);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[task-intelligence/draft/[taskId]/submit] Error:", error);
    return NextResponse.json(
      { success: false, error: message || "Failed to submit task." },
      { status: 500 }
    );
  }
}
