import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { extractInsights } from "@/lib/analysis/extractInsights";
import { createLearningEvents } from "@/lib/learning-events";
import { applyLearningEventsToKB } from "@/lib/apply-learning-events";
import { markdownToHtml } from "@/lib/markdown-to-html";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for markdown to HTML conversion using OpenAI (fallback)
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

/**
 * Convert markdown to HTML using OpenAI as a fallback
 */
async function convertMarkdownToHtmlWithOpenAI(markdown: string): Promise<string> {
  try {
    console.log("[SOP Update] Converting markdown to HTML with OpenAI, length:", markdown.length);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast and cheap for conversion
      messages: [
        { role: "system", content: MARKDOWN_TO_HTML_SYSTEM_PROMPT },
        { role: "user", content: markdown },
      ],
      temperature: 0, // Deterministic output
      max_tokens: 16000, // Large enough for full SOP HTML
    });

    let html = completion.choices[0].message.content || "";
    
    // Remove any markdown code fences that might have slipped through
    html = html.replace(/```html\n?/g, "").replace(/```\n?/g, "").trim();
    
    console.log("[SOP Update] OpenAI HTML conversion complete, length:", html.length);
    
    return html;
  } catch (error) {
    console.error("[SOP Update] Error converting markdown to HTML with OpenAI:", error);
    throw error;
  }
}

// System prompt for AI review
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

    // 2. Parse request body
    const body = await request.json();
    const { sopId, sopContent, reviewWithAI } = body;

    if (!sopId || !sopContent) {
      return NextResponse.json(
        { success: false, message: "sopId and sopContent are required." },
        { status: 400 }
      );
    }

    // 3. Get existing SOP and verify ownership
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

    // Verify user has access to this SOP
    if (existingSOP.userOrganization.userId !== decoded.userId) {
      return NextResponse.json(
        { success: false, message: "You don't have permission to edit this SOP." },
        { status: 403 }
      );
    }

    // 4. Get current version from content
    const currentContent = existingSOP.content as any;
    const currentVersion = currentContent?.version || "1.0";
    const versionNumber = parseFloat(currentVersion);
    const nextVersion = (versionNumber + 0.1).toFixed(1); // Increment by 0.1 (e.g., 1.0 -> 1.1)

    // 5. AI Review (if requested)
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
          temperature: 0.3, // Lower temperature for more consistent review
          max_tokens: 2000,
        });

        const reviewResult = JSON.parse(
          reviewCompletion.choices[0].message.content || "{}"
        );

        if (reviewResult.suggestions && Array.isArray(reviewResult.suggestions)) {
          aiReviewSuggestions = reviewResult.suggestions;
        }
      } catch (reviewError: any) {
        console.error("[SOP Update] AI review error:", reviewError);
        // Continue without review - don't fail the update
      }
    }

    // 6. Convert updated markdown to HTML
    let updatedHtml: string | undefined = undefined;
    try {
      // Try library-based conversion first (fast and free), fallback to OpenAI if needed
      try {
        updatedHtml = await markdownToHtml(sopContent);
        console.log("[SOP Update] Library conversion successful, HTML length:", updatedHtml.length);
        
        // Verify we got valid HTML
        if (!updatedHtml || updatedHtml.trim().length === 0) {
          throw new Error("Library conversion returned empty result");
        }
        
        // Check if it actually looks like HTML (has tags)
        if (!updatedHtml.includes("<")) {
          throw new Error("Library conversion did not produce HTML tags");
        }
        
        // Check if it still contains markdown syntax (indicates conversion failed)
        if (updatedHtml.includes("```") && !updatedHtml.includes("<code>")) {
          throw new Error("Library conversion may have failed (contains markdown code fences)");
        }
      } catch (libraryError: any) {
        console.warn("[SOP Update] Library conversion failed or produced poor results, falling back to OpenAI:", libraryError.message);
        
        // Fallback to OpenAI conversion
        updatedHtml = await convertMarkdownToHtmlWithOpenAI(sopContent);
        console.log("[SOP Update] OpenAI fallback conversion successful, HTML length:", updatedHtml.length);
      }
    } catch (htmlError: any) {
      console.error("[SOP Update] Error converting markdown to HTML (non-blocking):", htmlError);
      // Continue without HTML - will use markdown on frontend
      updatedHtml = undefined;
    }

    // 7. Update SOP record
    const updatedSOP = await prisma.sOP.update({
      where: { id: sopId },
      data: {
        content: {
          markdown: sopContent,
          html: updatedHtml || undefined, // Store HTML if available
          version: nextVersion,
          generatedAt: currentContent?.generatedAt || new Date().toISOString(),
          lastEditedAt: new Date().toISOString(),
        },
        metadata: {
          ...(existingSOP.metadata as any),
          lastEditedBy: decoded.userId,
          lastEditedAt: new Date().toISOString(),
          editHistory: [
            ...((existingSOP.metadata as any)?.editHistory || []),
            {
              version: nextVersion,
              editedBy: decoded.userId,
              editedAt: new Date().toISOString(),
              changesSummary: `Updated SOP content (version ${nextVersion})`,
            },
          ],
          aiReviewed: reviewWithAI || false,
          aiReviewSuggestionsCount: aiReviewSuggestions.length,
        },
      },
      select: {
        id: true,
        title: true,
        content: true,
        updatedAt: true,
      },
    });

    // 7. Extract insights from updated SOP (for learning events)
    let contributedInsights: any[] = [];
    try {
      const intakeData = existingSOP.intakeData as any;
      const organizationProfile = (existingSOP.metadata as any)?.organizationProfileSnapshot || null;

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
          version: nextVersion,
        },
      };

      contributedInsights = extractInsights("SOP_GENERATION", sopDataForExtraction);
    } catch (insightError: any) {
      console.error("[SOP Update] Error extracting insights (non-blocking):", insightError);
    }

    // 8. Create learning events if insights found (non-blocking)
    if (contributedInsights.length > 0) {
      try {
        // Get knowledge base
        const knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
          where: { organizationId: existingSOP.organizationId },
          select: { id: true },
        });

        if (knowledgeBase) {
          const learningEventsResult = await createLearningEvents({
            knowledgeBaseId: knowledgeBase.id,
            sourceType: "SOP_GENERATION",
            sourceId: sopId,
            insights: contributedInsights,
            triggeredBy: existingSOP.userOrganizationId,
          });

          if (learningEventsResult.success) {
            console.log(
              `[SOP Update] Created ${learningEventsResult.eventsCreated} LearningEvents for SOP ${sopId}`
            );

            // Apply learning events to KB (non-blocking)
            try {
              await applyLearningEventsToKB({
                knowledgeBaseId: knowledgeBase.id,
                minConfidence: 80,
              });
            } catch (enrichmentError) {
              console.error("[SOP Update] Error applying learning events (non-critical):", enrichmentError);
            }
          }
        }
      } catch (learningEventError) {
        console.error("[SOP Update] Error creating LearningEvents (non-critical):", learningEventError);
      }
    }

    // 9. Return success response
    const responseContent = updatedSOP.content as any;
    return NextResponse.json({
      success: true,
      sop: {
        id: updatedSOP.id,
        title: updatedSOP.title,
        content: responseContent, // Return full content object with markdown and html
        version: nextVersion,
        updatedAt: updatedSOP.updatedAt,
      },
      aiReview: reviewWithAI
        ? {
            suggestions: aiReviewSuggestions,
            reviewed: true,
          }
        : null,
    });
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

