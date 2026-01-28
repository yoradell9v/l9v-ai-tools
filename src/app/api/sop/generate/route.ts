import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/core/prisma";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/core/auth";
import { extractInsights } from "@/lib/analysis/extractInsights";
import { createLearningEvents } from "@/lib/learning/learning-events";
import { applyLearningEventsToKB } from "@/lib/learning/apply-learning-events";
import { markdownToHtml } from "@/lib/extraction/markdown-to-html";
import { withRateLimit, addRateLimitHeaders } from "@/lib/rate-limiting/rate-limit-utils";
import { CONFIDENCE_THRESHOLDS } from "@/lib/knowledge-base/insight-confidence-thresholds";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

## TIER 1: CONTROL LAYER (Removes Ambiguity)

### 1. SOP IDENTITY & CONTROL BLOCK (MANDATORY)

This section provides governance and instant context. It signals operational maturity to buyers.

**SOP Name**: [Clear, descriptive title]

**SOP Code**: [Generate machine-readable code: Format as ORG-001, ORG-002, etc. Use organization initials or abbreviation]

**Role This SOP Trains For**: [Function, not job title - e.g., "Social Media Content Creator" not "Marketing Manager"]

**Skill Level Required**: 
- [ ] Entry (No prior experience needed)
- [ ] Intermediate (Some experience with tools/processes)
- [ ] Advanced (Requires specialized knowledge)

**Execution Type**:
- [ ] Repetitive (Same steps every time)
- [ ] Event-triggered (Initiated by specific conditions)
- [ ] Judgment-based (Requires decision-making at each step)

**Time Sensitivity**:
- [ ] Hard deadline (Must be completed by specific time/date)
- [ ] Soft deadline (Target completion time, some flexibility)

**Replacement Readiness**: "A new VA should be able to perform this within [X] days of training."

**Effective Date**: [Current date]

**Version**: 1.0

**Document Owner**: [Primary role responsible]

**Review Date**: [6-12 months from now]

---

## TIER 2: DECISION CONTEXT (What Most SOPs Miss)

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

## TIER 3: EXECUTION ENGINE (Where Your Current SOP Lives)

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

- [ ] [Specific check 1 - e.g., "Tone matches approved adjectives from brand voice guide"]
- [ ] [Specific check 2 - e.g., "CTA (Call-to-Action) present in every post"]
- [ ] [Specific check 3 - e.g., "No prohibited phrases from forbidden words list"]
- [ ] [Specific check 4 - e.g., "Image dimensions are 1080x1080px for Instagram"]
- [ ] [Specific check 5 - e.g., "All hashtags are from approved list"]

**If ANY checkbox is No → STOP and fix before proceeding.**

**Escalation Rules** (Stop immediately if):

- [Condition 1] → [Who to contact] - e.g., "Brand guidance is missing or conflicting → Contact Marketing Manager"
- [Condition 2] → [Who to contact] - e.g., "Approval delayed > 24 hours → Escalate to Operations Lead"
- [Tool/access failure] → [Escalation path] - e.g., "Hootsuite login fails → Contact IT Support, notify Manager"
- [Platform error] → [Action] - e.g., "Post fails to publish after 3 attempts → Log incident, notify Manager"

**Estimated Time**: [Duration for this step - e.g., "15-20 minutes"]

**Common Pitfalls**:
- [Specific mistake to avoid and why - e.g., "Don't skip brand voice check - leads to rejection"]
- [What to do if something goes wrong - e.g., "If content is rejected, review feedback and resubmit within 4 hours"]

[Repeat this complete structure for each major step]

---

## TIER 4: PERFORMANCE & ACCOUNTABILITY (Most Valuable to Buyers)

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

## TIER 5: EVOLUTION & AI-READINESS (App Advantage)

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

- Use numbered lists for sequential steps
- Use bullet points for non-sequential information
- Write in active voice and imperative mood ("Click," "Enter," "Review")
- Be specific: "Click the blue 'Submit' button in the top right" vs. "Submit the form"
- Include exact timings when relevant
- Use checkbox format ([ ]) for binary quality gates
- Make outputs specific and verifiable
- Include "why" for critical steps to build understanding

**DON'T:**

