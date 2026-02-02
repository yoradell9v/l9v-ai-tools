/**
 * Task Intelligence: generate task fields from scratch using OpenAI (no template).
 */

import OpenAI from "openai";
import type { TaskDraftPayload } from "./types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a task designer for virtual assistants. Given a user's task description, produce a single structured task.

Rules:
1. Infer a clear title, category (e.g. Marketing, Development, Operations, Content, Admin), description, and key considerations from the user's words.
2. Generate up to 10 subtasks (ordered steps), up to 10 deliverables (expected outputs), and up to 10 quality control checklist items.
3. Be specific and actionable; avoid vague items.
4. Return ONLY valid JSON with exactly these keys: title, category, description, keyConsiderations, subtasks (array of strings), deliverables (array of strings), qualityControlChecklist (array of strings). No markdown, no explanation.`;

export async function generateTaskFromScratch(
  userPrompt: string
): Promise<TaskDraftPayload> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `User's task description:\n\n${userPrompt}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
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
