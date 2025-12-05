import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export const runtime = "nodejs";

const CONFIG = {
  MAX_RESPONSE_TOKENS: 2000,
  EXCERPT_LENGTH: 500,
  MAX_HISTORY_MESSAGES: 10,
  TEMPERATURE: 0.3,
  MODEL: "gpt-4o",
  INTENT_MODEL: "gpt-4o-mini",
  CONTEXT_SUMMARY_THRESHOLD: 10,
  CONTEXT_SUMMARY_INTERVAL: 5,
  MIN_CARD_RELEVANCE: 40,
  HIGH_CARD_RELEVANCE: 80,
  ACTIVE_CARDS_DECAY_MESSAGES: 10,
} as const;

interface BusinessCard {
  id: string;
  type: string;
  title: string;
  description: string;
  metadata?: any;
  priority?: number | null;
  orderIndex: number;
}

interface LoadedCard {
  type: string;
  title: string;
  relevance: number;
  content: string;
}

interface CardCitation {
  cardId: string;
  cardType: string;
  excerpts: string[];
  confidence: number;
}

// ============================================================================
// SLASH COMMAND HANDLERS
// ============================================================================

/**
 * Handle slash command execution
 */
async function handleSlashCommand(
  command: string,
  openai: OpenAI,
  businessBrain: {
    id: string;
    intakeData: any;
    knowledgeBase: any;
    cards: BusinessCard[];
  },
  conversationId: string,
  nextSequenceNumber: number
): Promise<{
  content: string;
  metadata: any;
  citations: CardCitation[];
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

  // Prepare context for command handlers
  const context = {
    businessBrain,
    knowledgeBase: businessBrain.knowledgeBase,
    intakeData: businessBrain.intakeData,
    cards: businessBrain.cards,
  };

  // Execute command handler
  const content = await handler(openai, context);

  // Extract citations from cards used
  const citations: CardCitation[] = [];
  const brandVoiceCard = businessBrain.cards.find(
    (c) => c.type === "COMMUNICATION_STYLE_CARD" || c.type === "BRAND_VOICE_CARD"
  );
  if (brandVoiceCard) {
    citations.push({
      cardId: brandVoiceCard.id,
      cardType: brandVoiceCard.type,
      excerpts: [brandVoiceCard.title],
      confidence: 80,
    });
  }

  return {
    content,
    metadata: {
      command: `/${command}`,
      executedAt: new Date().toISOString(),
      model: CONFIG.MODEL,
    },
    citations,
  };
}

/**
 * /calibrate-voice → Generates brand voice guidelines
 */
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

Use the knowledge base and cards to extract authentic voice patterns.`;

  const userPrompt = `Generate brand voice guidelines for this business:

Knowledge Base:
${JSON.stringify(context.knowledgeBase?.brandVoice || {}, null, 2)}

Intake Data:
- Brand Voice Style: ${context.intakeData?.brandVoiceStyle || "Not specified"}
- Risk/Boldness Level: ${context.intakeData?.riskBoldnessLevel || "Not specified"}

Communication Style Card:
${context.cards
  .find((c: BusinessCard) => c.type === "COMMUNICATION_STYLE_CARD")
  ?.description || "Not available"}

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

/**
 * /ad-kit → Creates 10 hooks, 6 angles, 5 ad scripts
 */
