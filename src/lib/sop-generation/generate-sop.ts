import OpenAI from "openai";
import { markdownToHtml } from "@/lib/extraction/markdown-to-html";

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

- [Specific, measurable outcome 1]
- [Specific, measurable outcome 2]
- [Quality threshold]
- [Expected deliverable]
- [Completion indicator]

### 3. NON-GOALS (Anti-Scope)

**CRITICAL**: Prevent creative freelancing—a massive VA failure mode. Explicitly state what NOT to do.

Do NOT do these things:

- [Prohibited action 1]
- [Prohibited action 2]
- [Boundary condition]
- [Escalation requirement]
- [Scope limitation]

### 4. PREREQUISITES & PREPARATION

Before starting, ensure you have:

**Required Access/Permissions**:
- [Specific login/credential]
- [System access]
- [Approval authority - if applicable]

**Required Documents/Templates**:
- [Specific document]
- [Template]
- [Reference material]

**Required Tools/Software**:
- [Tool name and version]
- [Browser/OS requirements if relevant]

**Information Needed**:
- [Data requirement]
- [Input from others]

---

## TIER 3: EXECUTION ENGINE (Where Your Current SOP Lives)

### 5. STEP-BY-STEP INSTRUCTIONS

For each major step:

**Step [Number]: [Step Name]**

**Inputs** (What you need):
- [Specific input 1]
- [Specific input 2]

**Actions** (What you do):
1. [Specific action with exact location/button name]
2. [Next action]
3. [Continue...]

**Outputs** (What you produce):
- [Specific deliverable 1]
- [Specific deliverable 2]

**Quality Gates** (Binary checkboxes - ALL must be Yes):
- [ ] [Specific check 1]
- [ ] [Specific check 2]
- [ ] [Specific check 3]

**If ANY checkbox is No → STOP and fix before proceeding.**

**Escalation Rules** (Stop immediately if):
- [Condition 1] → [Who to contact]
- [Tool/access failure] → [Escalation path]
- [Platform error] → [Action]

**Estimated Time**: [Duration for this step]

**Common Pitfalls**:
- [Specific mistake to avoid and why]
- [What to do if something goes wrong]

[Repeat this complete structure for each major step]

---

## TIER 4: PERFORMANCE & ACCOUNTABILITY

### 7. SOP-SPECIFIC KPIs

**CRITICAL**: These metrics are tied to THIS SOP only, not general business metrics.

Track these metrics for this SOP:

- **% of [process] completed on time**
- **Average [metric] per [time period]**
- **Error rate: [specific error type]**
- **[SOP-specific metric]**
- **[Quality metric]**

**How to measure**: [Brief description of tracking method]

### 8. FAILURE MODES & RECOVERY PLAYBOOKS

**CRITICAL**: Replace generic troubleshooting with specific failure → exact response playbooks.

#### Common Failure 1: [Specific Issue]

**Exact Response**:

1. [Immediate action]
2. [Verification step]
3. [Resolution attempt]
4. [If still fails]
5. [Escalation]

**Prevention**: [How to avoid]

[Repeat structure for each common failure]

---

## TIER 5: EVOLUTION & AI-READINESS

### 9. SOP UPDATE LOGIC

**Who can change this SOP**: [Role/approval process]

**What triggers a revision**:
- Tool/platform change
- Process modification
- KPI drop below threshold
- [Other trigger]

**Required testing before rollout**: [Process]

### 10. AUTOMATION & AI HOOKS

**Can this SOP be partially automated?**: Yes / No

**If Yes, automation opportunities**:
- [Task 1]
- [Task 2]

**AI Assistance Opportunities**:
- **[Task 1]**: AI can assist with [specific function]
- **[Task 2]**: AI can assist with [specific function]

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

# Output Format

Generate the SOP in clean, well-formatted **Markdown** that is:
- Easy to read on screen or print
- Properly hierarchical with clear heading levels
- Uses tables where appropriate for structured data
- Includes emphasis (bold, italic) strategically for scannability
- Uses checkbox format ([ ]) for quality gates
- Ready to paste into a knowledge base, wiki, or documentation system

**CRITICAL**: Return ONLY the markdown content. Do NOT wrap it in code fences. Return the raw markdown text directly without any code block markers.

