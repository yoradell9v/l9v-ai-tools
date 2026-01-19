import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { prisma } from "@/lib/core/prisma";
import { verifyAccessToken } from "@/lib/core/auth";
import { extractInsights } from "@/lib/analysis/extractInsights";
import { createLearningEvents } from "@/lib/learning/learning-events";
import { applyLearningEventsToKB } from "@/lib/learning/apply-learning-events";
import { CONFIDENCE_THRESHOLDS } from "@/lib/knowledge-base/insight-confidence-thresholds";
import { addRateLimitHeaders } from "@/lib/rate-limiting/rate-limit-middleware";
import { withRateLimit } from "@/lib/rate-limiting/rate-limit-utils";

export const runtime = "nodejs";

const CONFIG = {
  MAX_RESPONSE_TOKENS: 2000,
  MAX_HISTORY_MESSAGES: 10,
  TEMPERATURE: 0.3,
  MODEL: "gpt-4o",
  CONTEXT_SUMMARY_THRESHOLD: 10,
  CONTEXT_SUMMARY_INTERVAL: 5,
  MIN_MESSAGE_LENGTH_FOR_EXTRACTION: 20,
  INSIGHT_EXTRACTION_MODEL: "gpt-4o-mini", 
} as const;

async function handleSlashCommand(
  command: string,
  openai: OpenAI,
  knowledgeBase: any,
  conversationId: string,
  nextSequenceNumber: number
): Promise<{
  content: string;
  metadata: any;
}> {
  const commandHandlers: Record<string, (openai: OpenAI, context: any) => Promise<string>> = {
    "calibrate-voice": handleCalibrateVoice,
    "ad-kit": handleAdKit,
    "email-kit": handleEmailKit,
    "offers-map": handleOffersMap,
    "summarize-sops": handleSummarizeSops,
    "content-brief": handleContentBrief,
  };

  const handler = commandHandlers[command];
  if (!handler) {
    throw new Error(`Unknown command: /${command}`);
  }

  const context = {
    knowledgeBase: knowledgeBase,
  };

  const content = await handler(openai, context);

  return {
    content,
    metadata: {
      command: `/${command}`,
      executedAt: new Date().toISOString(),
      model: CONFIG.MODEL,
    },
  };
}

async function handleCalibrateVoice(
  openai: OpenAI,
  context: any
): Promise<string> {
  const systemPrompt = `You are a brand voice specialist. Generate comprehensive brand voice guidelines based on the business profile.

Create a detailed brand voice guide that includes:
1. **Voice Characteristics** - Describe the tone, style, and personality
2. **Writing Rules** - Specific do's and don'ts with examples
3. **Vocabulary Guidelines** - Preferred words, forbidden words, power phrases
4. **Sentence Structure** - Preferred patterns (short vs long, questions, lists)
5. **Relationship Dynamics** - How to address the reader, assumed knowledge level
6. **Examples** - Good and bad examples with explanations

Use the knowledge base to extract authentic voice patterns.`;

  const kb = context.knowledgeBase;
  const userPrompt = `Generate brand voice guidelines for this business:

Business Name: ${kb.businessName || "Not specified"}
Industry: ${kb.industry || "Not specified"}
What You Sell: ${kb.whatYouSell || "Not specified"}

Brand Voice Style: ${kb.brandVoiceStyle || "Not specified"}
Risk/Boldness Level: ${kb.riskBoldness || "Not specified"}
Good Voice Examples: ${kb.voiceExampleGood || "Not specified"}
Voice to Avoid: ${kb.voiceExamplesAvoid || "Not specified"}
Forbidden Words: ${kb.forbiddenWords || "Not specified"}
Content Links: ${kb.contentLinks || "Not specified"}

Generate comprehensive brand voice guidelines in markdown format.`;

  const result = await openai.chat.completions.create({
    model: CONFIG.MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 3000,
  });

  return result.choices[0].message.content || "Failed to generate brand voice guidelines.";
}

