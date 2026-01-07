import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { withRateLimit, addRateLimitHeaders } from "@/lib/rate-limit-utils";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for AI review
const AI_REVIEW_SYSTEM_PROMPT = `You are an expert editor specializing in Standard Operating Procedures (SOPs). Your task is to review edited SOP content and provide specific, actionable suggestions for improvement.

Focus on:
1. **Grammar & Spelling**: Correct any grammatical errors, typos, or spelling mistakes
2. **Clarity**: Ensure instructions are clear and unambiguous
3. **Consistency**: Check for consistent terminology, formatting, and style
4. **Completeness**: Identify any incomplete thoughts or missing information
5. **Professional Tone**: Ensure the language is professional and appropriate for SOPs

For each issue found, provide:
- **type**: One of "grammar", "clarity", "consistency", "completeness", or "tone"
- **original**: The exact text that needs improvement (include enough context to identify it uniquely)
- **suggested**: The improved version
- **reason**: A brief explanation of why this change improves the SOP

Return your response as JSON with this structure:
{
  "suggestions": [
    {
      "type": "grammar",
      "original": "the exact text to replace",
      "suggested": "the improved text",
      "reason": "Brief explanation"
    }
  ]
}

Only suggest changes that genuinely improve the document. If no improvements are needed, return an empty suggestions array.`;

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

    // 1.5. Check rate limit (before expensive operations)
    const rateLimit = await withRateLimit(request, "/api/sop/review", {
      requireAuth: true,
    });

    if (!rateLimit.allowed) {
      return rateLimit.response!;
    }

    // 2. Parse request body
    const body = await request.json();
    const { sopContent } = body;

    if (!sopContent || typeof sopContent !== "string") {
      return NextResponse.json(
        { success: false, message: "sopContent is required and must be a string." },
        { status: 400 }
      );
    }

    // 3. Call OpenAI for AI review
    try {
      const reviewCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: AI_REVIEW_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Please review this edited SOP content and provide suggestions for improvement:\n\n${sopContent}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3, // Lower temperature for more consistent review
        max_tokens: 2000,
      });

      const reviewResult = JSON.parse(
        reviewCompletion.choices[0].message.content || '{"suggestions": []}'
      );

      // Validate and clean suggestions
      const suggestions = Array.isArray(reviewResult.suggestions)
        ? reviewResult.suggestions.filter((s: any) => {
            return (
              s &&
              typeof s === "object" &&
              s.original &&
              s.suggested &&
              typeof s.original === "string" &&
              typeof s.suggested === "string" &&
              s.original.trim().length > 0 &&
              s.suggested.trim().length > 0
            );
          })
        : [];

      const response = NextResponse.json({
        success: true,
        suggestions: suggestions,
        reviewed: true,
      });

      // Add rate limit headers to response
      return addRateLimitHeaders(response, rateLimit.rateLimitResult);
    } catch (openaiError: any) {
      console.error("[SOP Review] OpenAI API error:", openaiError);
      return NextResponse.json(
        {
          success: false,
          message: `AI review failed: ${openaiError.message || "Unknown error"}`,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[SOP Review] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Internal server error.",
      },
      { status: 500 }
    );
  }
}

