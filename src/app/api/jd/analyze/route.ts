import { NextResponse, NextRequest } from "next/server";
import OpenAI from "openai";
import { cookies } from "next/headers";
import { prisma } from "@/lib/core/prisma";
import { verifyAccessToken } from "@/lib/core/auth";
import { extractInsights } from "@/lib/analysis/extractInsights";
import {
  extractFromFile,
  extractFromUrl,
} from "@/lib/extraction/extract-content";
import { withRateLimit } from "@/lib/rate-limiting/rate-limit-utils";
import { getRateLimitHeaders } from "@/lib/rate-limiting/rate-limit";
import {
  updateHiringHistory,
  updateServicePreferences,
  updateSkillRequirements,
  updateBottleneckHistory,
} from "@/lib/job-description/jd-field-updaters";

export const runtime = "nodejs";

function transformWebsiteContent(extracted: any): any {
  if (!extracted || extracted.error) {
    return {
      hero: "",
      about: "",
      services: "",
      testimonials: [],
      fullText: "",
      metadata: { title: "", description: "" },
      companyInfo: "",
      team: "",
      values: "",
      contact: "",
    };
  }

  const sectionTexts: string[] = [];
  if (extracted.sections?.hero?.summary)
    sectionTexts.push(`Hero: ${extracted.sections.hero.summary}`);
  if (extracted.sections?.about?.summary)
    sectionTexts.push(`About: ${extracted.sections.about.summary}`);
  if (extracted.sections?.services?.summary)
    sectionTexts.push(`Services: ${extracted.sections.services.summary}`);
  if (extracted.sections?.companyInfo?.summary)
    sectionTexts.push(
      `Company Info: ${extracted.sections.companyInfo.summary}`
    );
  if (extracted.sections?.team?.summary)
    sectionTexts.push(`Team: ${extracted.sections.team.summary}`);
  if (extracted.sections?.values?.summary)
    sectionTexts.push(`Values: ${extracted.sections.values.summary}`);
  if (extracted.sections?.contact?.summary)
    sectionTexts.push(`Contact: ${extracted.sections.contact.summary}`);
  if (extracted.overallSummary)
    sectionTexts.push(`Overall: ${extracted.overallSummary}`);

  const fullText = sectionTexts.join("\n\n").substring(0, 50000);

  return {
    hero: extracted.sections?.hero?.summary || "",
    about: extracted.sections?.about?.summary || "",
    services: extracted.sections?.services?.summary || "",
    testimonials: extracted.testimonials || [],
    fullText: fullText,
    metadata: {
      title: extracted.metadata?.title || "",
      description: extracted.metadata?.description || "",
    },
    companyInfo: extracted.sections?.companyInfo?.summary || "",
    team: extracted.sections?.team?.summary || "",
    values: extracted.sections?.values?.summary || "",
    contact: extracted.sections?.contact?.summary || "",
  };
}

function normalizeTasks(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0)
      .slice(0, 5);
  }
  if (typeof input === "string" && input.trim()) {
    return [input.trim()];
  }
  return [];
}

function normalizeStringArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }
  if (typeof input === "string" && input.trim().length > 0) {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

function formatErrorMessage(error: any): {
  error: string;
  details: string;
  userMessage: string;
} {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (
    errorMessage.includes("429") ||
    errorMessage.includes("quota") ||
    errorMessage.includes("billing")
  ) {
    return {
      error: "OpenAI API quota exceeded",
      details: errorMessage,
      userMessage:
        "OpenAI API quota has been exceeded. Please check your OpenAI billing and plan details, or contact support.",
    };
  }

  if (
    errorMessage.includes("401") ||
    errorMessage.includes("Invalid API key")
  ) {
    return {
      error: "OpenAI API authentication failed",
      details: errorMessage,
      userMessage:
        "OpenAI API key is invalid or missing. Please check your API configuration.",
    };
  }

  if (
    errorMessage.includes("500") ||
    errorMessage.includes("Internal server error")
  ) {
    return {
      error: "OpenAI API server error",
      details: errorMessage,
      userMessage:
        "OpenAI service is experiencing issues. Please try again in a few moments.",
    };
  }

  if (
    errorMessage.includes("timeout") ||
    errorMessage.includes("ETIMEDOUT") ||
    errorMessage.includes("ECONNREFUSED")
  ) {
    return {
      error: "Connection error",
      details: errorMessage,
      userMessage:
        "Unable to connect to the AI service. Please check your internet connection and try again.",
    };
  }

  if (
    errorMessage.includes("rate limit") ||
    errorMessage.includes("rate_limit")
  ) {
    return {
      error: "Rate limit exceeded",
      details: errorMessage,
      userMessage: "Too many requests. Please wait a moment and try again.",
    };
  }

  if (
    errorMessage.includes("insufficient_quota") ||
    errorMessage.includes("insufficient tokens")
  ) {
    return {
      error: "Insufficient tokens",
      details: errorMessage,
      userMessage:
        "Insufficient API credits. Please add credits to your OpenAI account and try again.",
    };
  }

  return {
    error: "Analysis failed",
    details: errorMessage,
    userMessage:
      "An error occurred while analyzing your job description. Please try again or contact support if the issue persists.",
  };
}

function cleanTeamSupportAreas(analysisResult: any): any {
  if (!analysisResult) return analysisResult;

  const serviceType =
    analysisResult.preview?.service_type ||
    analysisResult.full_package?.service_structure?.service_type ||
    analysisResult.full_package?.executive_summary?.service_recommendation
      ?.type;

  if (serviceType === "Dedicated VA") {
    const cleaned = JSON.parse(JSON.stringify(analysisResult)); // Deep clone

    if (cleaned.preview?.team_support_areas !== undefined) {
      delete cleaned.preview.team_support_areas;
    }

    if (
      cleaned.full_package?.service_structure?.team_support_areas !== undefined
    ) {
      delete cleaned.full_package.service_structure.team_support_areas;
    }

    if (cleaned.full_package?.team_support_areas !== undefined) {
      delete cleaned.full_package.team_support_areas;
    }

    return cleaned;
  }

  return analysisResult;
}

function formatKnowledgeBaseContext(kb: any): string {
  if (!kb) return "";

  const contextParts: string[] = [];

  contextParts.push("ORGANIZATION KNOWLEDGE BASE CONTEXT:");
  contextParts.push(
    "Use this existing knowledge about the organization to personalize the analysis:"
  );

  if (kb.businessName) {
    contextParts.push(`- Business Name: ${kb.businessName}`);
  }
  if (kb.industry) {
    contextParts.push(
      `- Industry: ${kb.industry}${
        kb.industryOther ? ` (${kb.industryOther})` : ""
      }`
    );
  }
  if (kb.whatYouSell) {
    contextParts.push(`- What They Sell: ${kb.whatYouSell}`);
  }
  if (kb.idealCustomer) {
    contextParts.push(`- Ideal Customer: ${kb.idealCustomer}`);
  }
  if (kb.toolStack && Array.isArray(kb.toolStack) && kb.toolStack.length > 0) {
    contextParts.push(`- Existing Tools: ${kb.toolStack.join(", ")}`);
  }
  if (kb.primaryCRM) {
    contextParts.push(`- Primary CRM: ${kb.primaryCRM}`);
  }
  if (kb.defaultWeeklyHours) {
    contextParts.push(`- Default Weekly Hours: ${kb.defaultWeeklyHours}`);
  }
  if (kb.defaultManagementStyle) {
    contextParts.push(
      `- Default Management Style: ${kb.defaultManagementStyle}`
    );
  }
  if (kb.brandVoiceStyle) {
    contextParts.push(`- Brand Voice Style: ${kb.brandVoiceStyle}`);
  }
  if (kb.biggestBottleNeck) {
    contextParts.push(`- Known Bottleneck: ${kb.biggestBottleNeck}`);
  }

  contextParts.push(
    "\nWhen analyzing, consider how this role fits with their existing tools, processes, and business context."
  );
  contextParts.push(
    "If intake data conflicts with knowledge base, note the discrepancy but prioritize intake data for this specific role."
  );

  return contextParts.join("\n");
}

//Stage 1: Deep Discovery

async function runDeepDiscovery(
  openai: OpenAI,
  intakeData: any,
  sopText: string | null,
  knowledgeBase: any = null
) {
  const websiteInfo = intakeData.websiteContent
    ? `
WEBSITE CONTENT (extracted company information):
- Hero/Main Message: ${intakeData.websiteContent.hero || "Not available"}
- About Section: ${intakeData.websiteContent.about || "Not available"}
- Services/Offerings: ${intakeData.websiteContent.services || "Not available"}
- Company Info: ${intakeData.websiteContent.companyInfo || "Not available"}
- Team Information: ${intakeData.websiteContent.team || "Not available"}
- Values/Culture: ${intakeData.websiteContent.values || "Not available"}
- Contact Info: ${intakeData.websiteContent.contact || "Not available"}
- Testimonials: ${
        (intakeData.websiteContent.testimonials || [])
          .slice(0, 3)
          .join(" | ") || "Not available"
      }
- Full Website Text (sample): ${(
        intakeData.websiteContent.fullText || ""
      ).substring(0, 5000)}
- Metadata: ${JSON.stringify(intakeData.websiteContent.metadata || {})}
`
    : "";

  const kbContext = formatKnowledgeBaseContext(knowledgeBase);

  const discoveryPrompt = `You are a business analyst conducting deep discovery for a virtual assistant placement.
  
${kbContext ? `${kbContext}\n\n` : ""}INTAKE DATA:
${JSON.stringify({ ...intakeData, websiteContent: undefined }, null, 2)}

${websiteInfo}

${
  sopText
    ? `SOP DOCUMENT (use this to understand current processes and identify implicit needs):
${sopText.slice(0, 15000)}`
    : "No SOP provided."
}

Your job is to extract deep insights that aren't explicitly stated. Respond with JSON:

{
  "business_context": {
    "company_stage": "startup | growth | established",
    "primary_bottleneck": "What's preventing the 90-day outcome?",
    "hidden_complexity": "What complexities are implied but not stated?",
    "growth_indicators": "Signs of scaling needs or trajectory"
  },
  
  "task_analysis": {
    "task_clusters": [
      {
        "cluster_name": "Descriptive name for related tasks",
        "tasks": ["task 1", "task 2"],
        "workflow_type": "creative | analytical | operational | client-facing",
        "interdependencies": ["What other clusters does this depend on?"],
        "complexity_score": 1-10,
        "estimated_hours_weekly": 5
      }
    ],
    "skill_requirements": {
      "technical": ["Specific technical skills with proficiency levels"],
      "soft": ["Communication, problem-solving, etc. with context"],
      "domain": ["Industry or domain knowledge needed"]
    },
    "implicit_needs": [
      "Requirements not explicitly stated but clearly needed",
      "Example: 'Tasks mention reporting but no BI tool listed - needs data viz skills'"
    ]
  },
  
  "sop_insights": {
    "process_complexity": "low | medium | high",
    "documented_workflows": ["List of documented processes"],
    "documentation_gaps": ["What's missing from SOPs"],
    "handoff_points": ["Where work passes between people/systems"],
    "pain_points": ["Bottlenecks or issues evident in current process"],
    "tools_mentioned": ["Tools found in SOP that aren't in intake"],
    "implicit_requirements": ["Skills/access needed based on SOP"]
  },
  
  "context_gaps": [
    {
      "question": "Clarifying question for the client",
      "why_it_matters": "How this impacts role design",
      "assumption_if_unanswered": "What we'll assume if they don't answer"
    }
  ],
  
  "measurement_capability": {
    "current_tracking": ["What metrics/KPIs are they currently tracking"],
    "tools_available": ["What tools they have for measurement"],
    "tracking_gaps": ["What they want to measure but can't currently"],
    "recommendations": ["What instrumentation/tools they should add"]
  }
}

Be specific and insightful. Look for what's NOT said but is clearly implied.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert business analyst." },
      { role: "user", content: discoveryPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 2500,
  });

  return JSON.parse(completion.choices[0].message.content || "{}");
}

//Stage 1.5: Service Type Classification

async function classifyServiceType(
  openai: OpenAI,
  intakeData: any,
  discovery: any,
  knowledgeBase: any = null
) {
  const preClassificationChecks = `

HARD RULES (these override scoring):

1. If weekly_hours > 0 AND all tasks are ongoing/recurring AND tasks fit within 2-3 related skill domains → LIKELY DEDICATED VA

2. If weekly_hours = 0 OR outcome describes finite deliverables OR comments mention "one-time" → LIKELY PROJECTS ON DEMAND  

3. Only classify as UNICORN VA if there's clearly a core role (60%+ of work) PLUS specialized needs that require different expertise



UNICORN VA MUST HAVE:

- A clear primary responsibility (e.g., "social media management")

- PLUS secondary needs requiring specialized skills (e.g., video editing, graphic design)

- NOT just "multiple tools" - that's normal for any role



DEDICATED VA characteristics:

- Tasks cluster around ONE core function

- Hours are weekly/recurring

- Role has ongoing operational ownership

- Skills are complementary, not disparate



PROJECTS ON DEMAND characteristics:

- Tasks have clear end states

- Work is batch/campaign-based

- Deliverables are countable (build X, create Y, migrate Z)

- Timeline is project duration, not weekly hours

`;

  const kbContext = formatKnowledgeBaseContext(knowledgeBase);

  const classificationPrompt = `You are a service type classifier for a VA agency. Based on the client's needs, classify which service model fits best.

${preClassificationChecks}

${kbContext ? `${kbContext}\n\n` : ""}INTAKE DATA:
${JSON.stringify(intakeData, null, 2)}

DISCOVERY INSIGHTS:
${JSON.stringify(discovery, null, 2)}

SERVICE TYPE DEFINITIONS:

1. DEDICATED VA
   - Best for: Ongoing, recurring operational tasks
   - Client has: Specific, well-defined role for one person
   - Tasks are: Cohesive and within related skill domains
   - Engagement: Long-term, consistent workload
   - Example: Executive assistant, customer support lead, operations coordinator

2. PROJECTS ON DEMAND
   - Best for: One-off, project-based, or sporadic needs
   - Client has: Multiple disconnected projects, not ongoing operations
   - Tasks are: Varied, non-recurring, or campaign-based
   - Engagement: Project-by-project basis with defined start/end
   - Example: Website build, funnel setup, one-time migration, content creation project

3. UNICORN VA SERVICE
   - Best for: Core ongoing role + diverse additional skill needs
   - Client has: One primary responsibility + variety of secondary needs
   - Tasks are: Mix of core competency + adjacent specialized skills
   - Engagement: Dedicated VA for core work + team access for specialized tasks
   - Example: Marketing VA (core) + graphic design + video editing + copywriting needs

CLASSIFICATION CRITERIA:

Analyze these factors:
- Task Cohesion: Do tasks naturally fit one person's skill set?
- Temporal Pattern: Ongoing daily work vs project-based?
- Skill Distribution: Single domain vs multiple specialized domains?
- Business Integration: Internal operations vs external deliverables?
- Workload Consistency: Steady hours vs fluctuating needs?

Respond with JSON:

{
  "service_type_analysis": {
    "recommended_service": "Dedicated VA | Projects on Demand | Unicorn VA Service",
    "confidence": "High | Medium | Low",
    
    "factors": {
      "task_cohesion": {
        "score": 1-10,
        "reasoning": "Are tasks related enough for one person?"
      },
      "temporal_pattern": {
        "pattern": "ongoing | project-based | hybrid",
        "reasoning": "What's the engagement timeline?"
      },
      "skill_distribution": {
        "core_skills": ["Primary skills needed"],
        "secondary_skills": ["Additional specialized skills"],
        "fit_assessment": "Do these fit in one person?"
      },
      "business_integration": {
        "type": "internal_operations | external_deliverables | mixed",
        "reasoning": "Is this about running operations or delivering projects?"
      },
      "workload_consistency": {
        "pattern": "steady | fluctuating | seasonal",
        "weekly_hours": "Estimated hours breakdown"
      }
    },
    
    "service_fit_scores": {
      "dedicated_va": {
        "score": 1-10,
        "why_fits": ["Reasons this service works"],
        "why_doesnt": ["Reasons this service doesn't work"]
      },
      "projects_on_demand": {
        "score": 1-10,
        "why_fits": ["Reasons this service works"],
        "why_doesnt": ["Reasons this service doesn't work"]
      },
      "unicorn_va": {
        "score": 1-10,
        "why_fits": ["Reasons this service works"],
        "why_doesnt": ["Reasons this service doesn't work"]
      }
    },
    
    "decision_logic": "Explain why the recommended service is the best fit",
    
    "edge_cases": [
      "Scenarios where this recommendation might not work",
      "Alternative service type to consider if X changes"
    ],
    
    "client_validation_questions": [
      {
        "question": "Question to validate the service type choice",
        "why_matters": "How the answer affects service type",
        "if_yes": "Impact if they answer yes",
        "if_no": "Impact if they answer no"
      }
    ]
  },
  
  "role_structure_by_service": {
    "if_dedicated_va": {
      "role_count": 1,
      "role_description": "Single cohesive role description",
      "hours_per_week": "From intake",
      "skill_profile": "Combined skill requirements"
    },
    
    "if_projects_on_demand": {
      "project_types": [
        {
          "project_name": "Project category",
          "estimated_hours": "Hours for this project",
          "skills_needed": ["Skills for this project"],
          "deliverables": ["What client gets"],
          "timeline": "Estimated completion time"
        }
      ],
      "engagement_model": "How projects would be scoped and delivered"
    },
    
    "if_unicorn_va": {
      "core_role": {
        "title": "Primary VA role title",
        "hours_per_week": "Hours for core work",
        "core_responsibilities": ["Main ongoing tasks"],
        "skills_needed": ["Core skill set"]
      },
      "team_support_needs": [
        {
          "skill_area": "Specialized skill category",
          "estimated_hours_monthly": "Hours needed",
          "use_cases": ["When this skill is needed"],
          "why_not_core_va": "Why this doesn't fit the core VA"
        }
      ]
    }
  }
}

Be analytical and objective. The goal is to match the client's actual needs to the right service model, not force them into a specific service.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a service classification expert." },
      { role: "user", content: classificationPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 2500,
  });

  return JSON.parse(completion.choices[0].message.content || "{}");
}

