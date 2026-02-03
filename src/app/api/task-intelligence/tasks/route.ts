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

export async function GET(request: NextRequest) {
  try {
    const rateLimit = await withRateLimit(request, "/api/task-intelligence/tasks", {
      requireAuth: true,
    });
    if (!rateLimit.allowed) return rateLimit.response!;

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // DRAFT | SUBMITTED
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    if (typeof prisma.task === "undefined") {
      console.error("[task-intelligence/tasks] Prisma client missing Task model. Run: npx prisma generate");
      return NextResponse.json(
        {
          success: false,
          error:
            "Task model not available. Stop the dev server, run 'npx prisma generate', then restart.",
        },
        { status: 503 }
      );
    }

    const where: { userOrganizationId: { in: string[] }; status?: "DRAFT" | "SUBMITTED" } = {
      userOrganizationId: { in: auth.userOrganizationIds },
    };
    if (status === "DRAFT" || status === "SUBMITTED") {
      where.status = status;
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          createdAt: true,
          submittedAt: true,
        },
      }),
      prisma.task.count({ where }),
    ]);

    const res = NextResponse.json({
      success: true,
      data: { tasks, total, limit, offset },
    });
    addRateLimitHeaders(res, rateLimit.rateLimitResult);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[task-intelligence/tasks] Error:", error);
    return NextResponse.json(
      { success: false, error: message || "Failed to list tasks." },
      { status: 500 }
    );
  }
}
