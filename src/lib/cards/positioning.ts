import OpenAI from "openai";
import { DeepInsight, AnalysisContext } from "../analysis/types";

export interface PositioningCard {
  title: string;
  description: string;
  metadata: {
    framework_details: {
      value_proposition: string;
      target_audience: string;
      market_position: string;
      differentiation: string;
    };
    who: {
      demographics: string;
      psychographics: string;
      journey_stage: string;
      evidence: string[];
    };
    what: {
      deliverables: string[];
      pricing_indicators: string;
      service_model: string;
    };
    why: {
      unique_approach: string;
      methodology: string;
      competitive_advantage: string;
      evidence: string[];
    };
    how: {
      proof_strategy: string;
      risk_reversal: string;
      decision_criteria: string;
    };
    confidence_score: number;
  };
  confidence_score: number;
  source_attribution: string[];
}

/**
 * Generate enhanced Positioning card using deep insights
 */
export async function generatePositioningCard(
  openai: OpenAI,
  insights: DeepInsight[],
  context: AnalysisContext
): Promise<PositioningCard> {
  try {
    // Filter insights relevant to positioning
    const positioningInsights = insights.filter(
      i => i.category === "belief" || 
           i.category === "proof" ||
           i.category === "relationship"
    );

    const systemPrompt = `You are a market positioning strategist. Create a comprehensive positioning framework.

CRITICAL REQUIREMENTS:
1. NO generic statements - everything must be evidenced with exact quotes
2. Extract SPECIFIC details:
   - WHO: exact demographics, psychographics, journey stage (with evidence)
   - WHAT: specific deliverables, pricing indicators, service model
   - WHY: unique approach/methodology, what competitors CAN'T/WON'T do
   - HOW: proof strategy, risk reversal, decision criteria

3. For each claim, provide:
   - Specific statement (not "targets small businesses" but "targets tech startups with 5-20 employees, Series A funding, struggling with customer support scaling")
   - Evidence (exact quotes from content)
   - Confidence level

4. Framework details must be specific and actionable.

5. CRITICAL: Even if insights are limited, you MUST generate content from the intake data provided. Do not return empty strings or empty arrays.

Return JSON with this EXACT structure:
{
  "description": "Brief description",
  "metadata": {
    "framework_details": {
      "value_proposition": "Specific value prop",
      "target_audience": "Specific audience",
      "market_position": "Market position",
      "differentiation": "How they differentiate"
    },
    "who": {
      "demographics": "Specific demographics",
      "psychographics": "Psychographics",
      "journey_stage": "Journey stage",
      "evidence": ["quote1", "quote2"]
    },
    "what": {
      "deliverables": ["deliverable1", "deliverable2"],
      "pricing_indicators": "Pricing info",
      "service_model": "Service model"
    },
    "why": {
      "unique_approach": "Unique approach",
      "methodology": "Methodology",
      "competitive_advantage": "Competitive advantage",
      "evidence": ["quote1", "quote2"]
    },
    "how": {
      "proof_strategy": "Proof strategy",
      "risk_reversal": "Risk reversal",
      "decision_criteria": "Decision criteria"
    },
    "confidence_score": 75
  },
  "source_attribution": ["source1"]
}

IMPORTANT: Populate ALL fields with actual data. Use intake data ICPs, offers, and competitors if content is limited.`;

    const contentSamples = {
      website: context.websiteContent.fullText.substring(0, 10000),
      hero: context.websiteContent.hero.substring(0, 5000),
      services: context.websiteContent.services.substring(0, 5000),
      testimonials: context.websiteContent.testimonials,
    };

    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyze this positioning data and generate comprehensive framework.

INSIGHTS (${positioningInsights.length} total):
${JSON.stringify(positioningInsights.slice(0, 30), null, 2)}

CONTENT SAMPLES:
Website: ${contentSamples.website.substring(0, 2000)}
Hero: ${contentSamples.hero.substring(0, 500)}
Services: ${contentSamples.services.substring(0, 500)}
Testimonials: ${contentSamples.testimonials.join('\n\n')}

INTAKE DATA:
${JSON.stringify({
  offers: context.intakeData?.offers || "",
  outcomePromise: context.intakeData?.outcomePromise || "",
  icps: context.intakeData?.icps || [],
  topCompetitor: context.intakeData?.topCompetitor || "",
  competitors: context.intakeData?.competitors || "",
  pricing: context.intakeData?.pricing || "",
}, null, 2)}

Generate the positioning card JSON now.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 4000,
    });

    const rawResponse = result.choices[0].message.content || "{}";
    let parsed: any = {};
    
    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error("Error parsing positioning card response:", parseError);
      console.error("Raw response (first 500 chars):", rawResponse.substring(0, 500));
    }
    
    console.log("[Positioning] LLM Response Structure:", {
      hasMetadata: !!parsed.metadata,
      hasFrameworkDetails: !!parsed.metadata?.framework_details,
      hasWho: !!parsed.metadata?.who,
      metadataKeys: parsed.metadata ? Object.keys(parsed.metadata) : [],
    });
    
    if (!parsed.metadata || !parsed.metadata.framework_details) {
      console.warn("Positioning card: Missing framework_details in response");
      // Generate fallback from intake data
      if (context.intakeData?.icps && context.intakeData.icps.length > 0) {
        const firstIcp = context.intakeData.icps[0];
        parsed.metadata = parsed.metadata || {};
        parsed.metadata.framework_details = {
          value_proposition: context.intakeData.outcomePromise || "",
          target_audience: firstIcp.segment || "",
          market_position: context.intakeData.topCompetitor ? `Competing with ${context.intakeData.topCompetitor}` : "",
          differentiation: context.intakeData.competitors || "",
        };
        parsed.metadata.who = {
          demographics: firstIcp.segment || "",
          psychographics: "",
          journey_stage: "",
          evidence: [],
        };
        parsed.metadata.what = {
          deliverables: context.intakeData.offers ? context.intakeData.offers.split('\n').filter(Boolean) : [],
          pricing_indicators: context.intakeData.pricing || "",
          service_model: "",
        };
        parsed.metadata.why = {
          unique_approach: "",
          methodology: "",
          competitive_advantage: context.intakeData.competitors || "",
          evidence: [],
        };
        parsed.metadata.how = {
          proof_strategy: "",
          risk_reversal: "",
          decision_criteria: "",
        };
        console.log("[Positioning] Generated fallback from intake data");
      }
    }

    // Calculate confidence
    const confidenceScores = positioningInsights.map(i => i.confidence);
    const avgConfidence = confidenceScores.length > 0
      ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
      : 50;

    return {
      title: "Market Position & Competitive Strategy",
      description: parsed.description || "Market positioning based on your business information.",
      metadata: {
        framework_details: parsed.metadata?.framework_details || {
          value_proposition: "",
          target_audience: "",
          market_position: "",
          differentiation: "",
        },
        who: parsed.metadata?.who || {
          demographics: "",
          psychographics: "",
          journey_stage: "",
          evidence: [],
        },
        what: parsed.metadata?.what || {
          deliverables: [],
          pricing_indicators: "",
          service_model: "",
        },
        why: parsed.metadata?.why || {
          unique_approach: "",
          methodology: "",
          competitive_advantage: "",
          evidence: [],
        },
        how: parsed.metadata?.how || {
          proof_strategy: "",
          risk_reversal: "",
          decision_criteria: "",
        },
        confidence_score: parsed.metadata?.confidence_score || avgConfidence,
      },
      confidence_score: avgConfidence,
      source_attribution: parsed.source_attribution || positioningInsights.map(i => i.source_locations.join(", ")),
    };
  } catch (error) {
    console.error("Error generating positioning card:", error);
    return {
      title: "Market Position & Competitive Strategy",
      description: "Market positioning based on your intake form data.",
      metadata: {
        framework_details: {
          value_proposition: "",
          target_audience: "",
          market_position: "",
          differentiation: "",
        },
        who: {
          demographics: "",
          psychographics: "",
          journey_stage: "",
          evidence: [],
        },
        what: {
          deliverables: [],
          pricing_indicators: "",
          service_model: "",
        },
        why: {
          unique_approach: "",
          methodology: "",
          competitive_advantage: "",
          evidence: [],
        },
        how: {
          proof_strategy: "",
          risk_reversal: "",
          decision_criteria: "",
        },
        confidence_score: 30,
      },
      confidence_score: 30,
      source_attribution: [],
    };
  }
}

