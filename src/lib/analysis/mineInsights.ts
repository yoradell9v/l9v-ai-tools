import OpenAI from "openai";
import {
  DeepInsight,
  InsightCategory,
  AnalysisContext,
  MiningResult,
} from "./types";
import { calculateInsightConfidence, validateInsight } from "./confidence";

export async function mineDeepInsights(
  openai: OpenAI,
  context: AnalysisContext
): Promise<MiningResult> {
  const allInsights: DeepInsight[] = [];

  try {
    const websiteInsights = await mineWebsiteInsights(
      openai,
      context.websiteContent
    );
    allInsights.push(...websiteInsights);

    // Mine insights from contentLinks URLs
    if (context.contentLinks && context.contentLinks.length > 0) {
      console.log(`[mineDeepInsights] Mining insights from ${context.contentLinks.length} content links`);
      for (const contentLink of context.contentLinks) {
        try {
          // Treat each contentLink as a website-like source
          const linkInsights = await mineWebsiteInsights(openai, {
            hero: contentLink.hero,
            about: contentLink.about,
            services: contentLink.services,
            testimonials: contentLink.testimonials,
            fullText: contentLink.fullText,
            metadata: contentLink.metadata,
          });
          
          // Update source locations to indicate these came from contentLinks
          const adjustedInsights = linkInsights.map((insight) => ({
            ...insight,
            source_locations: insight.source_locations.map(
              (loc) => `contentLink:${contentLink.url} - ${loc}`
            ),
          }));
          
          allInsights.push(...adjustedInsights);
        } catch (error) {
          console.error(`Failed to mine insights from content link ${contentLink.url}:`, error);
        }
      }
    }

    for (const file of context.files) {
      try {
        const fileInsights = await mineFileInsights(openai, file, context);
        allInsights.push(...fileInsights);
      } catch (error) {
        console.error(`Failed to mine insights from ${file.name}:`, error);
      }
    }

    const validInsights = allInsights.filter(validateInsight);

    const validatedInsights = await crossReferenceInsights(
      openai,
      validInsights
    );

    const highConfidenceCount = validatedInsights.filter(
      (i) => i.confidence >= 8
    ).length;
    const specificityAvg =
      validatedInsights.length > 0
        ? validatedInsights.reduce((sum, i) => sum + i.specificity_score, 0) /
          validatedInsights.length
        : 0;
    const categoriesCovered = [
      ...new Set(validatedInsights.map((i) => i.category)),
    ] as InsightCategory[];

    return {
      insights: validatedInsights,
      total_insights: validatedInsights.length,
      high_confidence_count: highConfidenceCount,
      specificity_avg: Math.round(specificityAvg * 10) / 10,
      categories_covered: categoriesCovered,
    };
  } catch (error) {
    console.error("Error mining deep insights:", error);
    // Return empty result rather than failing completely
    return {
      insights: [],
      total_insights: 0,
      high_confidence_count: 0,
      specificity_avg: 0,
      categories_covered: [],
    };
  }
}

async function mineWebsiteInsights(
  openai: OpenAI,
  websiteContent: AnalysisContext["websiteContent"]
): Promise<DeepInsight[]> {
  const systemPrompt = `You are a linguistic and business pattern analyst. Extract SPECIFIC, EVIDENCE-BACKED insights from website content.

CRITICAL REQUIREMENTS:
1. Specificity: Rate each insight 1-10. REJECT anything below 7. Generic observations like "professional tone" or "customer-focused" are NOT acceptable.
2. Evidence: For EACH insight, provide 2-5 EXACT quotes (3-10 words each) from the content.
3. Uniqueness: Each insight must answer "What makes this unique to THIS business?" - not applicable to all businesses.
4. Categories: Classify as language_pattern, structure, belief, relationship, or proof.

ACCEPTABLE insights:
- "Uses 3-word power phrases ending in action verbs: 'Transform your business', 'Scale with confidence'"
- "Addresses reader as 'you' 4x more than 'we' in hero section"
- "Uses em dashes instead of commas for emphasis (found 8 instances)"
- "Testimonials average 45 words and include specific metrics"

REJECT these generic insights:
- "Professional tone"
- "Customer-focused approach"
- "High-quality service"
- "Engaging content"

Return JSON array with format:
{
  "insights": [
    {
      "finding": "Specific observation with measurable detail",
      "evidence": ["exact quote 1", "exact quote 2", "exact quote 3"],
      "source_locations": ["hero section", "about page"],
      "category": "language_pattern",
      "unique_identifier": "What makes this unique to THIS business",
      "specificity_score": 8
    }
  ]
}`;

  try {
    const combinedContent = [
      `HERO: ${websiteContent.hero}`,
      `ABOUT: ${websiteContent.about}`,
      `SERVICES: ${websiteContent.services}`,
      `FULL TEXT: ${websiteContent.fullText.substring(0, 10000)}`,
    ].join("\n\n");

    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Extract deep insights from this website content:\n\n${combinedContent}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 4000,
    });

    console.log("Website insights: Received response from LLM", result);
    const rawResponse = result.choices[0].message.content || "{}";
    let parsed: any = {};

    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error("Error parsing website insights response:", parseError);
      console.error(
        "Raw response (first 500 chars):",
        rawResponse.substring(0, 500)
      );
      return [];
    }

    const rawInsights = parsed.insights || [];

    if (rawInsights.length === 0) {
      console.warn("Website insights: No insights extracted from content");
      console.log("Response structure:", Object.keys(parsed));
      if (parsed.error) {
        console.error("LLM reported error:", parsed.error);
      }
    } else {
      console.log(
        `Website insights: Extracted ${rawInsights.length} raw insights`
      );
    }

    const insights: DeepInsight[] = rawInsights.map(
      (raw: any, index: number) => {
        const insight: DeepInsight = {
          finding: raw.finding || "",
          evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
          source_locations: Array.isArray(raw.source_locations)
            ? raw.source_locations
            : ["website"],
          category: raw.category || "language_pattern",
          unique_identifier: raw.unique_identifier || raw.finding,
          specificity_score: raw.specificity_score || 5,
          confidence: 0, // Will be calculated
        };

        insight.confidence = calculateInsightConfidence(insight);

        return insight;
      }
    );

    return insights;
  } catch (error) {
    console.error("Error mining website insights:", error);
    return [];
  }
}

