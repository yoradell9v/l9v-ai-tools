import OpenAI from "openai";
import { DeepInsight, AnalysisContext } from "../analysis/types";

export interface ComplianceCard {
  title: string;
  description: string;
  metadata: {
    required_disclaimers: string[];
    forbidden_claims: string[];
    legal_terms: Record<string, string>;
    risk_areas: string[];
    confidence_score: number;
  };
  confidence_score: number;
  source_attribution: string[];
}

/**
 * Generate enhanced Compliance card using deep insights
 */
export async function generateComplianceCard(
  openai: OpenAI,
  insights: DeepInsight[],
  context: AnalysisContext
): Promise<ComplianceCard> {
  try {
    // Filter compliance insights
    const complianceInsights = insights.filter(i => i.category === "compliance");

    const systemPrompt = `You are a compliance and legal content analyst. Create specific compliance rules.

REQUIREMENTS:
1. Analyze:
   - Required disclaimers and when to use them
   - Forbidden claims or language (especially for regulated industries)
   - Legal terminology that must be used correctly
   - Risk mitigation strategies in content
   - Industry-specific compliance requirements

2. Extract EXACT disclaimers from content (don't paraphrase)

3. Identify forbidden claims with evidence

4. Map legal terms to their definitions

5. List risk areas with specific examples

6. CRITICAL: Use intake data disclaimers and forbiddenWords. Do not return empty arrays.

Return JSON with this EXACT structure:
{
  "description": "Compliance guide description",
  "metadata": {
    "required_disclaimers": ["disclaimer1", "disclaimer2"],
    "forbidden_claims": ["claim1", "claim2"],
    "legal_terms": {
      "term1": "definition1",
      "term2": "definition2"
    },
    "risk_areas": ["risk1", "risk2"],
    "confidence_score": 70
  },
  "source_attribution": ["source1"]
}

IMPORTANT: Populate ALL fields. Use intake data disclaimers and forbiddenWords if content is limited.`;

    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyze this compliance data and generate compliance rules.

INSIGHTS (${complianceInsights.length} total):
${JSON.stringify(complianceInsights.slice(0, 20), null, 2)}

WEBSITE CONTENT:
${context.websiteContent.fullText.substring(0, 2000)}

INTAKE DATA:
${JSON.stringify({
  isRegulated: context.intakeData?.isRegulated,
  regulatedIndustryType: context.intakeData?.regulatedIndustryType,
  disclaimers: context.intakeData?.disclaimers || "",
  forbiddenWords: context.intakeData?.forbiddenWords || "",
}, null, 2)}

Generate the compliance card JSON now.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 3000,
    });

    const rawResponse = result.choices[0].message.content || "{}";
    let parsed: any = {};
    
    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error("Error parsing compliance card response:", parseError);
      console.error("Raw response (first 500 chars):", rawResponse.substring(0, 500));
    }
    
    console.log("[Compliance] LLM Response Structure:", {
      hasMetadata: !!parsed.metadata,
      hasDisclaimers: !!parsed.metadata?.required_disclaimers,
      disclaimersCount: parsed.metadata?.required_disclaimers?.length || 0,
      hasForbiddenClaims: !!parsed.metadata?.forbidden_claims,
      metadataKeys: parsed.metadata ? Object.keys(parsed.metadata) : [],
    });
    
    if (!parsed.metadata || parsed.metadata.required_disclaimers?.length === 0) {
      console.warn("Compliance card: No disclaimers found in response, generating fallback");
      // Generate fallback from intake data
      parsed.metadata = parsed.metadata || {};
      const disclaimers = context.intakeData?.disclaimers 
        ? context.intakeData.disclaimers.split('\n').filter(Boolean)
        : [];
      const forbiddenWords = context.intakeData?.forbiddenWords
        ? context.intakeData.forbiddenWords.split(',').map(w => w.trim()).filter(Boolean)
        : [];
      parsed.metadata.required_disclaimers = disclaimers.length > 0 ? disclaimers : ["Results may vary. Individual results not guaranteed."];
      parsed.metadata.forbidden_claims = forbiddenWords;
      parsed.metadata.legal_terms = {};
      parsed.metadata.risk_areas = [];
      console.log("[Compliance] Generated fallback from intake data");
    }

    const confidenceScores = complianceInsights.map(i => i.confidence);
    const avgConfidence = confidenceScores.length > 0
      ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
      : 30;

    return {
      title: "Compliance & Legal Guidelines",
      description: parsed.description || "Compliance guidelines.",
      metadata: {
        required_disclaimers: parsed.metadata?.required_disclaimers || [],
        forbidden_claims: parsed.metadata?.forbidden_claims || [],
        legal_terms: parsed.metadata?.legal_terms || {},
        risk_areas: parsed.metadata?.risk_areas || [],
        confidence_score: parsed.metadata?.confidence_score || avgConfidence,
      },
      confidence_score: avgConfidence,
      source_attribution: parsed.source_attribution || complianceInsights.map(i => i.source_locations.join(", ")),
    };
  } catch (error) {
    console.error("Error generating compliance card:", error);
    return {
      title: "Compliance & Legal Guidelines",
      description: "Compliance guidelines.",
      metadata: {
        required_disclaimers: [],
        forbidden_claims: [],
        legal_terms: {},
        risk_areas: [],
        confidence_score: 30,
      },
      confidence_score: 30,
      source_attribution: [],
    };
  }
}