async function handleAdKit(openai: OpenAI, context: any): Promise<string> {
  const systemPrompt = `You are a direct response copywriter specializing in high-converting ad copy. Generate a complete ad kit based on the business profile.

Create:
1. **10 Attention-Grabbing Hooks** - Opening lines that stop the scroll
2. **6 Unique Angles** - Different positioning approaches for the same offer
3. **5 Complete Ad Scripts** - Full ad copy (headline, body, CTA) for different platforms

All content must match the brand voice and positioning exactly.`;

  const userPrompt = `Generate an ad kit for this business:

Business Overview:
${JSON.stringify(context.knowledgeBase?.businessOverview || {}, null, 2)}

Positioning:
${JSON.stringify(context.knowledgeBase?.positioning || {}, null, 2)}

Brand Voice:
${JSON.stringify(context.knowledgeBase?.brandVoice || {}, null, 2)}

Target Audience:
${JSON.stringify(context.knowledgeBase?.positioning?.target_audience || [], null, 2)}

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

/**
 * /email-kit → Generates 5 email templates with subject lines
 */
async function handleEmailKit(openai: OpenAI, context: any): Promise<string> {
  const systemPrompt = `You are an email marketing specialist. Generate 5 email templates with subject lines based on the business profile.

Each email should include:
1. **Subject Line** - Compelling, on-brand
2. **Preheader** - Supporting text
3. **Email Body** - Full copy matching brand voice
4. **Use Case** - When to use this email
5. **CTA** - Clear call-to-action

Templates should cover: Welcome, Nurture, Offer, Follow-up, Re-engagement`;

  const userPrompt = `Generate 5 email templates for this business:

Business Overview:
${JSON.stringify(context.knowledgeBase?.businessOverview || {}, null, 2)}

Brand Voice:
${JSON.stringify(context.knowledgeBase?.brandVoice || {}, null, 2)}

Positioning:
${JSON.stringify(context.knowledgeBase?.positioning || {}, null, 2)}

Operations (for CTAs):
${JSON.stringify(context.knowledgeBase?.operations || {}, null, 2)}

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

/**
 * /offers-map → Lists all offers with objections/rebuttals
 */
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

  const userPrompt = `Create an offers map for this business:

Business Overview:
${JSON.stringify(context.knowledgeBase?.businessOverview || {}, null, 2)}

Positioning (includes objections):
${JSON.stringify(context.knowledgeBase?.positioning || {}, null, 2)}

Marketing Strategy:
${JSON.stringify(context.knowledgeBase?.marketingStrategy || {}, null, 2)}

Intake Data:
- Core Offer: ${context.intakeData?.coreOfferSummary || "Not specified"}
- Top Objection: ${context.intakeData?.topObjection || "Not specified"}

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

/**
 * /summarize-sops → Creates 1-page SOP summary
 */
async function handleSummarizeSops(openai: OpenAI, context: any): Promise<string> {
  const systemPrompt = `You are an operations specialist. Create a concise 1-page SOP summary based on the business operations data.

The summary should include:
1. **Key Processes** - Main workflows and procedures
2. **Tools & Platforms** - CRM, software, systems used
3. **Communication Protocols** - How to communicate, when, with whom
4. **Quality Standards** - What "done" looks like
5. **Common Pitfalls** - What to avoid

Keep it to 1 page, actionable, and easy to reference.`;

  const userPrompt = `Create a 1-page SOP summary for this business:

Operations:
${JSON.stringify(context.knowledgeBase?.operations || {}, null, 2)}

Intake Data:
- Customer Journey: ${context.intakeData?.customerJourney || "Not specified"}
- Primary CRM: ${context.intakeData?.primaryCRM || "Not specified"}
- Support Email: ${context.intakeData?.supportEmail || "Not specified"}
- Booking Link: ${context.intakeData?.bookingLink || "Not specified"}

Onboarding Assessment Card:
${context.cards
  .find((c: BusinessCard) => c.type === "ONBOARDING_ASSESSMENT_CARD")
  ?.description || "Not available"}

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

/**
 * /content-brief → Generates creative brief for content
 */
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

  const userPrompt = `Generate a creative brief for content creation:

Brand Voice:
${JSON.stringify(context.knowledgeBase?.brandVoice || {}, null, 2)}

Positioning:
${JSON.stringify(context.knowledgeBase?.positioning || {}, null, 2)}

Content Framework:
${JSON.stringify(context.knowledgeBase?.contentFramework || {}, null, 2)}

Compliance:
${JSON.stringify(context.knowledgeBase?.compliance || {}, null, 2)}

Content Production Card:
${context.cards
  .find((c: BusinessCard) => c.type === "CONTENT_PRODUCTION_CARD")
  ?.description || "Not available"}

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

// ============================================================================
// MAIN POST HANDLER
// ============================================================================

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ businessBrainId: string; conversationId: string }> }
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "OpenAI API key not configured.",
        },
        { status: 500 }
      );
    }

    const { businessBrainId, conversationId } = await params;

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

    // Check if message is a slash command
    const isSlashCommand = content.startsWith("/");
    let commandName: string | null = null;
    
    if (isSlashCommand) {
      const commandMatch = content.match(/^\/(\w+(-?\w+)*)/);
      if (commandMatch) {
        commandName = commandMatch[1];
      }
    }

    const [conversation, businessBrain] = await Promise.all([
      prisma.businessConversation.findFirst({
        where: {
          id: conversationId,
          brainId: businessBrainId,
          userOrganizationId: { in: userOrganizationIds },
        },
      }),
      prisma.businessBrain.findFirst({
        where: {
          id: businessBrainId,
          userOrganizationId: { in: userOrganizationIds },
        },
        select: {
          id: true,
          intakeData: true,
          knowledgeBase: true,
          cards: {
            orderBy: { orderIndex: "asc" },
          },
        },
      }),
    ]);

    if (!conversation) {
      return NextResponse.json(
        {
          success: false,
          error: "Conversation not found or access denied.",
        },
        { status: 404 }
      );
    }

    if (!businessBrain) {
      return NextResponse.json(
        {
          success: false,
          error: "Business brain not found or access denied.",
        },
        { status: 404 }
      );
    }

    const nextSequenceNumber = conversation.messageCount + 1;

    // Initialize OpenAI client early (needed for commands)
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Handle slash commands
    if (isSlashCommand && commandName) {
      try {
        // Execute command handler
        const commandResult = await handleSlashCommand(
          commandName,
          openai,
          businessBrain,
          conversationId,
          nextSequenceNumber
        );

        // Save user message
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
            attachments: body.attachments || undefined,
          },
        });

        // Save assistant response
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
              tokenCount: commandResult.content.length / 4, // Rough estimate
            },
            cardCitations: commandResult.citations as any,
          },
        });

        // Update conversation
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
            citations: commandResult.citations,
            confidence: 90, // Commands have high confidence
          },
          intent: {
            category: "command",
            relevantCards: commandResult.citations.map((c) => c.cardId),
            confidence: 100,
            reasoning: `Executed command: /${commandName}`,
          },
          cards: [],
          cardRelevance: {},
          conversationHistory: [],
          conversation: {
            id: conversationId,
            messageCount: nextSequenceNumber + 1,
            activeCardIds: commandResult.citations.map((c) => c.cardId),
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

    // Normal chat flow continues below
    const intent = await analyzeUserIntent(content, businessBrain.cards);

    const cardData = loadCardsByRelevance(businessBrain.cards, intent);

    const cardIdMap = new Map<string, string>();
    for (const card of businessBrain.cards) {
      cardIdMap.set(`${card.type}:${card.title}`, card.id);
    }

    const loadedCardIds = cardData.loadedCards
      .filter((c) => c.relevance >= 40)
      .map((c) => cardIdMap.get(`${c.type}:${c.title}`))
      .filter((id): id is string => id !== undefined);

    const existingActiveCards = conversation.activeCardIds || [];
    const newActiveCards = [
      ...loadedCardIds,
      ...existingActiveCards.filter(
        (id: string) => !loadedCardIds.includes(id)
      ),
    ];

    const uniqueActiveCards = Array.from(new Set(newActiveCards));

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
        metadata: true,
      },
    });

    const historyChronological = conversationHistory.reverse();

    const systemPrompt = buildSystemPrompt(
      businessBrain,
      cardData.loadedCards,
      conversation.contextSummary
    );

    // OpenAI client already initialized above (for commands)

    // Build messages array for OpenAI
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: systemPrompt }];

    // Add conversation history (excluding system prompts, only user/assistant pairs)
    for (const msg of historyChronological) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    // Add current user message
    messages.push({
      role: "user",
      content: content,
    });

    // Step 8a: Create user message first (quick operation, outside transaction)
    const userMessage = await prisma.businessMessage.create({
      data: {
        conversationId: conversationId,
        role: "user",
        content: content,
        sequenceNumber: nextSequenceNumber,
        metadata: {
          intent: intent,
          cardRelevance: cardData.cardRelevance,
          analyzedAt: new Date().toISOString(),
        },
        attachments: body.attachments || undefined, // Prisma requires undefined, not null
      },
    });

    // Step 8b: Call OpenAI API (outside transaction to avoid timeout)
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
      // If OpenAI fails, we still have the user message saved
      // We could optionally delete it, but keeping it for audit trail
      throw new Error(
        `Failed to generate AI response: ${
          openaiError.message || "Unknown error"
        }`
      );
    }

    // Step 8c: Extract card citations from AI response
    const citations = extractCardCitations(
      aiResponse,
      cardData.loadedCards,
      businessBrain.cards
    );

    // Step 8d: Calculate response confidence
    const confidence = calculateResponseConfidence(
      citations,
      cardData.cardRelevance,
      businessBrain.cards as BusinessCard[],
      !!businessBrain.knowledgeBase
    );

    // Step 8e: Save assistant message and update conversation in transaction
    // This transaction is quick (no OpenAI calls), so it won't timeout
    const result = await prisma.$transaction(async (tx) => {
      // Save assistant message
      const assistantSequenceNumber = nextSequenceNumber + 1;
      const assistantMessage = await tx.businessMessage.create({
        data: {
          conversationId: conversationId,
          role: "assistant",
          content: aiResponse,
          sequenceNumber: assistantSequenceNumber,
          metadata: {
            cardsReferenced: citations.map((c) => c.cardId),
            confidenceScore: confidence,
            model: CONFIG.MODEL,
            tokenCount: totalTokens,
            promptTokens: promptTokens,
            completionTokens: completionTokens,
          },
          cardCitations: citations as any, // Prisma JsonValue type
          generatedArtifacts: undefined,
        },
      });

      // Update conversation state with active card management
      // Track which cards were actually used in the response
      const usedCardIds = citations.map((c) => c.cardId);

      // Remove cards not cited in recent messages (decay mechanism)
      const recentMessages = await tx.businessMessage.findMany({
        where: { conversationId },
        orderBy: { sequenceNumber: "desc" },
        take: CONFIG.ACTIVE_CARDS_DECAY_MESSAGES,
        select: { cardCitations: true },
      });

      const recentlyUsedCardIds = new Set<string>();
      for (const msg of recentMessages) {
        if (msg.cardCitations && Array.isArray(msg.cardCitations)) {
          for (const citation of msg.cardCitations as unknown as CardCitation[]) {
            if (
              citation &&
              typeof citation === "object" &&
              "cardId" in citation
            ) {
              recentlyUsedCardIds.add(citation.cardId);
            }
          }
        }
      }

      // Merge: keep recently used cards + new citations + high relevance cards
      const updatedActiveCardIds = Array.from(
        new Set([
          ...usedCardIds, // Cards used in this response
          ...uniqueActiveCards.filter((id) => recentlyUsedCardIds.has(id)), // Keep recently used
          ...loadedCardIds.filter((id) => {
            const card = businessBrain.cards.find((c) => c.id === id);
            return (
              card &&
              (cardData.cardRelevance[id] || 0) >= CONFIG.HIGH_CARD_RELEVANCE
            );
          }), // Keep high relevance cards
        ])
      );

      const updatedConversation = await tx.businessConversation.update({
        where: { id: conversationId },
        data: {
          messageCount: { increment: 2 }, // User message + assistant message
          lastMessageAt: new Date(),
          activeCardIds: updatedActiveCardIds,
        },
      });

      return {
        assistantMessage,
        updatedConversation,
      };
    });

    const newMessageCount = result.updatedConversation.messageCount;
    let contextSummary = result.updatedConversation.contextSummary;
    
    // Generate context summary if threshold is met
    if (
      newMessageCount >= CONFIG.CONTEXT_SUMMARY_THRESHOLD &&
      newMessageCount % CONFIG.CONTEXT_SUMMARY_INTERVAL === 0
    ) {
      try {
        const generatedSummary = await generateContextSummary(conversationId, newMessageCount);
        if (generatedSummary) {
          contextSummary = generatedSummary;
        }
      } catch (summaryError) {
        console.error("[Message POST] Failed to generate context summary:", summaryError);
        // Continue execution even if summary generation fails
      }
    }

    // Combine results
    const finalResult = {
      userMessage,
      assistantMessage: result.assistantMessage,
      aiResponse,
      citations,
      confidence,
      promptTokens,
      completionTokens,
      totalTokens,
      updatedConversation: result.updatedConversation,
      contextSummary,
    };

    return NextResponse.json({
      success: true,
      message: finalResult.userMessage,
      assistantMessage: {
        id: finalResult.assistantMessage.id,
        content: finalResult.aiResponse,
        citations: finalResult.citations,
        confidence: finalResult.confidence,
      },
      intent: intent,
      cards: cardData.loadedCards,
      cardRelevance: cardData.cardRelevance,
      conversationHistory: historyChronological,
      conversation: {
        id: finalResult.updatedConversation.id,
        messageCount: finalResult.updatedConversation.messageCount,
        activeCardIds: finalResult.updatedConversation.activeCardIds,
        contextSummary: finalResult.contextSummary,
      },
    });
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

/**
 * Build system prompt for Business Conversation AI
 *
 * Includes:
 * 1. Role definition with business name
 * 2. Full knowledge base JSON
 * 3. Loaded card content (based on relevance)
 * 4. Behavioral rules
 * 5. Context summary (if available)
 */
function buildSystemPrompt(
  businessBrain: {
    intakeData: any;
    knowledgeBase: any;
  },
  loadedCards: Array<{
    type: string;
    title: string;
    relevance: number;
    content: string;
  }>,
  contextSummary: string | null
): string {
  // Extract business name from intakeData or knowledgeBase
  const businessName =
    businessBrain.knowledgeBase?.businessOverview?.name ||
    businessBrain.knowledgeBase?.businessOverview?.publicName ||
    businessBrain.intakeData?.businessName ||
    businessBrain.intakeData?.companyName ||
    "this business";

  let prompt = `You are an AI assistant with deep knowledge of ${businessName}.\n\n`;

  // 2. KNOWLEDGE BASE
  prompt += `=== KNOWLEDGE BASE ===\n`;
  if (businessBrain.knowledgeBase) {
    prompt += `\nThe following is the complete knowledge base for ${businessName}:\n\n`;
    prompt += JSON.stringify(businessBrain.knowledgeBase, null, 2);
    prompt += `\n\n`;
  } else {
    prompt += `\nNote: Knowledge base is not yet synthesized. Using intake data only.\n`;
    if (businessBrain.intakeData) {
      prompt += `\nIntake Data:\n${JSON.stringify(
        businessBrain.intakeData,
        null,
        2
      )}\n\n`;
    }
  }

  // 3. LOADED CARD CONTENT
  prompt += `=== KNOWLEDGE CARDS ===\n`;
  prompt += `\nThe following knowledge cards are relevant to the current conversation:\n\n`;

  if (loadedCards.length === 0) {
    prompt += `No cards loaded for this conversation.\n\n`;
  } else {
    for (const card of loadedCards) {
      prompt += `\n--- ${card.title} (${card.type}) ---\n`;
      prompt += `Relevance: ${card.relevance}%\n`;

      if (card.relevance >= 80) {
        prompt += `[FULL CARD - Description + Metadata]\n`;
      } else if (card.relevance >= 40) {
        prompt += `[EXCERPT - First 500 characters]\n`;
      } else {
        prompt += `[TITLE ONLY]\n`;
      }

      prompt += `${card.content}\n`;
    }
    prompt += `\n`;
  }

  // 4. BEHAVIORAL RULES
  prompt += `=== BEHAVIORAL RULES ===\n`;
  prompt += `\nYou MUST follow these instructions:\n\n`;
  prompt += `1. ALWAYS cite which knowledge card(s) your answer uses.\n`;
  prompt += `   Example: "Based on the Brand Voice card..." or "According to the Compliance Rules card..."\n\n`;
  prompt += `2. Follow the Brand Voice card's style patterns EXACTLY.\n`;
  prompt += `   - Use the vocabulary, tone, and rhetorical patterns specified.\n`;
  prompt += `   - Avoid forbidden words and phrases.\n`;
  prompt += `   - Match the formality level and relationship dynamics.\n\n`;
  prompt += `3. If compliance rules apply to the user's question, mention them EXPLICITLY.\n`;
  prompt += `   - Reference required disclaimers when relevant.\n`;
  prompt += `   - Warn about forbidden claims.\n`;
  prompt += `   - Provide legal guidance from the Compliance Rules card.\n\n`;
  prompt += `4. Stay STRICTLY within the boundaries of the provided knowledge base and cards.\n`;
  prompt += `   - Do NOT fabricate details outside the provided information.\n`;
  prompt += `   - If information is not available, say "This information is not available in the knowledge base."\n`;
  prompt += `   - Do NOT invent pricing, customer details, competitors, or other factual data.\n\n`;
  prompt += `5. Use the knowledge base to provide accurate, contextual responses.\n`;
  prompt += `   - Reference specific sections when relevant (e.g., "According to the positioning strategy...").\n`;
  prompt += `   - Cross-reference related concepts (e.g., link objections to positioning, ICPs to content).\n\n`;

  // 5. CONTEXT SUMMARY (optional)
  if (contextSummary) {
    prompt += `=== CONTEXT SUMMARY ===\n`;
    prompt += `\nThe following is a summary of important points from previous conversation turns:\n\n`;
    prompt += `${contextSummary}\n\n`;
  }

  prompt += `\n=== END OF SYSTEM PROMPT ===\n`;
  prompt += `\nNow respond to the user's message following all the rules above.\n`;

  return prompt;
}

