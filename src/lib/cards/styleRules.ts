import OpenAI from "openai";
import { DeepInsight, AnalysisContext, FormattingPatterns } from "../analysis/types";

export interface StyleRulesCard {
  title: string;
  description: string;
  metadata: Record<string, any> & { confidence_score: number };
  confidence_score: number;
  source_attribution: Array<string | { source?: string; insight?: string }>;
}

function aggregateFormattingPatterns(files: any[]): FormattingPatterns {
  const base: FormattingPatterns = {
    headingStyles: [],
    listUsage: { bulletPoints: 0, numberedLists: 0, examples: [] },
    paragraphStructure: { avgLength: 0, avgSentenceLength: 0, examples: [] },
    emphasisPatterns: { bold: [], italic: [], allCaps: [] },
    ctaPatterns: [],
  };

  if (!files || files.length === 0) return base;

  const collected = files
    .map((f: any) => f.formattingPatterns)
    .filter(Boolean) as FormattingPatterns[];

  if (collected.length === 0) return base;

  base.headingStyles = Array.from(
    new Set(collected.flatMap((p) => p.headingStyles || []))
  );
  base.listUsage.bulletPoints = collected.reduce(
    (sum, p) => sum + (p.listUsage?.bulletPoints || 0),
    0
  );
  base.listUsage.numberedLists = collected.reduce(
    (sum, p) => sum + (p.listUsage?.numberedLists || 0),
    0
  );
  base.listUsage.examples = collected
    .flatMap((p) => p.listUsage?.examples || [])
    .slice(0, 3);

  const paragraphExamples = collected.flatMap(
    (p) => p.paragraphStructure?.examples || []
  );
  base.paragraphStructure.examples = paragraphExamples.slice(0, 5);
  const avgLengths = collected
    .map((p) => p.paragraphStructure?.avgLength || 0)
    .filter(Boolean);
  if (avgLengths.length > 0) {
    base.paragraphStructure.avgLength =
      avgLengths.reduce((a, b) => a + b, 0) / avgLengths.length;
  }
  const avgSent = collected
    .map((p) => p.paragraphStructure?.avgSentenceLength || 0)
    .filter(Boolean);
  if (avgSent.length > 0) {
    base.paragraphStructure.avgSentenceLength =
      avgSent.reduce((a, b) => a + b, 0) / avgSent.length;
  }

  base.emphasisPatterns.bold = Array.from(
    new Set(collected.flatMap((p) => p.emphasisPatterns?.bold || []))
  ).slice(0, 10);
  base.emphasisPatterns.italic = Array.from(
    new Set(collected.flatMap((p) => p.emphasisPatterns?.italic || []))
  ).slice(0, 10);
  base.emphasisPatterns.allCaps = Array.from(
    new Set(collected.flatMap((p) => p.emphasisPatterns?.allCaps || []))
  ).slice(0, 10);

  base.ctaPatterns = Array.from(
    new Set(collected.flatMap((p) => p.ctaPatterns || []))
  ).slice(0, 10);

  return base;
}

export async function generateStyleRulesCard(
  openai: OpenAI,
  insights: DeepInsight[],
  context: AnalysisContext
): Promise<StyleRulesCard> {
  try {
    const styleInsights = insights.filter(
      (i) => i.category === "formatting" || i.category === "structure"
    );

    const formattingPatterns = aggregateFormattingPatterns(context.files);
    const enhanced = context.enhancedContext;

    const styleRulesPrompt = `You are a content style analyst. Create formatting and structure guidelines.

INPUTS:
${JSON.stringify(
  {
    formattingPatterns,
    voiceSamples: enhanced?.styleRules.goodExamples,
    websiteSamples: enhanced?.styleRules.websiteSamples,
    customerJourney: enhanced?.ghlImplementation.customerJourney,
    exampleLinkContent: enhanced?.brandVoice.exampleLinkContent || [],
  },
  null,
  2
)}

TASK: Create style rules with these REQUIRED sections:

## 1. Formatting Preferences
HEADINGS: [how they style H1, H2, H3]
LISTS: [bullet vs numbered, max items, structure]
PARAGRAPHS: [length, white space, rhythm]
Provide specific examples from their content.

## 2. Content Structure Templates
Provide templates for:
- Email structure (5-step template)
- Social post structure (4-step template)
- Blog post structure (intro/body/conclusion)
Each template should have specific guidelines.

## 3. Visual Elements
IMAGES: [when/how to use, examples]
EMOJIS: [rules for usage by context]
CTAS: [format, placement, language]

## 4. Calls to Action (CTAs)
PRIMARY CTA: [main conversion action]
SECONDARY CTA: [alternative actions]
SUPPORT CTA: [help/questions]
Include actual links and format preferences.

## 5. Length Guidelines
Specify word counts for:
- Email subject lines
- Email body
- Blog posts
- Social posts (by platform)

OUTPUT FORMAT: Return JSON with structured metadata for each section.`;

    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: styleRulesPrompt },
        {
          role: "user",
          content: `Use the mined insights and samples below to generate the card.

INSIGHTS (${styleInsights.length}):
${JSON.stringify(styleInsights.slice(0, 30), null, 2)}

WEBSITE CONTENT:
${context.websiteContent.fullText.substring(0, 2000)}

FILE FORMATTING SAMPLES:
${JSON.stringify(formattingPatterns, null, 2)}

EXAMPLE CONTENT LINKS (from contentLinks field):
${enhanced?.brandVoice.exampleLinkContent && enhanced.brandVoice.exampleLinkContent.length > 0
  ? enhanced.brandVoice.exampleLinkContent
      .map(
        (link: any) => `URL: ${link.url}
Title: ${link.metadata?.title || "N/A"}
Hero: ${link.hero || ""}
About: ${link.about || ""}
Full Text: ${link.fullText || ""}`
      )
      .join("\n\n---\n\n")
  : "No example content links provided"}
`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.35,
      max_tokens: 9000,
    });

    const rawResponse = result.choices[0].message.content || "{}";
    let parsed: any = {};

    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error("Error parsing style rules card response:", parseError);
    }

    const fallbackConfidence =
      styleInsights.length > 0
        ? Math.round(
            styleInsights.reduce((a, b) => a + (b.confidence || 0), 0) /
              styleInsights.length
          )
        : 40;

    const confidence = parsed.confidence_score || fallbackConfidence;

    return {
      title: parsed.title || "Style Rules & Guidelines",
      description: parsed.description || "Style guidelines based on your content.",
      metadata: {
        ...(parsed.metadata || {}),
        confidence_score: confidence,
      },
      confidence_score: confidence,
      source_attribution:
        parsed.source_attribution ||
        styleInsights.map((i) => i.source_locations.join(", ")),
    };
  } catch (error) {
    console.error("Error generating style rules card:", error);
    return {
      title: "Style Rules & Guidelines",
      description: "Style guidelines.",
      metadata: { confidence_score: 30 },
      confidence_score: 30,
      source_attribution: [],
    };
  }
}