//Stage 2: Service-Aware Role Architecture

async function designRoleArchitecture(
  openai: OpenAI,
  intakeData: any,
  discovery: any,
  serviceClassification: any,
  knowledgeBase: any = null
) {
  const recommendedService =
    serviceClassification.service_type_analysis.recommended_service;

  const serviceSpecificInstructions: Record<string, string> = {
    "Dedicated VA": `
You are designing a DEDICATED VA role. Create ONE cohesive role that:
- Combines all tasks into a single, manageable position
- Has a clear core mission and outcome ownership
- Balances the workload across ${intakeData.weekly_hours} hours/week
- Includes all necessary skills in one person's capability range

IMPORTANT: Do NOT include "team_support_areas" in your response. This is a single dedicated VA role only.

Respond with JSON:
{
  "service_type": "Dedicated VA",
  "dedicated_va_role": {
    "title": "Specific role title",
    "hours_per_week": ${intakeData.weekly_hours},
    "core_responsibility": "Primary outcome this role owns",
    "task_allocation": {
      "from_intake": ["All intake tasks mapped here"],
      "estimated_breakdown": "How hours split across task types"
    },
    "skill_requirements": {
      "required": ["Must-have skills"],
      "nice_to_have": ["Bonus skills"],
      "growth_areas": ["Skills they can develop over time"]
    },
    "workflow_ownership": ["All workflow clusters owned by this role"],
    "interaction_model": {
      "reports_to": "Role or person",
      "collaborates_with": ["Other roles/teams"],
      "sync_needs": "Daily | Weekly | Async-first"
    }
  },
  "pros": [
    "Why this structure works well",
    "Specific advantages for this client"
  ],
  "cons": [
    "Honest limitations or tradeoffs",
    "What this structure doesn't solve"
  ],
  "scaling_path": "How this structure evolves as needs grow",
  "alternative_consideration": "What would make you switch to a different service type"
}`,

    "Projects on Demand": `
You are scoping PROJECTS ON DEMAND. Create a project-based breakdown that:
- Groups tasks into discrete deliverable projects
- Defines clear start/end points for each project
- Specifies deliverables and acceptance criteria
- Estimates hours per project (not weekly recurring hours)
- Can be executed sequentially or in parallel

Respond with JSON:
{
  "service_type": "Projects on Demand",
  "projects": [
    {
      "project_name": "Descriptive project name",
      "category": "Type of project (e.g., Marketing, Tech, Operations)",
      "objective": "What this project achieves",
      "deliverables": [
        "Specific deliverable 1 with acceptance criteria",
        "Specific deliverable 2 with acceptance criteria"
      ],
      "estimated_hours": "Total hours for project",
      "timeline": "Estimated duration (e.g., 2-3 weeks)",
      "skills_required": ["Skills needed for this project"],
      "dependencies": ["What needs to exist before starting"],
      "success_criteria": "How we know it's done well"
    }
  ],
  "recommended_sequence": "Order to execute projects and why",
  "total_investment": {
    "hours": "Sum of all project hours",
    "timeline": "Total timeline if sequential"
  },
  "pros": [
    "Why this structure works well",
    "Specific advantages for this client"
  ],
  "cons": [
    "Honest limitations or tradeoffs",
    "What this structure doesn't solve"
  ],
  "scaling_path": "How this could transition to ongoing engagement",
  "alternative_consideration": "What would make you switch to a different service type"
}`,

    "Unicorn VA Service": `
You are designing a UNICORN VA SERVICE. Create a structure with:
1. ONE core Dedicated VA role (ongoing, recurring tasks - 60-80% of work)
2. TEAM SUPPORT AREAS (specialized skills accessed on-demand)

The core VA should handle the primary ongoing work. Team support covers specialized needs that:
- Require expertise beyond the core VA's skill set
- Are needed occasionally, not daily
- Would be inefficient to train one person on
- Benefit from specialist-level execution

Respond with JSON:
{
  "service_type": "Unicorn VA Service",
  "core_va_role": {
    "title": "Core VA role title",
    "hours_per_week": "Hours for recurring work",
    "core_responsibility": "Primary ongoing outcome",
    "recurring_tasks": ["Tasks the VA does daily/weekly"],
    "skill_requirements": {
      "required": ["Core skills"],
      "nice_to_have": ["Bonus skills"]
    },
    "workflow_ownership": ["Workflows owned by core VA"]
  },
  "team_support_areas": [
    {
      "skill_category": "e.g., Graphic Design",
      "use_cases": ["When this skill is needed"],
      "estimated_hours_monthly": "Hours per month",
      "deliverables": ["What the specialist produces"],
      "why_team_not_va": "Why this doesn't fit the core VA",
      "example_requests": [
        "Example task 1 for this specialist",
        "Example task 2 for this specialist"
      ]
    }
  ],
  "coordination_model": "How core VA and team specialists collaborate",
  "pros": [
    "Why this structure works well",
    "Specific advantages for this client"
  ],
  "cons": [
    "Honest limitations or tradeoffs",
    "What this structure doesn't solve"
  ],
  "scaling_path": "How this structure evolves as needs grow",
  "alternative_consideration": "What would make you switch to a different service type"
}`,
  };

  const kbContext = formatKnowledgeBaseContext(knowledgeBase);

  const architecturePrompt = `You are a role design architect designing a ${recommendedService} engagement.

${kbContext ? `${kbContext}\n\n` : ""}INTAKE DATA:
${JSON.stringify(intakeData, null, 2)}

DISCOVERY INSIGHTS:
${JSON.stringify(discovery, null, 2)}

SERVICE CLASSIFICATION:
${JSON.stringify(serviceClassification.service_type_analysis, null, 2)}

${serviceSpecificInstructions[recommendedService] || ""}

Make every section specific and actionable. Avoid generic statements.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a role architecture specialist." },
      { role: "user", content: architecturePrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.5,
    max_tokens: 3000,
  });

  return JSON.parse(completion.choices[0].message.content || "{}");
}

//Stage 3A: Detailed JD Generation (For Dedicated VA or Core Unicorn VA)

async function generateDetailedJD(
  openai: OpenAI,
  role: any,
  discovery: any,
  intakeData: any
) {
  const jdPrompt = `You are writing a comprehensive job description for a VA role.

ROLE OVERVIEW:
${JSON.stringify(role, null, 2)}

DISCOVERY CONTEXT:
${JSON.stringify(discovery, null, 2)}

CLIENT CONTEXT:
${JSON.stringify(intakeData, null, 2)}

Generate a detailed, actionable job description following this JSON schema:

{
  "title": "${role.title}",
  "hours_per_week": ${role.hours_per_week},
  
  "mission_statement": "2-3 sentences: Why this role exists and what success looks like. Make it inspiring and clear.",
  
  "primary_outcome": "The single most important thing this role must deliver in 90 days (specific and measurable)",
  
  "core_outcomes": [
    "4-6 specific, measurable outcomes for 90 days",
    "Each should be concrete with success criteria",
    "Example: 'Build 3 lead-generation funnels with documented workflows, achieving <2% form error rate and 15+ booked calls/month'",
    "Tie each to the overall business goal"
  ],
  
  "responsibilities": [
    {
      "category": "Category name (e.g., 'Workflow Automation')",
      "details": [
        "Detailed responsibility with the HOW, not just WHAT",
        "Example: 'Design GHL multi-step workflows including form logic, conditional branching, webhook integrations, and calendar booking—with full QA documentation before launch'",
        "Include frequency, tools, and output format"
      ]
    }
  ],
  
  "skills_required": {
    "technical": [
      {
        "skill": "Specific technical skill",
        "proficiency": "beginner | intermediate | advanced",
        "application": "How it's used in this role",
        "example": "Concrete example of application"
      }
    ],
    "soft": [
      {
        "skill": "Soft skill",
        "why_critical": "Why it matters for this specific role",
        "demonstration": "How you'd assess this in interview/trial"
      }
    ],
    "domain": [
      "Domain knowledge needed with context"
    ]
  },
  
  "tools": [
    {
      "tool": "Tool name",
      "use_case": "Primary use in this role",
      "proficiency": "How deep they need to know it",
      "training_available": "Will client provide training? Y/N/Partial"
    }
  ],
  
  "kpis": [
    {
      "metric": "Specific KPI",
      "target": "Target value (if applicable)",
      "frequency": "How often measured",
      "measurement_method": "How it's tracked/calculated",
      "leading_or_lagging": "leading | lagging",
      "instrumentation_needs": "What tools/setup needed to track this"
    }
  ],
  
  "personality_fit": [
    {
      "trait": "Specific personality trait",
      "why_critical": "Why this matters for success in THIS role",
      "anti_pattern": "What the opposite trait looks like (red flag)",
      "example_scenario": "Situation where this trait is tested"
    }
  ],
  
  "sample_week": {
    "Mon": {
      "focus": "Primary focus/theme for Monday",
      "activities": ["Specific activity 1", "Specific activity 2"],
      "estimated_hours": "Hour breakdown"
    },
    "Tue": { "focus": "", "activities": [], "estimated_hours": "" },
    "Wed": { "focus": "", "activities": [], "estimated_hours": "" },
    "Thu": { "focus": "", "activities": [], "estimated_hours": "" },
    "Fri": {
      "focus": "Include weekly review/reporting",
      "activities": [],
      "estimated_hours": ""
    }
  },
  
  "communication_structure": {
    "reporting_to": "Role or person",
    "daily_updates": "Format and channel (e.g., 'Async Slack summary by 9am EST')",
    "weekly_sync": "Format, duration, purpose",
    "documentation_standards": "How work is documented",
    "escalation_protocol": "When and how to raise issues",
    "tools": ["Slack", "Loom", "ClickUp"]
  },
  
  "timezone_requirements": {
    "flexibility": "What's negotiable",
    "critical_windows": "When real-time presence is essential",
    "async_workflows": "What can be done fully async"
  },
  
  "success_indicators": {
    "30_days": ["What good looks like at 30 days"],
    "60_days": ["What good looks like at 60 days"],
    "90_days": ["What good looks like at 90 days - should match core outcomes"]
  }
}

Make every section rich and specific. Avoid generic statements.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert job description writer.",
      },
      { role: "user", content: jdPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.6,
    max_tokens: 3500,
  });

  return JSON.parse(completion.choices[0].message.content || "{}");
}