Now, generate a comprehensive, VA-ready SOP following this 5-tier structure based on the user's input.`;

function buildUserPrompt(
  formData: Record<string, any>,
  knowledgeBase: any,
  jobAnalysis?: { analysis: any; intakeData?: any } | null,
): string {
  let prompt = `# SOP Generation Request

## Process Information

**SOP Title**: ${formData.sopTitle || ""}

**Process Overview**: ${formData.processOverview || ""}

**Primary Role/Performer**: ${formData.primaryRole || ""}

**Main Steps** (user-provided outline):
${formData.mainSteps || ""}

**Tools/Software Used**: ${formData.toolsUsed || ""}

**Frequency**: ${formData.frequency || ""}

**Process Trigger**: ${formData.trigger || ""}

**Success Criteria**: ${formData.successCriteria || ""}
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

  if (jobAnalysis && jobAnalysis.analysis) {
    const analysis = jobAnalysis.analysis;
    const intakeData = jobAnalysis.intakeData || {};

    prompt += `\n\n## Linked Job Description Analysis\n`;
    prompt += `This SOP is being created for the role defined in the following job analysis:\n\n`;

    const serviceType =
      analysis.preview?.service_type ||
      analysis.full_package?.service_structure?.service_type ||
      "Virtual Assistant";
    const roleTitle =
      analysis.preview?.role_title ||
      analysis.full_package?.service_structure?.dedicated_va_role?.title ||
      analysis.full_package?.service_structure?.core_va_role?.title ||
      "Role";

    prompt += `**Role Title**: ${roleTitle}\n`;
    prompt += `**Service Type**: ${serviceType}\n`;

    if (intakeData.businessName) {
      prompt += `**Business Name**: ${intakeData.businessName}\n`;
    }

    if (analysis.preview?.primary_outcome) {
      prompt += `**Primary Outcome**: ${analysis.preview.primary_outcome}\n`;
    }

    const serviceStructure = analysis.full_package?.service_structure;
    if (serviceStructure?.dedicated_va_role?.task_allocation?.from_intake) {
      prompt += `\n**Key Tasks & Responsibilities**:\n`;
      const tasks =
        serviceStructure.dedicated_va_role.task_allocation.from_intake;
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

    if (serviceStructure?.dedicated_va_role?.skill_requirements) {
      const skills = serviceStructure.dedicated_va_role.skill_requirements;
      if (skills.required && skills.required.length > 0) {
        prompt += `\n**Required Skills**: ${skills.required.join(", ")}\n`;
      }
      if (skills.nice_to_have && skills.nice_to_have.length > 0) {
        prompt += `**Nice-to-Have Skills**: ${skills.nice_to_have.join(", ")}\n`;
      }
    }

    const hoursPerWeek =
      analysis.preview?.hours_per_week ||
      serviceStructure?.dedicated_va_role?.hours_per_week ||
      intakeData.weeklyHours ||
      "40";
    prompt += `**Hours per Week**: ${hoursPerWeek}\n`;

    if (intakeData.tools) {
      const tools =
        typeof intakeData.tools === "string"
          ? intakeData.tools.split(",").map((t: string) => t.trim())
          : intakeData.tools;
      if (tools && tools.length > 0) {
        prompt += `**Tools/Software**: ${Array.isArray(tools) ? tools.join(", ") : tools}\n`;
      }
    }

    if (serviceStructure?.dedicated_va_role?.interaction_model) {
      const interaction = serviceStructure.dedicated_va_role.interaction_model;
      if (interaction.reports_to) {
        prompt += `**Reports To**: ${interaction.reports_to}\n`;
      }
      if (interaction.sync_needs) {
        prompt += `**Sync Needs**: ${interaction.sync_needs}\n`;
      }
    }

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
      if (
        knowledgeBase.industryOther &&
        knowledgeBase.industry.toLowerCase() === "other"
      ) {
        prompt += ` - ${knowledgeBase.industryOther}`;
      }
      prompt += `\n`;
    }

    if (
      knowledgeBase.toolStack &&
      Array.isArray(knowledgeBase.toolStack) &&
      knowledgeBase.toolStack.length > 0
    ) {
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

    if (knowledgeBase.brandVoiceStyle) {
      prompt += `**Brand Voice Style**: ${knowledgeBase.brandVoiceStyle}\n`;
    }
  }

  prompt += `\n\nPlease generate a comprehensive, professional SOP following the structure and guidelines provided in the system prompt.`;

  return prompt;
}