/**
 * Extract card citations from AI response
 * Analyzes the response to determine which cards influenced it
 */
function extractCardCitations(
  aiResponse: string,
  loadedCards: LoadedCard[],
  allCards: BusinessCard[]
): CardCitation[] {
  const citations: CardCitation[] = [];

  // Cache lowercased response for single-pass analysis
  const responseLower = aiResponse.toLowerCase();

  // Check each loaded card for references in the response
  for (const loadedCard of loadedCards) {
    // Find the original card to get its ID
    const originalCard = allCards.find(
      (c) => c.type === loadedCard.type && c.title === loadedCard.title
    );

    if (!originalCard) continue;

    let citationStrength = 0;
    const excerpts: string[] = [];

    // Check for direct card name references
    const cardNamePatterns = [
      loadedCard.title.toLowerCase(),
      loadedCard.type.toLowerCase().replace(/_/g, " "),
      loadedCard.type.toLowerCase(),
    ];

    for (const pattern of cardNamePatterns) {
      if (responseLower.includes(pattern)) {
        citationStrength += 30;
        // Extract context around the mention
        const index = responseLower.indexOf(pattern);
        const context = aiResponse.substring(
          Math.max(0, index - 50),
          Math.min(aiResponse.length, index + pattern.length + 50)
        );
        excerpts.push(context.trim());
        break;
      }
    }

    // Check for content patterns from high-relevance cards
    if (loadedCard.relevance >= 80) {
      // For high-relevance cards, check if response follows card patterns
      const cardContent = loadedCard.content.toLowerCase();

      // Extract key phrases from card metadata (if available)
      if (cardContent.includes("metadata")) {
        // Try to match vocabulary, rules, or patterns from the card
        const vocabularyMatch = cardContent.match(
          /forbidden[_-]?words?[:\s]+\[(.*?)\]/i
        );
        if (vocabularyMatch) {
          const words = vocabularyMatch[1]
            .split(",")
            .map((w: string) => w.trim().toLowerCase());
          const foundWords = words.filter(
            (w: string) => !responseLower.includes(w)
          );
          if (foundWords.length < words.length) {
            citationStrength += 20; // Response avoids forbidden words
          }
        }
      }

      // Check if response structure matches card guidelines
      if (
        cardContent.includes("brand voice") ||
        cardContent.includes("style")
      ) {
        // Look for tone indicators
        if (responseLower.includes("you") || responseLower.includes("your")) {
          citationStrength += 10; // Direct address pattern
        }
      }
    }

    // If citation strength is significant, add it
    if (citationStrength >= 30) {
      const cardConfidence = Math.min(citationStrength, 100);
      citations.push({
        cardId: originalCard.id,
        cardType: loadedCard.type,
        excerpts: excerpts.length > 0 ? excerpts : [loadedCard.title],
        confidence: cardConfidence,
      });
    }
  }

  return citations;
}

