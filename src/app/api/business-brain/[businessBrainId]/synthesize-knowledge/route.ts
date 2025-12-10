import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * ENHANCED KNOWLEDGE BASE SYNTHESIS
 * 
 * This route creates a comprehensive, deeply analytical knowledge base by:
 * 1. Extracting deeper insights from intakeData and cards
 * 2. Performing cross-analysis to detect relationships, contradictions, and opportunities
 * 3. Generating computed insights and strategic patterns
 * 4. Creating reusable knowledge objects (definitions, rules, examples)
 * 5. Enforcing strict anti-hallucination constraints
 * 6. Validating output against required schema
 * 
 * The knowledge base is structured for AI assistants, content generation, and decision-making.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface KnowledgeBaseSchema {
  businessOverview: {
    name: string;
    publicName?: string;
    website: string;
    offers: string[];
    outcomePromise: string;
    pricing: string;
    geography: string;
    primaryCTA: string;
    customCTA?: string;
  };
  brandVoice: {
    sliders: {
      formalCasual: number;
      playfulSerious: number;
      directStoryDriven: number;
      punchyDetailed: number;
      inspirationalAnalytical: number;
    };
    soundsLike: string;
    rules: Array<{
      rule: string;
      example?: string;
      justification: string;
      source: string;
      confidence: number;
    }>;
    vocabulary: {
      frequent_words: string[];
      forbidden_words: string[];
      power_phrases: string[];
      formality_examples: string[];
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
  };
  positioning: {
    value_proposition: string;
    target_audience: Array<{
      segment: string;
      pain: string;
      outcome: string;
      psychological_triggers: string[];
      content_angles: string[];
    }>;
    market_position: string;
    differentiation: string;
    competitive_advantage: string[];
    objections: Array<{
      objection: string;
      response_strategy: string;
      proof_points: string[];
    }>;
  };
  marketingStrategy: {
    primary_channels: string[];
    messaging_hierarchy: string[];
    proof_strategy: string[];
    risk_reversal: string[];
    decision_criteria: string[];
  };
  contentFramework: {
    style_rules: Array<{
      rule: string;
      example?: string;
      source: string;
    }>;
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
    };
    forbidden: string[];
    preferred: string[];
    examples: Array<{
      type: "good" | "bad";
      text: string;
      reason: string;
    }>;
  };
  compliance: {
    required_disclaimers: Array<{
      disclaimer: string;
      when_to_use: string;
      source: string;
    }>;
    forbidden_claims: string[];
    legal_terms: Record<string, string>;
    risk_areas: Array<{
      area: string;
      mitigation: string;
      source: string;
    }>;
    regulated_industry?: {
      type: string;
      specific_requirements: string[];
    };
  };
  operations: {
    crm: {
      platform: string;
      subaccount?: string;
      pipelines: Array<{
        name: string;
        stages: string[];
        description: string;
      }>;
    };
    workflows: Array<{
      name: string;
      description: string;
      stages: string[];
      automation_opportunities: string[];
    }>;
    templates: Array<{
      name: string;
      subject?: string;
      body: string;
      use_case: string;
    }>;
    communication: {
      support_email: string;
      email_signoff: string;
      meeting_link?: string;
      brand_emails: string[];
    };
  };
  opportunities: Array<{
    opportunity: string;
    rationale: string;
    source: string;
    priority: "high" | "medium" | "low";
  }>;
  risks: Array<{
    risk: string;
    severity: "high" | "medium" | "low";
    mitigation: string;
    source: string;
  }>;
  contradictions: Array<{
    contradiction: string;
    sources: string[];
    resolution?: string;
  }>;
  knowledgeObjects: {
    definitions: Array<{
      term: string;
      definition: string;
      context: string;
    }>;
    rules: Array<{
      rule: string;
      category: string;
      priority: number;
      source: string;
    }>;
    doNotSay: Array<{
      phrase: string;
      reason: string;
      alternative?: string;
    }>;
    mustSay: Array<{
      phrase: string;
      context: string;
      reason: string;
    }>;
    contentExamples: Array<{
      type: string;
      example: string;
      why_effective: string;
      source: string;
    }>;
    personaSnapshots: Array<{
      persona: string;
      characteristics: string[];
      content_preferences: string[];
      pain_points: string[];
    }>;
  };
  metadata: {
    synthesizedAt: string;
    modelVersion: string;
    promptVersion: string;
    cardCount: number;
    intakeFieldCount: number;
    crossLinks: number;
    contradictionsFound: number;
    confidence_score: number;
    fallback: boolean;
  };
}

