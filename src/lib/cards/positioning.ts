import OpenAI from "openai";
import { DeepInsight, AnalysisContext } from "../analysis/types";

export interface PositioningCard {
  title: string;
  description: string;
  metadata: Record<string, any> & { confidence_score: number };
  confidence_score: number;
  source_attribution: Array<string | { source?: string; insight?: string }>;
}

export async function generatePositioningCard(
  openai: OpenAI,
  insights: DeepInsight[],
  context: AnalysisContext
): Promise<PositioningCard> {
  try {
    const positioningInsights = insights.filter(
      (i) =>
        i.category === "belief" ||
        i.category === "proof" ||
        i.category === "relationship"
    );

    const enhanced = context.enhancedContext;

    const positioningPrompt = `You are a strategic positioning analyst. Create a positioning guide that defines how this business competes.

INPUTS:
${JSON.stringify(
  {
    corePitch: enhanced?.positioning.corePitch,
    targetAudience: enhanced?.positioning.targetAudience,
    mainObjection: enhanced?.positioning.mainObjection,
    coreOffer: enhanced?.positioning.coreOffer,
    businessStage: enhanced?.positioning.businessStage,
    websiteAbout: context.websiteContent.about,
    testimonials: context.websiteContent.testimonials,
    exampleLinkContent: enhanced?.brandVoice.exampleLinkContent || [],
  },
  null,
  2
)}

TASK: Create a positioning guide with these REQUIRED sections:

## 1. Core Positioning Statement (1-2 sentences)
The elevator pitch that captures who they serve and what makes them unique.

## 2. Target Audience Definition
PRIMARY: [detailed description with pain points]
SECONDARY: [if applicable]
Include demographic AND psychographic details.

## 3. Unique Value Proposition
What makes them different from competitors? List 4-5 specific differentiators.

## 4. Primary Problem Solved
PROBLEM: [customer pain point in their words]
SOLUTION: [how this business solves it]
Use actual language from their content.

## 5. Market Position & Competitive Landscape
How they position vs:
- Courses/DIY solutions
- Competing agencies/services
- Alternative solutions
Include 3-4 specific comparison points.

## 6. Proof Points & Credibility
List all available proof:
- Client results (with numbers)
- Testimonials (summarize key themes)
- Social proof (features, awards, etc.)
- Business credibility (their own revenue, experience)

OUTPUT FORMAT: Return JSON with:
{
  "title": "Market Positioning Guide",
  "description": "[Full markdown guide with all 6 sections]",
  "metadata": {
    "positioning_statement": "...",
    "target_audience": {
      "primary": "...",
      "secondary": "..."
    },
    "differentiators": ["...", "...", ...],
    "problem_solution": {
      "problem": "...",
      "solution": "..."
    },
    "proof_points": ["...", "...", ...]
  },
  "confidence_score": 90,
  "source_attribution": [...]
}`;

    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: positioningPrompt },
        {
          role: "user",
          content: `Use the mined insights and samples below to generate the card.

INSIGHTS (${positioningInsights.length}):
${JSON.stringify(positioningInsights.slice(0, 30), null, 2)}

WEBSITE ABOUT:
${context.websiteContent.about.substring(0, 2000)}

HERO:
${context.websiteContent.hero.substring(0, 800)}

SERVICES:
${context.websiteContent.services.substring(0, 800)}

TESTIMONIALS:
${context.websiteContent.testimonials.join("\n\n")}

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
      max_tokens: 8000,
    });

    const rawResponse = result.choices[0].message.content || "{}";
    let parsed: any = {};

    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error("Error parsing positioning card response:", parseError);
    }

    const fallbackConfidence =
      positioningInsights.length > 0
        ? Math.round(
            positioningInsights.reduce((a, b) => a + (b.confidence || 0), 0) /
              positioningInsights.length
          )
        : 50;

    const confidence = parsed.confidence_score || fallbackConfidence;

    return {
      title: parsed.title || "Market Positioning Guide",
      description: parsed.description || "Positioning guidance based on your content.",
      metadata: {
        ...(parsed.metadata || {}),
        confidence_score: confidence,
      },
      confidence_score: confidence,
      source_attribution:
        parsed.source_attribution ||
        positioningInsights.map((i) => i.source_locations.join(", ")),
    };
  } catch (error) {
    console.error("Error generating positioning card:", error);
    return {
      title: "Market Positioning Guide",
      description: "Positioning guidance.",
      metadata: { confidence_score: 30 },
      confidence_score: 30,
      source_attribution: [],
    };
  }
}