/**
 * Calculate overall response confidence
 * Formula: (card_confidence × 0.5) + (relevance_score × 0.3) + (citation_strength × 0.2)
 *
 * If no card citations but knowledge base is used, return higher base confidence
 */
function calculateResponseConfidence(
  citations: CardCitation[],
  cardRelevance: Record<string, number>,
  allCards: BusinessCard[],
  hasKnowledgeBase: boolean
): number {
  // If no card citations but knowledge base exists, response might still be accurate
  if (citations.length === 0) {
    // Distinguish between "low confidence" and "no card citations needed"
    return hasKnowledgeBase ? 65 : 50; // Higher base if KB available
  }

  // Calculate weighted average across all citations
  let totalWeightedConfidence = 0;
  let totalWeight = 0;

  for (const citation of citations) {
    const originalCard = allCards.find((c) => c.id === citation.cardId);
    if (!originalCard) continue;

    // Get card confidence score from metadata
    const cardConfidence =
      (originalCard.metadata?.confidence_score as number) || 70;

    // Get relevance score
    const relevanceScore = cardRelevance[citation.cardId] || 50;

    // Citation strength (from extractCardCitations)
    const citationStrength = citation.confidence;

    // Calculate weighted confidence for this citation
    const weightedConfidence =
      cardConfidence * 0.5 + relevanceScore * 0.3 + citationStrength * 0.2;

    totalWeightedConfidence += weightedConfidence;
    totalWeight += 1;
  }

  // Average across all citations
  const overallConfidence =
    totalWeight > 0 ? totalWeightedConfidence / totalWeight : 50;

  return Math.round(overallConfidence);
}

