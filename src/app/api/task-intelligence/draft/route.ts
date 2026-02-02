import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/core/prisma";
import { verifyAccessToken } from "@/lib/core/auth";
import { withRateLimit, addRateLimitHeaders } from "@/lib/rate-limiting/rate-limit-utils";
import {
  getBestTaskTemplateMatch,
  fillTaskFromTemplate,
  generateTaskFromScratch,
} from "@/lib/task-intelligence";

export const runtime = "nodejs";

async function getAuthContext() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  if (!accessToken) return null;
  const decoded = await verifyAccessToken(accessToken);
  if (!decoded) return null;
  const userOrg = await prisma.userOrganization.findFirst({
    where: {
      userId: decoded.userId,
      deactivatedAt: null,
      organization: { deactivatedAt: null },
    },
    select: {
      id: true,
      organizationId: true,
    },
  });
  if (!userOrg) return null;
  return { userOrganizationId: userOrg.id, organizationId: userOrg.organizationId };
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await withRateLimit(request, "/api/task-intelligence/draft", {
      requireAuth: true,
    });
    if (!rateLimit.allowed) {
      return rateLimit.response!;
    }

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const userPrompt = typeof body?.userPrompt === "string" ? body.userPrompt.trim() : "";
    const templateId = typeof body?.templateId === "string" ? body.templateId.trim() : null;

    if (typeof prisma.task === "undefined") {
      console.error("[task-intelligence/draft] Prisma client missing Task model. Run: npx prisma generate");
      return NextResponse.json(
        {
          success: false,
          error:
            "Task model not available. Stop the dev server, run 'npx prisma generate', then restart.",
        },
        { status: 503 }
      );
    }

    let payload: Awaited<ReturnType<typeof fillTaskFromTemplate>>;
    let matchedTemplateId: string | null = null;
    let matchScore: number | null = null;
    let matchReason: string | null = null;
    const effectivePrompt = userPrompt || "Use this template as-is.";

    if (templateId) {
      const template = await prisma.taskTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template) {
        return NextResponse.json(
          { success: false, error: "Template not found." },
          { status: 404 }
        );
      }
      const templateForSearch = {
        id: template.id,
        title: template.title,
        category: template.category,
        description: template.description,
        keyConsiderations: template.keyConsiderations,
        subtasks: template.subtasks,
        deliverables: template.deliverables,
        qualityControlChecklist: template.qualityControlChecklist,
        embedding: template.embedding,
        embeddingModel: template.embeddingModel,
      };
      payload = await fillTaskFromTemplate(userPrompt || template.title, templateForSearch);
      matchedTemplateId = template.id;
      matchReason = `Matched: ${template.title}`;
    } else {
      if (!userPrompt) {
        return NextResponse.json(
          { success: false, error: "userPrompt is required when not using a template." },
          { status: 400 }
        );
      }
      const match = await getBestTaskTemplateMatch(prisma, userPrompt, 0.45);
      if (match) {
        payload = await fillTaskFromTemplate(userPrompt, match.template);
        matchedTemplateId = match.template.id;
        matchScore = match.similarity;
        matchReason = `Matched: ${match.template.title}`;
      } else {
        payload = await generateTaskFromScratch(userPrompt);
      }
    }

    const task = await prisma.task.create({
      data: {
        organizationId: auth.organizationId,
        userOrganizationId: auth.userOrganizationId,
        userPrompt: effectivePrompt,
        title: payload.title,
        category: payload.category,
        description: payload.description,
        keyConsiderations: payload.keyConsiderations,
        subtasks: payload.subtasks,
        deliverables: payload.deliverables,
        qualityControlChecklist: payload.qualityControlChecklist,
        matchedTemplateId,
        matchScore,
        matchReason,
        status: "DRAFT",
      },
    });

    const taskWithTemplate = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        matchedTemplate: { select: { id: true, title: true } },
      },
    });

    const res = NextResponse.json({ success: true, data: taskWithTemplate ?? task });
    addRateLimitHeaders(res, rateLimit.rateLimitResult);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[task-intelligence/draft] Error:", error);
    if (
      message.includes("OpenAI") ||
      message.includes("quota") ||
      message.includes("429") ||
      message.includes("rate limit")
    ) {
      return NextResponse.json(
        { success: false, error: "AI service is temporarily unavailable. Please try again." },
        { status: 503 }
      );
    }
    const isTechnical = /Unknown arg|TaskCreateInput|Prisma client|not available/i.test(message);
    const userError = isTechnical
      ? "We couldn't create your draft right now. Please try again in a moment or refresh the page."
      : message && message.length < 200
        ? message
        : "Something went wrong. Please try again.";
    return NextResponse.json(
      { success: false, error: userError },
      { status: 500 }
    );
  }
}
