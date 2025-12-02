import OpenAI from "openai";
import { DeepInsight, AnalysisContext } from "../analysis/types";

export interface GHLCard {
  title: string;
  description: string;
  metadata: {
    workflows: Array<{
      name: string;
      description: string;
      stages: string[];
    }>;
    pipelines: Array<{
      name: string;
      description: string;
      stages: string[];
    }>;
    automations: Array<{
      name: string;
      description: string;
      stages: string[];
    }>;
    templates: Array<{
      name: string;
      subject: string;
      body: string;
    }>;
    confidence_score: number;
  };
  confidence_score: number;
  source_attribution: string[];
}

/**
 * Generate enhanced GHL Implementation card using deep insights
 */
export async function generateGHLCard(
  openai: OpenAI,
  insights: DeepInsight[],
  context: AnalysisContext
): Promise<GHLCard> {
  try {
    // Filter CRM-related insights
    const crmInsights = insights.filter(i => i.category === "crm_pattern");

    const systemPrompt = `You are a CRM implementation strategist. Create GHL-specific implementation notes.

FOCUS ON:
1. Workflow automation opportunities based on their business model
2. Customer journey mapping for GHL pipelines
3. Communication sequences and templates
4. Integration points with their existing tools
5. Specific GHL features they should leverage

6. CRITICAL: Use intake data (pipelineStages, crmPlatform, supportEmail, emailSignoff) to generate content. Do not return empty arrays.

Return JSON with this EXACT structure:
{
  "description": "GHL implementation strategy",
  "metadata": {
    "workflows": [
      {
        "name": "Workflow name",
        "description": "Description",
        "stages": ["stage1", "stage2"]
      }
    ],
    "pipelines": [
      {
        "name": "Pipeline name",
        "description": "Description",
        "stages": ["stage1", "stage2"]
      }
    ],
    "automations": [
      {
        "name": "Automation name",
        "description": "Description",
        "stages": ["stage1", "stage2"]
      }
    ],
    "templates": [
      {
        "name": "Template name",
        "subject": "Email subject",
        "body": "Email body"
      }
    ],
    "confidence_score": 70
  },
  "source_attribution": ["source1"]
}

IMPORTANT: Populate ALL fields. Use intake data pipelineStages if provided.`;

    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyze this GHL implementation data and generate implementation notes.

INSIGHTS (${crmInsights.length} total):
${JSON.stringify(crmInsights.slice(0, 20), null, 2)}

WEBSITE CONTENT:
${context.websiteContent.fullText.substring(0, 2000)}

INTAKE DATA:
${JSON.stringify({
  crmPlatform: context.intakeData?.crmPlatform || "",
  crmSubaccount: context.intakeData?.crmSubaccount || "",
  pipelineStages: context.intakeData?.pipelineStages || "",
  supportEmail: context.intakeData?.supportEmail || "",
  emailSignoff: context.intakeData?.emailSignoff || "",
  offers: context.intakeData?.offers || "",
  icps: context.intakeData?.icps || [],
}, null, 2)}

Generate the GHL implementation card JSON now.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 3000,
    });

    const rawResponse = result.choices[0].message.content || "{}";
    let parsed: any = {};
    
    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error("Error parsing GHL card response:", parseError);
      console.error("Raw response (first 500 chars):", rawResponse.substring(0, 500));
    }
    
    console.log("[GHL] LLM Response Structure:", {
      hasMetadata: !!parsed.metadata,
      hasWorkflows: !!parsed.metadata?.workflows,
      workflowsCount: parsed.metadata?.workflows?.length || 0,
      hasPipelines: !!parsed.metadata?.pipelines,
      metadataKeys: parsed.metadata ? Object.keys(parsed.metadata) : [],
    });
    
    if (!parsed.metadata || parsed.metadata.workflows?.length === 0) {
      console.warn("GHL card: No workflows found in response, generating fallback");
      // Generate fallback from intake data
      parsed.metadata = parsed.metadata || {};
      const pipelineStages = context.intakeData?.pipelineStages 
        ? context.intakeData.pipelineStages.split('→').map((s: string) => s.trim()).filter(Boolean)
        : [];
      parsed.metadata.workflows = pipelineStages.length > 0 ? [{
        name: "Main Sales Workflow",
        description: "Customer journey through pipeline stages",
        stages: pipelineStages,
      }] : [];
      parsed.metadata.pipelines = pipelineStages.length > 0 ? [{
        name: "Sales Pipeline",
        description: "Primary sales pipeline",
        stages: pipelineStages,
      }] : [];
      parsed.metadata.automations = [];
      parsed.metadata.templates = context.intakeData?.emailSignoff ? [{
        name: "Standard Email Template",
        subject: "Thank you for your inquiry",
        body: `Thank you for reaching out.\n\n${context.intakeData.emailSignoff}`,
      }] : [];
      console.log("[GHL] Generated fallback from intake data");
    }

    const confidenceScores = crmInsights.map(i => i.confidence);
    const avgConfidence = confidenceScores.length > 0
      ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
      : 35;

    return {
      title: "GoHighLevel Implementation Notes",
      description: parsed.description || "GHL implementation strategy.",
      metadata: {
        workflows: parsed.metadata?.workflows || [],
        pipelines: parsed.metadata?.pipelines || [],
        automations: parsed.metadata?.automations || [],
        templates: parsed.metadata?.templates || [],
        confidence_score: parsed.metadata?.confidence_score || avgConfidence,
      },
      confidence_score: avgConfidence,
      source_attribution: parsed.source_attribution || crmInsights.map(i => i.source_locations.join(", ")),
    };
  } catch (error) {
    console.error("Error generating GHL card:", error);
    return {
      title: "GoHighLevel Implementation Notes",
      description: "GHL implementation notes.",
      metadata: {
        workflows: [],
        pipelines: [],
        automations: [],
        templates: [],
        confidence_score: 30,
      },
      confidence_score: 30,
      source_attribution: [],
    };
  }
}

