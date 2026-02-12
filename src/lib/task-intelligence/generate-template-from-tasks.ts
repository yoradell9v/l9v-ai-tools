/**
 * Task Intelligence: generate one canonical TaskTemplate from a cluster of Asana tasks.
 * Uses OpenAI to produce title, category, description, keyConsiderations, subtasks,
 * deliverables, qualityControlChecklist based on (1) task data and (2) best practices.
 */

import OpenAI from "openai";
import { TASK_TEMPLATE_CATEGORIES } from "../../../prisma/seed-task-templates";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface GeneratedTemplate {
  title: string;
  category: string;
  description: string;
  keyConsiderations: string;
  subtasks: string[];
  deliverables: string[];
  qualityControlChecklist: string[];
}

const CATEGORY_LIST = TASK_TEMPLATE_CATEGORIES.join(", ");

const SYSTEM_PROMPT = `You are a task template designer. Given several similar tasks (from a project management tool), produce ONE canonical task template that generalizes them.

Rules:
1. Use the task data to infer the common purpose and workflow. Enrich with your knowledge of best practices for that type of work.
2. Pick exactly one category from this list: ${CATEGORY_LIST}.
3. Title: clear, generic template title (e.g. "Execute Email Marketing Campaign for [PRODUCT/OFFER]").
4. Description: 2-4 sentences explaining what this task type is and when it's used.
5. keyConsiderations: important constraints, compliance, or pitfalls (2-4 sentences).
6. subtasks: 6-12 ordered steps (strings). Be specific and actionable.
7. deliverables: 6-12 expected outputs (strings).
8. qualityControlChecklist: 6-12 verification items (strings).
9. Return ONLY valid JSON with exactly these keys: title, category, description, keyConsiderations, subtasks, deliverables, qualityControlChecklist. No markdown, no explanation.`;

/**
 * Generate one template from a cluster of tasks. Each task is represented as "name + notes" text.
 */
export async function generateTemplateFromTaskCluster(
  taskTexts: string[]
): Promise<GeneratedTemplate> {
  const userContent = `Similar tasks (use these to infer one template):\n\n${taskTexts
    .map((t, i) => `--- Task ${i + 1} ---\n${t}`)
    .join("\n\n")}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Empty response from OpenAI");
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return normalizeGeneratedTemplate(parsed);
}

function normalizeGeneratedTemplate(raw: Record<string, unknown>): GeneratedTemplate {
  const category = String(raw.category ?? "").trim();
  const validCategory = TASK_TEMPLATE_CATEGORIES.includes(category as any)
    ? category
    : TASK_TEMPLATE_CATEGORIES[0];

  return {
    title: String(raw.title ?? "").trim() || "Untitled Template",
    category: validCategory,
    description: String(raw.description ?? "").trim(),
    keyConsiderations: String(raw.keyConsiderations ?? "").trim(),
    subtasks: Array.isArray(raw.subtasks)
      ? (raw.subtasks as unknown[]).map((s) => String(s ?? "").trim()).filter(Boolean)
      : [],
    deliverables: Array.isArray(raw.deliverables)
      ? (raw.deliverables as unknown[]).map((d) => String(d ?? "").trim()).filter(Boolean)
      : [],
    qualityControlChecklist: Array.isArray(raw.qualityControlChecklist)
      ? (raw.qualityControlChecklist as unknown[])
          .map((q) => String(q ?? "").trim())
          .filter(Boolean)
      : [],
  };
}
