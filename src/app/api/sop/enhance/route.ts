import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { withRateLimit, addRateLimitHeaders } from "@/lib/rate-limit-utils";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: "Invalid token." },
        { status: 401 }
      );
    }

    // Check rate limit (before expensive operations)
    const rateLimit = await withRateLimit(request, "/api/sop/enhance", {
      requireAuth: true,
    });

    if (!rateLimit.allowed) {
      return rateLimit.response!;
    }

    // This endpoint is not yet implemented
    const response = NextResponse.json(
      {
        success: false,
        message: "SOP enhancement feature is not yet available.",
      },
      { status: 501 }
    );

    // Add rate limit headers to response
    return addRateLimitHeaders(response, rateLimit.rateLimitResult);
  } catch (error: any) {
    console.error("[SOP Enhance] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Internal server error.",
      },
      { status: 500 }
    );
  }
}