// ============================================================================
// STAGE 3B: PROJECT SPECS GENERATOR (For Projects on Demand)
// ============================================================================

async function generateProjectSpecs(
  openai: OpenAI,
  projects: any[],
  discovery: any,
  intakeData: any
) {
  const projectPrompt = `You are creating detailed project specifications for a Projects on Demand engagement.

PROJECTS:
${JSON.stringify(projects, null, 2)}

DISCOVERY CONTEXT:
${JSON.stringify(discovery, null, 2)}

INTAKE DATA:
${JSON.stringify(intakeData, null, 2)}

For each project, create comprehensive specifications. Respond with JSON:

{
  "projects": [
    {
      "project_name": "From input",
      "overview": "2-3 sentence project summary",
      "objectives": ["Specific goals this project achieves"],
      "deliverables": [
        {
          "item": "Deliverable name",
          "description": "Detailed description",
          "acceptance_criteria": ["How we know it's done right"],
          "file_format": "Expected output format"
        }
      ],
      "scope": {
        "in_scope": ["What IS included"],
        "out_of_scope": ["What IS NOT included"],
        "assumptions": ["What we're assuming about resources/access"]
      },
      "timeline": {
        "estimated_hours": "Total hours",
        "duration": "Calendar time",
        "milestones": [
          {
            "milestone": "Checkpoint name",
            "timing": "When it happens",
            "deliverable": "What's delivered"
          }
        ]
      },
      "requirements": {
        "from_client": ["What client must provide"],
        "skills_needed": ["Skills for execution"],
        "tools_needed": ["Tools required"]
      },
      "success_metrics": ["How we measure success"],
      "risks": [
        {
          "risk": "Potential issue",
          "mitigation": "How to prevent/handle it"
        }
      ]
    }
  ]
}

Make each project specification detailed enough to be executed independently.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a project specification expert." },
      { role: "user", content: projectPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.5,
    max_tokens: 3000,
  });

  return JSON.parse(completion.choices[0].message.content || "{}");
}

//Stage 4: Validation & Risk Analysis (Service-Aware)

async function validateAndAnalyzeRisks(
  openai: OpenAI,
  architecture: any,
  detailedSpecs: any,
  discovery: any,
  intakeData: any,
  serviceClassification: any
) {
  const validationPrompt = `You are a quality assurance analyst reviewing a VA service design package.

SERVICE TYPE: ${serviceClassification.service_type_analysis.recommended_service}

ROLE ARCHITECTURE:
${JSON.stringify(architecture, null, 2)}

DETAILED SPECIFICATIONS:
${JSON.stringify(detailedSpecs, null, 2)}

DISCOVERY INSIGHTS:
${JSON.stringify(discovery, null, 2)}

INTAKE DATA:
${JSON.stringify(intakeData, null, 2)}

Perform a comprehensive validation and risk analysis. Respond with JSON:

{
  "consistency_checks": {
    "hours_balance": {
      "stated_hours": "Total weekly hours from intake",
      "allocated_hours": "Sum of hours across roles/projects",
      "issues": ["Any mismatches or concerns"]
    },
    
    "tool_alignment": {
      "tools_in_intake": ["From intake"],
      "tools_in_specs": ["From specifications"],
      "missing_from_specs": ["Tools needed but not listed"],
      "not_in_intake": ["Tools in specs but not provided by client"],
      "recommendations": ["What to clarify with client"]
    },
    
    "outcome_mapping": {
      "client_goal": "90-day outcome from intake",
      "role_outcomes": ["Primary outcomes from specifications"],
      "coverage": "What % of client goal is addressed",
      "gaps": ["Aspects of client goal not covered"]
    },
    
    "kpi_feasibility": [
      {
        "kpi": "KPI name",
        "measurable": true,
        "instrumentation_exists": false,
        "issue": "If not measurable, what's missing",
        "recommendation": "How to fix"
      }
    ]
  },
  
  "risk_analysis": [
    {
      "risk": "Specific risk description",
      "category": "scope | skill | tool | process | management",
      "severity": "high | medium | low",
      "likelihood": "high | medium | low",
      "impact": "What happens if this risk materializes",
      "mitigation": "How to reduce or manage this risk",
      "early_warning_signs": ["Signals this risk is becoming real"]
    }
  ],
  
  "assumptions_to_validate": [
    {
      "assumption": "What we're assuming",
      "criticality": "high | medium | low",
      "validation_method": "How client should verify this",
      "if_wrong": "What changes if this assumption is incorrect"
    }
  ],
  
  "red_flags": [
    {
      "flag": "Specific concern",
      "evidence": "What in the data suggests this",
      "recommendation": "What to do about it"
    }
  ],
  
  "quality_assessment": {
    "specificity": "Are specifications specific enough? (1-10)",
    "role_clarity": "Is the service structure crystal clear? (1-10)",
    "outcome_alignment": "Does structure directly drive client goal? (1-10)",
    "personality_depth": "Are personality traits specific and useful? (1-10)",
    "kpi_quality": "Are KPIs measurable and meaningful? (1-10)",
    "overall_confidence": "high | medium | low",
    "areas_to_strengthen": ["What needs more depth"]
  },
  
  "service_type_validation": {
    "classification_appears_correct": true,
    "concerns": ["Any concerns about the service type choice"],
    "alternative_to_consider": "If concerns exist, what alternative service type"
  },
  
  "alternative_considerations": [
    "Other structures that might work",
    "Scenarios where current design might fail",
    "What would make you change this recommendation"
  ]
}

Be brutally honest. This is the final QA check before showing to the client.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a quality assurance specialist." },
      { role: "user", content: validationPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 2500,
  });

  return JSON.parse(completion.choices[0].message.content || "{}");
}

