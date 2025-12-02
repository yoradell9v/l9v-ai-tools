import OpenAI from "openai";
import { DeepInsight, AnalysisContext } from "../analysis/types";

export interface BrandVoiceCard {
  title: string;
  description: string;
  metadata: {
    rules: Array<{
      rule: string;
      example: string;
      counter_example?: string;
      justification: string;
      source: string;
      confidence: number;
    }>;
    sentence_construction: {
      avg_length: number;
      variety_patterns: string[];
      rhythm: string;
      punctuation_preferences: string[];
    };
    vocabulary: {
      frequent_words: string[];
      forbidden_words: string[];
      formality_examples: string[];
      power_phrases: string[];
    };
    rhetorical_patterns: {
      questions: string[];
      metaphors: string[];
      lists: string[];
      emphasis_techniques: string[];
    };
    relationship_dynamics: {
      reader_address: string;
      assumed_knowledge: string;
      power_positioning: string;
    };
    proof_credibility: {
      fact_to_opinion_ratio: string;
      citation_style: string;
      social_proof_patterns: string[];
    };
    confidence_score: number;
  };
  confidence_score: number;
  source_attribution: string[];
}

/**
 * Generate enhanced Brand Voice card using deep insights
 */
export async function generateBrandVoiceCard(
  openai: OpenAI,
  insights: DeepInsight[],
  context: AnalysisContext
): Promise<BrandVoiceCard> {
  try {
    // Log intake data availability
    console.log("[BrandVoice] Context intakeData:", {
      hasIntakeData: !!context.intakeData,
      keys: context.intakeData ? Object.keys(context.intakeData) : [],
      formalCasual: context.intakeData?.formalCasual,
      playfulSerious: context.intakeData?.playfulSerious,
      soundsLike: context.intakeData?.soundsLike,
      forbiddenWords: context.intakeData?.forbiddenWords?.substring(0, 50),
    });
    
    // Filter insights relevant to brand voice
    const voiceInsights = insights.filter(
      i => i.category === "language_pattern" || 
           i.category === "relationship" || 
           i.category === "structure"
    );

    console.log(`Brand Voice: Using ${voiceInsights.length} insights out of ${insights.length} total`);
    
    // If no insights, log warning but continue (will use content directly)
    if (voiceInsights.length === 0) {
      console.warn("Brand Voice: No relevant insights found, will analyze content directly");
    }

    // Prepare full content samples (not truncated)
    const contentSamples = {
      hero: context.websiteContent.hero.substring(0, 10000),
      about: context.websiteContent.about.substring(0, 10000),
      services: context.websiteContent.services.substring(0, 10000),
      fullText: context.websiteContent.fullText.substring(0, 15000),
    };

    // Extract file samples
    const fileSamples = context.files
      .filter(f => f.type === "brand_guide" || f.type === "style_guide")
      .flatMap(f => f.sections.slice(0, 5))
      .map(s => ({ title: s.title, content: s.content.substring(0, 5000) }));

    // Log content availability
    const hasWebsiteContent = contentSamples.fullText.length > 100 || 
                              contentSamples.hero.length > 50 ||
                              contentSamples.about.length > 50;
    const hasFileContent = fileSamples.length > 0;
    
    console.log(`Brand Voice: Content available - Website: ${hasWebsiteContent}, Files: ${hasFileContent} (${fileSamples.length} sections)`);
    
    if (!hasWebsiteContent && !hasFileContent) {
      console.warn("Brand Voice: Very limited content available, card quality may be reduced");
    }

    const systemPrompt = `You are a brand voice architect creating a comprehensive, actionable brand voice guide.

REQUIREMENTS:
1. Generate 3000+ word markdown guide with these sections:
   - Sentence Construction (avg length, variety patterns, rhythm, punctuation)
   - Vocabulary Choices (20+ frequent words, 10+ forbidden words, formality examples)
   - Rhetorical Patterns (questions, metaphors, lists, emphasis techniques)
   - Relationship Dynamics (reader address, assumed knowledge, power positioning)
   - Proof & Credibility (fact-to-opinion ratio, citation style, social proof)

2. Each rule in the rules array MUST be an object with:
   - rule: string (specific, actionable rule statement)
   - example: string (EXACT quote from source material)
   - counter_example: string (optional, what NOT to do)
   - justification: string (why this rule exists)
   - source: string (where this rule came from)
   - confidence: number (1-10)

3. NO generic statements. Everything must be:
   - Specific and measurable
   - Backed by exact quotes
   - Actionable for AI content generation

4. Use the provided insights to inform your analysis, but also analyze the full content directly.

5. CRITICAL: Even if insights array is empty, you MUST still analyze the content samples and generate rules. Do not return empty arrays.

6. For each section, extract actual data:
   - sentence_construction: Analyze actual sentences from content, calculate avg_length, identify patterns
   - vocabulary: Extract actual frequent words from content, identify forbidden words from intake data
   - rhetorical_patterns: Find actual questions, metaphors, lists in the content
   - relationship_dynamics: Analyze how the content addresses readers
   - proof_credibility: Analyze how facts vs opinions are presented

Return JSON with this EXACT structure:
{
  "description": "Brief description of the brand voice",
  "metadata": {
    "rules": [
      {
        "rule": "Specific rule statement",
        "example": "Exact quote from content",
        "counter_example": "What NOT to do",
        "justification": "Why this rule exists",
        "source": "Where this came from",
        "confidence": 8
      }
    ],
    "sentence_construction": {
      "avg_length": 15,
      "variety_patterns": ["pattern1", "pattern2"],
      "rhythm": "Description of sentence rhythm",
      "punctuation_preferences": ["em dash", "semicolon"]
    },
    "vocabulary": {
      "frequent_words": ["word1", "word2"],
      "forbidden_words": ["word1", "word2"],
      "formality_examples": ["example1"],
      "power_phrases": ["phrase1", "phrase2"]
    },
    "rhetorical_patterns": {
      "questions": ["question pattern"],
      "metaphors": ["metaphor example"],
      "lists": ["list pattern"],
      "emphasis_techniques": ["technique1"]
    },
    "relationship_dynamics": {
      "reader_address": "How reader is addressed",
      "assumed_knowledge": "What knowledge is assumed",
      "power_positioning": "Power dynamic description"
    },
    "proof_credibility": {
      "fact_to_opinion_ratio": "Description",
      "citation_style": "Citation style used",
      "social_proof_patterns": ["pattern1"]
    },
    "confidence_score": 75
  },
  "source_attribution": ["source1", "source2"]
}

IMPORTANT: You MUST populate all fields with actual data from the content. Do not return empty arrays or empty strings unless there is truly no data available.

CRITICAL: If the insights array is empty or content is limited, you MUST still generate rules based on:
- The intakeData sliders (formalCasual, playfulSerious, etc.)
- The soundsLike reference
- Any content samples provided
- Industry best practices

Generate at least 5-10 rules even if insights are limited. Each rule must have:
- A specific, actionable statement
- An example (even if from intake data)
- A justification
- A source
- A confidence score (1-10)`;

    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyze this brand voice data and generate comprehensive rules.

INSIGHTS (${voiceInsights.length} total):
${JSON.stringify(voiceInsights.slice(0, 30), null, 2)}

CONTENT SAMPLES:
Hero: ${contentSamples.hero.substring(0, 500)}
About: ${contentSamples.about.substring(0, 500)}
Services: ${contentSamples.services.substring(0, 500)}
Full Text (excerpt): ${contentSamples.fullText.substring(0, 2000)}

FILE SAMPLES:
${fileSamples.slice(0, 5).map(f => `${f.title}:\n${f.content.substring(0, 500)}`).join('\n\n') || 'No file samples available'}

INTAKE DATA:
${JSON.stringify({
  legalName: context.intakeData?.legalName || "",
  website: context.intakeData?.website || "",
  offers: context.intakeData?.offers || "",
  outcomePromise: context.intakeData?.outcomePromise || "",
  formalCasual: context.intakeData?.formalCasual || 50,
  playfulSerious: context.intakeData?.playfulSerious || 50,
  directStoryDriven: context.intakeData?.directStoryDriven || 50,
  punchyDetailed: context.intakeData?.punchyDetailed || 50,
  inspirationalAnalytical: context.intakeData?.inspirationalAnalytical || 50,
  soundsLike: context.intakeData?.soundsLike || "",
  forbiddenWords: context.intakeData?.forbiddenWords || "",
  icps: context.intakeData?.icps || [],
}, null, 2)}

Generate the brand voice card JSON now.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 16000, // Large token budget for comprehensive guide
    });

    const rawResponse = result.choices[0].message.content || "{}";
    let parsed: any = {};
    
    try {
      parsed = JSON.parse(rawResponse);
      // Log the full response structure for debugging
      console.log("Brand Voice LLM Response Structure:", {
        hasMetadata: !!parsed.metadata,
        hasRules: !!parsed.metadata?.rules,
        rulesCount: parsed.metadata?.rules?.length || 0,
        metadataKeys: parsed.metadata ? Object.keys(parsed.metadata) : [],
        topLevelKeys: Object.keys(parsed),
      });
    } catch (parseError) {
      console.error("Error parsing brand voice card response:", parseError);
      console.error("Raw response (first 1000 chars):", rawResponse.substring(0, 1000));
    }

    // Log what we received for debugging
    if (!parsed.metadata || !parsed.metadata.rules || parsed.metadata.rules.length === 0) {
      console.warn("Brand Voice card: No rules found in LLM response");
      console.log("Parsed response keys:", Object.keys(parsed));
      if (parsed.metadata) {
        console.log("Metadata keys:", Object.keys(parsed.metadata));
      }
    }

    // Calculate overall confidence from insights
    const confidenceScores = voiceInsights.map(i => i.confidence);
    const avgConfidence = confidenceScores.length > 0
      ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
      : 50;

    // If no rules were generated, create at least basic rules from intake data
    let rules = parsed.metadata?.rules || [];
    if (rules.length === 0 && context.intakeData) {
      console.warn("Brand Voice: No rules from LLM, creating fallback rules from intake data");
      // Create basic rules from intake data as fallback
      if (context.intakeData.soundsLike) {
        rules.push({
          rule: `Sound like: ${context.intakeData.soundsLike}`,
          example: "Based on intake form preference",
          justification: "User-specified brand voice reference",
          source: "Intake form",
          confidence: 7,
        });
      }
      if (context.intakeData.forbiddenWords) {
        const forbiddenWords = typeof context.intakeData.forbiddenWords === 'string' 
          ? context.intakeData.forbiddenWords.split(',').map((w: string) => w.trim()).filter(Boolean)
          : [];
        if (forbiddenWords.length > 0) {
          rules.push({
            rule: `Never use these words: ${forbiddenWords.join(', ')}`,
            example: "Forbidden words from intake form",
            justification: "User-specified compliance requirement",
            source: "Intake form",
            confidence: 8,
          });
        }
      }
    }

    return {
      title: "Brand Voice & Communication Style",
      description: parsed.description || "Comprehensive brand voice guidelines based on your content and preferences.",
      metadata: {
        // Keep the rules array format that frontend expects
        rules: rules,
        // Add detailed analysis sections
        sentence_construction: parsed.metadata?.sentence_construction || {
          avg_length: 0,
          variety_patterns: [],
          rhythm: "",
          punctuation_preferences: [],
        },
        vocabulary: parsed.metadata?.vocabulary || {
          frequent_words: [],
          forbidden_words: [],
          formality_examples: [],
          power_phrases: [],
        },
        rhetorical_patterns: parsed.metadata?.rhetorical_patterns || {
          questions: [],
          metaphors: [],
          lists: [],
          emphasis_techniques: [],
        },
        relationship_dynamics: parsed.metadata?.relationship_dynamics || {
          reader_address: "",
          assumed_knowledge: "",
          power_positioning: "",
        },
        proof_credibility: parsed.metadata?.proof_credibility || {
          fact_to_opinion_ratio: "",
          citation_style: "",
          social_proof_patterns: [],
        },
        confidence_score: parsed.metadata?.confidence_score || avgConfidence,
      },
      confidence_score: avgConfidence,
      source_attribution: parsed.source_attribution || voiceInsights.map(i => i.source_locations.join(", ")),
    };
  } catch (error) {
    console.error("Error generating brand voice card:", error);
    // Fallback to basic card
    return {
      title: "Brand Voice & Communication Style",
      description: "Brand voice guidelines based on your intake form data.",
      metadata: {
        rules: [],
        sentence_construction: {
          avg_length: 0,
          variety_patterns: [],
          rhythm: "",
          punctuation_preferences: [],
        },
        vocabulary: {
          frequent_words: [],
          forbidden_words: [],
          formality_examples: [],
          power_phrases: [],
        },
        rhetorical_patterns: {
          questions: [],
          metaphors: [],
          lists: [],
          emphasis_techniques: [],
        },
        relationship_dynamics: {
          reader_address: "",
          assumed_knowledge: "",
          power_positioning: "",
        },
        proof_credibility: {
          fact_to_opinion_ratio: "",
          citation_style: "",
          social_proof_patterns: [],
        },
        confidence_score: 30,
      },
      confidence_score: 30,
      source_attribution: [],
    };
  }
}