// ============================================================================
// NORMALIZATION & EXTRACTION HELPERS
// ============================================================================

function normalizeIntakeData(intakeData: any): any {
  if (!intakeData || typeof intakeData !== "object") {
    return {};
  }

  // Map strictly to fields defined in businessBrainFormConfig
  return {
    businessName: String(intakeData.businessName || "").trim(),
    website: String(intakeData.website || "").trim(),
    whatYouSell: String(intakeData.whatYouSell || "").trim(),
    businessType: String(intakeData.businessType || "").trim(),
    businessTypeOther: String(intakeData.businessTypeOther || "").trim(),
    monthlyRevenue: String(intakeData.monthlyRevenue || "").trim(),
    goal90Day: String(intakeData.goal90Day || "").trim(),
    biggestBottleneck: String(intakeData.biggestBottleneck || "").trim(),
    idealCustomer: String(intakeData.idealCustomer || "").trim(),
    topObjection: String(intakeData.topObjection || "").trim(),
    coreOffer: String(intakeData.coreOffer || "").trim(),
    customerJourney: String(intakeData.customerJourney || "").trim(),
    brandVoiceStyle: String(intakeData.brandVoiceStyle || "").trim(),
    riskBoldnessLevel: String(intakeData.riskBoldnessLevel || "").trim(),
    primaryCRM: String(intakeData.primaryCRM || "").trim(),
    bookingLink: String(intakeData.bookingLink || "").trim(),
    supportEmail: String(intakeData.supportEmail || "").trim(),
    isRegulated: String(intakeData.isRegulated || "").trim(),
    regulatedIndustryType: String(intakeData.regulatedIndustryType || "").trim(),
    forbiddenWords: String(intakeData.forbiddenWords || "").trim(),
    disclaimers: String(intakeData.disclaimers || "").trim(),
    hasProofAssets: String(intakeData.hasProofAssets || "").trim(),
    proofAssets: String(intakeData.proofAssets || "").trim(),
    pipelineStages: String(intakeData.pipelineStages || "").trim(),
    emailSignoff: String(intakeData.emailSignoff || "").trim(),
    brandEmails: String(intakeData.brandEmails || "").trim(),
    voiceExamplesGood: String(intakeData.voiceExamplesGood || "").trim(),
    voiceExamplesAvoid: String(intakeData.voiceExamplesAvoid || "").trim(),
    contentLinks: String(intakeData.contentLinks || "").trim(),
  };
}

function extractCardInsights(cards: any[]): {
  brandVoice: any;
  positioning: any;
  styleRules: any;
  compliance: any;
  ghl: any;
} {
  const insights = {
    brandVoice: null as any,
    positioning: null as any,
    styleRules: null as any,
    compliance: null as any,
    ghl: null as any,
  };

  for (const card of cards) {
    switch (card.type) {
      case "BRAND_VOICE_CARD":
        insights.brandVoice = {
          title: card.title,
          description: card.description,
          metadata: card.metadata || {},
          confidence: card.metadata?.confidence_score || 0,
        };
        break;
      case "POSITIONING_CARD":
        insights.positioning = {
          title: card.title,
          description: card.description,
          metadata: card.metadata || {},
          confidence: card.metadata?.confidence_score || 0,
        };
        break;
      case "STYLE_RULES":
        insights.styleRules = {
          title: card.title,
          description: card.description,
          metadata: card.metadata || {},
          confidence: card.metadata?.confidence_score || 0,
        };
        break;
      case "COMPLIANCE_RULES":
        insights.compliance = {
          title: card.title,
          description: card.description,
          metadata: card.metadata || {},
          confidence: card.metadata?.confidence_score || 0,
        };
        break;
      case "GHL_IMPLEMENTATION_NOTES":
        insights.ghl = {
          title: card.title,
          description: card.description,
          metadata: card.metadata || {},
          confidence: card.metadata?.confidence_score || 0,
        };
        break;
    }
  }

  return insights;
}

