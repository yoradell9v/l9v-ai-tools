import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/core/auth";
import { prisma } from "@/lib/core/prisma";
import { getRateLimitConfig } from "./rate-limit-config";
import { checkRateLimit, getRateLimitHeaders, type RateLimitCheckResult } from "./rate-limit";


function getClientIP(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    return ips[0] || undefined;
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  const ip = (request as any).ip;
  if (ip) {
    return ip;
  }
  return undefined;
}

async function getUserOrganizationId(userId: string): Promise<string | undefined> {
  try {
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: userId,
        organization: {
          deactivatedAt: null,
        },
        deactivatedAt: null,
      },
      select: {
        organizationId: true,
      },
      orderBy: {
        createdAt: "asc", 
      },
    });

    return userOrg?.organizationId;
  } catch (error) {
    console.error("[Rate Limit Middleware] Error fetching user organization:", error);
    return undefined;
  }
}

interface RateLimitMiddlewareParams {
  request: NextRequest;
  endpoint: string;
  requireAuth?: boolean; 
}

export interface RateLimitMiddlewareResult {
  allowed: boolean;
  response?: NextResponse;
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  rateLimitResult?: RateLimitCheckResult;
}

export async function rateLimitMiddleware(
  params: RateLimitMiddlewareParams
): Promise<RateLimitMiddlewareResult> {
  const { request, endpoint, requireAuth = false } = params;

  console.log(`[Rate Limit Middleware] Processing request for endpoint: ${endpoint}, requireAuth: ${requireAuth}`);

  const config = getRateLimitConfig(endpoint);
  if (!config) {
    console.log(`[Rate Limit Middleware] No rate limit config found for endpoint: ${endpoint}, allowing request`);
    return {
      allowed: true,
    };
  }

  console.log(`[Rate Limit Middleware] Rate limit config found for ${endpoint}:`, {
    hasUserLimit: !!config.user,
    hasOrgLimit: !!config.organization,
    hasIpLimit: !!config.ip,
    failStrategy: config.failStrategy,
  });

  let userId: string | undefined;
  let organizationId: string | undefined;
  const ipAddress = getClientIP(request);

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (accessToken) {
      const decoded = await verifyAccessToken(accessToken);
      if (decoded) {
        userId = decoded.userId;
        console.log(`[Rate Limit Middleware] Authenticated user: ${userId.substring(0, 8)}...`);
        organizationId = await getUserOrganizationId(userId);
        if (organizationId) {
          console.log(`[Rate Limit Middleware] User organization: ${organizationId.substring(0, 8)}...`);
        } else {
          console.log(`[Rate Limit Middleware] ⚠️  No organization found for user`);
        }
      }
    } else {
      console.log(`[Rate Limit Middleware] No access token found, proceeding without user/org limits`);
    }

    if (requireAuth && !userId) {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            success: false,
            message: "Authentication required for this endpoint.",
          },
          { status: 401 }
        ),
      };
    }
  } catch (error) {
    console.error("[Rate Limit Middleware] Error extracting user info:", error);
  }

  try {
    console.log(`[Rate Limit Middleware] Calling checkRateLimit for endpoint: ${endpoint}`);
    const rateLimitResult = await checkRateLimit({
      userId,
      organizationId,
      ipAddress,
      endpoint,
      config,
    });

    console.log(`[Rate Limit Middleware] Rate limit check result: allowed=${rateLimitResult.allowed}`);

    if (!rateLimitResult.allowed) {
      let message = "Rate limit exceeded.";
      let limitType = "limit";

      if (rateLimitResult.userLimit && !rateLimitResult.userLimit.allowed) {
        const userWindow = config.user?.window || 3600;
        message = `You've reached your limit of ${rateLimitResult.userLimit.limit} requests per ${Math.floor(userWindow / 60)} minute(s).`;
        limitType = "user";
      } else if (rateLimitResult.orgLimit && !rateLimitResult.orgLimit.allowed) {
        message = `Your organization has reached its limit of ${rateLimitResult.orgLimit.limit} requests per ${Math.floor(config.organization!.window / 60)} minute(s).`;
        limitType = "organization";
      } else if (rateLimitResult.ipLimit && !rateLimitResult.ipLimit.allowed) {
        message = `Too many requests from this IP address. Please try again later.`;
        limitType = "ip";
      }

      const resetTime = new Date(rateLimitResult.reset);
      const retryAfter = rateLimitResult.retryAfter || Math.ceil((rateLimitResult.reset - Date.now()) / 1000);

      const headers = getRateLimitHeaders(rateLimitResult);

      return {
        allowed: false,
        response: NextResponse.json(
          {
            success: false,
            message,
            error: "RATE_LIMIT_EXCEEDED",
            limitType,
            retryAfter,
            resetAt: resetTime.toISOString(),
          },
          {
            status: 429,
            headers,
          }
        ),
        userId,
        organizationId,
        ipAddress,
        rateLimitResult,
      };
    }

    return {
      allowed: true,
      userId,
      organizationId,
      ipAddress,
      rateLimitResult,
    };
  } catch (error: any) {
    console.error("[Rate Limit Middleware] Rate limit check error:", error);

    if (config.failStrategy === "closed") {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            success: false,
            message: "Rate limiting service is temporarily unavailable. Please try again later.",
            error: "RATE_LIMIT_SERVICE_UNAVAILABLE",
          },
          { status: 503 }
        ),
      };
    } else {
      console.warn("[Rate Limit Middleware] Rate limit check failed, allowing request (fail-open strategy)");
      return {
        allowed: true,
        userId,
        organizationId,
        ipAddress,
      };
    }
  }
}

export function addRateLimitHeaders(
  response: NextResponse,
  rateLimitResult?: RateLimitCheckResult
): NextResponse {
  if (!rateLimitResult) {
    return response;
  }

  const headers = getRateLimitHeaders(rateLimitResult);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

