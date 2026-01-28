import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/rate-limiting/rate-limit-utils";
import type { ToolChatRequest, ToolChatResponse, ToolId } from "@/lib/tool-chat/types";
import { getToolChatAuth, handleToolChatError, logToolChatError } from "@/lib/tool-chat/utils";
import { handleRoleBuilder } from "./handlers/role-builder";
import { handleProcessBuilder } from "./handlers/process-builder";
import { handleOrganizationProfile } from "./handlers/organization-profile";

export const runtime = "nodejs";

/**
 * Unified endpoint for all tool chat interactions.
 * Dispatches to tool-specific handlers based on toolId.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimit = await withRateLimit(request, "/api/tool-chat", {
      requireAuth: false, // Auth is optional, handled in handlers
    });

    if (!rateLimit.allowed) {
      return rateLimit.response!;
    }

    // Parse request body
    let body: ToolChatRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          assistantMessage: "I couldn't parse your request. Please try again.",
        } as ToolChatResponse,
        { status: 400 }
      );
    }

    // Validate request structure
    if (!body.toolId || !body.mode || !Array.isArray(body.conversation)) {
      return NextResponse.json(
        {
          error: "Invalid request format",
          assistantMessage:
            "The request format is invalid. Please ensure toolId, mode, and conversation are provided.",
        } as ToolChatResponse,
        { status: 400 }
      );
    }

    // Validate toolId
    const validToolIds: ToolId[] = ["role-builder", "process-builder", "organization-profile"];
    if (!validToolIds.includes(body.toolId)) {
      return NextResponse.json(
        {
          error: "Invalid toolId",
          assistantMessage: `Unknown tool: ${body.toolId}. Please use one of: ${validToolIds.join(", ")}`,
        } as ToolChatResponse,
        { status: 400 }
      );
    }

    // Validate conversation is not empty
    if (body.conversation.length === 0) {
      return NextResponse.json(
        {
          error: "Empty conversation",
          assistantMessage: "Please provide at least one message in the conversation.",
        } as ToolChatResponse,
        { status: 400 }
      );
    }

    // Get authentication and KB data (non-blocking)
    const auth = await getToolChatAuth(body.toolId);

    // Dispatch to tool-specific handler
    let response: ToolChatResponse;
    try {
      switch (body.toolId) {
        case "role-builder":
          response = await handleRoleBuilder(body, auth);
          break;
        case "process-builder":
          response = await handleProcessBuilder(body, auth);
          break;
        case "organization-profile":
          response = await handleOrganizationProfile(body, auth);
          break;
        default:
          // This should never happen due to validation above, but TypeScript needs it
          return NextResponse.json(
            {
              error: "Unsupported tool",
              assistantMessage: `Tool ${body.toolId} is not yet implemented.`,
            } as ToolChatResponse,
            { status: 501 }
          );
      }
    } catch (error) {
      // Log error with context
      logToolChatError(error, {
        toolId: body.toolId,
        userId: auth.userId || undefined,
        organizationId: auth.organizationId || undefined,
      });

      // Convert to user-friendly response
      response = handleToolChatError(error);
    }

    // Return response
    return NextResponse.json(response, {
      status: response.error ? 500 : 200,
    });
  } catch (error) {
    // Top-level error handler (should rarely be reached)
    console.error("[Tool Chat] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        assistantMessage:
          "An unexpected error occurred. Please try again or contact support if the issue persists.",
      } as ToolChatResponse,
      { status: 500 }
    );
  }
}
