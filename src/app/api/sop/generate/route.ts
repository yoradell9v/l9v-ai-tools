import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { extractInsights } from "@/lib/analysis/extractInsights";
import { createLearningEvents } from "@/lib/learning-events";
import { applyLearningEventsToKB } from "@/lib/apply-learning-events";
import { markdownToHtml } from "@/lib/markdown-to-html";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for markdown to HTML conversion using OpenAI (fallback)
const MARKDOWN_TO_HTML_SYSTEM_PROMPT = `You are a markdown to HTML converter. Your job is to convert markdown content into clean, semantic HTML.

Rules:
1. Convert ALL markdown syntax to proper HTML tags
2. Use semantic HTML5 tags (article, section, header, etc.) where appropriate
3. Preserve all content exactly as provided
4. Add appropriate structure:
   - Headings: h1, h2, h3, h4, h5, h6
   - Paragraphs: <p> tags
   - Lists: <ul> and <ol> with <li> items
   - Code blocks: <pre><code>
   - Inline code: <code>
   - Tables: <table> with <thead>, <tbody>, <tr>, <th>, <td>
   - Bold: <strong>
   - Italic: <em>
   - Links: <a href="...">
   - Blockquotes: <blockquote>
5. Return ONLY the HTML content, no markdown backticks or explanations
6. Do not add <!DOCTYPE>, <html>, <head>, or <body> tags - just the content HTML
7. Ensure proper HTML entity encoding for special characters`;

