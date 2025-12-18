import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for OpenAI SOP Generator API route
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

    // 3. Get organization profile
    let organizationProfile = null;
    try {
      const profileResponse = await prisma.organizationProfile.findUnique({
        where: { organizationId: userOrg.organizationId },
        select: {
          businessName: true,
          website: true,
          industry: true,
          industryOther: true,
          primaryTools: true,
          primaryCRM: true,
          managementStyle: true,
          defaultTimezone: true,
          isRegulated: true,
          regulatedIndustryType: true,
          forbiddenWords: true,
          disclaimers: true,
          brandVoiceStyle: true,
          riskBoldnessLevel: true,
        },
      });
      organizationProfile = profileResponse;
    } catch (error) {
      console.error("Error fetching organization profile:", error);
      // Continue without org profile - it's optional
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

    // 8. Save SOP to database
    let savedSOP = null;
    try {
      savedSOP = await prisma.sOP.create({
        data: {
          userOrganizationId: userOrg.id,
          title: formData.sopTitle,
          content: {
            markdown: generatedSOP,
            version: "1.0",
            generatedAt: new Date().toISOString(),
          },
          intakeData: formData,
          organizationProfileSnapshot: organizationProfile || null,
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
            generatedAt: new Date().toISOString(),
          },
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      });
    } catch (dbError: any) {
      console.error("[SOP Generate] Database save error:", dbError);
      // Don't fail the request if save fails - still return the SOP
      // Log the error for monitoring
    }

    // 9. Return success response
    return NextResponse.json({
      success: true,
      sop: generatedSOP,
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

