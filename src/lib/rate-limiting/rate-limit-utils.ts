import { NextRequest, NextResponse } from "next/server";
import { rateLimitMiddleware, addRateLimitHeaders, type RateLimitMiddlewareResult } from "./rate-limit-middleware";
import { getRateLimitConfig } from "./rate-limit-config";

export { addRateLimitHeaders };

export async function withRateLimit(
  request: NextRequest,
  endpoint: string,
  options?: {
    requireAuth?: boolean;
  }
): Promise<RateLimitMiddlewareResult> {
  return await rateLimitMiddleware({
    request,
    endpoint,
    requireAuth: options?.requireAuth ?? false,
  });
}

export function shouldRateLimit(endpoint: string): boolean {
  const config = getRateLimitConfig(endpoint);
  return config !== null;
}

export function createRateLimitResponse(
  message: string,
  retryAfter?: number,
  resetAt?: string,
  headers?: Record<string, string>
): NextResponse {
  const responseHeaders: Record<string, string> = {
    ...headers,
  };

  if (retryAfter !== undefined) {
    responseHeaders["Retry-After"] = retryAfter.toString();
  }

  return NextResponse.json(
    {
      success: false,
      message,
      error: "RATE_LIMIT_EXCEEDED",
      retryAfter,
      resetAt,
    },
    {
      status: 429,
      headers: responseHeaders,
    }
  );
}


export function createRateLimitServiceUnavailableResponse(
  message: string = "Rate limiting service is temporarily unavailable. Please try again later."
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message,
      error: "RATE_LIMIT_SERVICE_UNAVAILABLE",
    },
    { status: 503 }
  );
}