async function mineFileInsights(
  openai: OpenAI,
  file: AnalysisContext["files"][0],
  context: AnalysisContext
): Promise<DeepInsight[]> {
  const systemPrompt = `You are a document analysis specialist. Extract SPECIFIC, EVIDENCE-BACKED insights from brand/style guide documents.

CRITICAL REQUIREMENTS:
1. Specificity: Rate each insight 1-10. REJECT anything below 7.
2. Evidence: Provide 2-5 EXACT quotes from the document.
3. Uniqueness: What makes this unique to THIS business?
4. Categories: Classify appropriately (language_pattern, structure, formatting, compliance, etc.)

Focus on:
- Exact formatting rules (paragraph length, punctuation, list structure)
- Specific language patterns (repeated phrases, sentence structure)
- Brand voice characteristics (with examples)
- Style guidelines (with exact specifications)
- Compliance requirements (with exact disclaimers/rules)

Return JSON array with insights matching DeepInsight format.`;

  try {
    const sections = file.sections
      .slice(0, 10)
      .map((section) => `[${section.title}]\n${section.content}`)
      .join("\n\n");

    if (!sections || sections.trim().length < 100) {
      return [];
    }

    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Extract insights from this ${file.type} document "${
            file.name
          }":\n\n${sections.substring(0, 15000)}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 4000,
    });

    const rawResponse = result.choices[0].message.content || "{}";
    let parsed: any = {};

    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error(
        `Error parsing file insights response for ${file.name}:`,
        parseError
      );
      console.error(
        "Raw response (first 500 chars):",
        rawResponse.substring(0, 500)
      );
      return [];
    }

    const rawInsights = parsed.insights || [];

    if (rawInsights.length === 0) {
      console.warn(`File insights (${file.name}): No insights extracted`);
    } else {
      console.log(
        `File insights (${file.name}): Extracted ${rawInsights.length} raw insights`
      );
    }

    const insights: DeepInsight[] = rawInsights.map((raw: any) => {
      const insight: DeepInsight = {
        finding: raw.finding || "",
        evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
        source_locations: [
          `${file.name}: ${raw.source_location || "document"}`,
        ],
        category: raw.category || "structure",
        unique_identifier: raw.unique_identifier || raw.finding,
        specificity_score: raw.specificity_score || 5,
        confidence: 0,
      };

      insight.confidence = calculateInsightConfidence(insight);
      return insight;
    });

    return insights;
  } catch (error) {
    console.error(`Error mining insights from file ${file.name}:`, error);
    return [];
  }
}

async function crossReferenceInsights(
  openai: OpenAI,
  insights: DeepInsight[]
): Promise<DeepInsight[]> {
  if (insights.length === 0) return [];

  // Generate unique IDs for insights
  const insightsWithIds = insights.map((insight, index) => ({
    ...insight,
    id: `insight_${index}`,
  }));

  const systemPrompt = `You are an insight validation specialist. Cross-reference insights to:
1. Identify confirmations (insights that reinforce each other)
2. Flag contradictions (insights that conflict)
3. Detect redundancies (similar insights that should be merged)
4. Validate evidence quality

For each insight, add:
- confirmed_by: count of confirming insights
- contradicted_by: array of contradicting insight IDs
- cross_references: array of related insight IDs
- validation_notes: brief note about validation status

Return JSON with validated insights array.`;

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Cross-reference these insights:\n\n${JSON.stringify(
            insightsWithIds.slice(0, 50),
            null,
            2
          )}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 3000,
    });

    const parsed = JSON.parse(result.choices[0].message.content || "{}");
    const validated = parsed.insights || insightsWithIds;

    return insightsWithIds.map((insight, index) => {
      const validatedInsight =
        validated.find((v: any) => v.id === insight.id) ||
        validated[index] ||
        {};

      return {
        ...insight,
        confirmed_by: validatedInsight.confirmed_by || 0,
        contradicted_by: validatedInsight.contradicted_by || [],
        cross_references: validatedInsight.cross_references || [],
        validation_notes: validatedInsight.validation_notes || "",
      };
    });
  } catch (error) {
    console.error("Error cross-referencing insights:", error);
    return insights;
  }
}
