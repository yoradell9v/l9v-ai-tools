
export interface RateLimitError {
  isRateLimit: boolean;
  message: string;
  limitType: "user" | "organization" | "ip" | "limit";
  retryAfter?: number; // seconds
  resetAt?: string; // ISO timestamp
  remaining?: number;
  limit?: number;
  reset?: number; // Unix timestamp
}

export function isRateLimitError(response: Response): boolean {
  return response.status === 429;
}


export function isRateLimitServiceUnavailable(response: Response): boolean {
  return response.status === 503;
}

export function getRateLimitInfo(response: Response): {
  limit?: number;
  remaining?: number;
  reset?: number;
} {
  const limit = response.headers.get("X-RateLimit-Limit");
  const remaining = response.headers.get("X-RateLimit-Remaining");
  const reset = response.headers.get("X-RateLimit-Reset");

  return {
    limit: limit ? parseInt(limit, 10) : undefined,
    remaining: remaining ? parseInt(remaining, 10) : undefined,
    reset: reset ? parseInt(reset, 10) : undefined,
  };
}

export async function parseRateLimitError(response: Response): Promise<RateLimitError> {
  const headers = getRateLimitInfo(response);

  try {
    const data = await response.json();

    return {
      isRateLimit: true,
      message: data.message || "Rate limit exceeded. Please try again later.",
      limitType: data.limitType || "limit",
      retryAfter: data.retryAfter || headers.reset ? Math.max(0, headers.reset! - Math.floor(Date.now() / 1000)) : undefined,
      resetAt: data.resetAt,
      remaining: headers.remaining,
      limit: headers.limit,
      reset: headers.reset,
    };
  } catch {
    return {
      isRateLimit: true,
      message: "Rate limit exceeded. Please try again later.",
      limitType: "limit",
      retryAfter: headers.reset ? Math.max(0, headers.reset - Math.floor(Date.now() / 1000)) : undefined,
      remaining: headers.remaining,
      limit: headers.limit,
      reset: headers.reset,
    };
  }
}


export function formatRetryTime(retryAfter?: number): string {
  if (!retryAfter || retryAfter <= 0) {
    return "now";
  }

  const minutes = Math.floor(retryAfter / 60);
  const seconds = retryAfter % 60;

  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

export function formatResetTime(resetAt?: string): string {
  if (!resetAt) {
    return "soon";
  }

  try {
    const resetDate = new Date(resetAt);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return "in less than a minute";
    } else if (diffMins === 1) {
      return "in 1 minute";
    } else if (diffMins < 60) {
      return `in ${diffMins} minutes`;
    } else {
      const hours = Math.floor(diffMins / 60);
      return hours === 1 ? "in 1 hour" : `in ${hours} hours`;
    }
  } catch {
    return "soon";
  }
}

export function getRateLimitErrorMessage(error: RateLimitError): string {
  let message = error.message;

  if (error.retryAfter) {
    const retryTime = formatRetryTime(error.retryAfter);
    message += ` Please try again ${retryTime}.`;
  } else if (error.resetAt) {
    const resetTime = formatResetTime(error.resetAt);
    message += ` Please try again ${resetTime}.`;
  }

  return message;
}