/**
 * Smart card loading strategy based on relevance
 *
 * Relevance Rules:
 * - ≥80%: Full description + all metadata + priority
 * - 40-79%: First 500 chars of description only (no metadata, no priority)
 * - <40%: Title only (skip description and metadata)
 */
function loadCardsByRelevance(
  cards: any[],
  intent: {
    category: string;
    relevantCards: string[];
    confidence: number;
  }
): {
  loadedCards: Array<{
    type: string;
    title: string;
    relevance: number;
    content: string;
  }>;
  cardRelevance: Record<string, number>;
} {
  const cardRelevance: Record<string, number> = {};
  const loadedCards: Array<{
    type: string;
    title: string;
    relevance: number;
    content: string;
  }> = [];

  // Calculate relevance score for each card
  for (const card of cards) {
    let relevance = 0;

    // High relevance: Card is in relevantCards list
    if (intent.relevantCards.includes(card.id)) {
      relevance = Math.min(80 + intent.confidence / 5, 100);
    } else {
      // Medium relevance: Card type matches intent category
      const categoryToCardTypes: Record<string, string[]> = {
        content_generation: ["BRAND_VOICE_CARD", "STYLE_RULES"],
        business_info: ["POSITIONING_CARD"],
        compliance: ["COMPLIANCE_RULES"],
        technical_setup: ["GHL_IMPLEMENTATION_NOTES"],
      };

      const relevantTypes = categoryToCardTypes[intent.category] || [];
      if (relevantTypes.includes(card.type)) {
        relevance = 40 + intent.confidence / 2;
      } else {
        // Low relevance: Other cards
        relevance = 20;
      }
    }

    cardRelevance[card.id] = Math.round(relevance);

    // Determine content based on relevance
    let content = "";

    if (relevance >= 80) {
      // Full description + metadata + priority
      const metadataStr = card.metadata
        ? `\n\nMetadata:\n${JSON.stringify(card.metadata, null, 2)}`
        : "";
      const priorityStr = card.priority ? `\n\nPriority: ${card.priority}` : "";
      content = `${card.description}${metadataStr}${priorityStr}`;
    } else if (relevance >= 40) {
      // First 500 characters of description only (no metadata, no priority)
      content = card.description.substring(0, 500);
      if (card.description.length > 500) {
        content += "...";
      }
    } else {
      // Title only (skip description and metadata entirely)
      content = card.title;
    }

    // Include all cards (even <40% gets title only)
    loadedCards.push({
      type: card.type,
      title: card.title,
      relevance: Math.round(relevance),
      content: content,
    });
  }

  return {
    loadedCards,
    cardRelevance,
  };
}