export interface GenerateSOPResult {
  sopHtml: string;
  sopMarkdown: string;
  metadata: {
    title: string;
    tokens: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
}

export async function generateSOP(
  formData: Record<string, any>,
  knowledgeBase: any | null,
  openai: OpenAI,
  jobAnalysis?: { analysis: any; intakeData?: any } | null,
): Promise<GenerateSOPResult> {
  const userPrompt = buildUserPrompt(formData, knowledgeBase, jobAnalysis);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SOP_GENERATOR_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 8000,
  });

  let generatedSOPMarkdown = completion.choices[0].message.content || "";

  if (!generatedSOPMarkdown) {
    throw new Error("OpenAI returned empty response");
  }

  generatedSOPMarkdown = generatedSOPMarkdown.trim();
  if (generatedSOPMarkdown.startsWith("```")) {
    const firstNewline = generatedSOPMarkdown.indexOf("\n");
    if (firstNewline !== -1) {
      const lastBackticks = generatedSOPMarkdown.lastIndexOf("```");
      if (lastBackticks > firstNewline) {
        generatedSOPMarkdown = generatedSOPMarkdown
          .substring(firstNewline + 1, lastBackticks)
          .trim();
      } else {
        generatedSOPMarkdown = generatedSOPMarkdown
          .substring(firstNewline + 1)
          .trim();
      }
    } else {
      generatedSOPMarkdown = generatedSOPMarkdown
        .replace(/^```[\w]*\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
    }
  }

  const promptTokens = completion.usage?.prompt_tokens || 0;
  const completionTokens = completion.usage?.completion_tokens || 0;
  const totalTokens = completion.usage?.total_tokens || 0;

  let generatedSOPHtml: string;
  try {
    generatedSOPHtml = await markdownToHtml(generatedSOPMarkdown);

    if (!generatedSOPHtml || generatedSOPHtml.trim().length === 0) {
      throw new Error("Markdown to HTML conversion returned empty result");
    }
  } catch (error) {
    console.error("[SOP Generation] Error converting markdown to HTML:", error);
    try {
      const htmlCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a markdown to HTML converter. Convert the provided markdown to clean, semantic HTML. Return ONLY the HTML content, no markdown backticks or explanations. Use proper HTML tags: h1-h6 for headings, p for paragraphs, ul/ol for lists, strong for bold, em for italic, code for inline code, pre for code blocks, table elements for tables.`,
          },
          {
            role: "user",
            content: `Convert this markdown to HTML:\n\n${generatedSOPMarkdown}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      });

      const htmlContent = htmlCompletion.choices[0].message.content || "";
      if (htmlContent && htmlContent.trim().length > 0) {
        let cleanedHtml = htmlContent.trim();
        if (cleanedHtml.startsWith("```")) {
          const firstNewline = cleanedHtml.indexOf("\n");
          const lastBackticks = cleanedHtml.lastIndexOf("```");
          if (firstNewline !== -1 && lastBackticks > firstNewline) {
            cleanedHtml = cleanedHtml
              .substring(firstNewline + 1, lastBackticks)
              .trim();
          } else {
            cleanedHtml = cleanedHtml
              .replace(/^```[\w]*\n?/, "")
              .replace(/\n?```$/, "")
              .trim();
          }
        }
        generatedSOPHtml = cleanedHtml;
      } else {
        throw new Error("OpenAI HTML conversion returned empty result");
      }
    } catch (fallbackError) {
      console.error(
        "[SOP Generation] Fallback HTML conversion also failed:",
        fallbackError,
      );
      generatedSOPHtml = `<pre>${generatedSOPMarkdown.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
    }
  }

  return {
    sopHtml: generatedSOPHtml,
    sopMarkdown: generatedSOPMarkdown,
    metadata: {
      title: formData.sopTitle || "SOP",
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
        total: totalTokens,
      },
    },
  };
}