async function handleAdKit(openai: OpenAI, context: any): Promise<string> {
  const systemPrompt = `You are a direct response copywriter specializing in high-converting ad copy. Generate a complete ad kit based on the business profile.

Create:
1. **10 Attention-Grabbing Hooks** - Opening lines that stop the scroll
2. **6 Unique Angles** - Different positioning approaches for the same offer
3. **5 Complete Ad Scripts** - Full ad copy (headline, body, CTA) for different platforms

All content must match the brand voice and positioning exactly.`;

  const kb = context.knowledgeBase;
  const userPrompt = `Generate an ad kit for this business:

Business Name: ${kb.businessName || "Not specified"}
Industry: ${kb.industry || "Not specified"}
What You Sell: ${kb.whatYouSell || "Not specified"}

Ideal Customer: ${kb.idealCustomer || "Not specified"}
Core Offer: ${kb.coreOffer || "Not specified"}
Top Objection: ${kb.topObjection || "Not specified"}

Brand Voice Style: ${kb.brandVoiceStyle || "Not specified"}
Risk/Boldness Level: ${kb.riskBoldness || "Not specified"}
Forbidden Words: ${kb.forbiddenWords || "Not specified"}

Generate the complete ad kit in markdown format with clear sections.`;

  const result = await openai.chat.completions.create({
    model: CONFIG.MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.5,
    max_tokens: 4000,
  });

  return result.choices[0].message.content || "Failed to generate ad kit.";
}

async function handleEmailKit(openai: OpenAI, context: any): Promise<string> {
  const systemPrompt = `You are an email marketing specialist. Generate 5 email templates with subject lines based on the business profile.

Each email should include:
1. **Subject Line** - Compelling, on-brand
2. **Preheader** - Supporting text
3. **Email Body** - Full copy matching brand voice
4. **Use Case** - When to use this email
5. **CTA** - Clear call-to-action

Templates should cover: Welcome, Nurture, Offer, Follow-up, Re-engagement`;

  const kb = context.knowledgeBase;
  const userPrompt = `Generate 5 email templates for this business:

Business Name: ${kb.businessName || "Not specified"}
What You Sell: ${kb.whatYouSell || "Not specified"}

Ideal Customer: ${kb.idealCustomer || "Not specified"}
Core Offer: ${kb.coreOffer || "Not specified"}

Brand Voice Style: ${kb.brandVoiceStyle || "Not specified"}
Email Sign-off: ${kb.emailSignOff || "Not specified"}
Booking Link: ${kb.bookingLink || "Not specified"}
Support Email: ${kb.supportEmail || "Not specified"}

Forbidden Words: ${kb.forbiddenWords || "Not specified"}
Disclaimers: ${kb.disclaimers || "Not specified"}

Generate 5 complete email templates in markdown format.`;

  const result = await openai.chat.completions.create({
    model: CONFIG.MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 4000,
  });

  return result.choices[0].message.content || "Failed to generate email kit.";
}

async function handleOffersMap(openai: OpenAI, context: any): Promise<string> {
  const systemPrompt = `You are a sales strategist. Create a comprehensive offers map that lists all offers with their objections and rebuttals.

For each offer, provide:
1. **Offer Name & Description**
2. **Price Point**
3. **Value Proposition**
4. **Top 3-5 Objections** - Most common hesitations
5. **Rebuttal Strategies** - How to address each objection
6. **Proof Points** - Evidence to support the offer

Use the knowledge base to extract real offers and objections.`;

  const kb = context.knowledgeBase;
  const userPrompt = `Create an offers map for this business:

Business Name: ${kb.businessName || "Not specified"}
Industry: ${kb.industry || "Not specified"}
What You Sell: ${kb.whatYouSell || "Not specified"}

Ideal Customer: ${kb.idealCustomer || "Not specified"}
Core Offer: ${kb.coreOffer || "Not specified"}
Top Objection: ${kb.topObjection || "Not specified"}
Customer Journey: ${kb.customerJourney || "Not specified"}

Generate a comprehensive offers map in markdown format.`;

  const result = await openai.chat.completions.create({
    model: CONFIG.MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 3000,
  });

  return result.choices[0].message.content || "Failed to generate offers map.";
}

