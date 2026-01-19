import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/core/prisma";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/core/auth";
import { extractInsights } from "@/lib/analysis/extractInsights";
import { createLearningEvents } from "@/lib/learning/learning-events";
import { applyLearningEventsToKB } from "@/lib/learning/apply-learning-events";
import { CONFIDENCE_THRESHOLDS } from "@/lib/knowledge-base/insight-confidence-thresholds";
import { markdownToHtml } from "@/lib/extraction/markdown-to-html";
import {
  withRateLimit,
  addRateLimitHeaders,
} from "@/lib/rate-limiting/rate-limit-utils";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MARKDOWN_TO_HTML_SYSTEM_PROMPT = `You are a markdown to HTML converter. Your job is to convert markdown content into clean, semantic HTML.

Rules:
1. Convert ALL markdown syntax to proper HTML tags
2. Use semantic HTML5 tags (article, section, header, etc.) where appropriate
3. Preserve all content exactly as provided
4. Add appropriate structure:
   - Headings: h1, h2, h3, h4, h5, h6
   - Paragraphs: <p> tags
   - Lists: <ul> and <ol> with <li> items
   - Code blocks: <pre><code>
   - Inline code: <code>
   - Tables: <table> with <thead>, <tbody>, <tr>, <th>, <td>
   - Bold: <strong>
   - Italic: <em>
   - Links: <a href="...">
   - Blockquotes: <blockquote>
5. Return ONLY the HTML content, no markdown backticks or explanations
6. Do not add <!DOCTYPE>, <html>, <head>, or <body> tags - just the content HTML
7. Ensure proper HTML entity encoding for special characters`;

