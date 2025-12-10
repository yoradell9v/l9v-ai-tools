import OpenAI from "openai";
import { DeepInsight, AnalysisContext } from "../analysis/types";

export interface ComplianceCard {
  title: string;
  description: string;
  metadata: Record<string, any> & { confidence_score: number };
  confidence_score: number;
  source_attribution: Array<string | { source?: string; insight?: string }>;
}

export async function generateComplianceCard(
  openai: OpenAI,
  insights: DeepInsight[],
  context: AnalysisContext
): Promise<ComplianceCard> {
  try {
    const complianceInsights = insights.filter((i) => i.category === "compliance");
    const enhanced = context.enhancedContext;

    const complianceMarkers = context.files.flatMap(
      (f: any) => f.complianceMarkers || []
    );

    const compliancePrompt = `You are a compliance and legal content analyst. Create strict compliance rules.

INPUTS:
${JSON.stringify(
  {
    isRegulated: enhanced?.compliance.isRegulated,
    industryType: enhanced?.compliance.industryType,
    forbiddenWords: enhanced?.compliance.forbiddenWords,
    requiredDisclaimers: enhanced?.compliance.requiredDisclaimers,
    complianceMarkers,
    businessType: context.intakeData?.businessType,
  },
  null,
  2
)}

TASK: Create compliance guidelines with these REQUIRED sections:

## 1. Regulatory Context
INDUSTRY: [industry name]
REGULATIONS: [FTC, FDA, SEC, etc.]
RISK LEVEL: [LOW/MEDIUM/HIGH]
Explain why this risk level.

## 2. Forbidden Language (Critical Restrictions)
List all forbidden words/phrases with explanations:
❌ "guaranteed" - WHY: Violates FTC earnings disclosure rules
❌ "cure" - WHY: FDA medical claims violation
Include at least 10-15 specific restrictions.

## 3. Required Disclaimers
Provide exact disclaimer text that must appear on:
- All sales pages
- Testimonials
- Income claims
- Email signatures
Include where and how to display.

## 4. Safe Phrasing Alternatives
For each forbidden phrase, provide 3-5 safe alternatives:
INSTEAD OF "guaranteed," USE:
✅ "Our goal is to..."
✅ "Designed to help you..."

## 5. Testimonial & Proof Guidelines
Rules for:
- How to present testimonials legally
- Required disclaimers for case studies
- Photo/screenshot requirements
- Dating and attribution

## 6. Risk Areas & Red Flags
List high-risk content areas that need review:
⚠️ Income claims - [specific rules]
⚠️ Health claims - [specific rules]

OUTPUT FORMAT: Return JSON with metadata for each restriction and alternative.`;

    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: compliancePrompt },
        {
          role: "user",
          content: `Use the mined insights and samples below to generate the card.

INSIGHTS (${complianceInsights.length}):
${JSON.stringify(complianceInsights.slice(0, 20), null, 2)}

WEBSITE CONTENT:
${context.websiteContent.fullText.substring(0, 2000)}

EXAMPLE CONTENT LINKS (from contentLinks field):
${enhanced?.brandVoice.exampleLinkContent && enhanced.brandVoice.exampleLinkContent.length > 0
  ? enhanced.brandVoice.exampleLinkContent
      .map(
        (link: any) => `URL: ${link.url}
Title: ${link.metadata?.title || "N/A"}
Full Text: ${link.fullText || ""}`
      )
      .join("\n\n---\n\n")
  : "No example content links provided"}
`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.25,
      max_tokens: 7000,
    });

    const rawResponse = result.choices[0].message.content || "{}";
    let parsed: any = {};

    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error("Error parsing compliance card response:", parseError);
    }

    const fallbackConfidence =
      complianceInsights.length > 0
        ? Math.round(
            complianceInsights.reduce((a, b) => a + (b.confidence || 0), 0) /
              complianceInsights.length
          )
        : 30;

    const confidence = parsed.confidence_score || fallbackConfidence;

    return {
      title: parsed.title || "Compliance & Legal Guidelines",
      description: parsed.description || "Compliance guidelines.",
      metadata: {
        ...(parsed.metadata || {}),
        confidence_score: confidence,
      },
      confidence_score: confidence,
      source_attribution:
        parsed.source_attribution ||
        complianceInsights.map((i) => i.source_locations.join(", ")),
    };
  } catch (error) {
    console.error("Error generating compliance card:", error);
    return {
      title: "Compliance & Legal Guidelines",
      description: "Compliance guidelines.",
      metadata: { confidence_score: 30 },
      confidence_score: 30,
      source_attribution: [],
    };
  }
}

