/**
 * GET /api/asana/tasks?projectId=1211653625969373
 * Fetches all tasks for the given Asana project (paginated).
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAllProjectTasks } from "@/lib/asana/fetch-project-tasks";

export type { AsanaTaskCompact } from "@/lib/asana/fetch-project-tasks";

const DEFAULT_PROJECT_ID = "1211653625969373";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? DEFAULT_PROJECT_ID;
    const tasks = await fetchAllProjectTasks(projectId);
    return NextResponse.json({
      success: true,
      data: { tasks },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch project tasks";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