export const SOP_GENERATOR_SYSTEM_PROMPT = `You are an expert Standard Operating Procedure (SOP) writer with 15+ years of experience creating operational documentation for businesses across all industries. Your SOPs are known for being exceptionally clear, actionable, and practical.

# Your Mission

Transform the user's process information into a comprehensive, professional SOP that ANY team member—even someone completely new—could follow successfully. Your SOP should eliminate ambiguity, prevent mistakes, and ensure consistent execution.

# Core Principles

1. **Clarity over Cleverness**: Use simple, direct language. Avoid jargon unless industry-specific and necessary.

2. **Actionable Steps**: Every step must be concrete and executable. No vague instructions like "handle appropriately."

3. **Anticipate Confusion**: Address potential questions before they arise. Include decision trees for "if/then" scenarios.

4. **Real-World Practical**: SOPs are working documents, not theoretical exercises. Focus on what actually happens on the ground.

5. **Scalable Structure**: Organize information so it's scannable, searchable, and easy to update.

# SOP Structure & Format

## 1. DOCUMENT HEADER

- **SOP Title**: Clear, descriptive title

- **Document ID**: [Auto-generated or placeholder]

- **Version**: 1.0

- **Effective Date**: [Current date]

- **Review Date**: [6-12 months from now]

- **Document Owner**: [Primary role responsible]

- **Last Updated By**: [To be filled]

## 2. EXECUTIVE SUMMARY (2-4 sentences)

Provide a high-level overview answering:

- What is this process?

- Why does it matter?

- What's the end result?

## 3. PURPOSE & SCOPE

### Purpose

- Clearly state what this SOP accomplishes and why it exists

- Connect to broader business objectives when applicable

### Scope

- **Applies to**: Which roles, departments, or situations

- **Does NOT apply to**: Important exclusions or exceptions

- **Frequency**: How often this process is performed

- **Estimated Duration**: How long it typically takes

## 4. DEFINITIONS & ACRONYMS (if applicable)

List any technical terms, acronyms, or role-specific language that requires clarification.

## 5. ROLES & RESPONSIBILITIES

Create a clear RACI or role matrix:

- **Primary Owner/Executor**: [Role] - Main person performing the process

- **Supporting Roles**: Who assists, provides input, or is consulted

- **Approvers**: Who must sign off or approve

- **Informed**: Who needs to be notified or kept in the loop

## 6. PREREQUISITES & PREPARATION

Before starting, ensure you have:

- **Required Access/Permissions**: Logins, credentials, system access

- **Required Documents/Templates**: Links or locations

- **Required Tools/Software**: Specific platforms or applications

- **Information Needed**: Data, approvals, or inputs required upfront

## 7. PROCESS TRIGGERS

When to initiate this process:

- List all triggering events or conditions

- Include timing considerations (e.g., "by the 5th business day of each month")

- Note any dependencies on other processes

## 8. DETAILED STEP-BY-STEP PROCEDURE

This is the heart of the SOP. For each major step:

### Step [Number]: [Clear Action-Oriented Title]

**Objective**: What this step accomplishes

**Performed by**: [Role]

**Instructions**:

1. [Specific, numbered sub-steps with clear actions]

   - Use active voice: "Click the Export button" not "The Export button is clicked"

   - Include exact navigation paths: "Navigate to Settings > Users > Permissions"

   - Specify exact field names, button labels, or menu items

   

2. [Next sub-step]

   - Add screenshots, examples, or templates references where helpful

   - Note timing: "Wait 5-10 minutes for processing"

   - Include verification: "You should see a green confirmation message"

**Decision Points** (if applicable):

- IF [condition], THEN [action]

- ELSE IF [condition], THEN [action]

- ELSE [default action]

**Common Pitfalls**:

- ⚠️ [Specific mistake to avoid and why]

- ⚠️ [What to do if something goes wrong]

**Quality Checkpoint**:

- ✓ [How to verify this step was completed correctly]

- ✓ [What the expected outcome looks like]

**Estimated Time**: [Duration for this step]

[Repeat structure for each major step]

## 9. QUALITY STANDARDS & SUCCESS CRITERIA

How to know the process was completed successfully:

- Specific, measurable outcomes

- Quality thresholds or acceptance criteria

- Expected deliverables or outputs

- What "done correctly" looks like

## 10. COMPLIANCE & SAFETY (if applicable)

- Regulatory requirements (GDPR, HIPAA, SOX, etc.)

- Safety protocols or risk mitigation

- Legal considerations

- Audit trail requirements

- Data privacy/security measures

## 11. TROUBLESHOOTING & FAQS

Anticipate common issues:

**Problem**: [Specific issue]

**Solution**: [Step-by-step resolution]

**Prevention**: [How to avoid in future]

**FAQ**:

- Q: [Common question]

  A: [Clear, actionable answer]

## 12. TOOLS & RESOURCES

- **Software/Platforms**: [List with versions if relevant]

- **Templates**: [Links or locations]

- **Reference Documents**: [Related SOPs, policies, guides]

- **Support Contacts**: Who to reach for help

- **Training Materials**: Where to learn more

## 13. RELATED PROCESSES

- **Upstream**: What happens before this (dependencies)

- **Downstream**: What happens after this (impacts)

- **Related SOPs**: Cross-references to connected procedures

## 14. APPENDICES (if needed)

- Sample forms or templates

- Detailed examples

- Reference tables or matrices

- Screenshots or diagrams

- Escalation paths

## 15. VERSION HISTORY & CHANGE LOG

| Version | Date | Author | Changes | Approved By |

|---------|------|--------|---------|-------------|

| 1.0 | [Date] | [Role] | Initial creation | [Approver] |

# Writing Style Guidelines

**DO:**

- ✅ Use numbered lists for sequential steps

- ✅ Use bullet points for non-sequential information

- ✅ Write in active voice and imperative mood ("Click," "Enter," "Review")

- ✅ Be specific: "Click the blue 'Submit' button in the top right" vs. "Submit the form"

- ✅ Include exact timings when relevant

- ✅ Add visual indicators (⚠️ for warnings, ✓ for checkpoints, 💡 for tips)

- ✅ Cross-reference related sections

- ✅ Use consistent terminology throughout

- ✅ Include "why" for critical steps to build understanding

**DON'T:**

- ❌ Use passive voice ("The form should be submitted")

- ❌ Be vague or ambiguous ("Handle as needed")

- ❌ Assume prior knowledge without defining terms

- ❌ Skip error handling or edge cases

- ❌ Make steps too long (break complex steps into sub-steps)

- ❌ Use outdated or unclear screenshots

- ❌ Forget to explain decision points

# Tone & Voice

- **Professional but Approachable**: Not stuffy or overly formal

- **Confident and Authoritative**: You're the expert guiding them

- **Empathetic**: Acknowledge where confusion might happen

- **Practical**: Focus on real-world execution, not theory

# Context-Specific Adaptations

Based on the industry provided, adapt:

- **Healthcare**: Emphasize compliance, patient privacy, safety protocols

- **Finance**: Focus on accuracy, audit trails, regulatory requirements

- **Legal**: Highlight confidentiality, precedent, risk mitigation

- **Retail/Hospitality**: Emphasize customer experience, speed, consistency

- **Manufacturing**: Focus on safety, quality control, efficiency

- **Technology/SaaS**: Include technical prerequisites, version specificity

# Quality Indicators for Your Output

A great SOP should:

1. Enable a new employee to complete the process independently

2. Reduce errors and rework significantly

3. Ensure consistent outcomes regardless of who performs it

4. Be easy to update as processes evolve

5. Serve as a training tool and reference guide

6. Withstand the "6-month test" (still clear after not using it for months)

# Special Instructions

- If the user provided **minimal information**, do your best to create a functional SOP framework and note areas marked with [REQUIRES DETAIL] where subject matter expert input is needed.

- If **decision points** are mentioned, create clear decision trees with IF/THEN logic.

- If **common mistakes** are noted, integrate warnings and prevention strategies throughout.

- If **compliance requirements** exist, create a dedicated compliance section and flag related steps.

- When user provides a **brain dump or rough notes**, extract the useful information, organize it logically, and transform it into professional documentation.

- For **technical processes**, include specific command syntax, API endpoints, or configuration values when provided.

# Output Format

Generate the SOP in clean, well-formatted **Markdown** that is:

- Easy to read on screen or print

- Properly hierarchical with clear heading levels

- Uses tables where appropriate for structured data

- Includes emphasis (bold, italic) strategically for scannability

- Ready to paste into a knowledge base, wiki, or documentation system

Now, generate a comprehensive, professional SOP based on the user's input.`;

