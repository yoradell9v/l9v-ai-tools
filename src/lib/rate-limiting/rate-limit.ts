import { redis, isRedisAvailable } from "@/lib/core/redis";
import type { RateLimitConfig } from "./rate-limit-config";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  userLimit?: RateLimitResult;
  orgLimit?: RateLimitResult;
  ipLimit?: RateLimitResult;
  reset: number;
  retryAfter?: number;
}

async function checkSlidingWindow(
  key: string,
  window: number,
  limit: number
): Promise<RateLimitResult> {
  if (!redis) {
    console.error(`[Rate Limit] Redis client not available for key: ${key}`);
    throw new Error("Redis client not available");
  }

  const now = Date.now();
  const windowStart = now - window * 1000;

  console.log(
    `[Rate Limit] Checking sliding window: key=${key}, window=${window}s, limit=${limit}`
  );

  try {
    const pipeline = redis.pipeline();

    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.expire(key, window + 60);

    const results = await pipeline.exec();

    if (!results) {
      console.error(
        `[Rate Limit] Redis pipeline execution failed for key: ${key}`
      );
      throw new Error("Redis pipeline execution failed");
    }

    const currentCount = results[1]?.[1] as number | undefined;
    const count = currentCount !== undefined ? currentCount : 0;
    const remaining = Math.max(0, limit - count - 1);
    const reset = now + window * 1000;
    const allowed = count < limit;

    console.log(
      `[Rate Limit] Result for ${key}: count=${count}, limit=${limit}, allowed=${allowed}, remaining=${remaining}`
    );

    return {
      allowed,
      limit,
      remaining: allowed ? remaining : 0,
      reset,
      retryAfter: allowed ? undefined : Math.ceil((reset - now) / 1000),
    };
  } catch (error) {
    console.error(
      `[Rate Limit] Error checking sliding window for key ${key}:`,
      error
    );
    throw error;
  }
}