- Use passive voice ("The form should be submitted")
- Be vague or ambiguous ("Handle as needed")
- Use subjective quality checks ("Ensure content is good")
- Skip Inputs/Outputs for any step
- Make escalation rules generic ("Contact manager if needed")
- Assume prior knowledge without defining terms
- Skip error handling or edge cases
- Make steps too long (break complex steps into sub-steps)

# Critical Quality Requirements

**Every step MUST have**:
1. Inputs section (what you need)
2. Actions section (what you do - numbered)
3. Outputs section (what you produce)
4. Quality Gates (binary checkboxes)
5. Escalation Rules (specific conditions and contacts)

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
- Uses checkbox format ([ ]) for quality gates
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
  knowledgeBase: any,
  jobAnalysis?: { analysis: any; intakeData?: any } | null
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

  // Add job analysis context if provided
  if (jobAnalysis && jobAnalysis.analysis) {
    const analysis = jobAnalysis.analysis;
    const intakeData = jobAnalysis.intakeData || {};
    
    prompt += `\n\n## Linked Job Description Analysis\n`;
    prompt += `This SOP is being created for the role defined in the following job analysis:\n\n`;
    
    // Service type and role title
    const serviceType = analysis.preview?.service_type || analysis.full_package?.service_structure?.service_type || "Virtual Assistant";
    const roleTitle = analysis.preview?.role_title || 
                     analysis.full_package?.service_structure?.dedicated_va_role?.title ||
                     analysis.full_package?.service_structure?.core_va_role?.title ||
                     "Role";
    
    prompt += `**Role Title**: ${roleTitle}\n`;
    prompt += `**Service Type**: ${serviceType}\n`;
    
    if (intakeData.businessName) {
      prompt += `**Business Name**: ${intakeData.businessName}\n`;
    }
    
    // Primary outcome
    if (analysis.preview?.primary_outcome) {
      prompt += `**Primary Outcome**: ${analysis.preview.primary_outcome}\n`;
    }
    
    // Tasks and responsibilities
    const serviceStructure = analysis.full_package?.service_structure;
    if (serviceStructure?.dedicated_va_role?.task_allocation?.from_intake) {
      prompt += `\n**Key Tasks & Responsibilities**:\n`;
      const tasks = serviceStructure.dedicated_va_role.task_allocation.from_intake;
      if (Array.isArray(tasks)) {
        tasks.forEach((task: string) => {
          prompt += `- ${task}\n`;
        });
      }
    } else if (serviceStructure?.dedicated_va_role?.recurring_tasks) {
      prompt += `\n**Recurring Tasks**:\n`;
      const tasks = serviceStructure.dedicated_va_role.recurring_tasks;
      if (Array.isArray(tasks)) {
        tasks.forEach((task: string) => {
          prompt += `- ${task}\n`;
        });
      }
    }
    
    // Skills and requirements
    if (serviceStructure?.dedicated_va_role?.skill_requirements) {
      const skills = serviceStructure.dedicated_va_role.skill_requirements;
      if (skills.required && skills.required.length > 0) {
        prompt += `\n**Required Skills**: ${skills.required.join(", ")}\n`;
      }
      if (skills.nice_to_have && skills.nice_to_have.length > 0) {
        prompt += `**Nice-to-Have Skills**: ${skills.nice_to_have.join(", ")}\n`;
      }
    }
    
    // Hours and work structure
    const hoursPerWeek = analysis.preview?.hours_per_week || 
                        serviceStructure?.dedicated_va_role?.hours_per_week ||
                        intakeData.weeklyHours ||
                        "40";
    prompt += `**Hours per Week**: ${hoursPerWeek}\n`;
    
    // Tools mentioned in analysis
    if (intakeData.tools) {
      const tools = typeof intakeData.tools === 'string' ? intakeData.tools.split(',').map((t: string) => t.trim()) : intakeData.tools;
      if (tools && tools.length > 0) {
        prompt += `**Tools/Software**: ${Array.isArray(tools) ? tools.join(", ") : tools}\n`;
      }
    }
    
    // Management style and reporting
    if (serviceStructure?.dedicated_va_role?.interaction_model) {
      const interaction = serviceStructure.dedicated_va_role.interaction_model;
      if (interaction.reports_to) {
        prompt += `**Reports To**: ${interaction.reports_to}\n`;
      }
      if (interaction.sync_needs) {
        prompt += `**Sync Needs**: ${interaction.sync_needs}\n`;
      }
    }
    
    // Core responsibility
    if (serviceStructure?.dedicated_va_role?.core_responsibility) {
      prompt += `\n**Core Responsibility**: ${serviceStructure.dedicated_va_role.core_responsibility}\n`;
    }
    
    prompt += `\n**Note**: When generating this SOP, incorporate the role details, tasks, and requirements from the job analysis above. The SOP should be tailored specifically for this ${roleTitle} role.`;
  }

  if (knowledgeBase) {
    prompt += `\n\n## Organization Context\n`;
    
    if (knowledgeBase.businessName) {
      prompt += `**Business Name**: ${knowledgeBase.businessName}\n`;
    }
    
    if (knowledgeBase.website) {
      prompt += `**Website**: ${knowledgeBase.website}\n`;
    }
    
    if (knowledgeBase.industry) {
      prompt += `**Industry**: ${knowledgeBase.industry}`;
      if (knowledgeBase.industryOther && knowledgeBase.industry.toLowerCase() === "other") {
        prompt += ` - ${knowledgeBase.industryOther}`;
      }
      prompt += `\n`;
    }
    
    if (knowledgeBase.toolStack && knowledgeBase.toolStack.length > 0) {
      prompt += `**Organization's Primary Tools**: ${knowledgeBase.toolStack.join(", ")}\n`;
    }
    
    if (knowledgeBase.primaryCRM) {
      prompt += `**Primary CRM/Platform**: ${knowledgeBase.primaryCRM}\n`;
    }
    
    if (knowledgeBase.defaultManagementStyle) {
      prompt += `**Management Style**: ${knowledgeBase.defaultManagementStyle}\n`;
    }
    
    if (knowledgeBase.defaultTimeZone) {
      prompt += `**Default Timezone**: ${knowledgeBase.defaultTimeZone}\n`;
    }
    
    if (knowledgeBase.isRegulated) {
      prompt += `**Regulated Industry**: Yes`;
      if (knowledgeBase.regulatedIndustry) {
        prompt += ` (${knowledgeBase.regulatedIndustry})`;
      }
      prompt += `\n`;
    }
    
    if (knowledgeBase.forbiddenWords) {
      prompt += `**Forbidden Words/Claims**: ${knowledgeBase.forbiddenWords}\n`;
    }
    
    if (knowledgeBase.disclaimers) {
      prompt += `**Required Disclaimers**: ${knowledgeBase.disclaimers}\n`;
    }
    
    if (knowledgeBase.brandVoiceStyle) {
      prompt += `**Brand Voice Style**: ${knowledgeBase.brandVoiceStyle}\n`;
    }
    
    if (knowledgeBase.riskBoldness) {
      prompt += `**Risk/Boldness Level**: ${knowledgeBase.riskBoldness}\n`;
    }
  }

  prompt += `\n\nPlease generate a comprehensive, professional SOP following the structure and guidelines provided in the system prompt.`;

  return prompt;
}