interface SOPFormData {
  sopTitle: string;
  processOverview: string;
  primaryRole: string;
  mainSteps: string;
  toolsUsed: string;
  frequency: string;
  trigger: string;
  successCriteria: string;
  department?: string;
  estimatedTime?: string;
  decisionPoints?: string;
  commonMistakes?: string;
  requiredResources?: string;
  supportingRoles?: string;
  qualityStandards?: string;
  complianceRequirements?: string;
  relatedProcesses?: string;
  tipsBestPractices?: string;
  additionalContext?: string;
}

function buildUserPrompt(
  formData: SOPFormData,
  organizationProfile: any
): string {
  let prompt = `# SOP Generation Request

## Process Information

**SOP Title**: ${formData.sopTitle}

**Process Overview**: ${formData.processOverview}

**Primary Role/Performer**: ${formData.primaryRole}

**Main Steps** (user-provided outline):
${formData.mainSteps}

**Tools/Software Used**: ${formData.toolsUsed}

**Frequency**: ${formData.frequency}

**Process Trigger**: ${formData.trigger}

**Success Criteria**: ${formData.successCriteria}
`;

  // Add optional context fields if provided
  if (formData.department) {
    prompt += `\n**Department/Team**: ${formData.department}`;
  }

  if (formData.estimatedTime) {
    prompt += `\n**Estimated Time to Complete**: ${formData.estimatedTime}`;
  }

  if (formData.decisionPoints) {
    prompt += `\n\n## Decision Points & Variations\n${formData.decisionPoints}`;
  }

  if (formData.commonMistakes) {
    prompt += `\n\n## Common Mistakes & Failure Points\n${formData.commonMistakes}`;
  }

  if (formData.requiredResources) {
    prompt += `\n\n## Required Resources/Documents\n${formData.requiredResources}`;
  }

  if (formData.supportingRoles) {
    prompt += `\n\n## Supporting Roles & Stakeholders\n${formData.supportingRoles}`;
  }

  if (formData.qualityStandards) {
    prompt += `\n\n## Quality Standards\n${formData.qualityStandards}`;
  }

  if (formData.complianceRequirements) {
    prompt += `\n\n## Compliance & Safety Requirements\n${formData.complianceRequirements}`;
  }

  if (formData.relatedProcesses) {
    prompt += `\n\n## Related Processes\n${formData.relatedProcesses}`;
  }

  if (formData.tipsBestPractices) {
    prompt += `\n\n## Tips & Best Practices\n${formData.tipsBestPractices}`;
  }

  if (formData.additionalContext) {
    prompt += `\n\n## Additional Context (Brain Dump)\n${formData.additionalContext}`;
  }

  // Add organization profile context
  if (organizationProfile) {
    prompt += `\n\n## Organization Context\n`;
    
    if (organizationProfile.businessName) {
      prompt += `**Business Name**: ${organizationProfile.businessName}\n`;
    }
    
    if (organizationProfile.website) {
      prompt += `**Website**: ${organizationProfile.website}\n`;
    }
    
    if (organizationProfile.industry) {
      prompt += `**Industry**: ${organizationProfile.industry}`;
      if (organizationProfile.industryOther && organizationProfile.industry.toLowerCase() === "other") {
        prompt += ` - ${organizationProfile.industryOther}`;
      }
      prompt += `\n`;
    }
    
    if (organizationProfile.primaryTools) {
      prompt += `**Organization's Primary Tools**: ${organizationProfile.primaryTools}\n`;
    }
    
    if (organizationProfile.primaryCRM) {
      prompt += `**Primary CRM/Platform**: ${organizationProfile.primaryCRM}\n`;
    }
    
    if (organizationProfile.managementStyle) {
      prompt += `**Management Style**: ${organizationProfile.managementStyle}\n`;
    }
    
    if (organizationProfile.defaultTimezone) {
      prompt += `**Default Timezone**: ${organizationProfile.defaultTimezone}\n`;
    }
    
    if (organizationProfile.isRegulated === "yes") {
      prompt += `**Regulated Industry**: Yes`;
      if (organizationProfile.regulatedIndustryType) {
        prompt += ` (${organizationProfile.regulatedIndustryType})`;
      }
      prompt += `\n`;
    }
    
    if (organizationProfile.forbiddenWords) {
      prompt += `**Forbidden Words/Claims**: ${organizationProfile.forbiddenWords}\n`;
    }
    
    if (organizationProfile.disclaimers) {
      prompt += `**Required Disclaimers**: ${organizationProfile.disclaimers}\n`;
    }
    
    if (organizationProfile.brandVoiceStyle) {
      prompt += `**Brand Voice Style**: ${organizationProfile.brandVoiceStyle}\n`;
    }
    
    if (organizationProfile.riskBoldnessLevel) {
      prompt += `**Risk/Boldness Level**: ${organizationProfile.riskBoldnessLevel}\n`;
    }
  }

  prompt += `\n\nPlease generate a comprehensive, professional SOP following the structure and guidelines provided in the system prompt.`;

  return prompt;
}

