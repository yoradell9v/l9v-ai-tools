import { FormConfig } from "./jdFormConfig";

export const organizationKnowledgeBaseConfig: FormConfig = {
  storageKey: "organization-knowledge-base-form-data",
  title: "Organization Knowledge Base",
  description:
    "Set up your organization's knowledge base. All team members can help fill this out.",
  sections: [
    {
      id: "required-fields",
      title: "Required Information",
      description:
        "These fields are required to complete your organization profile",
      fields: [
        {
          id: "businessName",
          label: "Business Name",
          type: "text",
          placeholder: "Acme Inc.",
          required: true,
          helpText: "Your organization's business name",
          validation: {
            minLength: 1,
            maxLength: 255,
          },
        },
        {
          id: "website",
          label: "Website",
          type: "text",
          placeholder: "https://example.com or 'none yet'",
          required: true,
          helpText:
            "Please enter a valid URL, or type 'none yet' if you don't have a website.",
          validation: {
            pattern: "https?://.*|none yet",
          },
        },
        {
          id: "industry",
          label: "Industry / Business Type",
          type: "select",
          required: true,
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
          helpText: "Required when 'Other' is selected for industry",
          required: true,
          validation: {
            minLength: 1,
            maxLength: 255,
          },
        },
        {
          id: "whatYouSell",
          label: "What You Sell / Your Core Product or Service",
          type: "textarea",
          required: true,
          placeholder:
            "Describe what your business sells or the main service you provide",
          helpText: "A clear description of your primary offering",
        },
      ],
    },
    {
      id: "business-context",
      title: "Business Context",
      description: "Core business information and goals",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "monthlyRevenue",
          label: "Current Monthly Revenue Range",
          type: "select",
          options: [
            {
              label: "Pre-revenue / Just starting",
              value: "Pre-revenue / Just starting",
            },
            { label: "$5k–$20k/month", value: "$5k–$20k/month" },
            { label: "$20k–$100k/month", value: "$20k–$100k/month" },
            { label: "$100k+/month", value: "$100k+/month" },
          ],
        },
        {
          id: "teamSize",
          label: "Team Size",
          type: "select",
          options: [
            { label: "1-5", value: "1-5" },
            { label: "6-20", value: "6-20" },
            { label: "21-50", value: "21-50" },
            { label: "51-100", value: "51-100" },
            { label: "100+", value: "100+" },
          ],
        },
        {
          id: "primaryGoal",
          label: "Primary Business Goal",
          type: "textarea",
          placeholder: "What is your main business objective right now?",
          helpText:
            "e.g., Increase revenue, expand team, enter new markets, improve efficiency",
        },
        {
          id: "biggestBottleNeck",
          label: "Biggest Bottleneck or Challenge",
          type: "textarea",
          placeholder: "What's currently holding your business back?",
          helpText: "Identify the main obstacle preventing growth or success",
        },
      ],
    },
    {
      id: "customer-market",
      title: "Customer & Market",
      description: "Information about your customers and market positioning",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "idealCustomer",
          label: "Ideal Customer Profile",
          type: "textarea",
          placeholder: "Describe your ideal customer in detail",
          helpText:
            "Who is your target customer? Include demographics, psychographics, pain points, etc.",
        },
        {
          id: "topObjection",
          label: "Top Customer Objection",
          type: "textarea",
          placeholder: "What's the main reason prospects say no?",
          helpText:
            "The most common objection you hear from potential customers",
        },
        {
          id: "coreOffer",
          label: "Core Offer / Main Product or Service",
          type: "textarea",
          placeholder: "Describe your primary offer in detail",
          helpText:
            "Your main product, service, or solution that drives revenue",
        },
        {
          id: "customerJourney",
          label: "Customer Journey",
          type: "textarea",
          placeholder:
            "Describe the typical customer journey from awareness to purchase",
          helpText: "How do customers discover, evaluate, and buy from you?",
        },
      ],
    },
    {
      id: "operations-tools",
      title: "Operations & Tools",
      description: "Technology stack and operational details",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "toolStack",
          label: "Tool Stack / Software Stack",
          type: "textarea",
          placeholder:
            "e.g., GoHighLevel, Slack, ClickUp, Canva, WordPress, Notion, Zapier, HubSpot, Salesforce, Asana, Trello",
          helpText:
            "List the tools and technologies your team uses (comma-separated or one per line). This will be stored as an array.",
        },
        {
          id: "primaryCRM",
          label: "Primary CRM / Platform",
          type: "text",
          placeholder: "GoHighLevel, HubSpot, Salesforce, etc.",
          helpText:
            "Which platform do you mainly use for contacts and pipelines?",
        },
        {
          id: "defaultTimeZone",
          label: "Default Timezone",
          type: "select",
          options: [
            { label: "EST (UTC-5)", value: "EST" },
            { label: "CST (UTC-6)", value: "CST" },
            { label: "MST (UTC-7)", value: "MST" },
            { label: "PST (UTC-8)", value: "PST" },
            { label: "GMT (UTC+0)", value: "GMT" },
            { label: "CET (UTC+1)", value: "CET" },
            { label: "IST (UTC+5:30)", value: "IST" },
            { label: "SGT (UTC+8)", value: "SGT" },
            { label: "AEST (UTC+10)", value: "AEST" },
          ],
        },
        {
          id: "bookingLink",
          label: "Booking / Calendar Link",
          type: "text",
          placeholder: "https://calendly.com/your-link or similar",
          helpText: "Link to your booking or scheduling system",
        },
        {
          id: "supportEmail",
          label: "Support Email",
          type: "text",
          placeholder: "support@example.com",
          helpText: "Primary email address for customer support",
        },
      ],
    },
    {
      id: "brand-voice",
      title: "Brand & Voice",
      description:
        "Define your organization's brand voice and communication style",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "brandVoiceStyle",
          label: "Brand Voice Style",
          type: "select",
          helpText: "Which best matches how you want to sound?",
          options: [
            {
              label: "Professional but friendly",
              value: "Professional but friendly",
            },
            {
              label: "Casual and conversational",
              value: "Casual and conversational",
            },
            { label: "Bold and high-energy", value: "Bold and high-energy" },
            {
              label: "Inspirational and story-driven",
              value: "Inspirational and story-driven",
            },
          ],
        },
        {
          id: "riskBoldness",
          label: "Risk / Boldness Level",
          type: "select",
          helpText: "How bold can we be in your marketing?",
          options: [
            {
              label: "Low – keep it safe and conservative",
              value: "Low – keep it safe and conservative",
            },
            {
              label: "Medium – some bold hooks, nothing controversial",
              value: "Medium – some bold hooks, nothing controversial",
            },
            {
              label:
                "High – strong pattern interrupts and bold claims (within truth/legal limits)",
              value:
                "High – strong pattern interrupts and bold claims (within truth/legal limits)",
            },
          ],
        },
        {
          id: "voiceExampleGood",
          label: "Voice Example (Good)",
          type: "textarea",
          placeholder:
            "Paste examples of messaging that represents your ideal voice",
          helpText:
            "Examples of content, copy, or messaging that you love and want to emulate",
        },
        {
          id: "voiceExamplesAvoid",
          label: "Voice Examples (Avoid)",
          type: "textarea",
          placeholder: "Paste examples of messaging you want to avoid",
          helpText:
            "Examples of content, copy, or messaging that doesn't match your brand",
        },
        {
          id: "contentLinks",
          label: "Content Links / Examples",
          type: "textarea",
          placeholder:
            "Links to your website, social media, or content examples",
          helpText:
            "URLs to your content, website pages, or social media that showcase your brand voice",
        },
      ],
    },
    {
      id: "compliance",
      title: "Compliance & Legal",
      description: "Legal requirements and restricted language",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "isRegulated",
          label: "Are you in a regulated industry?",
          type: "select",
          options: [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ],
        },
        {
          id: "regulatedIndustry",
          label: "Which Industry?",
          type: "select",
          options: [
            { label: "Medical", value: "medical" },
            { label: "Financial", value: "financial" },
            { label: "Legal", value: "legal" },
            { label: "Real Estate", value: "real_estate" },
            { label: "Education", value: "education" },
            { label: "Insurance", value: "insurance" },
            { label: "Other", value: "other" },
          ],
          showIf: { field: "isRegulated", value: "yes" },
        },
        {
          id: "forbiddenWords",
          label: "Any words/claims you absolutely cannot use?",
          type: "textarea",
          placeholder: "guaranteed, 100% success, cure, etc.",
          helpText: "Comma-separated list of forbidden words or claims",
        },
        {
          id: "disclaimers",
          label: "Required Disclaimer Text",
          type: "textarea",
          placeholder: "Results may vary. Individual results not guaranteed.",
          helpText: "Paste exact legal disclaimers that must appear in content",
        },
      ],
    },
    {
      id: "hr-defaults",
      title: "HR Defaults",
      description: "Default settings for HR and team management",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "defaultWeeklyHours",
          label: "Default Weekly Hours",
          type: "select",
          options: [
            { label: "20 hours/week (Part-time)", value: "20" },
            { label: "30 hours/week (Part-time)", value: "30" },
            { label: "40 hours/week (Full-time)", value: "40" },
            { label: "50+ hours/week (Full-time+)", value: "50+" },
          ],
          helpText: "Standard weekly hours for new hires",
        },
        {
          id: "defaultManagementStyle",
          label: "Default Management Style",
          type: "select",
          options: [
            { label: "Hands-on", value: "Hands-on" },
            { label: "Async", value: "Async" },
            { label: "Daily standup", value: "Daily standup" },
            { label: "Weekly", value: "Weekly" },
          ],
          helpText: "Preferred management approach for the team",
        },
        {
          id: "defaultEnglishLevel",
          label: "Default English Level Requirement",
          type: "select",
          options: [
            { label: "Basic", value: "Basic" },
            { label: "Intermediate", value: "Intermediate" },
            { label: "Advanced", value: "Advanced" },
            { label: "Native/Fluent", value: "Native/Fluent" },
          ],
          helpText: "Minimum English proficiency level for team members",
        },
      ],
    },
    {
      id: "proof-credibility",
      title: "Proof & Credibility",
      description: "Assets and files that demonstrate your credibility",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "proofAssets",
          label: "Proof Assets / Social Proof",
          type: "textarea",
          placeholder:
            "Testimonials, case studies, awards, certifications, etc.",
          helpText:
            "Describe or list your proof assets, testimonials, case studies, awards, certifications",
        },
        {
          id: "proofFiles",
          label: "Proof Files",
          type: "file",
          helpText:
            "Upload files such as case studies, testimonials, certifications, awards (PDFs, images, etc.)",
          fileConfig: {
            allowedExtensions: ["pdf", "jpg", "jpeg", "png", "doc", "docx"],
            allowedMimeTypes: [
              "application/pdf",
              "image/jpeg",
              "image/jpg",
              "image/png",
              "application/msword",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
            maxSize: 10 * 1024 * 1024, // 10MB
          },
        },
      ],
    },
    {
      id: "additional-context",
      title: "Additional Context",
      description: "Additional operational and communication details",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "pipeLineStages",
          label: "Pipeline Stages",
          type: "textarea",
          placeholder: "Lead → Qualified → Demo → Proposal → Closed",
          helpText: "Describe your sales or process pipeline stages",
        },
        {
          id: "emailSignOff",
          label: "Email Sign-Off",
          type: "text",
          placeholder: "Best regards, [Name]",
          helpText: "Preferred email sign-off or signature format",
        },
      ],
    },
  ],
  defaultValues: {
    businessName: "",
    website: "",
    industry: "",
    industryOther: "",
    whatYouSell: "",
    monthlyRevenue: "",
    teamSize: "",
    primaryGoal: "",
    biggestBottleNeck: "",
    idealCustomer: "",
    topObjection: "",
    coreOffer: "",
    customerJourney: "",
    toolStack: "",
    primaryCRM: "",
    defaultTimeZone: "",
    bookingLink: "",
    supportEmail: "",
    brandVoiceStyle: "",
    riskBoldness: "",
    voiceExampleGood: "",
    voiceExamplesAvoid: "",
    contentLinks: "",
    isRegulated: "",
    regulatedIndustry: "",
    forbiddenWords: "",
    disclaimers: "",
    defaultWeeklyHours: "",
    defaultManagementStyle: "",
    defaultEnglishLevel: "",
    proofAssets: "",
    proofFiles: "",
    pipeLineStages: "",
    emailSignOff: "",
  },
  submitButtonText: "Save Knowledge Base",
  apiEndpoint: "/api/organization-knowledge-base",
};