async function checkIdentifierLimit(
  identifier: "user" | "organization" | "ip",
  identifierValue: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult | null> {
  let limitConfig;
  let keyPrefix;

  switch (identifier) {
    case "user":
      limitConfig = config.user;
      keyPrefix = "ratelimit:user";
      break;
    case "organization":
      limitConfig = config.organization;
      keyPrefix = "ratelimit:org";
      break;
    case "ip":
      limitConfig = config.ip;
      keyPrefix = "ratelimit:ip";
      break;
  }

  if (!limitConfig) {
    return null;
  }

  const sanitizedEndpoint = endpoint
    .replace(/\//g, ":")
    .replace(/[^a-zA-Z0-9:]/g, "");
  const key = `${keyPrefix}:${identifierValue}:${sanitizedEndpoint}`;

  return await checkSlidingWindow(key, limitConfig.window, limitConfig.limit);
}

export async function checkRateLimit(params: {
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  endpoint: string;
  config: RateLimitConfig;
}): Promise<RateLimitCheckResult> {
  const { userId, organizationId, ipAddress, endpoint, config } = params;

  console.log(`[Rate Limit] Checking rate limit for endpoint: ${endpoint}`, {
    userId: userId ? `${userId.substring(0, 8)}...` : "none",
    organizationId: organizationId
      ? `${organizationId.substring(0, 8)}...`
      : "none",
    ipAddress: ipAddress ? `${ipAddress.substring(0, 10)}...` : "none",
    hasUserLimit: !!config.user,
    hasOrgLimit: !!config.organization,
    hasIpLimit: !!config.ip,
    failStrategy: config.failStrategy,
  });

  const redisAvailable = await isRedisAvailable();

  if (!redisAvailable) {
    console.warn(`[Rate Limit] Redis unavailable for endpoint: ${endpoint}`);
    if (config.failStrategy === "closed") {
      console.error(
        `[Rate Limit] Denying request (fail-closed strategy) for endpoint: ${endpoint}`
      );
      throw new Error(
        "Rate limiting service unavailable. Request denied for safety."
      );
    } else {
      console.warn(
        `[Rate Limit] Redis unavailable, allowing request (fail-open strategy) for endpoint: ${endpoint}`
      );
      const defaultWindow = config.user?.window || config.ip?.window || 3600;
      return {
        allowed: true,
        reset: Date.now() + defaultWindow * 1000,
      };
    }
  }

  const defaultWindow = config.user?.window || config.ip?.window || 3600;
  const results: RateLimitCheckResult = {
    allowed: true,
    reset: Date.now() + defaultWindow * 1000,
  };

  try {
    if (userId && config.user) {
      console.log(
        `[Rate Limit] Checking user limit for userId: ${userId.substring(
          0,
          8
        )}...`
      );
      const userResult = await checkIdentifierLimit(
        "user",
        userId,
        endpoint,
        config
      );
      if (userResult) {
        results.userLimit = userResult;
        console.log(
          `[Rate Limit] User limit result: allowed=${userResult.allowed}, remaining=${userResult.remaining}/${userResult.limit}`
        );
        if (!userResult.allowed) {
          results.allowed = false;
          results.reset = Math.min(results.reset, userResult.reset);
          results.retryAfter = userResult.retryAfter;
          console.log(
            `[Rate Limit] User limit exceeded for endpoint: ${endpoint}`
          );
        }
      }
    }

    if (organizationId && config.organization) {
      console.log(
        `[Rate Limit] Checking org limit for orgId: ${organizationId.substring(
          0,
          8
        )}...`
      );
      const orgResult = await checkIdentifierLimit(
        "organization",
        organizationId,
        endpoint,
        config
      );
      if (orgResult) {
        results.orgLimit = orgResult;
        console.log(
          `[Rate Limit] Org limit result: allowed=${orgResult.allowed}, remaining=${orgResult.remaining}/${orgResult.limit}`
        );
        if (!orgResult.allowed) {
          results.allowed = false;
          results.reset = Math.min(results.reset, orgResult.reset);
          results.retryAfter = orgResult.retryAfter;
          console.log(
            `[Rate Limit] Organization limit exceeded for endpoint: ${endpoint}`
          );
        }
      }
    }

    if (ipAddress && config.ip) {
      console.log(
        `[Rate Limit] Checking IP limit for IP: ${ipAddress.substring(
          0,
          10
        )}...`
      );
      const ipResult = await checkIdentifierLimit(
        "ip",
        ipAddress,
        endpoint,
        config
      );
      if (ipResult) {
        results.ipLimit = ipResult;
        console.log(
          `[Rate Limit] IP limit result: allowed=${ipResult.allowed}, remaining=${ipResult.remaining}/${ipResult.limit}`
        );
        if (!ipResult.allowed) {
          results.allowed = false;
          results.reset = Math.min(results.reset, ipResult.reset);
          results.retryAfter = ipResult.retryAfter;
          console.log(
            `[Rate Limit] IP limit exceeded for endpoint: ${endpoint}`
          );
        }
      }
    }

    if (results.userLimit) {
      results.reset = Math.min(results.reset, results.userLimit.reset);
    }
    if (results.orgLimit) {
      results.reset = Math.min(results.reset, results.orgLimit.reset);
    }
    if (results.ipLimit) {
      results.reset = Math.min(results.reset, results.ipLimit.reset);
    }

    if (!results.allowed && results.reset) {
      results.retryAfter = Math.ceil((results.reset - Date.now()) / 1000);
    }

    if (results.allowed) {
      console.log(`[Rate Limit] Request allowed for endpoint: ${endpoint}`);
    } else {
      console.log(
        `[Rate Limit] Request denied for endpoint: ${endpoint}, retryAfter=${results.retryAfter}s`
      );
    }

    return results;
  } catch (error) {
    console.error("[Rate Limit] Error checking rate limits:", error);

    if (config.failStrategy === "closed") {
      throw new Error("Rate limiting check failed. Request denied for safety.");
    } else {
      console.warn(
        "[Rate Limit] Error during rate limit check, allowing request (fail-open strategy)"
      );
      const defaultWindow = config.user?.window || config.ip?.window || 3600;
      return {
        allowed: true,
        reset: Date.now() + defaultWindow * 1000,
      };
    }
  }
}

export function getRateLimitHeaders(
  result: RateLimitCheckResult
): Record<string, string> {
  const headers: Record<string, string> = {};

  let limit = 0;
  let remaining = 0;
  let reset = result.reset;

  if (result.userLimit) {
    limit = result.userLimit.limit;
    remaining = result.userLimit.remaining;
    reset = Math.min(reset, result.userLimit.reset);
  }
  if (result.orgLimit && result.orgLimit.limit < limit) {
    limit = result.orgLimit.limit;
    remaining = result.orgLimit.remaining;
    reset = Math.min(reset, result.orgLimit.reset);
  }
  if (result.ipLimit && result.ipLimit.limit < limit) {
    limit = result.ipLimit.limit;
    remaining = result.ipLimit.remaining;
    reset = Math.min(reset, result.ipLimit.reset);
  }

  headers["X-RateLimit-Limit"] = limit.toString();
  headers["X-RateLimit-Remaining"] = remaining.toString();
  headers["X-RateLimit-Reset"] = Math.ceil(reset / 1000).toString();

  if (result.retryAfter) {
    headers["Retry-After"] = result.retryAfter.toString();
  }

  return headers;
}
