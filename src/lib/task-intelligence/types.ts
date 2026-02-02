/**
 * Task Intelligence: shared types for draft, template search, and API.
 */

export interface TaskDraftPayload {
  title: string;
  category: string;
  description: string;
  keyConsiderations: string;
  subtasks: string[];
  deliverables: string[];
  qualityControlChecklist: string[];
}

export interface TaskTemplateForSearch {
  id: string;
  title: string;
  category: string;
  description: string;
  keyConsiderations: string;
  subtasks: string[];
  deliverables: string[];
  qualityControlChecklist: string[];
  embedding: number[];
  embeddingModel: string | null;
}

export interface TaskTemplateMatch {
  template: TaskTemplateForSearch;
  similarity: number;
}
