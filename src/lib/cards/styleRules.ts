import OpenAI from "openai";
import { DeepInsight, AnalysisContext } from "../analysis/types";

export interface StyleRulesCard {
  title: string;
  description: string;
  metadata: {
    rules: string[];
    formatting: {
      paragraph_length: { avg: number; max: number; never: number };
      punctuation_preferences: string[];
      list_structure: {
        item_count: string;
        start_with_verbs: boolean;
        parallel_construction: boolean;
      };
      emphasis_techniques: string[];
      header_hierarchy: string[];
      whitespace_usage: string[];
      link_styling: string;
      number_date_formatting: string;
    };
    examples: string[];
    forbidden: string[];
    preferred: string[];
    confidence_score: number;
  };
  confidence_score: number;
  source_attribution: string[];
}

/**
 * Generate enhanced Style Rules card using deep insights
 */
export async function generateStyleRulesCard(
  openai: OpenAI,
  insights: DeepInsight[],
  context: AnalysisContext
): Promise<StyleRulesCard> {
  try {
    // Filter formatting and structure insights
    const styleInsights = insights.filter(
      i => i.category === "formatting" || 
           i.category === "structure"
    );

    const systemPrompt = `You are a content style analyst. Extract executable formatting rules.

REQUIREMENTS:
1. Extract SPECIFIC formatting rules:
   - Paragraph length patterns (avg, max, never exceed)
   - Punctuation preferences (em dash vs semicolon vs parentheses)
   - List structure (3-5 items? start with verbs? parallel construction?)
   - Emphasis techniques (bold vs italic vs caps)
   - Header hierarchy and naming patterns
   - Whitespace usage patterns
   - Link styling (inline, parenthetical, footnote)
   - Number/date formatting standards

2. Each rule must be:
   - Executable (clear dos/don'ts)
   - Backed by evidence from content
   - Specific and measurable

3. Include:
   - Forbidden phrases (from intake + discovered)
   - Preferred alternatives
   - Examples of good vs bad style

4. CRITICAL: Even if content is limited, generate rules from intake data (forbiddenWords, soundsLike). Do not return empty arrays.

Return JSON with this EXACT structure:
{
  "description": "Style guide description",
  "metadata": {
    "rules": ["rule1", "rule2", "rule3"],
    "formatting": {
      "paragraph_length": { "avg": 50, "max": 100, "never": 200 },
      "punctuation_preferences": ["em dash", "semicolon"],
      "list_structure": {
        "item_count": "3-5 items",
        "start_with_verbs": true,
        "parallel_construction": true
      },
      "emphasis_techniques": ["bold", "italic"],
      "header_hierarchy": ["H1", "H2", "H3"],
      "whitespace_usage": ["double line breaks"],
      "link_styling": "inline",
      "number_date_formatting": "MM/DD/YYYY"
    },
    "examples": ["example1", "example2"],
    "forbidden": ["word1", "word2"],
    "preferred": ["alternative1", "alternative2"],
    "confidence_score": 70
  },
  "source_attribution": ["source1"]
}

IMPORTANT: Populate ALL fields. Use intake data if content is limited.`;

    // Get full content from files and website
    const fileSamples = context.files
      .filter(f => f.type === "style_guide" || f.type === "brand_guide")
      .flatMap(f => f.sections)
      .map(s => ({ title: s.title, content: s.content.substring(0, 5000) }));

    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyze this style data and generate formatting rules.

INSIGHTS (${styleInsights.length} total):
${JSON.stringify(styleInsights.slice(0, 30), null, 2)}

FILE SAMPLES:
${fileSamples.slice(0, 5).map(f => `${f.title}:\n${f.content.substring(0, 500)}`).join('\n\n') || 'No file samples available'}

WEBSITE CONTENT:
${context.websiteContent.fullText.substring(0, 2000)}

INTAKE DATA:
${JSON.stringify({
  forbiddenWords: context.intakeData?.forbiddenWords || "",
  soundsLike: context.intakeData?.soundsLike || "",
  favoriteParagraphs: context.intakeData?.favoriteParagraphs || "",
  avoidParagraphs: context.intakeData?.avoidParagraphs || "",
}, null, 2)}

Generate the style rules card JSON now.`,
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
      console.error("Error parsing style rules card response:", parseError);
      console.error("Raw response (first 500 chars):", rawResponse.substring(0, 500));
    }
    
    console.log("[StyleRules] LLM Response Structure:", {
      hasMetadata: !!parsed.metadata,
      hasRules: !!parsed.metadata?.rules,
      rulesCount: parsed.metadata?.rules?.length || 0,
      hasForbidden: !!parsed.metadata?.forbidden,
      metadataKeys: parsed.metadata ? Object.keys(parsed.metadata) : [],
    });
    
    if (!parsed.metadata || parsed.metadata.rules?.length === 0) {
      console.warn("Style Rules card: No rules found in response, generating fallback");
      // Generate fallback from intake data
      parsed.metadata = parsed.metadata || {};
      const forbiddenWords = context.intakeData?.forbiddenWords 
        ? context.intakeData.forbiddenWords.split(',').map(w => w.trim()).filter(Boolean)
        : [];
      parsed.metadata.rules = [
        "Maintain consistent tone based on brand voice sliders",
        "Use clear, actionable language",
        "Avoid jargon unless necessary",
      ];
      parsed.metadata.forbidden = forbiddenWords;
      parsed.metadata.preferred = [];
      parsed.metadata.examples = [];
      parsed.metadata.formatting = {
        paragraph_length: { avg: 50, max: 150, never: 300 },
        punctuation_preferences: [],
        list_structure: { item_count: "3-5 items", start_with_verbs: false, parallel_construction: true },
        emphasis_techniques: [],
        header_hierarchy: [],
        whitespace_usage: [],
        link_styling: "inline",
        number_date_formatting: "",
      };
      console.log("[StyleRules] Generated fallback from intake data");
    }

    const confidenceScores = styleInsights.map(i => i.confidence);
    const avgConfidence = confidenceScores.length > 0
      ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
      : 40;

    return {
      title: "Style Rules & Guidelines",
      description: parsed.description || "Style guidelines based on your content.",
      metadata: {
        rules: parsed.metadata?.rules || [],
        formatting: parsed.metadata?.formatting || {
          paragraph_length: { avg: 0, max: 0, never: 0 },
          punctuation_preferences: [],
          list_structure: {
            item_count: "",
            start_with_verbs: false,
            parallel_construction: false,
          },
          emphasis_techniques: [],
          header_hierarchy: [],
          whitespace_usage: [],
          link_styling: "",
          number_date_formatting: "",
        },
        examples: parsed.metadata?.examples || [],
        forbidden: parsed.metadata?.forbidden || [],
        preferred: parsed.metadata?.preferred || [],
        confidence_score: parsed.metadata?.confidence_score || avgConfidence,
      },
      confidence_score: avgConfidence,
      source_attribution: parsed.source_attribution || styleInsights.map(i => i.source_locations.join(", ")),
    };
  } catch (error) {
    console.error("Error generating style rules card:", error);
    return {
      title: "Style Rules & Guidelines",
      description: "Style rules based on your preferences.",
      metadata: {
        rules: [],
        formatting: {
          paragraph_length: { avg: 0, max: 0, never: 0 },
          punctuation_preferences: [],
          list_structure: {
            item_count: "",
            start_with_verbs: false,
            parallel_construction: false,
          },
          emphasis_techniques: [],
          header_hierarchy: [],
          whitespace_usage: [],
          link_styling: "",
          number_date_formatting: "",
        },
        examples: [],
        forbidden: [],
        preferred: [],
        confidence_score: 30,
      },
      confidence_score: 30,
      source_attribution: [],
    };
  }
}