//Stage 5: Client-Facing Package Assembly

function assembleClientPackage(
  discovery: any,
  architecture: any,
  detailedSpecs: any,
  validation: any,
  intakeData: any,
  serviceClassification: any
) {
  const recommendedService =
    serviceClassification.service_type_analysis.recommended_service;

  // Clean architecture: Remove team_support_areas for Dedicated VA
  const cleanedArchitecture = { ...architecture };
  if (
    recommendedService === "Dedicated VA" &&
    cleanedArchitecture.team_support_areas !== undefined
  ) {
    delete cleanedArchitecture.team_support_areas;
  }

  return {
    executive_summary: {
      what_you_told_us: generateExecutiveSummary(discovery, intakeData),
      service_recommendation: {
        type: recommendedService,
        confidence: serviceClassification.service_type_analysis.confidence,
        reasoning: serviceClassification.service_type_analysis.decision_logic,
        why_not_others: {
          dedicated_va:
            serviceClassification.service_type_analysis.service_fit_scores
              .dedicated_va,
          projects_on_demand:
            serviceClassification.service_type_analysis.service_fit_scores
              .projects_on_demand,
          unicorn_va:
            serviceClassification.service_type_analysis.service_fit_scores
              .unicorn_va,
        },
      },
      key_insights: discovery.task_analysis.implicit_needs.slice(0, 3),
    },

    service_structure: cleanedArchitecture,

    detailed_specifications: detailedSpecs,

    implementation_plan: {
      immediate_next_steps: generateNextSteps(
        validation,
        discovery,
        intakeData,
        recommendedService
      ),
      onboarding_roadmap: generateOnboardingRoadmap(
        detailedSpecs,
        recommendedService
      ),
      success_milestones: generateMilestones(recommendedService, detailedSpecs),
    },

    risk_management: {
      risks: validation.risk_analysis,
      assumptions: validation.assumptions_to_validate,
      red_flags: validation.red_flags,
      monitoring_plan: generateMonitoringPlan(validation),
    },

    questions_for_you: [
      ...discovery.context_gaps,
      ...serviceClassification.service_type_analysis
        .client_validation_questions,
    ],

    validation_report: {
      consistency_checks: validation.consistency_checks,
      quality_scores: validation.quality_assessment,
      service_type_validation: validation.service_type_validation,
    },

    appendix: {
      discovery_insights: discovery,
      service_classification_details: serviceClassification,
      measurement_recommendations: discovery.measurement_capability,
    },
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateExecutiveSummary(discovery: any, intakeData: any) {
  const context = discovery.business_context;
  const tasks = discovery.task_analysis;

  return {
    company_stage: context.company_stage,
    outcome_90d: intakeData.outcome_90d,
    primary_bottleneck: context.primary_bottleneck,
    workflow_analysis: `Our analysis reveals ${tasks.task_clusters.length} distinct workflow clusters across ${intakeData.tasks_top5.length} key tasks, with hidden complexity around ${context.hidden_complexity}.`,
    sop_status: discovery.sop_insights
      ? {
          has_sops: true,
          pain_points: discovery.sop_insights.pain_points || [],
          documentation_gaps: discovery.sop_insights.documentation_gaps || [],
          summary: `Based on their SOP documentation, we've identified ${discovery.sop_insights.pain_points.length} process pain points and ${discovery.sop_insights.documentation_gaps.length} documentation gaps that need addressing.`,
        }
      : {
          has_sops: false,
          pain_points: [],
          documentation_gaps: [],
          summary:
            "No existing SOPs were provided, suggesting documentation will be a Day 1 priority.",
        },
    role_recommendation: `The service structure we're recommending is designed specifically to unblock ${context.primary_bottleneck} while building sustainable systems for ${context.growth_indicators}.`,
  };
}

function generateNextSteps(
  validation: any,
  discovery: any,
  intakeData: any,
  serviceType: string
) {
  const steps = [
    {
      step: "Review and approve service structure",
      owner: "Client",
      timeline: "Next 2 days",
      output: `Confirmed ${serviceType} engagement`,
    },
    {
      step: "Answer clarifying questions",
      owner: "Client",
      timeline: "Next 3 days",
      output: discovery.context_gaps.length + " questions answered",
    },
  ];

  if (
    validation.consistency_checks.tool_alignment.missing_from_specs &&
    validation.consistency_checks.tool_alignment.missing_from_specs.length > 0
  ) {
    steps.push({
      step: "Clarify tool access and training",
      owner: "Client",
      timeline: "Before engagement starts",
      output:
        "Confirmed: " +
        validation.consistency_checks.tool_alignment.missing_from_specs.join(
          ", "
        ),
    });
  }

  if (
    discovery.sop_insights &&
    discovery.sop_insights.documentation_gaps.length > 0
  ) {
    steps.push({
      step: "Document critical workflows",
      owner: "Client",
      timeline: "Week 1 of engagement",
      output:
        discovery.sop_insights.documentation_gaps.slice(0, 3).join(", ") +
        " documented",
    });
  }

  if (serviceType === "Dedicated VA" || serviceType === "Unicorn VA Service") {
    steps.push(
      {
        step: "Post role(s) and begin sourcing",
        owner: "Level 9 Virtual",
        timeline: "Within 48h of approval",
        output: "Active candidate pipeline",
      },
      {
        step: "Set up KPI tracking infrastructure",
        owner: "Client + VA",
        timeline: "Week 1 of onboarding",
        output: "Dashboard/tracking system live",
      }
    );
  } else if (serviceType === "Projects on Demand") {
    steps.push(
      {
        step: "Prioritize and schedule projects",
        owner: "Client + Level 9 Virtual",
        timeline: "Within 48h of approval",
        output: "Project execution timeline confirmed",
      },
      {
        step: "Assign specialist resources",
        owner: "Level 9 Virtual",
        timeline: "Before each project kickoff",
        output: "Project teams confirmed",
      }
    );
  }

  return steps;
}

function generateOnboardingRoadmap(detailedSpecs: any, serviceType: string) {
  const roadmap: any = {
    week_1: {},
    week_2: {},
    week_3_4: {},
  };

  if (serviceType === "Dedicated VA") {
    const jd = detailedSpecs;
    const title = jd.title;

    roadmap.week_1[title] = [
      `Grant access to: ${jd.tools.map((t: any) => t.tool).join(", ")}`,
      `Share SOPs for: ${jd.responsibilities[0]?.category || "core workflows"}`,
      `Complete setup: ${jd.communication_structure.tools.join(", ")}`,
    ];

    roadmap.week_2[title] = [
      `Shadow existing workflows and document understanding`,
      `First hands-on task: ${
        jd.responsibilities[0]?.details?.[0]?.split("—")[0] || "Initial project"
      }`,
      `Establish ${jd.communication_structure.weekly_sync} cadence`,
    ];

    roadmap.week_3_4[title] = [
      `Take ownership of: ${jd.primary_outcome}`,
      `Begin tracking: ${jd.kpis
        .slice(0, 2)
        .map((k: any) => k.metric)
        .join(", ")}`,
      `30-day check-in against success indicators`,
    ];
  } else if (serviceType === "Unicorn VA Service") {
    const coreJd = detailedSpecs.core_va_jd;
    const title = coreJd.title;

    roadmap.week_1[title] = [
      `Grant access to: ${coreJd.tools.map((t: any) => t.tool).join(", ")}`,
      `Introduce team support structure and request process`,
      `Complete setup: ${coreJd.communication_structure.tools.join(", ")}`,
    ];

    roadmap.week_2[title] = [
      `Shadow core workflows`,
      `First hands-on task: ${
        coreJd.responsibilities[0]?.details?.[0]?.split("—")[0] ||
        "Initial project"
      }`,
      `Submit first team support request for specialized task`,
    ];

    roadmap.week_3_4[title] = [
      `Take ownership of core recurring work`,
      `Establish rhythm with team specialists`,
      `30-day check-in on core outcomes and team utilization`,
    ];
  } else if (serviceType === "Projects on Demand") {
    roadmap.project_kickoff = {
      "All Projects": [
        "Confirm project scope and deliverables with client",
        "Verify access to required tools and resources",
        "Establish communication protocol and milestone review schedule",
      ],
    };

    roadmap.execution_phase = {
      "All Projects": [
        "Regular progress updates at defined milestones",
        "Client review and feedback on deliverables",
        "Adjust timeline if dependencies surface",
      ],
    };

    roadmap.completion = {
      "All Projects": [
        "Final deliverable submission with documentation",
        "Client acceptance and sign-off",
        "Post-project review and lessons learned",
      ],
    };
  }

  return roadmap;
}

function generateMilestones(serviceType: string, specs: any) {
  if (serviceType === "Dedicated VA") {
    return {
      week_2: "Initial setup and tool access complete",
      week_4: "First workflow/deliverable shipped",
      week_8: "Independent execution on core responsibilities",
      week_12: "90-day outcomes on track",
    };
  }

  if (serviceType === "Projects on Demand") {
    const projects = specs.projects || [];
    const milestones: any = {};

    projects.forEach((project: any, index: number) => {
      milestones[
        `project_${index + 1}_kickoff`
      ] = `${project.project_name}: Scope confirmed, resources allocated`;
      milestones[
        `project_${index + 1}_completion`
      ] = `${project.project_name}: All deliverables accepted`;
    });

    return milestones;
  }

  if (serviceType === "Unicorn VA Service") {
    return {
      week_2: "Core VA onboarded, team access established",
      week_4: "First core workflow delivered + first team request completed",
      week_8: "Core VA independent, team support rhythm established",
      week_12: "90-day outcomes on track with balanced VA/team utilization",
    };
  }

  return {};
}

function generateMonitoringPlan(validation: any) {
  const highRisks = validation.risk_analysis
    .filter((r: any) => r.severity === "high")
    .map((r: any) => ({
      risk: r.risk,
      check_in: "Weekly during first month",
      watch_for: r.early_warning_signs,
    }));

  return {
    high_priority_risks: highRisks,
    quality_checks: [
      {
        checkpoint: "Week 2",
        assess: [
          "Are KPIs being tracked?",
          "Is communication rhythm working?",
          "Any tool access issues?",
        ],
      },
      {
        checkpoint: "Week 4",
        assess: [
          "Is work progressing independently?",
          "Are outcomes on track?",
          "Any scope creep?",
        ],
      },
      {
        checkpoint: "Week 8",
        assess: ["Will we hit 90-day targets?", "Should structure adjust?"],
      },
    ],
    adjustment_triggers: validation.assumptions_to_validate
      .filter((a: any) => a.criticality === "high")
      .map((a: any) => ({
        trigger: a.assumption,
        action: a.if_wrong,
      })),
  };
}

//Main Function

export async function POST(request: NextRequest) {
  try {
    // Check rate limit (before expensive operations)
    // Note: Auth is optional for this endpoint, so requireAuth is false
    const rateLimit = await withRateLimit(request, "/api/jd/analyze", {
      requireAuth: false,
    });

    if (!rateLimit.allowed) {
      return rateLimit.response!;
    }

    // Parse request - frontend sends JSON with file URLs from S3
    const body = await request.json();
    const intake_json = body?.intake_json;
    const sopFileUrl = body?.sopFileUrl || null;
    const sopFileName = body?.sopFileName || null;
    const sopFileType = body?.sopFileType || null;
    const sopFileKey = body?.sopFileKey || null;

    const normalizedTasks = normalizeTasks(intake_json?.tasks_top5);

    if (!intake_json?.brand?.name || normalizedTasks.length === 0) {
      return NextResponse.json(
        { error: "Invalid intake data" },
        { status: 400 }
      );
    }

    const normalizedTools = normalizeStringArray(intake_json?.tools);
    const normalizedRequirements = normalizeStringArray(
      intake_json?.requirements
    );
    const weeklyHours = Number(intake_json?.weekly_hours) || 0;
    const clientFacing = Boolean(intake_json?.client_facing);

    const augmentedIntakeJson = {
      ...intake_json,
      tasks_top5: normalizedTasks,
      tools: normalizedTools,
      requirements: normalizedRequirements,
      weekly_hours: weeklyHours,
      client_facing: clientFacing,
    };

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Fetch Knowledge Base if user is authenticated
    let knowledgeBase: any = null;
    let knowledgeBaseVersion: number | null = null;
    let knowledgeBaseSnapshot: any = null;
    let organizationId: string | null = null;
    let userOrgId: string | null = null; // For learning events triggeredBy

    try {
      const cookieStore = await cookies();
      const accessToken = cookieStore.get("accessToken")?.value;

      if (accessToken) {
        const decoded = await verifyAccessToken(accessToken);
        if (decoded) {
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

          if (userOrg) {
            organizationId = userOrg.organizationId;
            userOrgId = userOrg.id;
            knowledgeBase = await prisma.organizationKnowledgeBase.findUnique({
              where: { organizationId: userOrg.organizationId },
              select: {
                id: true,
                version: true,
                // Core Identity Tier 1
                businessName: true,
                website: true,
                industry: true,
                industryOther: true,
                whatYouSell: true,
                // Business Context Tier 1
                monthlyRevenue: true,
                teamSize: true,
                primaryGoal: true,
                biggestBottleNeck: true,
                // Customer and Market Tier 2
                idealCustomer: true,
                topObjection: true,
                coreOffer: true,
                customerJourney: true,
                // Operations and Tools Tier 2
                toolStack: true,
                primaryCRM: true,
                defaultTimeZone: true,
                bookingLink: true,
                supportEmail: true,
                // Brand & Voice Tier 2
                brandVoiceStyle: true,
                riskBoldness: true,
                voiceExampleGood: true,
                voiceExamplesAvoid: true,
                contentLinks: true,
                // Compliance Tier 2
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
                // Exclude large Json fields to save storage:
                // aiInsights, extractedKnowledge, proofFiles, completenessBreakdown, aiQualityAnalysis
              },
            });

            if (knowledgeBase) {
              // Store the KB version number (OrganizationKnowledgeBase.version)
              // This will be saved as SavedAnalysis.usedKnowledgeBaseVersion
              knowledgeBaseVersion = knowledgeBase.version;
              console.log(
                `[KB] Found KB for org ${organizationId}, version: ${knowledgeBaseVersion}`
              );

              // Create snapshot of KB state (hybrid: all non-Json fields)
              // Excludes large Json fields (aiInsights, extractedKnowledge, proofFiles, etc.)
              // to balance storage cost with audit trail completeness
              knowledgeBaseSnapshot = {
                version: knowledgeBase.version,
                // Core Identity
                businessName: knowledgeBase.businessName,
                website: knowledgeBase.website,
                industry: knowledgeBase.industry,
                industryOther: knowledgeBase.industryOther,
                whatYouSell: knowledgeBase.whatYouSell,
                // Business Context
                monthlyRevenue: knowledgeBase.monthlyRevenue,
                teamSize: knowledgeBase.teamSize,
                primaryGoal: knowledgeBase.primaryGoal,
                biggestBottleNeck: knowledgeBase.biggestBottleNeck,
                // Customer and Market
                idealCustomer: knowledgeBase.idealCustomer,
                topObjection: knowledgeBase.topObjection,
                coreOffer: knowledgeBase.coreOffer,
                customerJourney: knowledgeBase.customerJourney,
                // Operations and Tools
                toolStack: knowledgeBase.toolStack,
                primaryCRM: knowledgeBase.primaryCRM,
                defaultTimeZone: knowledgeBase.defaultTimeZone,
                bookingLink: knowledgeBase.bookingLink,
                supportEmail: knowledgeBase.supportEmail,
                // Brand & Voice
                brandVoiceStyle: knowledgeBase.brandVoiceStyle,
                riskBoldness: knowledgeBase.riskBoldness,
                voiceExampleGood: knowledgeBase.voiceExampleGood,
                voiceExamplesAvoid: knowledgeBase.voiceExamplesAvoid,
                contentLinks: knowledgeBase.contentLinks,
                // Compliance
                isRegulated: knowledgeBase.isRegulated,
                regulatedIndustry: knowledgeBase.regulatedIndustry,
                forbiddenWords: knowledgeBase.forbiddenWords,
                disclaimers: knowledgeBase.disclaimers,
                // HR Defaults
                defaultWeeklyHours: knowledgeBase.defaultWeeklyHours,
                defaultManagementStyle: knowledgeBase.defaultManagementStyle,
                defaultEnglishLevel: knowledgeBase.defaultEnglishLevel,
                // Proof & Credibility
                proofAssets: knowledgeBase.proofAssets,
                // Additional Context
                pipeLineStages: knowledgeBase.pipeLineStages,
                emailSignOff: knowledgeBase.emailSignOff,
                // Versioning
                lastEditedBy: knowledgeBase.lastEditedBy,
                lastEditedAt: knowledgeBase.lastEditedAt,
                contributors: knowledgeBase.contributors,
                // Enrichment tracking
                lastEnrichedAt: knowledgeBase.lastEnrichedAt,
                enrichmentVersion: knowledgeBase.enrichmentVersion,
                // Metadata
                snapshotAt: new Date().toISOString(),
                // Note: Large Json fields excluded (aiInsights, extractedKnowledge, proofFiles, etc.)
                // to optimize storage while maintaining audit trail
              };
              console.log(
                `[KB] Created snapshot with ${
                  Object.keys(knowledgeBaseSnapshot).length
                } fields`
              );
            } else {
              console.log(`[KB] No KB found for org ${organizationId}`);
            }
          } else {
            console.log(`[KB] No userOrg found for user`);
          }
        } else {
          console.log(`[KB] Token verification failed`);
        }
      } else {
        console.log(`[KB] No access token found`);
      }
    } catch (kbError) {
      // If KB fetch fails, continue without KB context (non-blocking)
      console.warn(
        "Failed to fetch knowledge base, continuing without KB context:",
        kbError
      );
    }

    //Stage 1: Deep Discovery

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendProgress = (stage: string) => {
          const progress = JSON.stringify({ type: "progress", stage });
          controller.enqueue(encoder.encode(progress + "\n"));
        };

        try {
          let websiteContent: any = null;
          if (
            augmentedIntakeJson.website &&
            augmentedIntakeJson.website.trim()
          ) {
            sendProgress("Extracting company information from website...");
            try {
              const extracted = await extractFromUrl(
                augmentedIntakeJson.website,
                true // useCache
              );
              websiteContent = transformWebsiteContent(extracted);
              console.log("Extracted website content:", {
                hasHero: !!websiteContent.hero,
                hasAbout: !!websiteContent.about,
                hasServices: !!websiteContent.services,
                testimonialsCount: websiteContent.testimonials?.length || 0,
                fullTextLength: websiteContent.fullText?.length || 0,
              });
            } catch (websiteError) {
              console.error("Error extracting website content:", websiteError);
              websiteContent = null;
            }
          }

          let sopText: string | null = null;

          if (sopFileUrl && sopFileName) {
            sendProgress("Processing SOP file...");
            try {
              const extracted = await extractFromFile(
                sopFileUrl,
                sopFileName,
                sopFileType || undefined,
                sopFileKey || undefined,
                true // useCache
              );

              // Use cleanedText if available (raw extracted text), otherwise use summary
              sopText = extracted.cleanedText || extracted.summary || "";

              if (!sopText || sopText.trim().length === 0) {
                throw new Error("SOP file extraction returned no content");
              }
            } catch (extractionError) {
              console.error("SOP extraction failed:", extractionError);
              const errorMsg = JSON.stringify({
                type: "error",
                error: "Failed to parse the SOP file.",
                details:
                  extractionError instanceof Error
                    ? extractionError.message
                    : "Unknown error",
              });
              controller.enqueue(encoder.encode(errorMsg + "\n"));
              controller.close();
              return;
            }
          }

          sendProgress("Stage 1: Running deep discovery...");
          const discovery = await runDeepDiscovery(
            openai,
            {
              ...augmentedIntakeJson,
              websiteContent,
            },
            sopText,
            knowledgeBase
          );

          sendProgress("Stage 1.5: Classifying service type...");
          const serviceClassification = await classifyServiceType(
            openai,
            {
              ...augmentedIntakeJson,
              websiteContent,
            },
            discovery,
            knowledgeBase
          );

          const recommendedService =
            serviceClassification.service_type_analysis.recommended_service;
          sendProgress(
            `Stage 2: Designing role architecture for ${recommendedService}...`
          );
          const architecture = await designRoleArchitecture(
            openai,
            {
              ...augmentedIntakeJson,
              websiteContent,
            },
            discovery,
            serviceClassification,
            knowledgeBase
          );

          sendProgress("Stage 3: Generating detailed specifications...");
          let detailedSpecs;

          if (recommendedService === "Dedicated VA") {
            detailedSpecs = await generateDetailedJD(
              openai,
              architecture.dedicated_va_role,
              discovery,
              {
                ...augmentedIntakeJson,
                websiteContent,
              }
            );
          } else if (recommendedService === "Projects on Demand") {
            detailedSpecs = await generateProjectSpecs(
              openai,
              architecture.projects,
              discovery,
              {
                ...augmentedIntakeJson,
                websiteContent,
              }
            );
          } else if (recommendedService === "Unicorn VA Service") {
            detailedSpecs = {
              core_va_jd: await generateDetailedJD(
                openai,
                architecture.core_va_role,
                discovery,
                {
                  ...augmentedIntakeJson,
                  websiteContent,
                }
              ),
              team_support_specs: architecture.team_support_areas,
            };
          }

          sendProgress("Stage 4: Validating and analyzing risks...");
          const validation = await validateAndAnalyzeRisks(
            openai,
            architecture,
            detailedSpecs,
            discovery,
            {
              ...augmentedIntakeJson,
              websiteContent,
            },
            serviceClassification
          );

          sendProgress("Stage 5: Assembling client package...");
          const clientPackage = assembleClientPackage(
            discovery,
            architecture,
            detailedSpecs,
            validation,
            augmentedIntakeJson,
            serviceClassification
          );

          const preview: any = {
            summary: clientPackage.executive_summary.what_you_told_us,
            primary_outcome: augmentedIntakeJson.outcome_90d,

            service_type: recommendedService,
            service_confidence:
              serviceClassification.service_type_analysis.confidence,
            service_reasoning:
              serviceClassification.service_type_analysis.decision_logic,

            confidence: validation.quality_assessment.overall_confidence,
            key_risks: validation.risk_analysis
              .filter((r: any) => r.severity === "high")
              .slice(0, 3)
              .map((r: any) => r.risk),
            critical_questions: [
              ...discovery.context_gaps.slice(0, 2).map((q: any) => q.question),
              ...serviceClassification.service_type_analysis.client_validation_questions
                .slice(0, 1)
                .map((q: any) => q.question),
            ],
          };

          if (recommendedService === "Dedicated VA") {
            preview.role_title = architecture.dedicated_va_role.title;
            preview.hours_per_week =
              architecture.dedicated_va_role.hours_per_week;
          } else if (recommendedService === "Projects on Demand") {
            preview.project_count = architecture.projects.length;
            preview.total_hours = architecture.total_investment.hours;
            preview.estimated_timeline = architecture.total_investment.timeline;
          } else if (recommendedService === "Unicorn VA Service") {
            preview.core_va_title = architecture.core_va_role.title;
            preview.core_va_hours = architecture.core_va_role.hours_per_week;
            preview.team_support_areas = architecture.team_support_areas.length;
          }

          const response = {
            preview,
            full_package: clientPackage,
            metadata: {
              stages_completed: [
                "Discovery",
                "Service Classification",
                "Architecture",
                "Specification Generation",
                "Validation",
              ],
              service_type: recommendedService,
              service_classification_scores:
                serviceClassification.service_type_analysis.service_fit_scores,
              sop_processed: Boolean(sopText),
              discovery_insights_count:
                discovery.task_analysis.task_clusters.length,
              risks_identified: validation.risk_analysis.length,
              quality_scores: validation.quality_assessment,
            },
          };

          const cleanedResponse = cleanTeamSupportAreas(response);

          const extractedInsights = await extractInsights(
            "JOB_DESCRIPTION",
            cleanedResponse
          );

          const sourceId = knowledgeBase
            ? `jd-analysis-${Date.now()}-${knowledgeBase.id.substring(0, 8)}`
            : `jd-analysis-${Date.now()}`;

          if (knowledgeBase && architecture) {
            try {
              const roleTitle =
                architecture.dedicated_va_role?.title ||
                architecture.core_va_role?.title;
              const serviceType = recommendedService;
              const hoursPerWeek =
                architecture.dedicated_va_role?.hours_per_week ||
                architecture.core_va_role?.hours_per_week;

              if (roleTitle && serviceType) {
                await updateHiringHistory(knowledgeBase.id, {
                  roleTitle,
                  serviceType,
                  hoursPerWeek,
                  sourceId,
                });
                console.log(
                  `[JD Analysis] Updated hiring history: ${roleTitle} (${serviceType})`
                );
              }

              if (serviceClassification?.service_type_analysis) {
                const sta = serviceClassification.service_type_analysis;
                await updateServicePreferences(knowledgeBase.id, {
                  recommendedService: sta.recommended_service,
                  serviceFitScores: {
                    dedicatedVA:
                      sta.service_fit_scores?.dedicated_va?.score || 0,
                    projectsOnDemand:
                      sta.service_fit_scores?.projects_on_demand?.score || 0,
                    unicornVA: sta.service_fit_scores?.unicorn_va?.score || 0,
                  },
                  reasoning: sta.decision_logic,
                  sourceId,
                });
                console.log(
                  `[JD Analysis] Updated service preferences: ${sta.recommended_service}`
                );
              }

              if (discovery?.task_analysis?.skill_requirements) {
                const skills = discovery.task_analysis.skill_requirements;
                await updateSkillRequirements(knowledgeBase.id, {
                  technical: skills.technical,
                  soft: skills.soft,
                  domain: skills.domain,
                  sourceId,
                });
                console.log(`[JD Analysis] Updated skill requirements`);
              }

              if (discovery?.business_context?.primary_bottleneck) {
                await updateBottleneckHistory(
                  knowledgeBase.id,
                  discovery.business_context.primary_bottleneck,
                  sourceId
                );
                console.log(`[JD Analysis] Updated bottleneck history`);
              }
            } catch (fieldUpdateError) {
              console.error(
                "[JD Analysis] Error updating JD-specific fields (non-blocking):",
                fieldUpdateError
              );
            }
          }

          const finalResponse = {
            ...cleanedResponse,
            knowledgeBase: {
              used: !!knowledgeBase,
              version: knowledgeBaseVersion,
              snapshot: knowledgeBaseSnapshot,
              organizationId: organizationId,
            },
            extractedInsights:
              extractedInsights.length > 0 ? extractedInsights : undefined,
          };

          console.log(`[KB Response] Sending KB metadata:`, {
            hasKB: !!knowledgeBase,
            version: knowledgeBaseVersion,
            hasSnapshot: !!knowledgeBaseSnapshot,
            organizationId: organizationId,
            insightsCount: extractedInsights.length,
          });

          const final = JSON.stringify({
            type: "result",
            data: finalResponse,
          });
          controller.enqueue(encoder.encode(final + "\n"));
          controller.close();
        } catch (error) {
          console.error("Analysis pipeline error:", error);
          const formattedError = formatErrorMessage(error);
          const errorMsg = JSON.stringify({
            type: "error",
            error: formattedError.error,
            details: formattedError.details,
            userMessage: formattedError.userMessage,
          });
          controller.enqueue(encoder.encode(errorMsg + "\n"));
          controller.close();
        }
      },
    });

    const response = new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

    if (rateLimit.rateLimitResult) {
      const rateLimitHeaders =
        require("@/lib/rate-limiting/rate-limit").getRateLimitHeaders(
          rateLimit.rateLimitResult
        );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, String(value));
      });
    }

    return response;
  } catch (error) {
    console.error("JD Analysis error:", error);
    const formattedError = formatErrorMessage(error);
    return NextResponse.json(
      {
        error: formattedError.error,
        details: formattedError.details,
        userMessage: formattedError.userMessage,
      },
      { status: 500 }
    );
  }
}
