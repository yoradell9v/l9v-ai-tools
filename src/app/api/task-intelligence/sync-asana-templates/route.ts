/**
 * POST /api/task-intelligence/sync-asana-templates
 * Fetches Asana project tasks, clusters by semantic similarity, generates templates via OpenAI,
 * and saves them to TaskTemplate (with embeddings). Requires auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/core/auth";
import { prisma } from "@/lib/core/prisma";
import { withRateLimit, addRateLimitHeaders } from "@/lib/rate-limiting/rate-limit-utils";
import { fetchAllProjectTasks } from "@/lib/asana/fetch-project-tasks";
import { clusterTasksBySimilarity, taskToText } from "@/lib/task-intelligence/asana-task-clustering";
import { generateTemplateFromTaskCluster } from "@/lib/task-intelligence/generate-template-from-tasks";
import { templateToSearchText } from "@/lib/task-intelligence/ensure-task-template-embeddings";
import { generateEmbedding } from "@/lib/ai/embeddings";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEFAULT_PROJECT_ID = "1211653625969373";
const EMBEDDING_MODEL = "text-embedding-3-small";
const MIN_CLUSTER_SIZE = 2;

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await withRateLimit(request, "/api/task-intelligence/sync-asana-templates", {
      requireAuth: true,
    });
    if (!rateLimit.allowed) return rateLimit.response!;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return NextResponse.json({ success: false, error: "Not authenticated." }, { status: 401 });
    }
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return NextResponse.json({ success: false, error: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const projectId = (body.projectId as string) || DEFAULT_PROJECT_ID;

    const tasks = await fetchAllProjectTasks(projectId);
    const tasksWithText = tasks.filter(
      (t) => (t.name && t.name.trim().length > 0) || (t.notes && t.notes.trim().length > 0)
    );

    if (tasksWithText.length === 0) {
      const res = NextResponse.json({
        success: true,
        data: {
          tasksFetched: tasks.length,
          clustersFound: 0,
          templatesCreated: 0,
          message: "No tasks with name/notes to cluster.",
        },
      });
      addRateLimitHeaders(res, rateLimit.rateLimitResult);
      return res;
    }

    const clusters = await clusterTasksBySimilarity(tasksWithText);
    const repetitiveClusters = clusters.filter((c) => c.length >= MIN_CLUSTER_SIZE);

    let templatesCreated = 0;
    for (const cluster of repetitiveClusters) {
      const taskTexts = cluster.map(taskToText);
      try {
        const generated = await generateTemplateFromTaskCluster(taskTexts);
        const searchText = templateToSearchText(generated);
        const embedding = searchText.trim()
          ? await generateEmbedding(searchText)
          : [];

        await prisma.taskTemplate.create({
          data: {
            title: generated.title,
            category: generated.category,
            description: generated.description,
            keyConsiderations: generated.keyConsiderations,
            subtasks: generated.subtasks,
            deliverables: generated.deliverables,
            qualityControlChecklist: generated.qualityControlChecklist,
            embedding,
            embeddingModel: embedding.length > 0 ? EMBEDDING_MODEL : null,
          },
        });
        templatesCreated++;
      } catch (err) {
        console.error("[sync-asana-templates] Failed to create template for cluster:", err);
      }
    }

    const res = NextResponse.json({
      success: true,
      data: {
        tasksFetched: tasks.length,
        tasksWithText: tasksWithText.length,
        clustersFound: clusters.length,
        repetitiveClusters: repetitiveClusters.length,
        templatesCreated,
      },
    });
    addRateLimitHeaders(res, rateLimit.rateLimitResult);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed.";
    console.error("[sync-asana-templates]", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
