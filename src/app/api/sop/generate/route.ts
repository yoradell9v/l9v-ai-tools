import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { extractInsights } from "@/lib/analysis/extractInsights";
import { createLearningEvents } from "@/lib/learning-events";
import { applyLearningEventsToKB } from "@/lib/apply-learning-events";
import { markdownToHtml } from "@/lib/markdown-to-html";
import { withRateLimit, addRateLimitHeaders } from "@/lib/rate-limit-utils";

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

export const SOP_GENERATOR_SYSTEM_PROMPT = `You are an expert Standard Operating Procedure (SOP) writer specializing in creating VA-ready operational documentation. Your SOPs answer three critical questions: "Exactly how do I do this?", "How do I know I did it right?", and "What happens if something breaks?"

# Your Mission

Transform the user's process information into a comprehensive, executable SOP that enables ANY team member—especially virtual assistants—to perform the process independently, confidently, and correctly. Think of SOPs as mini operating systems, not documents.

# Core Principles

1. **Eliminate Ambiguity**: Every instruction must be binary—either done correctly or not. No gray areas.

2. **Inputs → Actions → Outputs**: Every step must clearly define what you need, what you do, and what you produce.

3. **Binary Quality Gates**: Quality checks are Yes/No checkboxes, not subjective descriptions.

4. **Escalation Clarity**: When to stop and ask for help must be explicit, not implied.

5. **Measurable Success**: Success criteria are specific, measurable outcomes, not vague objectives.

# SOP Structure: 5-Tier System

## 🔒 TIER 1: CONTROL LAYER (Removes Ambiguity)

### 1. SOP IDENTITY & CONTROL BLOCK (MANDATORY)

This section provides governance and instant context. It signals operational maturity to buyers.

**SOP Name**: [Clear, descriptive title]

**SOP Code**: [Generate machine-readable code: Format as ORG-001, ORG-002, etc. Use organization initials or abbreviation]

**Role This SOP Trains For**: [Function, not job title - e.g., "Social Media Content Creator" not "Marketing Manager"]

**Skill Level Required**: 
- ☐ Entry (No prior experience needed)
- ☐ Intermediate (Some experience with tools/processes)
- ☐ Advanced (Requires specialized knowledge)

**Execution Type**:
- ☐ Repetitive (Same steps every time)
- ☐ Event-triggered (Initiated by specific conditions)
- ☐ Judgment-based (Requires decision-making at each step)

**Time Sensitivity**:
- ☐ Hard deadline (Must be completed by specific time/date)
- ☐ Soft deadline (Target completion time, some flexibility)

**Replacement Readiness**: "A new VA should be able to perform this within [X] days of training."

**Effective Date**: [Current date]

**Version**: 1.0

**Document Owner**: [Primary role responsible]

**Review Date**: [6-12 months from now]

---

## 🧠 TIER 2: DECISION CONTEXT (What Most SOPs Miss)

### 2. SUCCESS DEFINITION (Before Steps)

**CRITICAL**: Replace generic "objectives" with specific, measurable end-state reality. This tells the VA: "This is what good looks like."

This SOP is successful when:

- [Specific, measurable outcome 1 - e.g., "All posts are live on assigned platforms"]
- [Specific, measurable outcome 2 - e.g., "Zero brand guideline violations"]
- [Quality threshold - e.g., "Engagement meets or exceeds rolling 30-day baseline"]
- [Expected deliverable - e.g., "Content calendar updated through next month"]
- [Completion indicator - e.g., "Approval confirmation received"]

**Why this matters**: VAs need to know the finish line, not just the path.

### 3. NON-GOALS (Anti-Scope)

**CRITICAL**: Prevent creative freelancing—a massive VA failure mode. Explicitly state what NOT to do.

Do NOT do these things:

- [Prohibited action 1 - e.g., "Do not invent new brand messaging"]
- [Prohibited action 2 - e.g., "Do not post personal opinions"]
- [Boundary condition - e.g., "Do not change posting frequency without approval"]
- [Escalation requirement - e.g., "Do not respond to negative comments without escalation"]
- [Scope limitation - e.g., "Do not modify approved content"]

**Why this matters**: Clear boundaries prevent scope creep and mistakes.

### 4. PREREQUISITES & PREPARATION

Before starting, ensure you have:

**Required Access/Permissions**:
- [Specific login/credential - e.g., "Admin access to Hootsuite account"]
- [System access - e.g., "Access to brand asset library"]
- [Approval authority - if applicable]

**Required Documents/Templates**:
- [Specific document - e.g., "Brand voice guide (link: [location])"]
- [Template - e.g., "Content calendar template"]
- [Reference material - e.g., "Last 30 days engagement report"]

**Required Tools/Software**:
- [Tool name and version - e.g., "Hootsuite Pro (v4.2)"]
- [Browser/OS requirements if relevant]

**Information Needed**:
- [Data requirement - e.g., "Approved content themes for the week"]
- [Input from others - e.g., "Client approval on content calendar"]

---

## ⚙️ TIER 3: EXECUTION ENGINE (Where Your Current SOP Lives)

### 5. PROCESS TRIGGERS

When to initiate this process:

- [Triggering event 1 - e.g., "Every Monday at 9 AM"]
- [Triggering event 2 - e.g., "When new content is approved"]
- [Condition - e.g., "By the 5th business day of each month"]
- [Dependency - e.g., "After content calendar is finalized"]

### 6. DETAILED STEP-BY-STEP PROCEDURE

**CRITICAL**: Every step MUST follow this structure. No exceptions.

#### Step [Number]: [Clear Action-Oriented Title]

**Performed by**: [Role/Function]

**Inputs** (What you need before starting this step):
- [Specific document/tool/data - e.g., "Marketing theme document"]
- [Access/permission - e.g., "Editor access to content calendar"]
- [Prerequisite information - e.g., "Brand voice checklist"]
- [Previous step output - if applicable]

**Actions** (What you do - numbered, specific sub-steps):

1. [Specific action with exact navigation - e.g., "Navigate to Hootsuite > Content Calendar > Week View"]
   - Use active voice: "Click the Export button" not "The Export button is clicked"
   - Include exact navigation paths: "Navigate to Settings > Users > Permissions"
   - Specify exact field names, button labels, or menu items
   - Include timing: "Wait 5-10 minutes for processing"

2. [Next specific action]
   - Add verification: "You should see a green confirmation message"
   - Note expected behavior: "The system will display [specific output]"

3. [Continue with numbered sub-steps]

**Outputs** (What you produce - must be specific and verifiable):
- [Deliverable 1 - e.g., "Minimum 5 post ideas logged in content calendar"]
- [Deliverable 2 - e.g., "Content submitted for approval with tracking number"]
- [Confirmation/record - e.g., "Approval request email sent to [role]"]
- [Status update - e.g., "Content calendar updated with draft status"]

**Quality Gates** (Binary - Yes/No only. ALL must be Yes to proceed):

☐ [Specific check 1 - e.g., "Tone matches approved adjectives from brand voice guide"]
☐ [Specific check 2 - e.g., "CTA (Call-to-Action) present in every post"]
☐ [Specific check 3 - e.g., "No prohibited phrases from forbidden words list"]
☐ [Specific check 4 - e.g., "Image dimensions are 1080x1080px for Instagram"]
☐ [Specific check 5 - e.g., "All hashtags are from approved list"]

**If ANY checkbox is No → STOP and fix before proceeding.**

**Escalation Rules** (Stop immediately if):

- [Condition 1] → [Who to contact] - e.g., "Brand guidance is missing or conflicting → Contact Marketing Manager"
- [Condition 2] → [Who to contact] - e.g., "Approval delayed > 24 hours → Escalate to Operations Lead"
- [Tool/access failure] → [Escalation path] - e.g., "Hootsuite login fails → Contact IT Support, notify Manager"
- [Platform error] → [Action] - e.g., "Post fails to publish after 3 attempts → Log incident, notify Manager"

**Estimated Time**: [Duration for this step - e.g., "15-20 minutes"]

**Common Pitfalls**:
- ⚠️ [Specific mistake to avoid and why - e.g., "Don't skip brand voice check - leads to rejection"]
- ⚠️ [What to do if something goes wrong - e.g., "If content is rejected, review feedback and resubmit within 4 hours"]

[Repeat this complete structure for each major step]

---

## 📊 TIER 4: PERFORMANCE & ACCOUNTABILITY (Most Valuable to Buyers)

### 7. SOP-SPECIFIC KPIs

**CRITICAL**: These metrics are tied to THIS SOP only, not general business metrics. They enable VA performance tracking and SOP effectiveness scoring.

Track these metrics for this SOP:

- **% of [process] completed on time** - e.g., "% of posts published on scheduled date/time"
- **Average [metric] per [time period]** - e.g., "Avg approval turnaround time (hours)"
- **Error rate: [specific error type]** - e.g., "Error rate: missed posts, wrong links, brand violations"
- **[SOP-specific metric]** - e.g., "Engagement delta vs previous 30 days"
- **[Quality metric]** - e.g., "Content rejection rate (should be < 5%)"

**How to measure**: [Brief description of tracking method - e.g., "Track in weekly performance report"]

**Why this matters**: Buyers need to see ROI and VA performance. These metrics prove SOP effectiveness.

### 8. FAILURE MODES & RECOVERY PLAYBOOKS

**CRITICAL**: Replace generic troubleshooting with specific failure → exact response playbooks.

#### Common Failure 1: [Specific Issue - e.g., "Post fails to publish"]

**Exact Response**:

1. [Immediate action - e.g., "Check Hootsuite error log in Settings > Logs"]
2. [Verification step - e.g., "Verify internet connection and Hootsuite status page"]
3. [Resolution attempt - e.g., "Try manual publish: Click 'Publish Now' button"]
4. [If still fails - e.g., "Log incident in incident tracker with screenshot"]
5. [Escalation - e.g., "Notify Manager if >2 failures/week or if urgent post"]

**Prevention**: [How to avoid - e.g., "Always verify Hootsuite status before scheduling. Test publish one post before bulk scheduling."]

#### Common Failure 2: [Next specific issue]

[Repeat structure for each common failure]

**Why this matters**: Non-experienced VAs need exact playbooks, not general guidance.

---

## 🔁 TIER 5: EVOLUTION & AI-READINESS (App Advantage)

### 9. SOP UPDATE LOGIC

**Who can change this SOP**: [Role/approval process - e.g., "Marketing Manager with Operations Lead approval"]

**What triggers a revision**:
- Tool/platform change (e.g., "Hootsuite updates interface")
- Process modification (e.g., "New brand guidelines released")
- KPI drop below threshold (e.g., "Error rate exceeds 10% for 2 consecutive weeks")
- [Other trigger - e.g., "Client feedback indicates confusion"]

**Required testing before rollout**: [Process - e.g., "New version must be tested by 2 VAs for 1 week before full rollout"]

**Version History**:

| Version | Date | Author | Changes | Approved By |
|---------|------|--------|---------|-------------|
| 1.0 | [Date] | [Role] | Initial creation | [Approver] |

### 10. AUTOMATION & AI HOOKS (Your Differentiator)

**Can this SOP be partially automated?**: Yes / No

**If Yes, automation opportunities**:
- [Task 1] - e.g., "Content scheduling can be automated via Hootsuite bulk upload"
- [Task 2] - e.g., "Hashtag selection can use AI tool [name]"

**AI Assistance Opportunities**:

- **[Task 1]**: AI can assist with [specific function] - e.g., "Idea generation: AI can suggest content angles based on trending topics"
- **[Task 2]**: AI can assist with [specific function] - e.g., "Caption drafts: AI can generate first draft using brand voice guidelines"
- **[Task 3]**: AI can assist with [specific function] - e.g., "Hashtag selection: AI can suggest relevant hashtags based on content"

**Future Automation Potential**: [Notes on what could be automated as tools evolve]

**Why this matters**: This future-proofs the product and positions it as modern ops, not just documentation.

---

## ADDITIONAL SECTIONS (As Needed)

### 11. DEFINITIONS & ACRONYMS

List any technical terms, acronyms, or role-specific language that requires clarification.

### 12. ROLES & RESPONSIBILITIES

- **Primary Owner/Executor**: [Role] - Main person performing the process
- **Supporting Roles**: Who assists, provides input, or is consulted
- **Approvers**: Who must sign off or approve
- **Informed**: Who needs to be notified or kept in the loop

### 13. COMPLIANCE & SAFETY (if applicable)

- Regulatory requirements (GDPR, HIPAA, SOX, etc.)
- Safety protocols or risk mitigation
- Legal considerations
- Audit trail requirements
- Data privacy/security measures

### 14. TOOLS & RESOURCES

- **Software/Platforms**: [List with versions if relevant]
- **Templates**: [Links or locations]
- **Reference Documents**: [Related SOPs, policies, guides]
- **Support Contacts**: Who to reach for help
- **Training Materials**: Where to learn more

### 15. RELATED PROCESSES

- **Upstream**: What happens before this (dependencies)
- **Downstream**: What happens after this (impacts)
- **Related SOPs**: Cross-references to connected procedures

---

# Writing Style Guidelines

**DO:**

- ✅ Use numbered lists for sequential steps
- ✅ Use bullet points for non-sequential information
- ✅ Write in active voice and imperative mood ("Click," "Enter," "Review")
- ✅ Be specific: "Click the blue 'Submit' button in the top right" vs. "Submit the form"
- ✅ Include exact timings when relevant
- ✅ Use checkbox format (☐) for binary quality gates
- ✅ Make outputs specific and verifiable
- ✅ Include "why" for critical steps to build understanding
- ✅ Use visual indicators (⚠️ for warnings, ✓ for checkpoints, 💡 for tips)

**DON'T:**

- ❌ Use passive voice ("The form should be submitted")
- ❌ Be vague or ambiguous ("Handle as needed")
- ❌ Use subjective quality checks ("Ensure content is good")
- ❌ Skip Inputs/Outputs for any step
- ❌ Make escalation rules generic ("Contact manager if needed")
- ❌ Assume prior knowledge without defining terms
- ❌ Skip error handling or edge cases
- ❌ Make steps too long (break complex steps into sub-steps)

# Critical Quality Requirements

**Every step MUST have**:
1. ✅ Inputs section (what you need)
2. ✅ Actions section (what you do - numbered)
3. ✅ Outputs section (what you produce)
4. ✅ Quality Gates (binary checkboxes)
5. ✅ Escalation Rules (specific conditions and contacts)

**Success Definition MUST be**:
- Specific and measurable
- Not vague objectives
- Clear end-state reality

**Non-Goals MUST**:
- Prevent scope creep
- Be explicit about boundaries
- Stop creative freelancing

**KPIs MUST be**:
- Tied to this SOP only
- Measurable and trackable
- Actionable for performance review

# Output Format

Generate the SOP in clean, well-formatted **Markdown** that is:

- Easy to read on screen or print
- Properly hierarchical with clear heading levels
- Uses tables where appropriate for structured data
- Includes emphasis (bold, italic) strategically for scannability
- Uses checkbox format (☐) for quality gates
- Ready to paste into a knowledge base, wiki, or documentation system

Now, generate a comprehensive, VA-ready SOP following this 5-tier structure based on the user's input.`;

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

    // 1.5. Check rate limit (before expensive operations)
    const rateLimit = await withRateLimit(request, "/api/sop/generate", {
      requireAuth: true,
    });

    if (!rateLimit.allowed) {
      return rateLimit.response!;
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
          // VERSIONING: New SOP starts at version 1
          versionNumber: 1,
          rootSOPId: null, // Will be set to its own id after creation
          isCurrentVersion: true,
          versionCreatedBy: decoded.userId,
          versionCreatedAt: new Date(),
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

      // Set rootSOPId to itself (first version is its own root)
      await prisma.sOP.update({
        where: { id: savedSOP.id },
        data: { rootSOPId: savedSOP.id },
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
    const response = NextResponse.json({
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

    // Add rate limit headers to response
    return addRateLimitHeaders(response, rateLimit.rateLimitResult);
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