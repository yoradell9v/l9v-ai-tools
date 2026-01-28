import type { ToolChatResponse } from "@/lib/tool-chat/types";
import type { ValidationResult } from "./validation";

export function createClarificationResponse(
  missingFields: string[],
  suggestedQuestions: string[],
): ToolChatResponse {
  const questions =
    suggestedQuestions.length > 0
      ? suggestedQuestions
      : missingFields.map((field) => `What is the ${field}?`);

  return {
    assistantMessage: `I've extracted most of the information, but I need a few more details:\n\n${questions
      .map((q, i) => `${i + 1}. ${q}`)
      .join("\n")}`,
    warnings: [`Missing required fields: ${missingFields.join(", ")}`],
  };
}


export function createSuccessResponse<T>(
  assistantMessage: string,
  action: T,
  warnings?: string[],
): ToolChatResponse<T> {
  return {
    assistantMessage,
    action,
    warnings,
  };
}


export function createErrorResponse(
  error: string,
  details?: string,
): ToolChatResponse {
  return {
    error,
    assistantMessage: `I encountered an error: ${error}. ${details || "Please try again or use the form-based approach."}`,
  };
}

export function createSuggestionResponse<T>(
  extractedData: T,
  suggestedFields: Record<string, any>,
  fieldSources: Record<string, "user" | "kb" | "suggested">,
  missingFields: string[],
): ToolChatResponse<T> {
  const suggestedFieldNames = Object.keys(suggestedFields);
  const hasSuggestions = suggestedFieldNames.length > 0;

  let message = "I've created a draft job description based on your input";

  if (hasSuggestions) {
    message += " and my suggestions for the missing details";
  }

  message += ". Here's what I've prepared:";

  if (hasSuggestions) {
    message += "\n\n**AI Suggestions (you can edit these):**";
    suggestedFieldNames.forEach((field) => {
      const value = suggestedFields[field];
      if (Array.isArray(value)) {
        message += `\n- ${field}: ${value.join(", ")}`;
      } else {
        message += `\n- ${field}: ${value}`;
      }
    });
  }

  message +=
    "\n\nYou can review and edit any of these suggestions, or tell me what you'd like to change.";

  return {
    assistantMessage: message,
    action: {
      formData: extractedData,
      suggestedFields,
      fieldSources,
      isDraft: true, // Indicates this is a draft with suggestions
    } as T,
    warnings:
      missingFields.length > 0
        ? [`Some fields still need attention: ${missingFields.join(", ")}`]
        : undefined,
  };
}


export function createValidationResponse<T>(
  validation: ValidationResult,
  extractedData: T,
  suggestedQuestions: string[],
): ToolChatResponse<T> | null {
  if (!validation.isValid && validation.missingFields.length > 0) {
    return createClarificationResponse(
      validation.missingFields,
      suggestedQuestions,
    ) as ToolChatResponse<T>;
  }

  return null;
}