/**
 * Convert markdown to HTML using OpenAI as a fallback
 * This is used when the library-based conversion fails or produces poor results
 */
async function convertMarkdownToHtmlWithOpenAI(markdown: string): Promise<string> {
  try {
    console.log("[SOP Generate] Converting markdown to HTML with OpenAI, length:", markdown.length);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast and cheap for conversion
      messages: [
        { role: "system", content: MARKDOWN_TO_HTML_SYSTEM_PROMPT },
        { role: "user", content: markdown },
      ],
      temperature: 0, // Deterministic output
      max_tokens: 16000, // Large enough for full SOP HTML
    });

    let html = completion.choices[0].message.content || "";
    
    // Remove any markdown code fences that might have slipped through
    html = html.replace(/```html\n?/g, "").replace(/```\n?/g, "").trim();
    
    console.log("[SOP Generate] OpenAI HTML conversion complete, length:", html.length);
    
    return html;
  } catch (error) {
    console.error("[SOP Generate] Error converting markdown to HTML with OpenAI:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: "Invalid token." },
        { status: 401 }
      );
    }

    // 2. Get user's organization
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: decoded.userId,
        organization: {
          deactivatedAt: null,
        },
        deactivatedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!userOrg) {
      return NextResponse.json(
        {
          success: false,
          message: "User does not belong to any active organization.",
        },
        { status: 403 }
      );
    }

    // 3. Get organization profile (legacy - using knowledgeBase as fallback)
    // Note: OrganizationProfile model doesn't exist in schema, using knowledgeBase data instead
    let organizationProfile = null;

    // 3.5. Get organization knowledge base (for learning events)
    let knowledgeBase = null;
    let knowledgeBaseVersion: number | null = null;
    let knowledgeBaseSnapshot: any = null;
    try {
      knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
        where: { organizationId: userOrg.organizationId },
        select: {
          id: true,
          version: true,
          // Core Identity
          businessName: true,
          website: true,
          industry: true,
          industryOther: true,
          whatYouSell: true,
          // Business Context
          monthlyRevenue: true,
          teamSize: true,
          primaryGoal: true,
          biggestBottleNeck: true,
          // Customer and Market
          idealCustomer: true,
          topObjection: true,
          coreOffer: true,
          customerJourney: true,
          // Operations and Tools
          toolStack: true,
          primaryCRM: true,
          defaultTimeZone: true,
          bookingLink: true,
          supportEmail: true,
          // Brand & Voice
          brandVoiceStyle: true,
          riskBoldness: true,
          voiceExampleGood: true,
          voiceExamplesAvoid: true,
          contentLinks: true,
          // Compliance
          isRegulated: true,
          regulatedIndustry: true,
          forbiddenWords: true,
          disclaimers: true,
          // HR Defaults
          defaultWeeklyHours: true,
          defaultManagementStyle: true,
          defaultEnglishLevel: true,
          // Proof & Credibility
          proofAssets: true,
          // Additional Context
          pipeLineStages: true,
          emailSignOff: true,
          // Versioning
          lastEditedBy: true,
          lastEditedAt: true,
          contributors: true,
          // Enrichment tracking
          lastEnrichedAt: true,
          enrichmentVersion: true,
        },
      });

      if (knowledgeBase) {
        knowledgeBaseVersion = knowledgeBase.version;
        console.log(`[SOP Generate] Found KB for org ${userOrg.organizationId}, version: ${knowledgeBaseVersion}`);
        
        // Populate organizationProfile from knowledgeBase (for backward compatibility with buildUserPrompt)
        organizationProfile = {
          businessName: knowledgeBase.businessName,
          website: knowledgeBase.website,
          industry: knowledgeBase.industry,
          industryOther: knowledgeBase.industryOther,
          primaryTools: knowledgeBase.toolStack?.join(", ") || null,
          primaryCRM: knowledgeBase.primaryCRM,
          managementStyle: knowledgeBase.defaultManagementStyle,
          defaultTimezone: knowledgeBase.defaultTimeZone,
          isRegulated: knowledgeBase.isRegulated ? "yes" : "no",
          regulatedIndustryType: knowledgeBase.regulatedIndustry,
          forbiddenWords: knowledgeBase.forbiddenWords,
          disclaimers: knowledgeBase.disclaimers,
          brandVoiceStyle: knowledgeBase.brandVoiceStyle,
          riskBoldnessLevel: knowledgeBase.riskBoldness,
        };
        
        // Create snapshot of KB state (non-Json fields only, similar to JD flow)
        knowledgeBaseSnapshot = {
          version: knowledgeBase.version,
          businessName: knowledgeBase.businessName,
          website: knowledgeBase.website,
          industry: knowledgeBase.industry,
          industryOther: knowledgeBase.industryOther,
          whatYouSell: knowledgeBase.whatYouSell,
          monthlyRevenue: knowledgeBase.monthlyRevenue,
          teamSize: knowledgeBase.teamSize,
          primaryGoal: knowledgeBase.primaryGoal,
          biggestBottleNeck: knowledgeBase.biggestBottleNeck,
          idealCustomer: knowledgeBase.idealCustomer,
          topObjection: knowledgeBase.topObjection,
          coreOffer: knowledgeBase.coreOffer,
          customerJourney: knowledgeBase.customerJourney,
          toolStack: knowledgeBase.toolStack,
          primaryCRM: knowledgeBase.primaryCRM,
          defaultTimeZone: knowledgeBase.defaultTimeZone,
          bookingLink: knowledgeBase.bookingLink,
          supportEmail: knowledgeBase.supportEmail,
          brandVoiceStyle: knowledgeBase.brandVoiceStyle,
          riskBoldness: knowledgeBase.riskBoldness,
          voiceExampleGood: knowledgeBase.voiceExampleGood,
          voiceExamplesAvoid: knowledgeBase.voiceExamplesAvoid,
          contentLinks: knowledgeBase.contentLinks,
          isRegulated: knowledgeBase.isRegulated,
          regulatedIndustry: knowledgeBase.regulatedIndustry,
          forbiddenWords: knowledgeBase.forbiddenWords,
          disclaimers: knowledgeBase.disclaimers,
          defaultWeeklyHours: knowledgeBase.defaultWeeklyHours,
          defaultManagementStyle: knowledgeBase.defaultManagementStyle,
          defaultEnglishLevel: knowledgeBase.defaultEnglishLevel,
          proofAssets: knowledgeBase.proofAssets,
          pipeLineStages: knowledgeBase.pipeLineStages,
          emailSignOff: knowledgeBase.emailSignOff,
          lastEditedBy: knowledgeBase.lastEditedBy,
          lastEditedAt: knowledgeBase.lastEditedAt,
          contributors: knowledgeBase.contributors,
          lastEnrichedAt: knowledgeBase.lastEnrichedAt,
          enrichmentVersion: knowledgeBase.enrichmentVersion,
        };
      }
    } catch (error) {
      console.error("[SOP Generate] Error fetching knowledge base:", error);
      // Continue without KB - learning events are optional
    }

    // 4. Parse request body
    const body = await request.json();
    const formData: SOPFormData = {
      sopTitle: body.sopTitle || "",
      processOverview: body.processOverview || "",
      primaryRole: body.primaryRole || "",
      mainSteps: body.mainSteps || "",
      toolsUsed: body.toolsUsed || "",
      frequency: body.frequency || "",
      trigger: body.trigger || "",
      successCriteria: body.successCriteria || "",
      department: body.department || undefined,
      estimatedTime: body.estimatedTime || undefined,
      decisionPoints: body.decisionPoints || undefined,
      commonMistakes: body.commonMistakes || undefined,
      requiredResources: body.requiredResources || undefined,
      supportingRoles: body.supportingRoles || undefined,
      qualityStandards: body.qualityStandards || undefined,
      complianceRequirements: body.complianceRequirements || undefined,
      relatedProcesses: body.relatedProcesses || undefined,
      tipsBestPractices: body.tipsBestPractices || undefined,
      additionalContext: body.additionalContext || undefined,
    };

    // 5. Validate required fields
    if (!formData.sopTitle || !formData.sopTitle.trim()) {
      return NextResponse.json(
        { success: false, message: "SOP Title is required." },
        { status: 400 }
      );
    }

    if (!formData.processOverview || !formData.processOverview.trim()) {
      return NextResponse.json(
        { success: false, message: "Process Overview is required." },
        { status: 400 }
      );
    }

    if (!formData.primaryRole || !formData.primaryRole.trim()) {
      return NextResponse.json(
        { success: false, message: "Primary Role is required." },
        { status: 400 }
      );
    }

    if (!formData.mainSteps || !formData.mainSteps.trim()) {
      return NextResponse.json(
        { success: false, message: "Main Steps are required." },
        { status: 400 }
      );
    }

    if (!formData.toolsUsed || !formData.toolsUsed.trim()) {
      return NextResponse.json(
        { success: false, message: "Tools Used is required." },
        { status: 400 }
      );
    }

    if (!formData.frequency || !formData.frequency.trim()) {
      return NextResponse.json(
        { success: false, message: "Frequency is required." },
        { status: 400 }
      );
    }

    if (!formData.trigger || !formData.trigger.trim()) {
      return NextResponse.json(
        { success: false, message: "Process Trigger is required." },
        { status: 400 }
      );
    }

    if (!formData.successCriteria || !formData.successCriteria.trim()) {
      return NextResponse.json(
        { success: false, message: "Success Criteria is required." },
        { status: 400 }
      );
    }

    // 6. Build user prompt
    const userPrompt = buildUserPrompt(formData, organizationProfile);

    // 7. Call OpenAI API
    let generatedSOP: string = "";
    let generatedSOPHtml: string = "";
    let promptTokens: number = 0;
    let completionTokens: number = 0;
    let totalTokens: number = 0;
    let finishReason: string = "stop";

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SOP_GENERATOR_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7, // Balanced creativity and consistency
        max_tokens: 8000, // Large token budget for comprehensive SOPs
      });

      generatedSOP = completion.choices[0].message.content || "";
      
      if (!generatedSOP) {
        throw new Error("OpenAI returned empty response");
      }

      promptTokens = completion.usage?.prompt_tokens || 0;
      completionTokens = completion.usage?.completion_tokens || 0;
      totalTokens = completion.usage?.total_tokens || 0;
      finishReason = completion.choices[0].finish_reason || "stop";

      // Check if response was truncated
      if (finishReason === "length") {
        console.warn("OpenAI response was truncated due to token limit");
        generatedSOP += "\n\n[Note: This SOP may have been truncated. Consider refining specific sections if needed.]";
      }

      // Convert markdown to HTML for frontend display
      // Try library-based conversion first (fast and free), fallback to OpenAI if needed
      // HTML conversion is REQUIRED - we must have HTML for display
      console.log("[SOP Generate] Converting markdown to HTML, markdown length:", generatedSOP.length);
      
      // First, try the library-based conversion
      try {
        generatedSOPHtml = await markdownToHtml(generatedSOP);
        console.log("[SOP Generate] Library conversion successful, HTML length:", generatedSOPHtml.length);
        
        // Verify we got valid HTML
        if (!generatedSOPHtml || generatedSOPHtml.trim().length === 0) {
          throw new Error("Library conversion returned empty result");
        }
        
        // Check if it actually looks like HTML (has tags)
        if (!generatedSOPHtml.includes("<")) {
          throw new Error("Library conversion did not produce HTML tags");
        }
        
        // Check if it still contains markdown syntax (indicates conversion failed)
        if (generatedSOPHtml.includes("```") && !generatedSOPHtml.includes("<code>")) {
          throw new Error("Library conversion may have failed (contains markdown code fences)");
        }
        
        // Check if the entire content is wrapped in a code block (conversion failed)
        const trimmed = generatedSOPHtml.trim();
        if (trimmed.startsWith('<pre><code') && trimmed.includes('language-markdown')) {
          throw new Error("Library conversion failed - entire content wrapped in code block");
        }
        
        // Check if it's just escaped markdown (conversion failed)
        if (trimmed.startsWith('<pre>') && !trimmed.includes('<h') && !trimmed.includes('<p>') && !trimmed.includes('<ul>')) {
          throw new Error("Library conversion failed - result is escaped markdown, not HTML");
        }
      } catch (libraryError: any) {
        console.warn("[SOP Generate] Library conversion failed or produced poor results, falling back to OpenAI:", libraryError.message);
        
        // Fallback to OpenAI conversion - this MUST succeed
        try {
          generatedSOPHtml = await convertMarkdownToHtmlWithOpenAI(generatedSOP);
          console.log("[SOP Generate] OpenAI fallback conversion successful, HTML length:", generatedSOPHtml.length);
          
          // Verify OpenAI conversion result
          if (!generatedSOPHtml || generatedSOPHtml.trim().length === 0) {
            throw new Error("OpenAI conversion returned empty result");
          }
        } catch (openaiError: any) {
          console.error("[SOP Generate] Both HTML conversion methods failed:", openaiError);
          // This is a critical error - we need HTML for display
          throw new Error(`Failed to convert markdown to HTML: ${openaiError.message || "Unknown error"}`);
        }
      }
      
      // Final verification - HTML is required and must be valid HTML (not markdown)
      if (!generatedSOPHtml || generatedSOPHtml.trim().length === 0) {
        throw new Error("HTML conversion failed - no HTML content generated");
      }
      
      // Critical validation: ensure it's actually HTML, not markdown
      if (!generatedSOPHtml.includes("<")) {
        console.error("[SOP Generate] Generated HTML does not contain HTML tags - appears to be markdown");
        console.error("[SOP Generate] Preview:", generatedSOPHtml.substring(0, 500));
        throw new Error("HTML conversion failed - output is not valid HTML (missing HTML tags)");
      }
      
      // Check for markdown syntax that shouldn't be in HTML
      if (generatedSOPHtml.includes("```") && !generatedSOPHtml.includes("<code>")) {
        console.error("[SOP Generate] Generated HTML contains markdown code fences - conversion may have failed");
        console.error("[SOP Generate] Preview:", generatedSOPHtml.substring(0, 500));
        throw new Error("HTML conversion failed - output contains markdown syntax");
      }
      
      console.log("[SOP Generate] HTML validation passed - valid HTML generated, length:", generatedSOPHtml.length);
    } catch (openaiError: any) {
      console.error("[SOP Generate] OpenAI API error:", openaiError);
      return NextResponse.json(
        {
          success: false,
          message: `Failed to generate SOP: ${openaiError.message || "Unknown error"}`,
        },
        { status: 500 }
      );
    }

    // 7.5. Extract insights from generated SOP (non-blocking)
    let contributedInsights: any[] = [];
    try {
      const sopDataForExtraction = {
        sopContent: generatedSOP,
        content: {
          markdown: generatedSOP,
        },
        intakeData: formData,
        organizationProfile: organizationProfile,
        metadata: {
          title: formData.sopTitle,
          generatedAt: new Date().toISOString(),
          tokens: {
            prompt: promptTokens,
            completion: completionTokens,
            total: totalTokens,
          },
        },
      };

      contributedInsights = extractInsights("SOP_GENERATION", sopDataForExtraction);
      
      console.log(`[SOP Generate] Extracted ${contributedInsights.length} insights from SOP`);
    } catch (insightError: any) {
      console.error("[SOP Generate] Error extracting insights (non-blocking):", insightError);
      // Continue without insights - SOP generation should still succeed
    }

    // 8. Save SOP to database
    let savedSOP = null;
    try {
      savedSOP = await prisma.sOP.create({
        data: {
          userOrganizationId: userOrg.id,
          organizationId: userOrg.organizationId, // Add organizationId
          title: formData.sopTitle,
          content: {
            html: generatedSOPHtml, // Store only HTML (primary format)
            version: "1.0",
            generatedAt: new Date().toISOString(),
          },
          intakeData: formData as any,
          usedKnowledgeBaseVersion: knowledgeBaseVersion ?? undefined,
          knowledgeBaseSnapshot: knowledgeBaseSnapshot ?? undefined,
          contributedInsights: contributedInsights.length > 0 ? contributedInsights : undefined,
          metadata: {
            tokens: {
              prompt: promptTokens,
              completion: completionTokens,
              total: totalTokens,
            },
            model: "gpt-4o",
            temperature: 0.7,
            maxTokens: 8000,
            finishReason: finishReason,
            organizationProfileUsed: organizationProfile !== null,
            organizationProfileSnapshot: organizationProfile || null, // Store in metadata
            generatedAt: new Date().toISOString(),
          },
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      });

      // Log KB metadata that was saved
      if (knowledgeBaseVersion || knowledgeBaseSnapshot || contributedInsights.length > 0) {
        console.log(`[SOP Generate] Saved SOP ${savedSOP.id} with KB metadata:`, {
          usedKnowledgeBaseVersion: knowledgeBaseVersion,
          hasSnapshot: !!knowledgeBaseSnapshot,
          insightsCount: contributedInsights.length,
        });
      }
    } catch (dbError: any) {
      console.error("[SOP Generate] Database save error:", dbError);
      // Don't fail the request if save fails - still return the SOP
      // Log the error for monitoring
    }

    // 9. Create learning events and apply to knowledge base (non-blocking)
    if (
      savedSOP &&
      contributedInsights.length > 0 &&
      knowledgeBase
    ) {
      try {
        const learningEventsResult = await createLearningEvents({
          knowledgeBaseId: knowledgeBase.id,
          sourceType: "SOP_GENERATION",
          sourceId: savedSOP.id,
          insights: contributedInsights,
          triggeredBy: userOrg.id,
        });

        if (learningEventsResult.success) {
          console.log(
            `[SOP Generate] Created ${learningEventsResult.eventsCreated} LearningEvents for SOP ${savedSOP.id}`
          );

          // Apply learning events to KB immediately (light enrichment for MVP)
          try {
            const enrichmentResult = await applyLearningEventsToKB({
              knowledgeBaseId: knowledgeBase.id,
              minConfidence: 80, // MVP: only high confidence insights
            });

            if (enrichmentResult.success) {
              console.log(
                `[SOP Generate] Applied ${enrichmentResult.eventsApplied} learning events to KB ${knowledgeBase.id}. ` +
                `Updated fields: ${enrichmentResult.fieldsUpdated.join(", ") || "none"}. ` +
                `Enrichment version: ${enrichmentResult.enrichmentVersion}`
              );
            } else {
              console.warn(
                `[SOP Generate] Failed to apply some learning events:`,
                enrichmentResult.errors
              );
            }
          } catch (enrichmentError) {
            // Don't fail the request if enrichment fails (non-critical)
            console.error(
              "[SOP Generate] Error applying learning events to KB (non-critical):",
              enrichmentError
            );
          }
        } else {
          console.warn(
            `[SOP Generate] Failed to create some LearningEvents:`,
            learningEventsResult.errors
          );
        }
      } catch (learningEventError) {
        // Don't fail the request if learning events fail (non-critical)
        console.error("[SOP Generate] Error creating LearningEvents (non-critical):", learningEventError);
      }
    }

    // 10. Return success response with HTML only
    console.log("[SOP Generate] Returning response, sopHtml length:", generatedSOPHtml?.length || 0);
    return NextResponse.json({
      success: true,
      sopHtml: generatedSOPHtml, // Return only HTML (primary format)
      sopId: savedSOP?.id || null,
      metadata: {
        title: formData.sopTitle,
        generatedAt: new Date().toISOString(),
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens,
        },
        organizationProfileUsed: organizationProfile !== null,
      },
    });
  } catch (error: any) {
    console.error("[SOP Generate] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Internal server error.",
      },
      { status: 500 }
    );
  }
}