async function handleSummarizeSops(openai: OpenAI, context: any): Promise<string> {
  const systemPrompt = `You are an operations specialist. Create a concise 1-page SOP summary based on the business operations data.

The summary should include:
1. **Key Processes** - Main workflows and procedures
2. **Tools & Platforms** - CRM, software, systems used
3. **Communication Protocols** - How to communicate, when, with whom
4. **Quality Standards** - What "done" looks like
5. **Common Pitfalls** - What to avoid

Keep it to 1 page, actionable, and easy to reference.`;

  const kb = context.knowledgeBase;
  const userPrompt = `Create a 1-page SOP summary for this business:

Business Name: ${kb.businessName || "Not specified"}

Tool Stack: ${kb.toolStack && kb.toolStack.length > 0 ? kb.toolStack.join(", ") : "Not specified"}
Primary CRM: ${kb.primaryCRM || "Not specified"}
Default Timezone: ${kb.defaultTimeZone || "Not specified"}
Support Email: ${kb.supportEmail || "Not specified"}
Booking Link: ${kb.bookingLink || "Not specified"}

Customer Journey: ${kb.customerJourney || "Not specified"}
Pipeline Stages: ${kb.pipeLineStages || "Not specified"}

Generate a concise 1-page SOP summary in markdown format.`;

  const result = await openai.chat.completions.create({
    model: CONFIG.MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  return result.choices[0].message.content || "Failed to generate SOP summary.";
}

async function handleContentBrief(openai: OpenAI, context: any): Promise<string> {
  const systemPrompt = `You are a content strategist. Generate a comprehensive creative brief for content creation.

The brief should include:
1. **Content Objective** - What this content should achieve
2. **Target Audience** - Who it's for, their pain points, desires
3. **Key Messages** - Main points to communicate
4. **Tone & Style** - How it should sound (from brand voice)
5. **Content Structure** - Suggested format/layout
6. **Call-to-Action** - What action should readers take
7. **Forbidden Elements** - What NOT to include
8. **Examples** - Similar content that works

Use brand voice, positioning, and compliance rules.`;

  const kb = context.knowledgeBase;
  const userPrompt = `Generate a creative brief for content creation:

Business Name: ${kb.businessName || "Not specified"}
Industry: ${kb.industry || "Not specified"}
What You Sell: ${kb.whatYouSell || "Not specified"}

Ideal Customer: ${kb.idealCustomer || "Not specified"}
Core Offer: ${kb.coreOffer || "Not specified"}
Top Objection: ${kb.topObjection || "Not specified"}

Brand Voice Style: ${kb.brandVoiceStyle || "Not specified"}
Risk/Boldness Level: ${kb.riskBoldness || "Not specified"}
Good Voice Examples: ${kb.voiceExampleGood || "Not specified"}
Voice to Avoid: ${kb.voiceExamplesAvoid || "Not specified"}
Content Links: ${kb.contentLinks || "Not specified"}

Forbidden Words: ${kb.forbiddenWords || "Not specified"}
Disclaimers: ${kb.disclaimers || "Not specified"}
Is Regulated: ${kb.isRegulated ? "Yes" : "No"}
${kb.isRegulated && kb.regulatedIndustry ? `Regulated Industry: ${kb.regulatedIndustry}` : ""}

Generate a comprehensive creative brief in markdown format.`;

  const result = await openai.chat.completions.create({
    model: CONFIG.MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 3000,
  });

  return result.choices[0].message.content || "Failed to generate content brief.";
}

async function extractStructuredInsightsFromConversation(
  openai: OpenAI,
  userMessage: string,
  assistantMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  knowledgeBase: any
): Promise<any | null> {
  const userMsgLower = userMessage.toLowerCase().trim();
  const trivialPatterns = [
    /^(thanks?|thank you|thx|ty|ok|okay|got it|sure|yep|yes|no|nope|bye|goodbye|hi|hello|hey)$/i,
    /^(thanks?|thank you|thx|ty)\s*(!|\.|$)/i,
  ];

  const isTrivial = trivialPatterns.some(pattern => pattern.test(userMsgLower)) || 
                    userMessage.trim().length < CONFIG.MIN_MESSAGE_LENGTH_FOR_EXTRACTION;

  if (isTrivial) {
    console.log("[Insight Extraction] Skipping trivial message");
    return null;
  }

  const recentHistory = conversationHistory.slice(-5).map(msg => ({
    role: msg.role,
    content: msg.content.substring(0, 500), // Limit context length
  }));

  const systemPrompt = `You are an insight extraction specialist. Analyze conversation exchanges and extract structured insights that could enrich a business knowledge base.

Extract insights in these categories:
1. **Business Context**: New bottlenecks, goals, pain points, company stage changes, growth indicators
2. **Process/Workflow**: New tools mentioned, SOP updates, process changes, workflow improvements
3. **Customer/Market**: New objections, customer feedback, market insights, target audience updates
4. **Knowledge Gaps**: Questions asked that indicate missing information in knowledge base
5. **Compliance/Regulatory**: New compliance requirements, regulatory mentions, forbidden words/claims

Return JSON with this structure:
{
  "business_context": {
    "bottleneck": "New bottleneck mentioned (if any)",
    "pain_point": "Pain point mentioned (if any)",
    "growth_indicator": "Growth indicator mentioned (if any)",
    "company_stage": "Company stage mentioned (if any: startup/growth/established)"
  },
  "process_optimization": {
    "new_tool": "New tool mentioned (if any)",
    "process_change": "Process change mentioned (if any)",
    "documentation_gap": "Documentation gap identified (if any)"
  },
  "customer_market": {
    "new_objection": "New objection mentioned (if any)",
    "customer_feedback": "Customer feedback shared (if any)",
    "market_insight": "Market insight mentioned (if any)"
  },
  "knowledge_gap": {
    "question_asked": "Question that indicates missing KB information (if any)",
    "missing_info": "Type of information missing (if any)"
  },
  "compliance": {
    "regulatory_mention": "Regulatory/compliance mention (if any)",
    "forbidden_claim": "Forbidden claim mentioned (if any)"
  },
  "confidence": 0-100, // Overall confidence in extraction quality
  "has_insights": true/false // Whether meaningful insights were found
}

Only extract insights that are:
- Explicitly stated or clearly implied
- New information not already in the knowledge base
- Actionable or informative
- High confidence (avoid speculation)

If no meaningful insights found, return: {"has_insights": false, "confidence": 0}`;

  const userPrompt = `Analyze this conversation exchange:

CURRENT EXCHANGE:
User: ${userMessage}
Assistant: ${assistantMessage}

${recentHistory.length > 0 ? `RECENT CONTEXT (last ${recentHistory.length} messages):\n${JSON.stringify(recentHistory, null, 2)}\n` : ""}

CURRENT KNOWLEDGE BASE (for reference - don't extract if already present):
- Business Name: ${knowledgeBase.businessName || "Not set"}
- Industry: ${knowledgeBase.industry || "Not set"}
- Biggest Bottleneck: ${knowledgeBase.biggestBottleNeck || "Not set"}
- Top Objection: ${knowledgeBase.topObjection || "Not set"}
- Core Offer: ${knowledgeBase.coreOffer || "Not set"}
- Tools: ${knowledgeBase.toolStack?.join(", ") || "Not set"}

Extract structured insights that would enrich the knowledge base. Focus on NEW information not already present.`;

  try {
    const completion = await openai.chat.completions.create({
      model: CONFIG.INSIGHT_EXTRACTION_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1000,
    });

    const extracted = JSON.parse(completion.choices[0].message.content || "{}");
    
    if (!extracted.has_insights || extracted.confidence < 50) {
      console.log(`[Insight Extraction] No meaningful insights found (confidence: ${extracted.confidence})`);
      return null;
    }

    console.log(`[Insight Extraction] Extracted insights with confidence: ${extracted.confidence}`);
    return extracted;
  } catch (error: any) {
    console.error("[Insight Extraction] AI extraction failed:", error);
    return null; 
  }
}

function buildSystemPrompt(knowledgeBase: any, contextSummary: string | null): string {
  const businessName = knowledgeBase.businessName || "this business";

  let prompt = `You are an AI assistant with deep knowledge of ${businessName}.\n\n`;


  prompt += `=== KNOWLEDGE BASE ===\n`;
  prompt += `\nThe following is the complete knowledge base for ${businessName}:\n\n`;
  
  if (knowledgeBase.businessName) prompt += `Business Name: ${knowledgeBase.businessName}\n`;
  if (knowledgeBase.website) prompt += `Website: ${knowledgeBase.website}\n`;
  if (knowledgeBase.industry) prompt += `Industry: ${knowledgeBase.industry}\n`;
  if (knowledgeBase.whatYouSell) prompt += `What You Sell: ${knowledgeBase.whatYouSell}\n\n`;

  // Business Context
  if (knowledgeBase.monthlyRevenue) prompt += `Monthly Revenue: ${knowledgeBase.monthlyRevenue}\n`;
  if (knowledgeBase.teamSize) prompt += `Team Size: ${knowledgeBase.teamSize}\n`;
  if (knowledgeBase.primaryGoal) prompt += `Primary Goal: ${knowledgeBase.primaryGoal}\n`;
  if (knowledgeBase.biggestBottleNeck) prompt += `Biggest Bottleneck: ${knowledgeBase.biggestBottleNeck}\n\n`;

  // Customer and Market
  if (knowledgeBase.idealCustomer) prompt += `Ideal Customer: ${knowledgeBase.idealCustomer}\n`;
  if (knowledgeBase.topObjection) prompt += `Top Objection: ${knowledgeBase.topObjection}\n`;
  if (knowledgeBase.coreOffer) prompt += `Core Offer: ${knowledgeBase.coreOffer}\n`;
  if (knowledgeBase.customerJourney) prompt += `Customer Journey: ${knowledgeBase.customerJourney}\n\n`;

  // Operations and Tools
  if (knowledgeBase.toolStack && knowledgeBase.toolStack.length > 0) {
    prompt += `Tool Stack: ${knowledgeBase.toolStack.join(", ")}\n`;
  }
  if (knowledgeBase.primaryCRM) prompt += `Primary CRM: ${knowledgeBase.primaryCRM}\n`;
  if (knowledgeBase.defaultTimeZone) prompt += `Default Timezone: ${knowledgeBase.defaultTimeZone}\n`;
  if (knowledgeBase.bookingLink) prompt += `Booking Link: ${knowledgeBase.bookingLink}\n`;
  if (knowledgeBase.supportEmail) prompt += `Support Email: ${knowledgeBase.supportEmail}\n\n`;

  // Brand & Voice
  if (knowledgeBase.brandVoiceStyle) prompt += `Brand Voice Style: ${knowledgeBase.brandVoiceStyle}\n`;
  if (knowledgeBase.riskBoldness) prompt += `Risk/Boldness Level: ${knowledgeBase.riskBoldness}\n`;
  if (knowledgeBase.voiceExampleGood) prompt += `Good Voice Examples: ${knowledgeBase.voiceExampleGood}\n`;
  if (knowledgeBase.voiceExamplesAvoid) prompt += `Voice to Avoid: ${knowledgeBase.voiceExamplesAvoid}\n`;
  if (knowledgeBase.contentLinks) prompt += `Content Links: ${knowledgeBase.contentLinks}\n\n`;

  // Compliance
  if (knowledgeBase.isRegulated) {
    prompt += `Regulated Industry: Yes\n`;
    if (knowledgeBase.regulatedIndustry) prompt += `Regulated Industry Type: ${knowledgeBase.regulatedIndustry}\n`;
  }
  if (knowledgeBase.forbiddenWords) prompt += `Forbidden Words: ${knowledgeBase.forbiddenWords}\n`;
  if (knowledgeBase.disclaimers) prompt += `Disclaimers: ${knowledgeBase.disclaimers}\n\n`;

  // Additional Context
  if (knowledgeBase.pipeLineStages) prompt += `Pipeline Stages: ${knowledgeBase.pipeLineStages}\n`;
  if (knowledgeBase.emailSignOff) prompt += `Email Sign-off: ${knowledgeBase.emailSignOff}\n\n`;

  // Extracted Knowledge (from tool usage)
  if (knowledgeBase.extractedKnowledge) {
    prompt += `\nExtracted Knowledge (from tool usage):\n`;
    prompt += JSON.stringify(knowledgeBase.extractedKnowledge, null, 2);
    prompt += `\n\n`;
  }

  // BEHAVIORAL RULES
  prompt += `=== BEHAVIORAL RULES ===\n`;
  prompt += `\nYou MUST follow these instructions:\n\n`;
  prompt += `1. Use the knowledge base to provide accurate, contextual responses.\n`;
  prompt += `   - Reference specific fields when relevant (e.g., "According to your brand voice style...").\n`;
  prompt += `   - Cross-reference related concepts (e.g., link objections to positioning, ICPs to content).\n\n`;
  prompt += `2. Follow the brand voice style EXACTLY.\n`;
  prompt += `   - Use the vocabulary, tone, and rhetorical patterns specified.\n`;
  prompt += `   - Avoid forbidden words and phrases.\n`;
  prompt += `   - Match the formality level and relationship dynamics.\n\n`;
  prompt += `3. If compliance rules apply to the user's question, mention them EXPLICITLY.\n`;
  prompt += `   - Reference required disclaimers when relevant.\n`;
  prompt += `   - Warn about forbidden claims.\n\n`;
  prompt += `4. Stay STRICTLY within the boundaries of the provided knowledge base.\n`;
  prompt += `   - Do NOT fabricate details outside the provided information.\n`;
  prompt += `   - If information is not available, say "This information is not available in the knowledge base."\n`;
  prompt += `   - Do NOT invent pricing, customer details, competitors, or other factual data.\n\n`;

  // CONTEXT SUMMARY (optional)
  if (contextSummary) {
    prompt += `=== CONTEXT SUMMARY ===\n`;
    prompt += `\nThe following is a summary of important points from previous conversation turns:\n\n`;
    prompt += `${contextSummary}\n\n`;
  }

  prompt += `\n=== END OF SYSTEM PROMPT ===\n`;
  prompt += `\nNow respond to the user's message following all the rules above.\n`;

  return prompt;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Invalid token." },
        { status: 401 }
      );
    }

    const rateLimit = await withRateLimit(request, "/api/organization-knowledge-base/conversation", {
      requireAuth: true,
    });

    if (!rateLimit.allowed) {
      return rateLimit.response!;
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "OpenAI API key not configured.",
        },
        { status: 500 }
      );
    }

    const { conversationId } = await params;

    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: { deactivatedAt: null },
        deactivatedAt: null,
      },
      select: { id: true, organizationId: true },
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

    const body = await request.json();
    const content = body.content?.trim();

    if (!content || content.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Message content is required.",
        },
        { status: 400 }
      );
    }

    const conversation = await prisma.businessConversation.findFirst({
      where: {
        id: conversationId,
        userOrganizationId: { in: userOrganizationIds },
      },
      include: {
        knowledgeBase: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        {
          success: false,
          error: "Conversation not found or access denied.",
        },
        { status: 404 }
      );
    }

    const knowledgeBase = conversation.knowledgeBase;
    if (!knowledgeBase) {
      return NextResponse.json(
        {
          success: false,
          error: "Knowledge base not found.",
        },
        { status: 404 }
      );
    }

    const nextSequenceNumber = conversation.messageCount + 1;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const isSlashCommand = content.startsWith("/");
    let commandName: string | null = null;
    
    if (isSlashCommand) {
      const commandMatch = content.match(/^\/(\w+(-?\w+)*)/);
      if (commandMatch) {
        commandName = commandMatch[1];
      }
    }

    if (isSlashCommand && commandName) {
      try {
        const commandResult = await handleSlashCommand(
          commandName,
          openai,
          knowledgeBase,
          conversationId,
          nextSequenceNumber
        );

        const userMessage = await prisma.businessMessage.create({
          data: {
            conversationId: conversationId,
            role: "user",
            content: content,
            sequenceNumber: nextSequenceNumber,
            metadata: {
              command: `/${commandName}`,
              executedAt: new Date().toISOString(),
            },
          },
        });

        const assistantSequenceNumber = nextSequenceNumber + 1;
        const assistantMessage = await prisma.businessMessage.create({
          data: {
            conversationId: conversationId,
            role: "assistant",
            content: commandResult.content,
            sequenceNumber: assistantSequenceNumber,
            metadata: {
              ...commandResult.metadata,
              command: `/${commandName}`,
              tokenCount: commandResult.content.length / 4,
            },
          },
        });

        await prisma.businessConversation.update({
          where: { id: conversationId },
          data: {
            messageCount: { increment: 2 },
            lastMessageAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          message: userMessage,
          assistantMessage: {
            id: assistantMessage.id,
            content: commandResult.content,
            confidence: 90,
          },
          conversationHistory: [],
          conversation: {
            id: conversationId,
            messageCount: nextSequenceNumber + 1,
            contextSummary: conversation.contextSummary,
          },
        });
      } catch (commandError: any) {
        console.error("[Command Handler] Error:", commandError);
        return NextResponse.json(
          {
            success: false,
            error: commandError.message || `Failed to execute command: /${commandName}`,
          },
          { status: 500 }
        );
      }
    }

    const conversationHistory = await prisma.businessMessage.findMany({
      where: { conversationId: conversationId },
      orderBy: { sequenceNumber: "desc" },
      take: CONFIG.MAX_HISTORY_MESSAGES,
      select: {
        id: true,
        role: true,
        content: true,
        sequenceNumber: true,
        createdAt: true,
      },
    });

    const historyChronological = conversationHistory.reverse();

    const systemPrompt = buildSystemPrompt(knowledgeBase, conversation.contextSummary);

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: systemPrompt }];


    for (const msg of historyChronological) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    messages.push({
      role: "user",
      content: content,
    });

    const userMessage = await prisma.businessMessage.create({
      data: {
        conversationId: conversationId,
        role: "user",
        content: content,
        sequenceNumber: nextSequenceNumber,
      },
    });


    let aiResponse: string = "";
    let promptTokens: number = 0;
    let completionTokens: number = 0;
    let totalTokens: number = 0;

    try {
      const completion = await openai.chat.completions.create({
        model: CONFIG.MODEL,
        messages: messages,
        temperature: CONFIG.TEMPERATURE,
        max_tokens: CONFIG.MAX_RESPONSE_TOKENS,
      });

      aiResponse = completion.choices[0].message.content || "";
      if (!aiResponse) {
        throw new Error("OpenAI returned empty response");
      }

      promptTokens = completion.usage?.prompt_tokens || 0;
      completionTokens = completion.usage?.completion_tokens || 0;
      totalTokens = completion.usage?.total_tokens || 0;
    } catch (openaiError: any) {
      console.error("[Message POST] OpenAI API error:", openaiError);
      throw new Error(
        `Failed to generate AI response: ${
          openaiError.message || "Unknown error"
        }`
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const assistantSequenceNumber = nextSequenceNumber + 1;
      const assistantMessage = await tx.businessMessage.create({
        data: {
          conversationId: conversationId,
          role: "assistant",
          content: aiResponse,
          sequenceNumber: assistantSequenceNumber,
          metadata: {
            model: CONFIG.MODEL,
            tokenCount: totalTokens,
            promptTokens: promptTokens,
            completionTokens: completionTokens,
          },
        },
      });

      const updatedConversation = await tx.businessConversation.update({
        where: { id: conversationId },
        data: {
          messageCount: { increment: 2 }, 
          lastMessageAt: new Date(),
        },
      });

      return {
        assistantMessage,
        updatedConversation,
      };
    });

    try {
      const structuredInsights = await extractStructuredInsightsFromConversation(
        openai,
        content,
        aiResponse,
        historyChronological,
        knowledgeBase
      );

      if (structuredInsights && structuredInsights.has_insights) {
        const conversationData = {
          userMessage: content,
          assistantMessage: aiResponse,
          conversationId: conversationId,
          knowledgeBaseId: knowledgeBase.id,
          organizationId: knowledgeBase.organizationId,
          structuredInsights: structuredInsights,
        };

        const insights = await extractInsights("CHAT_CONVERSATION", conversationData);

        if (insights.length > 0) {
          const learningEventsResult = await createLearningEvents({
            knowledgeBaseId: knowledgeBase.id,
            sourceType: "CHAT_CONVERSATION",
            sourceId: conversationId,
            insights: insights,
            triggeredBy: userOrganizations[0].id,
          });

          if (learningEventsResult.success && learningEventsResult.eventsCreated > 0) {
            console.log(
              `Created ${learningEventsResult.eventsCreated} LearningEvents for conversation ${conversationId}`
            );

            try {
              const enrichmentResult = await applyLearningEventsToKB({
                knowledgeBaseId: knowledgeBase.id,
                minConfidence: CONFIDENCE_THRESHOLDS.HIGH, 
              });

              if (enrichmentResult.success) {
                console.log(
                  `Applied ${enrichmentResult.eventsApplied} learning events to KB ${knowledgeBase.id}. ` +
                  `Updated fields: ${enrichmentResult.fieldsUpdated.join(", ") || "none"}. ` +
                  `Enrichment version: ${enrichmentResult.enrichmentVersion}`
                );
              } else {
                console.warn(
                  `Failed to apply some learning events:`,
                  enrichmentResult.errors
                );
              }
            } catch (enrichmentError) {
              console.error("Error applying learning events:", enrichmentError);
            }
          }
        } else {
          console.log("[Insight Extraction] No insights extracted after processing");
        }
      } else {
        console.log("[Insight Extraction] No meaningful insights found in conversation exchange");
      }
    } catch (insightError) {
      console.error("Error extracting insights from conversation:", insightError);
    }

    const response = NextResponse.json({
      success: true,
      message: userMessage,
      assistantMessage: {
        id: result.assistantMessage.id,
        content: aiResponse,
        confidence: 85,
      },
      conversationHistory: historyChronological,
      conversation: {
        id: result.updatedConversation.id,
        messageCount: result.updatedConversation.messageCount,
        contextSummary: result.updatedConversation.contextSummary,
      },
    });

    return addRateLimitHeaders(response, rateLimit.rateLimitResult);
  } catch (err: any) {
    console.error("[Message POST] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to create message.",
      },
      { status: 500 }
    );
  }
}