async function convertMarkdownToHtmlWithOpenAI(markdown: string): Promise<string> {
  try {
    console.log("[SOP Generate] Converting markdown to HTML with OpenAI, length:", markdown.length);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: MARKDOWN_TO_HTML_SYSTEM_PROMPT },
        { role: "user", content: markdown },
      ],
      temperature: 0,
      max_tokens: 16000,
    });

    let html = completion.choices[0].message.content || "";
    
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

    // TEMPORARILY DISABLED FOR TESTING
    // const rateLimit = await withRateLimit(request, "/api/sop/generate", {
    //   requireAuth: true,
    // });

    // if (!rateLimit.allowed) {
    //   return rateLimit.response!;
    // }
    
    // Create a dummy rateLimit object for the response headers
    const rateLimit = { rateLimitResult: null };

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

    let knowledgeBase = null;
    let knowledgeBaseVersion: number | null = null;
    let knowledgeBaseSnapshot: any = null;
    try {
      knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
        where: { organizationId: userOrg.organizationId },
        select: {
          id: true,
          version: true,
          businessName: true,
          website: true,
          industry: true,
          industryOther: true,
          whatYouSell: true,
          monthlyRevenue: true,
          teamSize: true,
          primaryGoal: true,
          biggestBottleNeck: true,
          idealCustomer: true,
          topObjection: true,
          coreOffer: true,
          customerJourney: true,
          toolStack: true,
          primaryCRM: true,
          defaultTimeZone: true,
          bookingLink: true,
          supportEmail: true,
          brandVoiceStyle: true,
          riskBoldness: true,
          voiceExampleGood: true,
          voiceExamplesAvoid: true,
          contentLinks: true,
          isRegulated: true,
          regulatedIndustry: true,
          forbiddenWords: true,
          disclaimers: true,
          defaultWeeklyHours: true,
          defaultManagementStyle: true,
          defaultEnglishLevel: true,
          proofAssets: true,
          pipeLineStages: true,
          emailSignOff: true,
          lastEditedBy: true,
          lastEditedAt: true,
          contributors: true,
          lastEnrichedAt: true,
          enrichmentVersion: true,
        },
      });

      if (knowledgeBase) {
        knowledgeBaseVersion = knowledgeBase.version;
        console.log(`[SOP Generate] Found KB for org ${userOrg.organizationId}, version: ${knowledgeBaseVersion}`);
        
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
    }

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

    // Check if jobAnalysisId is provided and fetch the job analysis
    let jobAnalysis: { analysis: any; intakeData?: any } | null = null;
    if (body.jobAnalysisId) {
      try {
        const savedAnalysis = await prisma.savedAnalysis.findUnique({
          where: { id: body.jobAnalysisId },
          select: {
            analysis: true,
            intakeData: true,
          },
        });
        if (savedAnalysis && savedAnalysis.analysis) {
          jobAnalysis = {
            analysis: savedAnalysis.analysis,
            intakeData: savedAnalysis.intakeData || {},
          };
        }
      } catch (error) {
        console.error("[SOP Generate] Error fetching job analysis:", error);
        // Continue without job analysis if fetch fails
      }
    }

    // Check if we're saving existing HTML (from chat) instead of generating new
    const existingSOPHtml = body.existingSOPHtml;
    // Determine save behavior:
    // - saveAsDraft: true = Save as draft (isDraft: true, isCurrentVersion: false)
    // - saveAsDraft: false AND saveAndPublish: true = Save and publish (isDraft: false, isCurrentVersion: true)
    // - Neither set = Don't save, just return the generated SOP for frontend to show Save buttons
    const saveAsDraft = body.saveAsDraft === true;
    const saveAndPublish = body.saveAndPublish === true;
    const shouldSave = saveAsDraft || saveAndPublish;

    // If saving existing HTML, skip field validation (it's already generated)
    // Otherwise, validate required fields
    if (!existingSOPHtml) {
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
          { success: false, message: "Main Steps is required." },
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
    } else {
      // For existing HTML, only validate title is present
      if (!formData.sopTitle || !formData.sopTitle.trim()) {
        return NextResponse.json(
          { success: false, message: "SOP Title is required." },
          { status: 400 }
        );
      }
    }

    let generatedSOP: string = "";
    let generatedSOPHtml: string = "";
    let promptTokens: number = 0;
    let completionTokens: number = 0;
    let totalTokens: number = 0;
    let finishReason: string = "stop";

    // If existing HTML is provided (from chat), skip generation
    if (existingSOPHtml && existingSOPHtml.trim().length > 0) {
      console.log("[SOP Generate] Using existing HTML from chat, skipping generation");
      generatedSOPHtml = existingSOPHtml;
      // Set minimal token values since we didn't generate
      promptTokens = 0;
      completionTokens = 0;
      totalTokens = 0;
      finishReason = "stop";
    } else {
      // Normal generation flow
      const userPrompt = buildUserPrompt(formData, knowledgeBase, jobAnalysis);

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: SOP_GENERATOR_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7, 
          max_tokens: 8000,
        });

      generatedSOP = completion.choices[0].message.content || "";
      
      if (!generatedSOP) {
        throw new Error("OpenAI returned empty response");
      }

      promptTokens = completion.usage?.prompt_tokens || 0;
      completionTokens = completion.usage?.completion_tokens || 0;
      totalTokens = completion.usage?.total_tokens || 0;
      finishReason = completion.choices[0].finish_reason || "stop";
  
      if (finishReason === "length") {
        console.warn("OpenAI response was truncated due to token limit");
        generatedSOP += "\n\n[Note: This SOP may have been truncated. Consider refining specific sections if needed.]";
      }

      console.log("[SOP Generate] Converting markdown to HTML, markdown length:", generatedSOP.length);
      
      try {
        generatedSOPHtml = await markdownToHtml(generatedSOP);
        console.log("[SOP Generate] Library conversion successful, HTML length:", generatedSOPHtml.length);
      
        if (!generatedSOPHtml || generatedSOPHtml.trim().length === 0) {
          throw new Error("Library conversion returned empty result");
        }
        
        if (!generatedSOPHtml.includes("<")) {
          throw new Error("Library conversion did not produce HTML tags");
        }
        
        if (generatedSOPHtml.includes("```") && !generatedSOPHtml.includes("<code>")) {
          throw new Error("Library conversion may have failed (contains markdown code fences)");
        }
        
        const trimmed = generatedSOPHtml.trim();
        if (trimmed.startsWith('<pre><code') && trimmed.includes('language-markdown')) {
          throw new Error("Library conversion failed - entire content wrapped in code block");
        }
       
        if (trimmed.startsWith('<pre>') && !trimmed.includes('<h') && !trimmed.includes('<p>') && !trimmed.includes('<ul>')) {
          throw new Error("Library conversion failed - result is escaped markdown, not HTML");
        }
      } catch (libraryError: any) {
        console.warn("[SOP Generate] Library conversion failed or produced poor results, falling back to OpenAI:", libraryError.message);
        
        try {
          generatedSOPHtml = await convertMarkdownToHtmlWithOpenAI(generatedSOP);
          console.log("[SOP Generate] OpenAI fallback conversion successful, HTML length:", generatedSOPHtml.length);
          
          if (!generatedSOPHtml || generatedSOPHtml.trim().length === 0) {
            throw new Error("OpenAI conversion returned empty result");
          }
        } catch (openaiError: any) {
          console.error("[SOP Generate] Both HTML conversion methods failed:", openaiError);
          throw new Error(`Failed to convert markdown to HTML: ${openaiError.message || "Unknown error"}`);
        }
      }
      
      if (!generatedSOPHtml || generatedSOPHtml.trim().length === 0) {
        throw new Error("HTML conversion failed - no HTML content generated");
      }
    
      if (!generatedSOPHtml.includes("<")) {
        console.error("[SOP Generate] Generated HTML does not contain HTML tags - appears to be markdown");
        console.error("[SOP Generate] Preview:", generatedSOPHtml.substring(0, 500));
        throw new Error("HTML conversion failed - output is not valid HTML (missing HTML tags)");
      }
      
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
    }

    let contributedInsights: any[] = [];
    if (!existingSOPHtml && generatedSOP) {
      try {
        const sopDataForExtraction = {
          sopContent: generatedSOP,
          content: {
            markdown: generatedSOP,
          },
          intakeData: formData,
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

        contributedInsights = await extractInsights("SOP_GENERATION", sopDataForExtraction);
        
        console.log(`[SOP Generate] Extracted ${contributedInsights.length} insights from SOP`);
      } catch (insightError: any) {
        console.error("[SOP Generate] Error extracting insights (non-blocking):", insightError);
      }
    }

    // If publishing (not draft), set all other versions of this SOP to not current
    // Only update versioning if we're actually saving AND publishing
    if (shouldSave && saveAndPublish) {
      try {
        // Find any existing published SOPs with the same title and set them to not current
        await prisma.sOP.updateMany({
          where: {
            organizationId: userOrg.organizationId,
            isDraft: false, // Only update published SOPs, not drafts
            title: formData.sopTitle,
            isCurrentVersion: true,
          },
          data: {
            isCurrentVersion: false,
          },
        });
      } catch (updateError) {
        console.warn("[SOP Generate] Error updating existing versions (non-blocking):", updateError);
      }
    }
    
    let savedSOP = null;
    
    // If updating an existing draft (has sopId and saving as draft), update it instead of creating new
    let isUpdatingDraft = false;
    if (shouldSave && saveAsDraft && body.sopId) {
      try {
        const existingSOP = await prisma.sOP.findUnique({
          where: { id: body.sopId },
          select: { isDraft: true },
        });
        
        if (existingSOP?.isDraft) {
          isUpdatingDraft = true;
          // Update existing draft
          savedSOP = await prisma.sOP.update({
            where: { id: body.sopId },
            data: {
              title: formData.sopTitle,
              content: {
                html: generatedSOPHtml,
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
                knowledgeBaseUsed: knowledgeBase !== null,
                knowledgeBaseVersion: knowledgeBaseVersion,
                knowledgeBaseSnapshot: knowledgeBaseSnapshot || null,
                generatedAt: new Date().toISOString(),
              },
            },
            select: {
              id: true,
              title: true,
              createdAt: true,
              versionNumber: true,
            },
          });
        }
      } catch (updateError) {
        console.warn("[SOP Generate] Error updating draft (non-blocking):", updateError);
        // Fall through to create new draft
      }
    }
    
    // Only save to database if explicitly requested (and not updating existing draft)
    let calculatedVersionNumber: number | undefined = undefined;
    if (shouldSave && !isUpdatingDraft) {
      try {
        // Determine version number: drafts don't get version numbers, published do
        let versionNumber = 1;
        let rootSOPId: string | null = null;
        
        if (saveAndPublish) {
          // For published SOPs, find the highest version number for this title
          const existingPublished = await prisma.sOP.findFirst({
            where: {
              organizationId: userOrg.organizationId,
              title: formData.sopTitle,
              isDraft: false,
            },
            orderBy: {
              versionNumber: 'desc',
            },
          });
          
          if (existingPublished) {
            versionNumber = existingPublished.versionNumber + 1;
            rootSOPId = existingPublished.rootSOPId || existingPublished.id;
          }
        }
        
        savedSOP = await prisma.sOP.create({
          data: {
            userOrganizationId: userOrg.id,
            organizationId: userOrg.organizationId,
            title: formData.sopTitle,
            content: {
              html: generatedSOPHtml, 
              version: "1.0",
              generatedAt: new Date().toISOString(),
            },
            intakeData: formData as any,
            usedKnowledgeBaseVersion: knowledgeBaseVersion ?? undefined,
            knowledgeBaseSnapshot: knowledgeBaseSnapshot ?? undefined,
            contributedInsights: contributedInsights.length > 0 ? contributedInsights : undefined,
            versionNumber: saveAndPublish ? versionNumber : 1, // Only version published SOPs
            rootSOPId: rootSOPId,
            isCurrentVersion: saveAndPublish, // Only published SOPs can be current version
            isDraft: saveAsDraft, // Explicit draft flag
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
            knowledgeBaseUsed: knowledgeBase !== null,
            knowledgeBaseVersion: knowledgeBaseVersion,
            knowledgeBaseSnapshot: knowledgeBaseSnapshot || null,
            generatedAt: new Date().toISOString(),
          },
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
          versionNumber: true,
        },
      });

        // Set rootSOPId if this is the first version
        if (!rootSOPId) {
          await prisma.sOP.update({
            where: { id: savedSOP.id },
            data: { rootSOPId: savedSOP.id },
          });
        }

  
      if (knowledgeBaseVersion || knowledgeBaseSnapshot || contributedInsights.length > 0) {
        console.log(`[SOP Generate] Saved SOP ${savedSOP.id} with KB metadata:`, {
          usedKnowledgeBaseVersion: knowledgeBaseVersion,
          hasSnapshot: !!knowledgeBaseSnapshot,
          insightsCount: contributedInsights.length,
        });
      }
    } catch (dbError: any) {
      console.error("[SOP Generate] Database save error:", dbError);
      throw dbError; // Re-throw to prevent returning success if save failed
    }
    }

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

          try {
            const enrichmentResult = await applyLearningEventsToKB({
              knowledgeBaseId: knowledgeBase.id,
              minConfidence: CONFIDENCE_THRESHOLDS.HIGH,
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
    
        console.error("[SOP Generate] Error creating LearningEvents (non-critical):", learningEventError);
      }
    }


    console.log("[SOP Generate] Returning response, sopHtml length:", generatedSOPHtml?.length || 0);
    const response = NextResponse.json({
      success: true,
      sopHtml: generatedSOPHtml, 
      sopId: savedSOP?.id || null,
      isDraft: shouldSave ? saveAsDraft : true, // If not saved, it's a draft. If saved, use the flag.
      metadata: {
        title: formData.sopTitle,
        generatedAt: new Date().toISOString(),
        versionNumber: calculatedVersionNumber,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens,
        },
        knowledgeBaseUsed: knowledgeBase !== null,
      },
    });

    // TEMPORARILY DISABLED FOR TESTING
    // return addRateLimitHeaders(response, rateLimit.rateLimitResult);
    return response;
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