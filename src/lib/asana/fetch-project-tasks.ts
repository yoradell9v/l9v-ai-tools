/**
 * Server-side: fetch all tasks for an Asana project (paginated).
 * Used by GET /api/asana/tasks and by sync-asana-templates.
 * Asana returns at least gid, name; notes included only when present (opt_fields=name,notes).
 */

import { asanaFetch, getAsanaBase } from "./client";

export interface AsanaTaskCompact {
  gid: string;
  name: string;
  notes?: string;
  resource_type?: string;
  resource_subtype?: string;
}

interface AsanaTasksResponse {
  data?: AsanaTaskCompact[];
  next_page?: { offset: string; path: string; uri: string } | null;
}

const PAGE_LIMIT = 100;
const OPT_FIELDS = "name,notes";

export async function fetchAllProjectTasks(
  projectId: string
): Promise<AsanaTaskCompact[]> {
  const base = getAsanaBase();
  const allTasks: AsanaTaskCompact[] = [];
  let offset: string | null = null;

  do {
    const url = new URL(`${base}/projects/${projectId}/tasks`);
    url.searchParams.set("limit", String(PAGE_LIMIT));
    url.searchParams.set("opt_fields", OPT_FIELDS);
    if (offset) url.searchParams.set("offset", offset);

    const res = await asanaFetch<AsanaTasksResponse>(url.toString());
    if (res.data && Array.isArray(res.data)) {
      allTasks.push(...res.data);
    }
    offset = res.next_page?.offset ?? null;
  } while (offset);

  return allTasks;
}
