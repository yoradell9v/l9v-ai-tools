import OpenAI from "openai";
import { DeepInsight, AnalysisContext } from "../analysis/types";

export interface BrandVoiceCard {
  title: string;
  description: string;
  metadata: {
    core_attributes?: string[];
    always_use?: string[];
    never_use?: string[];
    tone_contexts?: Record<string, string>;
    examples?: Array<{ wrong: string; right: string }>;
    confidence_score: number;
    source_attribution?: Array<{ source: string; insight: string }>;
    [key: string]: any;
  };
  confidence_score: number;
  source_attribution: Array<{ source?: string; insight?: string } | string>;
}

export async function generateBrandVoiceCard(
  openai: OpenAI,
  insights: DeepInsight[],
  context: AnalysisContext
): Promise<BrandVoiceCard> {
  try {
    const voiceInsights = insights.filter(
      (i) =>
        i.category === "language_pattern" ||
        i.category === "relationship" ||
        i.category === "structure"
    );

    const enhanced = context.enhancedContext;

    const contentSamples = {
      hero: context.websiteContent.hero.substring(0, 2000),
      about: context.websiteContent.about.substring(0, 2000),
      services: context.websiteContent.services.substring(0, 2000),
      fullText: context.websiteContent.fullText.substring(0, 4000),
    };

    const fileSamples = context.files
      .filter((f) => f.type === "brand_guide" || f.type === "style_guide")
      .flatMap((f) =>
        f.sections.slice(0, 3).map((s) => ({
          title: s.title,
          content: s.content.substring(0, 600),
        }))
      );

    const brandVoicePrompt = `You are a brand voice analyst creating a comprehensive writing guide for virtual assistants.

INPUTS:
${JSON.stringify(
  {
    stylePreference: enhanced?.brandVoice.stylePreference,
    riskLevel: enhanced?.brandVoice.riskLevel,
    goodExamples: enhanced?.brandVoice.goodExamples,
    avoidExamples: enhanced?.brandVoice.avoidExamples,
    websiteHero: enhanced?.styleRules.websiteSamples.hero,
    documentSamples: enhanced?.styleRules.documentSamples?.slice(0, 3) || [],
    exampleLinkContent: enhanced?.brandVoice.exampleLinkContent || [],
  },
  null,
  2
)}

TASK: Create a comprehensive brand voice guide with these REQUIRED sections:

## 1. Core Voice Attributes (3-5 traits)
List 3-5 specific voice characteristics with examples from their content.
Example: "Conversational yet authoritative - uses 'you' language, never stuffy third-person"

## 2. Vocabulary & Phrase Patterns
ALWAYS USE: [List 10-15 phrases/terms they frequently use]
NEVER USE: [List 10-15 phrases/terms to avoid]
Include actual examples from their content.

## 3. Sentence Structure & Rhythm
- Average sentence length: [calculate from samples]
- Paragraph style: [describe based on samples]
- Rhythm pattern: [mix of short/long, use of fragments, etc.]
Provide 3 before/after examples.

## 4. Tone by Context
Specify tone for: Sales emails, Nurture content, Social media, Support communications
Each should have 2-3 specific guidelines.

## 5. Do's and Don'ts (15 specific rules)
Provide 15 actionable rules with examples:
✓ DO: [specific action] - Example: [show it]
✗ DON'T: [specific action] - Example: [show wrong way]

## 6. Example Snippets (5 before/after pairs)
Show 5 real examples:
❌ WRONG: [generic/off-brand version]
✅ RIGHT: [their actual style]

OUTPUT FORMAT: Return JSON:
{
  "title": "Brand Voice Guide",
  "description": "[Full markdown guide with all 6 sections above]",
  "metadata": {
    "core_attributes": ["trait1", "trait2", ...],
    "always_use": ["phrase1", "phrase2", ...],
    "never_use": ["phrase1", "phrase2", ...],
    "tone_contexts": {
      "sales": "description",
      "nurture": "description",
      "social": "description"
    },
    "examples": [
      {"wrong": "...", "right": "..."}
    ]
  },
  "confidence_score": 85,
  "source_attribution": [
    {"source": "website hero", "insight": "Uses direct 'you' language"}
  ]
}

CRITICAL: Every rule must be backed by evidence from their content. Do not invent generic advice.`;

    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: brandVoicePrompt },
        {
          role: "user",
          content: `Use the mined insights and samples below to generate the card.

INSIGHTS (${voiceInsights.length}):
${JSON.stringify(voiceInsights.slice(0, 30), null, 2)}

CONTENT SAMPLES:
Hero: ${contentSamples.hero}
About: ${contentSamples.about}
Services: ${contentSamples.services}
Website Text: ${contentSamples.fullText}

FILE SAMPLES:
${fileSamples
  .slice(0, 3)
  .map((f) => `${f.title}:\n${f.content}`)
  .join("\n\n") || "No file samples"}

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

INTAKE DATA:
${JSON.stringify(
  {
    brandVoiceStyle: context.intakeData?.brandVoiceStyle || "",
    riskBoldnessLevel: context.intakeData?.riskBoldnessLevel || "",
    forbiddenWords: context.intakeData?.forbiddenWords || "",
    soundsLike: context.intakeData?.soundsLike || "",
  },
  null,
  2
)}
`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.35,
      max_tokens: 12000,
    });

    const rawResponse = result.choices[0].message.content || "{}";
    let parsed: any = {};

    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error("Error parsing brand voice card response:", parseError);
      console.error(
        "Raw response (first 800 chars):",
        rawResponse.substring(0, 800)
      );
    }

    const fallbackConfidence =
      voiceInsights.length > 0
        ? Math.round(
            voiceInsights.reduce((a, b) => a + (b.confidence || 0), 0) /
              voiceInsights.length
          )
        : 50;

    const confidence = parsed.confidence_score || fallbackConfidence;

    return {
      title: parsed.title || "Brand Voice Guide",
      description:
        parsed.description || "Brand voice guidance generated from content.",
      metadata: {
        ...parsed.metadata,
        confidence_score: confidence,
      },
      confidence_score: confidence,
      source_attribution:
        parsed.source_attribution ||
        voiceInsights.map((i) => i.source_locations.join(", ")),
    };
  } catch (error) {
    console.error("Error generating brand voice card:", error);
    return {
      title: "Brand Voice Guide",
      description: "Comprehensive brand voice guidelines.",
      metadata: {
        core_attributes: [],
        always_use: [],
        never_use: [],
        tone_contexts: {},
        examples: [],
        confidence_score: 30,
      },
      confidence_score: 30,
      source_attribution: [],
    };
  }
}