async function convertMarkdownToHtmlWithOpenAI(
  markdown: string
): Promise<string> {
  try {
    console.log(
      "[SOP Update] Converting markdown to HTML with OpenAI, length:",
      markdown.length
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: MARKDOWN_TO_HTML_SYSTEM_PROMPT },
        { role: "user", content: markdown },
      ],
      temperature: 0,
      max_tokens: 16000,
    });

    let html = completion.choices[0].message.content || "";

    html = html
      .replace(/```html\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    console.log(
      "[SOP Update] OpenAI HTML conversion complete, length:",
      html.length
    );

    return html;
  } catch (error) {
    console.error(
      "[SOP Update] Error converting markdown to HTML with OpenAI:",
      error
    );
    throw error;
  }
}

const AI_REVIEW_SYSTEM_PROMPT = `You are an expert editor specializing in Standard Operating Procedures (SOPs). Your task is to review edited SOP content and provide specific, actionable suggestions for improvement.

Focus on:
1. **Grammar & Spelling**: Correct any grammatical errors, typos, or spelling mistakes
2. **Clarity**: Ensure instructions are clear and unambiguous
3. **Consistency**: Check for consistent terminology, formatting, and style
4. **Completeness**: Identify any incomplete thoughts or missing information
5. **Professional Tone**: Ensure the language is professional and appropriate for SOPs

For each issue found, provide:
- **Type**: One of "grammar", "clarity", "consistency", "completeness", or "tone"
- **Original**: The exact text that needs improvement
- **Suggested**: The improved version
- **Reason**: A brief explanation of why this change improves the SOP

Return your suggestions as a JSON array. Only suggest changes that genuinely improve the document.`;

export async function POST(request: NextRequest) {
  try {
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
    const rateLimit = await withRateLimit(request, "/api/sop/update", {
      requireAuth: true,
    });

    if (!rateLimit.allowed) {
      return rateLimit.response!;
    }

    const body = await request.json();
    const { sopId, sopContent, reviewWithAI } = body;

    if (!sopId || !sopContent) {
      return NextResponse.json(
        { success: false, message: "sopId and sopContent are required." },
        { status: 400 }
      );
    }
    const existingSOP = await prisma.sOP.findUnique({
      where: { id: sopId },
      include: {
        userOrganization: {
          select: {
            userId: true,
            organizationId: true,
          },
        },
      },
    });

    if (!existingSOP) {
      return NextResponse.json(
        { success: false, message: "SOP not found." },
        { status: 404 }
      );
    }

    if (existingSOP.userOrganization.userId !== decoded.userId) {
      return NextResponse.json(
        {
          success: false,
          message: "You don't have permission to edit this SOP.",
        },
        { status: 403 }
      );
    }

    const currentContent = existingSOP.content as any;
    const currentVersionNumber = existingSOP.versionNumber || 1;
    const rootSOPId = existingSOP.rootSOPId || existingSOP.id;
    const nextVersionNumber = currentVersionNumber + 1;

    let aiReviewSuggestions: any[] = [];
    if (reviewWithAI) {
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
          temperature: 0.3,
          max_tokens: 2000,
        });

        const reviewResult = JSON.parse(
          reviewCompletion.choices[0].message.content || "{}"
        );

        if (
          reviewResult.suggestions &&
          Array.isArray(reviewResult.suggestions)
        ) {
          aiReviewSuggestions = reviewResult.suggestions;
        }
      } catch (reviewError: any) {
        console.error("[SOP Update] AI review error:", reviewError);
      }
    }

    let updatedHtml: string;
    console.log(
      "[SOP Update] Converting markdown to HTML, markdown length:",
      sopContent.length
    );

    try {
      updatedHtml = await markdownToHtml(sopContent);
      console.log(
        "[SOP Update] Library conversion successful, HTML length:",
        updatedHtml.length
      );

      if (!updatedHtml || updatedHtml.trim().length === 0) {
        throw new Error("Library conversion returned empty result");
      }

      if (!updatedHtml.includes("<")) {
        throw new Error("Library conversion did not produce HTML tags");
      }

      if (updatedHtml.includes("```") && !updatedHtml.includes("<code>")) {
        throw new Error(
          "Library conversion may have failed (contains markdown code fences)"
        );
      }
    } catch (libraryError: any) {
      console.warn(
        "[SOP Update] Library conversion failed or produced poor results, falling back to OpenAI:",
        libraryError.message
      );

      try {
        updatedHtml = await convertMarkdownToHtmlWithOpenAI(sopContent);
        console.log(
          "[SOP Update] OpenAI fallback conversion successful, HTML length:",
          updatedHtml.length
        );

        if (!updatedHtml || updatedHtml.trim().length === 0) {
          throw new Error("OpenAI conversion returned empty result");
        }
      } catch (openaiError: any) {
        console.error(
          "[SOP Update] Both HTML conversion methods failed:",
          openaiError
        );
        return NextResponse.json(
          {
            success: false,
            message: `Failed to convert markdown to HTML: ${
              openaiError.message || "Unknown error"
            }`,
          },
          { status: 500 }
        );
      }
    }

    if (!updatedHtml || updatedHtml.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "HTML conversion failed - no HTML content generated",
        },
        { status: 500 }
      );
    }

    if (!updatedHtml.includes("<")) {
      console.error(
        "[SOP Update] Generated HTML does not contain HTML tags - appears to be markdown"
      );
      console.error("[SOP Update] Preview:", updatedHtml.substring(0, 500));
      return NextResponse.json(
        {
          success: false,
          message:
            "HTML conversion failed - output is not valid HTML (missing HTML tags)",
        },
        { status: 500 }
      );
    }

    if (updatedHtml.includes("```") && !updatedHtml.includes("<code>")) {
      console.error(
        "[SOP Update] Generated HTML contains markdown code fences - conversion may have failed"
      );
      console.error("[SOP Update] Preview:", updatedHtml.substring(0, 500));
      return NextResponse.json(
        {
          success: false,
          message: "HTML conversion failed - output contains markdown syntax",
        },
        { status: 500 }
      );
    }

    console.log(
      "[SOP Update] HTML validation passed - valid HTML generated, length:",
      updatedHtml.length
    );

    if (existingSOP.isCurrentVersion) {
      await prisma.sOP.update({
        where: { id: sopId },
        data: { isCurrentVersion: false },
      });
    }

    const updatedSOP = await prisma.sOP.create({
      data: {
        userOrganizationId: existingSOP.userOrganizationId,
        organizationId: existingSOP.organizationId,
        title: existingSOP.title,
        content: {
          html: updatedHtml,
          version: nextVersionNumber.toString(),
          generatedAt: currentContent?.generatedAt || new Date().toISOString(),
          lastEditedAt: new Date().toISOString(),
        },
        intakeData: existingSOP.intakeData ?? undefined,
        usedKnowledgeBaseVersion:
          existingSOP.usedKnowledgeBaseVersion ?? undefined,
        knowledgeBaseSnapshot: existingSOP.knowledgeBaseSnapshot ?? undefined,
        contributedInsights: existingSOP.contributedInsights ?? undefined,

        versionNumber: nextVersionNumber,
        rootSOPId: rootSOPId,
        isCurrentVersion: true,
        versionCreatedBy: decoded.userId,
        versionCreatedAt: new Date(),
        metadata: {
          ...(existingSOP.metadata as any),
          lastEditedBy: decoded.userId,
          lastEditedAt: new Date().toISOString(),
          editHistory: [
            ...((existingSOP.metadata as any)?.editHistory || []),
            {
              version: nextVersionNumber,
              editedBy: decoded.userId,
              editedAt: new Date().toISOString(),
              changesSummary: `Updated SOP content (version ${nextVersionNumber})`,
            },
          ],
          aiReviewed: reviewWithAI || false,
          aiReviewSuggestionsCount: aiReviewSuggestions.length,
        },
      } as any,
      select: {
        id: true,
        title: true,
        content: true,
        versionNumber: true,
        updatedAt: true,
      },
    });

    let contributedInsights: any[] = [];
    try {
      const intakeData = existingSOP.intakeData as any;
      const organizationProfile =
        (existingSOP.metadata as any)?.organizationProfileSnapshot || null;

      const sopDataForExtraction = {
        sopContent: sopContent,
        content: {
          markdown: sopContent,
        },
        intakeData: intakeData,
        organizationProfile: organizationProfile,
        metadata: {
          title: existingSOP.title,
          updatedAt: new Date().toISOString(),
          version: nextVersionNumber,
        },
      };

      contributedInsights = await extractInsights(
        "SOP_GENERATION",
        sopDataForExtraction
      );
    } catch (insightError: any) {
      console.error(
        "[SOP Update] Error extracting insights (non-blocking):",
        insightError
      );
    }

    if (contributedInsights.length > 0) {
      try {
        const knowledgeBase = await prisma.organizationKnowledgeBase.findUnique(
          {
            where: { organizationId: existingSOP.organizationId },
            select: { id: true },
          }
        );

        if (knowledgeBase) {
          const learningEventsResult = await createLearningEvents({
            knowledgeBaseId: knowledgeBase.id,
            sourceType: "SOP_GENERATION",
            sourceId: updatedSOP.id,
            insights: contributedInsights,
            triggeredBy: existingSOP.userOrganizationId,
          });

          if (learningEventsResult.success) {
            console.log(
              `[SOP Update] Created ${learningEventsResult.eventsCreated} LearningEvents for SOP ${sopId}`
            );

            try {
              await applyLearningEventsToKB({
                knowledgeBaseId: knowledgeBase.id,
                minConfidence: CONFIDENCE_THRESHOLDS.HIGH,
              });
            } catch (enrichmentError) {
              console.error(
                "[SOP Update] Error applying learning events (non-critical):",
                enrichmentError
              );
            }
          }
        }
      } catch (learningEventError) {
        console.error(
          "[SOP Update] Error creating LearningEvents (non-critical):",
          learningEventError
        );
      }
    }

    const responseContent = updatedSOP.content as any;
    const response = NextResponse.json({
      success: true,
      sop: {
        id: updatedSOP.id,
        title: updatedSOP.title,
        content: responseContent,
        version: nextVersionNumber,
        versionNumber: nextVersionNumber,
        updatedAt: updatedSOP.updatedAt,
      },
      sopHtml: responseContent?.html || updatedHtml,
      aiReview: reviewWithAI
        ? {
            suggestions: aiReviewSuggestions,
            reviewed: true,
          }
        : null,
    });
    return addRateLimitHeaders(response, rateLimit.rateLimitResult);
  } catch (error: any) {
    console.error("[SOP Update] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Internal server error.",
      },
      { status: 500 }
    );
  }
}