/**
 * Analyze user intent to determine which cards are relevant
 */
async function analyzeUserIntent(
  userMessage: string,
  cards: any[]
): Promise<{
  category:
    | "content_generation"
    | "business_info"
    | "compliance"
    | "technical_setup"
    | "general";
  relevantCards: string[];
  confidence: number;
  reasoning: string;
}> {
  // Map card types to categories
  const cardTypeMap: Record<string, string> = {
    BRAND_VOICE_CARD: "content_generation",
    STYLE_RULES: "content_generation",
    POSITIONING_CARD: "business_info",
    COMPLIANCE_RULES: "compliance",
    GHL_IMPLEMENTATION_NOTES: "technical_setup",
  };

  // Initialize OpenAI if available
  let openai: OpenAI | null = null;
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Quick keyword-based analysis (fallback if OpenAI fails)
  const messageLower = userMessage.toLowerCase();

  const keywordPatterns = {
    content_generation: [
      "write",
      "create",
      "generate",
      "content",
      "email",
      "post",
      "article",
      "copy",
      "tone",
      "voice",
      "style",
      "brand voice",
      "sounds like",
      "how to write",
      "draft",
      "compose",
      "messaging",
      "copywriting",
    ],
    business_info: [
      "target",
      "audience",
      "customer",
      "positioning",
      "competitor",
      "differentiation",
      "value proposition",
      "who is",
      "what is",
      "why",
      "market",
      "strategy",
      "icp",
      "ideal customer",
      "offer",
      "pricing",
    ],
    compliance: [
      "compliance",
      "legal",
      "disclaimer",
      "forbidden",
      "claim",
      "regulation",
      "risk",
      "liability",
      "terms",
      "legal terms",
      "can i say",
      "allowed to",
    ],
    technical_setup: [
      "ghl",
      "go high level",
      "crm",
      "pipeline",
      "workflow",
      "automation",
      "template",
      "setup",
      "configure",
      "integration",
      "technical",
    ],
  };

  // Count keyword matches for each category
  const categoryScores: Record<string, number> = {
    content_generation: 0,
    business_info: 0,
    compliance: 0,
    technical_setup: 0,
  };

  for (const [category, keywords] of Object.entries(keywordPatterns)) {
    for (const keyword of keywords) {
      if (messageLower.includes(keyword)) {
        categoryScores[category] = (categoryScores[category] || 0) + 1;
      }
    }
  }

  // Use AI for more accurate analysis if available
  if (openai) {
    try {
      const systemPrompt = `You are an intent classifier for a business AI assistant. Analyze the user's message and determine:

1. What is the user asking for?
   - content_generation: Writing, content creation, brand voice, style, tone, copywriting
   - business_info: Target audience, positioning, competitors, value proposition, market strategy
   - compliance: Legal questions, disclaimers, forbidden claims, regulations, risk
   - technical_setup: CRM setup, GHL (GoHighLevel), workflows, pipelines, automations, templates
   - general: General questions, greetings, unclear intent

2. Which business cards are relevant? (Card types: BRAND_VOICE_CARD, STYLE_RULES, POSITIONING_CARD, COMPLIANCE_RULES, GHL_IMPLEMENTATION_NOTES)

Return JSON:
{
  "category": "content_generation" | "business_info" | "compliance" | "technical_setup" | "general",
  "relevantCardTypes": ["BRAND_VOICE_CARD", "STYLE_RULES"],
  "confidence": 85,
  "reasoning": "User is asking about writing style, so brand voice and style rules are relevant"
}`;

      const result = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analyze this user message: "${userMessage}"`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 300,
      });

      const aiAnalysis = JSON.parse(result.choices[0].message.content || "{}");

      // Map card types to card IDs
      const relevantCardIds = cards
        .filter((card) => aiAnalysis.relevantCardTypes?.includes(card.type))
        .map((card) => card.id);

      return {
        category: aiAnalysis.category || "general",
        relevantCards: relevantCardIds,
        confidence: aiAnalysis.confidence || 70,
        reasoning: aiAnalysis.reasoning || "AI analysis",
      };
    } catch (aiError) {
      console.warn(
        "[Intent Analysis] AI analysis failed, using keyword fallback:",
        aiError
      );
      // Fall through to keyword-based analysis
    }
  }

  // Keyword-based fallback
  const maxScore = Math.max(...Object.values(categoryScores));
  const detectedCategory =
    maxScore > 0
      ? (Object.entries(categoryScores).find(
          ([_, score]) => score === maxScore
        )?.[0] as any) || "general"
      : "general";

  // Map category to relevant card types
  const categoryToCardTypes: Record<string, string[]> = {
    content_generation: ["BRAND_VOICE_CARD", "STYLE_RULES"],
    business_info: ["POSITIONING_CARD"],
    compliance: ["COMPLIANCE_RULES"],
    technical_setup: ["GHL_IMPLEMENTATION_NOTES"],
    general: [],
  };

  const relevantCardTypes = categoryToCardTypes[detectedCategory] || [];
  const relevantCardIds = cards
    .filter((card) => relevantCardTypes.includes(card.type))
    .map((card) => card.id);

  return {
    category: detectedCategory,
    relevantCards: relevantCardIds,
    confidence: maxScore > 0 ? Math.min(60 + maxScore * 5, 90) : 50,
    reasoning: `Keyword-based analysis detected ${detectedCategory} intent`,
  };
}

/**
 * Generate context summary for long conversations
 * This helps maintain context without loading all messages
 */
async function generateContextSummary(
  conversationId: string,
  messageCount: number
): Promise<string | null> {
  try {
    // Get recent messages for summary
    const recentMessages = await prisma.businessMessage.findMany({
      where: { conversationId },
      orderBy: { sequenceNumber: "desc" },
      take: Math.min(messageCount, 20), // Last 20 messages or all if less
      select: {
        role: true,
        content: true,
        sequenceNumber: true,
      },
    });

    if (recentMessages.length === 0) return null;

    // Initialize OpenAI if available
    if (!process.env.OPENAI_API_KEY) {
      return null; // Can't generate summary without OpenAI
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const messagesText = recentMessages
      .reverse() // Reverse to chronological order
      .map(
        (msg: { role: string; content: string }) =>
          `${msg.role}: ${msg.content.substring(0, 200)}`
      )
      .join("\n\n");

    const systemPrompt = `You are a conversation summarizer. Create a concise summary (2-3 sentences) of the key topics and context from this conversation. Focus on:
- Main topics discussed
- Key decisions or conclusions
- Important context for future messages

Keep it brief and actionable.`;

    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Summarize this conversation:\n\n${messagesText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    await prisma.businessConversation.update({
      where: { id: conversationId },
      data: {
        contextSummary: result.choices[0].message.content?.trim() || null,
      },
    });

    return result.choices[0].message.content?.trim() || null;
  } catch (error) {
    console.warn("[Context Summary] Failed to generate summary:", error);
    return null;
  }
}
