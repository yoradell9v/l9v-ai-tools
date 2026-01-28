import type { ToolChatResponse } from "@/lib/tool-chat/types";
import { createErrorResponse } from "./response";

export class ToolChatError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage?: string
  ) {
    super(message);
    this.name = "ToolChatError";
  }
}

/**
 * Handles errors and converts them to ToolChatResponse.
 */
export function handleToolChatError(error: unknown): ToolChatResponse {
  if (error instanceof ToolChatError) {
    return createErrorResponse(
      error.userMessage || error.message,
      error.message
    );
  }

  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes("429") || error.message.includes("quota")) {
      return createErrorResponse(
        "OpenAI API quota exceeded. Please check your OpenAI billing and plan details.",
        error.message
      );
    }

    if (error.message.includes("401") || error.message.includes("Invalid API key")) {
      return createErrorResponse(
        "OpenAI API key is invalid or missing. Please check your API configuration.",
        error.message
      );
    }

    if (error.message.includes("500") || error.message.includes("Internal server error")) {
      return createErrorResponse(
        "OpenAI service is experiencing issues. Please try again in a few moments.",
        error.message
      );
    }

    if (
      error.message.includes("timeout") ||
      error.message.includes("ETIMEDOUT") ||
      error.message.includes("ECONNREFUSED")
    ) {
      return createErrorResponse(
        "Unable to connect to the AI service. Please check your internet connection and try again.",
        error.message
      );
    }

    if (error.message.includes("rate limit") || error.message.includes("rate_limit")) {
      return createErrorResponse(
        "Too many requests. Please wait a moment and try again.",
        error.message
      );
    }

    if (
      error.message.includes("insufficient_quota") ||
      error.message.includes("insufficient tokens")
    ) {
      return createErrorResponse(
        "Insufficient API credits. Please add credits to your OpenAI account and try again.",
        error.message
      );
    }

    return createErrorResponse(
      "An error occurred while processing your request.",
      error.message
    );
  }

  return createErrorResponse(
    "An unexpected error occurred. Please try again.",
    String(error)
  );
}

/**
 * Logs error with context for debugging.
 */
export function logToolChatError(
  error: unknown,
  context: {
    toolId: string;
    userId?: string;
    organizationId?: string;
  }
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error("[ToolChat Error]", {
    toolId: context.toolId,
    userId: context.userId,
    organizationId: context.organizationId,
    error: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
  });
}