function detectCrossReferences(normalizedIntake: any, cardInsights: any): {
  crossLinks: Array<{ from: string; to: string; relationship: string }>;
  contradictions: Array<{ contradiction: string; sources: string[] }>;
} {
  const crossLinks: Array<{ from: string; to: string; relationship: string }> = [];
  const contradictions: Array<{ contradiction: string; sources: string[] }> = [];

  // Link objections → positioning strategy
  if (normalizedIntake.topObjection && cardInsights.positioning?.metadata?.framework_details) {
    crossLinks.push({
      from: "topObjection",
      to: "positioning",
      relationship: "Objections inform positioning strategy and differentiation messaging",
    });
  }

  // Link ICPs → content guidelines
  if (normalizedIntake.idealCustomer && cardInsights.brandVoice?.metadata?.rules) {
    crossLinks.push({
      from: "idealCustomer",
      to: "brandVoice",
      relationship: "Target audience characteristics inform brand voice and communication style",
    });
  }

  // Link pricing → value justification
  if (normalizedIntake.coreOffer && cardInsights.positioning?.metadata?.framework_details?.value_proposition) {
    crossLinks.push({
      from: "coreOffer",
      to: "positioning",
      relationship: "Pricing model must align with value proposition messaging",
    });
  }

  // Link disclaimers → compliance rules
  if (normalizedIntake.disclaimers && cardInsights.compliance?.metadata?.required_disclaimers) {
    crossLinks.push({
      from: "disclaimers",
      to: "compliance_card",
      relationship: "Intake disclaimers must match compliance card requirements",
    });
  }

  // Detect contradictions
  // Example: If brand voice says "casual" but soundsLike says "Apple Support" (formal)
  if (
    typeof normalizedIntake.brandVoiceStyle === "string" &&
    normalizedIntake.brandVoiceStyle.toLowerCase().includes("casual") &&
    (normalizedIntake.voiceExamplesGood || "").toLowerCase().includes("apple support")
  ) {
    contradictions.push({
      contradiction: "Brand voice indicates casual, but examples reference Apple Support which is typically more formal",
      sources: ["intakeData.brandVoiceStyle", "intakeData.voiceExamplesGood"],
    });
  }

  // Check if forbidden words in intake match compliance card
  const intakeForbidden = normalizedIntake.forbiddenWords
    .split(",")
    .map((w: string) => w.trim().toLowerCase())
    .filter(Boolean);
  const cardForbidden = Array.isArray(cardInsights.compliance?.metadata?.forbidden_claims)
    ? cardInsights.compliance.metadata.forbidden_claims.map((c: string) => c.toLowerCase())
    : [];

  if (intakeForbidden.length > 0 && cardForbidden.length > 0) {
    const missing = intakeForbidden.filter((w: string) => !cardForbidden.some((c: string) => c.includes(w)));
    if (missing.length > 0) {
      contradictions.push({
        contradiction: `Some forbidden words from intake (${missing.join(", ")}) are not reflected in compliance card`,
        sources: ["intakeData.forbiddenWords", "complianceCard.metadata.forbidden_claims"],
      });
    }
  }

  return { crossLinks, contradictions };
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

function buildKnowledgePrompt(
  normalizedIntake: any,
  cardInsights: any,
  crossAnalysis: { crossLinks: any[]; contradictions: any[] }
): string {
  return `You are an expert knowledge synthesis architect. Your task is to create a DEEP, ANALYTICAL, and ACTIONABLE knowledge base from business intake data and generated intelligence cards. Return a valid JSON object only (the word "json" is explicitly included here).

CRITICAL REQUIREMENTS:

1. EXTRACT DEEPER INSIGHTS
   - Don't just summarize—analyze patterns, principles, and implicit strategies
   - Identify gaps, contradictions, and opportunities
   - Infer psychological triggers, leverage points, and content angles
   - Detect unstated risks and compliance pitfalls
   - Extract key principles behind choices (not just surface rules)

2. PERFORM CROSS-ANALYSIS
   - Link objections → positioning strategy
   - Link ICPs → content guidelines and brand voice
   - Link pricing → value justification messaging
   - Link disclaimers → legally safe content rules
   - Connect brand voice sliders → actual communication patterns
   - Map proof assets → marketing strategy

3. GENERATE COMPUTED INSIGHTS
   - Patterns the business seems to follow (inferred from data)
   - Audience psychological triggers (from ICPs and objections)
   - Strategic leverage points (from positioning and differentiation)
   - Content angles that fit the brand (from voice + positioning)
   - Operational bottlenecks (inferred from CRM/pipeline data)

4. CREATE KNOWLEDGE OBJECTS
   - definitions: Key terms with context-specific definitions
   - rules: Prioritized, categorized rules with sources
   - doNotSay: Forbidden phrases with reasons and alternatives
   - mustSay: Required phrases with context and reasons
   - contentExamples: Good/bad examples with analysis
   - personaSnapshots: Detailed persona characteristics

5. STRICT ANTI-HALLUCINATION RULES
   - If data is missing, use "Unknown" or "Not provided"
   - Never invent factual data (pricing, ICP details, competitors, etc.)
   - Only infer from explicit patterns in the provided data
   - For computed insights, clearly state they are "inferred from" or "pattern suggests"
   - If contradicting data exists, note it in contradictions array

6. REQUIRED SCHEMA STRUCTURE
   You MUST return JSON matching this exact structure:
   {
     "businessOverview": {
       "name": "string",
       "publicName": "string or null",
       "website": "string",
       "offers": ["array of strings"],
       "outcomePromise": "string",
       "pricing": "string",
       "geography": "string",
       "primaryCTA": "string",
       "customCTA": "string or null"
     },
     "brandVoice": {
       "sliders": { "formalCasual": number, "playfulSerious": number, ... },
       "soundsLike": "string",
       "rules": [{"rule": "string", "example": "string", "justification": "string", "source": "string", "confidence": number}],
       "vocabulary": {"frequent_words": [], "forbidden_words": [], "power_phrases": [], "formality_examples": []},
       "rhetorical_patterns": {"questions": [], "metaphors": [], "lists": [], "emphasis_techniques": []},
       "relationship_dynamics": {"reader_address": "string", "assumed_knowledge": "string", "power_positioning": "string"}
     },
     "positioning": {
       "value_proposition": "string",
       "target_audience": [{"segment": "string", "pain": "string", "outcome": "string", "psychological_triggers": [], "content_angles": []}],
       "market_position": "string",
       "differentiation": "string",
       "competitive_advantage": [],
       "objections": [{"objection": "string", "response_strategy": "string", "proof_points": []}]
     },
     "marketingStrategy": {
       "primary_channels": [],
       "messaging_hierarchy": [],
       "proof_strategy": [],
       "risk_reversal": [],
       "decision_criteria": []
     },
     "contentFramework": {
       "style_rules": [{"rule": "string", "example": "string", "source": "string"}],
       "formatting": {...},
       "forbidden": [],
       "preferred": [],
       "examples": [{"type": "good|bad", "text": "string", "reason": "string"}]
     },
     "compliance": {
       "required_disclaimers": [{"disclaimer": "string", "when_to_use": "string", "source": "string"}],
       "forbidden_claims": [],
       "legal_terms": {},
       "risk_areas": [{"area": "string", "mitigation": "string", "source": "string"}],
       "regulated_industry": {"type": "string", "specific_requirements": []} or null
     },
     "operations": {
       "crm": {"platform": "string", "subaccount": "string or null", "pipelines": [], "workflows": []},
       "templates": [{"name": "string", "subject": "string", "body": "string", "use_case": "string"}],
       "communication": {...}
     },
     "opportunities": [{"opportunity": "string", "rationale": "string", "source": "string", "priority": "high|medium|low"}],
     "risks": [{"risk": "string", "severity": "high|medium|low", "mitigation": "string", "source": "string"}],
     "contradictions": [{"contradiction": "string", "sources": [], "resolution": "string or null"}],
     "knowledgeObjects": {
       "definitions": [{"term": "string", "definition": "string", "context": "string"}],
       "rules": [{"rule": "string", "category": "string", "priority": number, "source": "string"}],
       "doNotSay": [{"phrase": "string", "reason": "string", "alternative": "string or null"}],
       "mustSay": [{"phrase": "string", "context": "string", "reason": "string"}],
       "contentExamples": [{"type": "string", "example": "string", "why_effective": "string", "source": "string"}],
       "personaSnapshots": [{"persona": "string", "characteristics": [], "content_preferences": [], "pain_points": []}]
     },
     "metadata": {
       "synthesizedAt": "ISO timestamp",
       "modelVersion": "gpt-4o",
       "promptVersion": "kb-v2",
       "cardCount": number,
       "intakeFieldCount": number,
       "crossLinks": number,
       "contradictionsFound": number,
       "confidence_score": number,
       "fallback": false
     }
   }

IMPORTANT: Populate ALL fields. Use "Unknown" or "Not provided" for missing data. Only infer from explicit patterns.`;
}

function buildUserMessage(
  normalizedIntake: any,
  cardInsights: any,
  crossAnalysis: { crossLinks: any[]; contradictions: any[] }
): string {
  return `Synthesize a comprehensive, deeply analytical knowledge base from this business data. Respond with a JSON object only (json required):

=== INTAKE DATA ===
${JSON.stringify(normalizedIntake, null, 2)}

=== GENERATED CARDS ===
Brand Voice Card:
${JSON.stringify(cardInsights.brandVoice, null, 2)}

Positioning Card:
${JSON.stringify(cardInsights.positioning, null, 2)}

Style Rules Card:
${JSON.stringify(cardInsights.styleRules, null, 2)}

Compliance Card:
${JSON.stringify(cardInsights.compliance, null, 2)}

GHL Card:
${JSON.stringify(cardInsights.ghl, null, 2)}

=== CROSS-ANALYSIS ===
Cross-Links Detected: ${crossAnalysis.crossLinks.length}
${JSON.stringify(crossAnalysis.crossLinks, null, 2)}

Contradictions Detected: ${crossAnalysis.contradictions.length}
${JSON.stringify(crossAnalysis.contradictions, null, 2)}

=== YOUR TASK ===
1. Extract DEEPER insights than what's explicitly stated
2. Perform cross-analysis to link related concepts
3. Generate computed insights (patterns, triggers, leverage points)
4. Create reusable knowledge objects
5. Identify opportunities and risks
6. Note any contradictions with potential resolutions
7. Return the complete knowledge base JSON matching the required schema

Remember: Use "Unknown" or "Not provided" for missing data. Only infer from explicit patterns. Never invent factual data.`;
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateKnowledgeBaseSchema(kb: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const required = [
    "businessOverview",
    "brandVoice",
    "positioning",
    "marketingStrategy",
    "contentFramework",
    "compliance",
    "operations",
    "opportunities",
    "risks",
    "contradictions",
    "knowledgeObjects",
    "metadata",
  ];

  for (const field of required) {
    if (!kb[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate nested structures
  if (kb.businessOverview && !kb.businessOverview.name) {
    errors.push("businessOverview.name is required");
  }
  if (kb.brandVoice && !kb.brandVoice.sliders) {
    errors.push("brandVoice.sliders is required");
  }
  if (kb.positioning && !kb.positioning.value_proposition) {
    errors.push("positioning.value_proposition is required");
  }
  if (kb.knowledgeObjects && !Array.isArray(kb.knowledgeObjects.rules)) {
    errors.push("knowledgeObjects.rules must be an array");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function buildFallbackKnowledgeBase(
  normalizedIntake: any,
  cardInsights: any,
  cardCount: number
): KnowledgeBaseSchema {
  const offers = normalizedIntake.coreOffer
    ? [normalizedIntake.coreOffer]
    : normalizedIntake.whatYouSell
    ? [normalizedIntake.whatYouSell]
    : [];

  const objections = normalizedIntake.topObjection
    ? [normalizedIntake.topObjection]
    : [];

  const forbiddenWords = normalizedIntake.forbiddenWords
    ? normalizedIntake.forbiddenWords
        .split(",")
        .map((w: string) => w.trim())
        .filter(Boolean)
    : [];

  const disclaimers = normalizedIntake.disclaimers
    ? normalizedIntake.disclaimers
        .split("\n")
        .filter(Boolean)
        .map((d: string) => d.trim())
    : [];

  const pipelineStages = normalizedIntake.pipelineStages
    ? normalizedIntake.pipelineStages
        .split(/→|->|\n|,/)
        .map((s: string) => s.trim())
        .filter(Boolean)
    : [];

  return {
    businessOverview: {
      name: normalizedIntake.businessName || "Unknown",
      publicName: normalizedIntake.businessName || "Unknown",
      website: normalizedIntake.website || "Unknown",
      offers: offers.length > 0 ? offers : ["Not provided"],
      outcomePromise: normalizedIntake.goal90Day || "Not provided",
      pricing: "Not provided",
      geography: "Not provided",
      primaryCTA: normalizedIntake.bookingLink || "Not provided",
      customCTA: undefined,
    },
    brandVoice: {
      sliders: {
        formalCasual: normalizedIntake.brandVoiceStyle ? 50 : 50,
        playfulSerious: 50,
        directStoryDriven: 50,
        punchyDetailed: 50,
        inspirationalAnalytical: 50,
      },
      soundsLike: normalizedIntake.brandVoiceStyle || "Not provided",
      rules: cardInsights.brandVoice?.metadata?.rules || [],
      vocabulary: cardInsights.brandVoice?.metadata?.vocabulary || {
        frequent_words: [],
        forbidden_words: forbiddenWords,
        power_phrases: [],
        formality_examples: [],
      },
      rhetorical_patterns: cardInsights.brandVoice?.metadata?.rhetorical_patterns || {
        questions: [],
        metaphors: [],
        lists: [],
        emphasis_techniques: [],
      },
      relationship_dynamics: cardInsights.brandVoice?.metadata?.relationship_dynamics || {
        reader_address: "Not provided",
        assumed_knowledge: "Not provided",
        power_positioning: "Not provided",
      },
    },
    positioning: {
      value_proposition:
        cardInsights.positioning?.metadata?.framework_details?.value_proposition ||
        normalizedIntake.whatYouSell ||
        "Not provided",
      target_audience: normalizedIntake.idealCustomer
        ? [
            {
              segment: normalizedIntake.idealCustomer,
              pain: normalizedIntake.biggestBottleneck || "Not provided",
              outcome: normalizedIntake.goal90Day || "Not provided",
              psychological_triggers: [],
              content_angles: [],
            },
          ]
        : [],
      market_position: cardInsights.positioning?.metadata?.framework_details?.market_position || "Not provided",
      differentiation: cardInsights.positioning?.metadata?.framework_details?.differentiation || "Not provided",
      competitive_advantage: [],
      objections:
        objections.length > 0
          ? objections.map((obj: string) => ({
              objection: obj,
              response_strategy: "Not provided",
              proof_points: [],
            }))
          : [],
    },
    marketingStrategy: {
      primary_channels: [],
      messaging_hierarchy: [],
      proof_strategy: normalizedIntake.hasProofAssets === "yes" ? ["Use provided proof assets"] : [],
      risk_reversal: [],
      decision_criteria: [],
    },
    contentFramework: {
      style_rules: cardInsights.styleRules?.metadata?.rules?.map((r: string) => ({
        rule: r,
        example: undefined,
        source: "Style Rules Card",
      })) || [],
      formatting: cardInsights.styleRules?.metadata?.formatting || {
        paragraph_length: { avg: 50, max: 150, never: 300 },
        punctuation_preferences: [],
        list_structure: { item_count: "3-5 items", start_with_verbs: false, parallel_construction: true },
        emphasis_techniques: [],
        header_hierarchy: [],
      },
      forbidden: forbiddenWords,
      preferred: cardInsights.styleRules?.metadata?.preferred || [],
      examples: [],
    },
    compliance: {
      required_disclaimers: disclaimers.map((d: string) => ({
        disclaimer: d,
        when_to_use: "As required by compliance guidelines",
        source: "Intake Data",
      })),
      forbidden_claims: forbiddenWords,
      legal_terms: cardInsights.compliance?.metadata?.legal_terms || {},
      risk_areas: cardInsights.compliance?.metadata?.risk_areas?.map((r: string) => ({
        area: r,
        mitigation: "Not provided",
        source: "Compliance Card",
      })) || [],
      regulated_industry: normalizedIntake.isRegulated === "yes"
        ? {
            type: normalizedIntake.regulatedIndustryType || "other",
            specific_requirements: [],
          }
        : undefined,
    },
    operations: {
      crm: {
        platform: normalizedIntake.primaryCRM || "Not provided",
        subaccount: undefined,
        pipelines: pipelineStages.length > 0
          ? [
              {
                name: "Main Sales Pipeline",
                stages: pipelineStages,
                description: "Primary sales pipeline",
              },
            ]
          : [],
      },
      workflows: cardInsights.ghl?.metadata?.workflows || [],
      templates: cardInsights.ghl?.metadata?.templates || [],
      communication: {
        support_email: normalizedIntake.supportEmail || "Not provided",
        email_signoff: normalizedIntake.emailSignoff || "Not provided",
        meeting_link: normalizedIntake.bookingLink || undefined,
        brand_emails: normalizedIntake.brandEmails
          ? normalizedIntake.brandEmails.split(",").map((e: string) => e.trim()).filter(Boolean)
          : [],
      },
    },
    opportunities: [],
    risks: [],
    contradictions: [],
    knowledgeObjects: {
      definitions: [],
      rules: [],
      doNotSay: forbiddenWords.map((w: string) => ({
        phrase: w,
        reason: "Explicitly forbidden by intake data",
        alternative: undefined,
      })),
      mustSay: disclaimers.map((d: string) => ({
        phrase: d,
        context: "Legal compliance",
        reason: "Required disclaimer",
      })),
      contentExamples: [],
      personaSnapshots: normalizedIntake.icps.map((icp: any) => ({
        persona: icp.segment || "Unknown",
        characteristics: [],
        content_preferences: [],
        pain_points: [icp.pain].filter(Boolean),
      })),
    },
    metadata: {
      synthesizedAt: new Date().toISOString(),
      modelVersion: "gpt-4o",
      promptVersion: "kb-v2",
      cardCount,
      intakeFieldCount: Object.keys(normalizedIntake).length,
      crossLinks: 0,
      contradictionsFound: 0,
      confidence_score: 50,
      fallback: true,
    },
  };
}

// ============================================================================
// MAIN SYNTHESIS FUNCTION
// ============================================================================

async function synthesizeKnowledgeBase(
  openai: OpenAI,
  intakeData: any,
  cards: any[]
): Promise<KnowledgeBaseSchema> {
  // Step 1: Normalize intake data
  const normalizedIntake = normalizeIntakeData(intakeData);
  console.log("[Synthesize-Knowledge] Normalized intake data fields:", Object.keys(normalizedIntake).length);

  // Step 2: Extract card insights
  const cardInsights = extractCardInsights(cards);
  const cardInsightKeys: (keyof typeof cardInsights)[] = ['brandVoice', 'positioning', 'styleRules', 'compliance', 'ghl'];
  const extractedCount = cardInsightKeys.filter(k => cardInsights[k] !== null).length;
  console.log("[Synthesize-Knowledge] Extracted insights from", extractedCount, "card types");

  // Step 3: Perform cross-analysis
  const crossAnalysis = detectCrossReferences(normalizedIntake, cardInsights);
  console.log("[Synthesize-Knowledge] Cross-analysis:", {
    crossLinks: crossAnalysis.crossLinks.length,
    contradictions: crossAnalysis.contradictions.length,
  });

  // Step 4: Build prompts
  const systemPrompt = buildKnowledgePrompt(normalizedIntake, cardInsights, crossAnalysis);
  const userMessage = buildUserMessage(normalizedIntake, cardInsights, crossAnalysis);

  try {
    console.log("[Synthesize-Knowledge] Calling OpenAI for knowledge synthesis...");
    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2, // Lower temperature for more consistent, grounded output
      max_tokens: 12000, // Large token budget for comprehensive knowledge base
    });

    const rawResponse = result.choices[0].message.content || "{}";
    let synthesized: any = {};

    try {
      synthesized = JSON.parse(rawResponse);
      console.log("[Synthesize-Knowledge] Successfully parsed AI response");
    } catch (parseError) {
      console.error("[Synthesize-Knowledge] Failed to parse AI response:", parseError);
      console.error("[Synthesize-Knowledge] Raw response (first 1000 chars):", rawResponse.substring(0, 1000));
      throw new Error("Failed to parse AI response as JSON");
    }

    // Step 5: Validate schema
    const validation = validateKnowledgeBaseSchema(synthesized);
    if (!validation.valid) {
      console.warn("[Synthesize-Knowledge] Schema validation failed:", validation.errors);
      console.warn("[Synthesize-Knowledge] Using fallback knowledge base");
      synthesized = buildFallbackKnowledgeBase(normalizedIntake, cardInsights, cards.length);
    } else {
      console.log("[Synthesize-Knowledge] Schema validation passed");
    }

    // Step 6: Enrich metadata
    synthesized.metadata = {
      ...synthesized.metadata,
      synthesizedAt: new Date().toISOString(),
      modelVersion: "gpt-4o",
      promptVersion: "kb-v2",
      cardCount: cards.length,
      intakeFieldCount: Object.keys(normalizedIntake).length,
      crossLinks: crossAnalysis.crossLinks.length,
      contradictionsFound: crossAnalysis.contradictions.length,
      confidence_score: synthesized.metadata?.confidence_score || 75,
      fallback: !validation.valid,
    };

    // Step 7: Merge detected contradictions into the knowledge base
    if (crossAnalysis.contradictions.length > 0) {
      synthesized.contradictions = [
        ...(synthesized.contradictions || []),
        ...crossAnalysis.contradictions.map((c) => ({
          contradiction: c.contradiction,
          sources: c.sources,
          resolution: null,
        })),
      ];
    }

    return synthesized as KnowledgeBaseSchema;
  } catch (error) {
    console.error("[Synthesize-Knowledge] Error during synthesis:", error);
    console.log("[Synthesize-Knowledge] Using fallback knowledge base");
    return buildFallbackKnowledgeBase(normalizedIntake, cardInsights, cards.length);
  }
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessBrainId: string }> }
) {
  console.log("[Synthesize-Knowledge] API endpoint called");
  try {
    // Authentication
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      console.error("[Synthesize-Knowledge] Not authenticated");
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      console.error("[Synthesize-Knowledge] Invalid token");
      return NextResponse.json(
        { success: false, error: "Invalid token." },
        { status: 401 }
      );
    }

    // Await params in Next.js App Router
    const { businessBrainId } = await params;

    if (!businessBrainId) {
      return NextResponse.json(
        { success: false, error: "businessBrainId is required." },
        { status: 400 }
      );
    }

    // Verify access to organization
    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: { deactivatedAt: null },
      },
      select: { id: true },
    });

    if (userOrganizations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User does not belong to any active organization.",
        },
        { status: 403 }
      );
    }

    const userOrganizationIds = userOrganizations.map((uo) => uo.id);

    // Fetch business brain with cards
    const businessBrain = await prisma.businessBrain.findFirst({
      where: {
        id: businessBrainId,
        userOrganizationId: { in: userOrganizationIds },
      },
      include: {
        cards: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!businessBrain) {
      return NextResponse.json(
        { success: false, error: "Business brain not found or access denied." },
        { status: 404 }
      );
    }

    // Parse intakeData if it's a string
    let intakeData = businessBrain.intakeData;
    if (typeof intakeData === 'string') {
      try {
        intakeData = JSON.parse(intakeData);
      } catch (e) {
        console.error("[Synthesize-Knowledge] Failed to parse intakeData:", e);
        return NextResponse.json(
          { success: false, error: "Invalid intakeData format." },
          { status: 400 }
        );
      }
    }

    // Check if we have cards
    if (!businessBrain.cards || businessBrain.cards.length === 0) {
      return NextResponse.json(
        { success: false, error: "No cards found. Please generate cards first." },
        { status: 400 }
      );
    }

    // Initialize OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OpenAI API key not configured." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log("[Synthesize-Knowledge] Starting knowledge synthesis...");
    console.log(`[Synthesize-Knowledge] Cards count: ${businessBrain.cards.length}`);

    // Synthesize knowledge base using AI
    const knowledgeBase = await synthesizeKnowledgeBase(
      openai,
      intakeData as any,
      businessBrain.cards
    );

    // Update BusinessBrain with knowledgeBase
    const updatedBusinessBrain = await prisma.businessBrain.update({
      where: { id: businessBrainId },
      data: {
        knowledgeBase: knowledgeBase as any,
      },
    });

    // Invalidate enhancement analysis cache since knowledge base has changed
    try {
      await prisma.enhancementAnalysis.deleteMany({
        where: { brainId: businessBrainId },
      });
      console.log("[Synthesize-Knowledge] Invalidated enhancement analysis cache");
    } catch (error) {
      console.error("[Synthesize-Knowledge] Error invalidating cache:", error);
      // Don't fail the request if cache invalidation fails
    }

    console.log("[Synthesize-Knowledge] Knowledge base synthesized and saved successfully");
    console.log(`[Synthesize-Knowledge] Metadata:`, {
      cardCount: knowledgeBase.metadata.cardCount,
      crossLinks: knowledgeBase.metadata.crossLinks,
      contradictions: knowledgeBase.metadata.contradictionsFound,
      confidence: knowledgeBase.metadata.confidence_score,
      fallback: knowledgeBase.metadata.fallback,
    });

    return NextResponse.json({
      success: true,
      knowledgeBase,
      message: "Knowledge base synthesized successfully.",
    });
  } catch (err: any) {
    console.error("[Synthesize-Knowledge] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to synthesize knowledge base.",
      },
      { status: 500 }
    );
  }
}
