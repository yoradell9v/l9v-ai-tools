/**
 * Task Intelligence: fill task fields from a template using OpenAI.
 * Fills placeholders in title and adapts subtasks/deliverables/QC to the user prompt.
 */

import OpenAI from "openai";
import type { TaskDraftPayload } from "./types";
import type { TaskTemplateForSearch } from "./types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a task designer for virtual assistants. Given a user's task description and a task template, produce a single structured task.

Rules:
1. Fill any placeholders in the template title (e.g. [OFFER NAME], [PLATFORM], [CHANNEL]) using the user's description. If the user doesn't specify, use a sensible generic (e.g. "our offer", "our website").
2. Keep the template's category unless the user clearly implies another.
3. Adapt the description and key considerations to the user's specific request; keep them concise.
4. Keep or trim the template's subtasks, deliverables, and qualityControlChecklist to fit the user's task (up to 10 items each). Remove items that don't apply; reword if needed.
5. Return ONLY valid JSON with exactly these keys: title, category, description, keyConsiderations, subtasks (array of strings), deliverables (array of strings), qualityControlChecklist (array of strings). No markdown, no explanation.`;

export async function fillTaskFromTemplate(
  userPrompt: string,
  template: TaskTemplateForSearch
): Promise<TaskDraftPayload> {
  const templateBlob = [
    `Title: ${template.title}`,
    `Category: ${template.category}`,
    `Description: ${template.description}`,
    `Key considerations: ${template.keyConsiderations}`,
    `Subtasks: ${template.subtasks.join(" | ")}`,
    `Deliverables: ${template.deliverables.join(" | ")}`,
    `Quality control checklist: ${template.qualityControlChecklist.join(" | ")}`,
  ].join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `User's task description:\n\n${userPrompt}\n\nTemplate:\n\n${templateBlob}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Empty response from OpenAI");
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return normalizeTaskDraftPayload(parsed);
}

function normalizeTaskDraftPayload(raw: Record<string, unknown>): TaskDraftPayload {
  return {
    title: String(raw.title ?? "").trim() || "Untitled Task",
    category: String(raw.category ?? "").trim() || "General",
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
