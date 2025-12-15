import { FormConfig } from "./jdFormConfig";

export const sopGeneratorConfig: FormConfig = {
  storageKey: "sop-generator-form-data",
  title: undefined,
  description: undefined,
  sections: [
    {
      id: "essential",
      title: "Essential Process Details",
      description:
        "These are required to generate a usable SOP. Aim to be clear rather than perfect.",
      fields: [
        {
          id: "sopTitle",
          label: "SOP Title / Process Name",
          type: "text",
          placeholder:
            "e.g., Customer Onboarding Process, Monthly Payroll Processing",
          required: true,
        },
        {
          id: "processOverview",
          label: "What does this process accomplish? (Process Overview)",
          type: "textarea",
          placeholder: "Describe the end goal in 2–3 sentences",
          required: true,
        },
        {
          id: "primaryRole",
          label: "Who performs this process? (Primary Role/User)",
          type: "text",
          placeholder: "e.g., Sales Manager, Customer Service Rep, Accounting Team",
          required: true,
        },
        {
          id: "mainSteps",
          label: "Main Steps",
          type: "textarea",
          placeholder:
            "List the major steps in order. Start each step on a new line. You can be brief – the AI will expand on these.",
          helpText:
            "Start each step on a new line. The AI will expand and structure these into detailed sub-steps.",
          required: true,
        },
        {
          id: "toolsUsed",
          label: "What tools/software are used?",
          type: "textarea",
          placeholder:
            "e.g., Salesforce, Excel, Shopify admin panel, Google Sheets",
          required: true,
        },
        {
          id: "frequency",
          label: "How often is this performed?",
          type: "select",
          required: true,
          options: [
            { label: "Daily", value: "Daily" },
            { label: "Weekly", value: "Weekly" },
            { label: "Monthly", value: "Monthly" },
            { label: "Quarterly", value: "Quarterly" },
            { label: "As-needed", value: "As-needed" },
            { label: "One-time", value: "One-time" },
          ],
        },
        {
          id: "trigger",
          label: "What triggers this process? (When to start)",
          type: "textarea",
          placeholder:
            "e.g., New customer signs up, End of month, Manager approval received",
          required: true,
        },
        {
          id: "successCriteria",
          label: "How do you know it's done correctly? (Success Criteria)",
          type: "textarea",
          placeholder:
            "e.g., Customer receives welcome email, All fields are filled, Report shows no errors",
          required: true,
        },
      ],
    },
    {
      id: "context-scope",
      title: "Context & Scope (Recommended)",
      description:
        "Optional but highly recommended. This context helps the AI generate more accurate and relevant SOPs.",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "industry",
          label: "Industry / Business Type",
          type: "select",
          placeholder: "Which best describes your business?",
          helpText: "Which best describes your business?",
          options: [
            {
              label: "Financial Services & Insurance",
              value: "Financial Services & Insurance",
            },
            { label: "Legal Services", value: "Legal Services" },
            {
              label: "Real Estate & Property",
              value: "Real Estate & Property",
            },
            {
              label: "Home Services & Contractors",
              value: "Home Services & Contractors",
            },
            {
              label: "Medical, Dental & Healthcare",
              value: "Medical, Dental & Healthcare",
            },
            {
              label: "Beauty, Aesthetics & Wellness",
              value: "Beauty, Aesthetics & Wellness",
            },
            { label: "Fitness & Sports", value: "Fitness & Sports" },
            {
              label: "Hospitality, Travel & Tourism",
              value: "Hospitality, Travel & Tourism",
            },
            {
              label: "Restaurants, Cafes & Food/Beverage",
              value: "Restaurants, Cafes & Food/Beverage",
            },
            {
              label: "Events, Weddings & Entertainment",
              value: "Events, Weddings & Entertainment",
            },
            {
              label: "Advertising, Marketing & Creative Services",
              value: "Advertising, Marketing & Creative Services",
            },
            {
              label: "Professional & B2B Services",
              value: "Professional & B2B Services",
            },
            {
              label: "Manufacturing, Industrial & Construction",
              value: "Manufacturing, Industrial & Construction",
            },
            {
              label: "Retail (Physical Store)",
              value: "Retail (Physical Store)",
            },
            { label: "Automotive", value: "Automotive" },
            { label: "Education & Training", value: "Education & Training" },
            {
              label: "Nonprofit, Charity, Church / Faith-Based",
              value: "Nonprofit, Charity, Church / Faith-Based",
            },
            {
              label: "Government / Public Sector",
              value: "Government / Public Sector",
            },
            { label: "Other", value: "other" },
          ],
        },
        {
          id: "industryOther",
          label: "Describe Your Niche",
          type: "text",
          placeholder: "Tell us your niche in a few words",
          showIf: { field: "industry", value: "other" },
          helpText: "Describe your business niche",
        },
        {
          id: "department",
          label: "Department / Team",
          type: "text",
          placeholder: "e.g., Sales, Operations, Customer Support, Finance",
        },
        {
          id: "estimatedTime",
          label: "Estimated time to complete",
          type: "text",
          placeholder: "e.g., 15 minutes, 2 hours, 3–5 days",
        },
      ],
    },
    {
      id: "detail-accuracy",
      title: "Detail & Accuracy",
      description:
        "Capture decision points, variations, and common pitfalls to make the SOP truly useful.",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "decisionPoints",
          label: "Decision points or variations",
          type: "textarea",
          placeholder:
            "Are there different paths depending on circumstances?\n\nE.g., \"If customer is enterprise, follow approval process A; if SMB, follow process B.\"",
        },
        {
          id: "commonMistakes",
          label: "Common mistakes or failure points",
          type: "textarea",
          placeholder: "Where do people typically get stuck or make errors?",
        },
        {
          id: "requiredResources",
          label: "Resources/documents needed",
          type: "textarea",
          placeholder:
            "e.g., Customer data template, approval form, price list, login credentials",
        },
      ],
    },
    {
      id: "roles-quality",
      title: "Roles & Quality Standards",
      description:
        "Clarify who is involved and what \"good\" looks like for this process.",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "supportingRoles",
          label: "Who else is involved? (Supporting roles)",
          type: "textarea",
          placeholder:
            "Who needs to approve, provide input, or be notified?\n\nE.g., Manager approvals, Finance sign-off, Legal review.",
        },
        {
          id: "qualityStandards",
          label: "Quality standards or requirements",
          type: "textarea",
          placeholder:
            "e.g., Must match 100%, Response time under 24hrs, Accuracy rate 99%+",
        },
        {
          id: "complianceRequirements",
          label: "Compliance or safety requirements",
          type: "textarea",
          placeholder:
            "Any regulations, policies, or safety protocols that must be followed?",
        },
      ],
    },
    {
      id: "enhancement",
      title: "Enhancement & Context",
      description:
        "Optional fields that help the AI connect this SOP to the bigger picture and add practical wisdom.",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "relatedProcesses",
          label: "Related processes or SOPs",
          type: "textarea",
          placeholder:
            "e.g., This comes after 'Lead Qualification' and before 'Account Setup'",
        },
        {
          id: "tipsBestPractices",
          label: "Tips or best practices",
          type: "textarea",
          placeholder:
            "Insider knowledge from experienced team members that makes this process smoother or higher quality.",
        },
        {
          id: "additionalContext",
          label: "Additional context (Brain dump field)",
          type: "textarea",
          placeholder:
            "Anything else we should know? Paste rough notes, screenshots, or context here.",
          helpText:
            "Use this as a catch-all for details that don’t fit neatly into other fields.",
        },
      ],
    },
  ],
  defaultValues: {
    sopTitle: "",
    processOverview: "",
    primaryRole: "",
    mainSteps: "",
    toolsUsed: "",
    frequency: "",
    trigger: "",
    successCriteria: "",
    industry: "",
    industryOther: "",
    department: "",
    estimatedTime: "",
    decisionPoints: "",
    commonMistakes: "",
    requiredResources: "",
    supportingRoles: "",
    qualityStandards: "",
    complianceRequirements: "",
    relatedProcesses: "",
    tipsBestPractices: "",
    additionalContext: "",
  },
  submitButtonText: "Generate SOP",
  apiEndpoint: "/api/sop/generate",
};


