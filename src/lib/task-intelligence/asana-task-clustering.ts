/**
 * Task Intelligence: context-based clustering of Asana tasks.
 * Groups tasks by meaning (e.g. deployment, testing, UI work), not by labels like
 * "Phase 2" or "Post-Deployment", so the same phase name from different developers
 * is not forced into one cluster.
 */

import { generateEmbeddingsBatch, cosineSimilarity } from "@/lib/ai/embeddings";

export interface AsanaTaskForClustering {
  gid: string;
  name: string;
  notes?: string;
}

/** Build a single text representation of a task for embedding (context). */
export function taskToText(t: AsanaTaskForClustering): string {
  const parts = [t.name || "", t.notes || ""].filter(Boolean);
  return parts.join("\n\n").trim() || t.gid;
}

/** Normalize a task name for exact-match dedup only (lowercase, collapse punctuation/whitespace). */
function normalizeTaskName(name?: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unionFindRoot(parent: number[], i: number): number {
  if (parent[i] !== i) parent[i] = unionFindRoot(parent, parent[i]);
  return parent[i];
}

/**
 * Cluster tasks by context (semantic similarity), not by wording or phase labels.
 * 1. Exact normalized name: only truly duplicate names (same task repeated).
 * 2. Embedding similarity: tasks that describe the same kind of work cluster together
 *    (e.g. deployment, testing, UI changes), regardless of "Phase 2" vs "Post-Deployment" etc.
 */
export async function clusterTasksBySimilarity(
  tasks: AsanaTaskForClustering[],
  similarityThreshold: number = 0.70
): Promise<AsanaTaskForClustering[][]> {
  if (tasks.length === 0) return [];
  if (tasks.length === 1) return [tasks];

  const n = tasks.length;
  const assigned = new Set<number>();
  const clusters: AsanaTaskForClustering[][] = [];

  // Step 1: exact normalized name only (true duplicates)
  const exactMap = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const key = normalizeTaskName(tasks[i].name);
    if (!key) continue;
    if (!exactMap.has(key)) exactMap.set(key, []);
    exactMap.get(key)!.push(i);
  }
  for (const indices of exactMap.values()) {
    if (indices.length >= 2) {
      clusters.push(indices.map((i) => tasks[i]));
      indices.forEach((i) => assigned.add(i));
    }
  }

  // Step 2: context-based clustering via embeddings (same kind of work → same cluster)
  const remainingIndices: number[] = [];
  const remainingTexts: string[] = [];
  for (let i = 0; i < n; i++) {
    if (!assigned.has(i)) {
      remainingIndices.push(i);
      const text = taskToText(tasks[i]);
      remainingTexts.push(text.trim() || tasks[i].name || tasks[i].gid);
    }
  }

  if (remainingIndices.length === 0) {
    return clusters;
  }

  const toEmbed = remainingTexts.map((t) => (t.length > 0 ? t : " "));
  const embeddings = await generateEmbeddingsBatch(toEmbed);
  const m = remainingIndices.length;
  const parent = Array.from({ length: m }, (_, i) => i);

  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      try {
        const sim = cosineSimilarity(embeddings[i], embeddings[j]);
        if (sim >= similarityThreshold) {
          const ri = unionFindRoot(parent, i);
          const rj = unionFindRoot(parent, j);
          if (ri !== rj) parent[ri] = rj;
        }
      } catch {
        // skip
      }
    }
  }

  const rootToIndices = new Map<number, number[]>();
  for (let i = 0; i < m; i++) {
    const r = unionFindRoot(parent, i);
    if (!rootToIndices.has(r)) rootToIndices.set(r, []);
    rootToIndices.get(r)!.push(i);
  }

  for (const subset of rootToIndices.values()) {
    if (subset.length >= 2) {
      const cluster = subset.map((idx) => tasks[remainingIndices[idx]]);
      clusters.push(cluster);
    }
  }

  return clusters;
}
