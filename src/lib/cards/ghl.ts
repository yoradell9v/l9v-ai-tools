import OpenAI from "openai";
import { DeepInsight, AnalysisContext } from "../analysis/types";

export interface GHLCard {
  title: string;
  description: string;
  metadata: Record<string, any> & { confidence_score: number };
  confidence_score: number;
  source_attribution: Array<string | { source?: string; insight?: string }>;
}

export async function generateGHLCard(
  openai: OpenAI,
  insights: DeepInsight[],
  context: AnalysisContext
): Promise<GHLCard> {
  try {
    const crmInsights = insights.filter((i) => i.category === "crm_pattern");
    const enhanced = context.enhancedContext;

    const ghlPrompt = `You are a GoHighLevel CRM implementation strategist. Create actionable GHL setup instructions.

INPUTS:
${JSON.stringify(
  {
    crmPlatform: enhanced?.ghlImplementation.crmPlatform,
    customerJourney: enhanced?.ghlImplementation.customerJourney,
    pipelineStages: enhanced?.ghlImplementation.pipelineStages,
    bookingLink: enhanced?.ghlImplementation.bookingLink,
    supportEmail: enhanced?.ghlImplementation.supportEmail,
    coreOffer: enhanced?.ghlImplementation.coreOffer,
    goal90Day: enhanced?.ghlImplementation.goal90Day,
  },
  null,
  2
)}

TASK: Create GHL implementation guide with these REQUIRED sections:

## 1. Pipeline Configuration
PIPELINE NAME: "Sales Pipeline"
STAGES: [list each stage with automation triggers]
Map customer journey to pipeline stages.

## 2. Email Sequence Templates
Create 3 sequences:
- "New Lead Nurture" (5 emails over 7 days)
- "Strategy Call No-Show" (3 touchpoints)
- "Proposal Follow-Up" (4 emails over 7 days)

For each email, provide:
- Day/timing
- Subject line
- Body structure (3-4 bullet points)
- CTA

## 3. Workflow Automations
Create workflows for:
- New lead intake
- Appointment no-shows
- Proposal follow-up
- Stale pipeline alerts

Each workflow: TRIGGER → ACTIONS (step-by-step)

## 4. Tag & Custom Field Strategy
TAGS: [list 10-15 tags with use cases]
CUSTOM FIELDS: [list 5-10 fields with purposes]
Explain when and how to use each.

## 5. Integration Requirements
List integrations needed:
- Calendar (Calendly/Acuity)
- Payment processor
- Zoom/meeting platform
- Other tools

Provide setup steps for each.

## 6. Reporting & KPIs
Define dashboards:
- "Sales Overview" (8-10 metrics)
- "Marketing Performance" (5-7 metrics)
Map to their 90-day goal.

OUTPUT FORMAT: Return JSON with actionable templates and workflows.`;

    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: ghlPrompt },
        {
          role: "user",
          content: `Use the mined insights and samples below to generate the card.

INSIGHTS (${crmInsights.length}):
${JSON.stringify(crmInsights.slice(0, 20), null, 2)}

WEBSITE CONTENT:
${context.websiteContent.fullText.substring(0, 1500)}

EXAMPLE CONTENT LINKS (from contentLinks field):
${enhanced?.brandVoice.exampleLinkContent && enhanced.brandVoice.exampleLinkContent.length > 0
  ? enhanced.brandVoice.exampleLinkContent
      .map(
        (link: any) => `URL: ${link.url}
Title: ${link.metadata?.title || "N/A"}
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
      console.error("Error parsing GHL card response:", parseError);
    }

    const fallbackConfidence =
      crmInsights.length > 0
        ? Math.round(
            crmInsights.reduce((a, b) => a + (b.confidence || 0), 0) /
              crmInsights.length
          )
        : 35;

    const confidence = parsed.confidence_score || fallbackConfidence;

    return {
      title: parsed.title || "GoHighLevel Implementation Notes",
      description: parsed.description || "GHL implementation strategy.",
      metadata: {
        ...(parsed.metadata || {}),
        confidence_score: confidence,
      },
      confidence_score: confidence,
      source_attribution:
        parsed.source_attribution ||
        crmInsights.map((i) => i.source_locations.join(", ")),
    };
  } catch (error) {
    console.error("Error generating GHL card:", error);
    return {
      title: "GoHighLevel Implementation Notes",
      description: "GHL implementation notes.",
      metadata: { confidence_score: 30 },
      confidence_score: 30,
      source_attribution: [],
    };
  }
}

