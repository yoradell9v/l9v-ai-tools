import { FormConfig } from "./jdFormConfig";

export const businessBrainFormConfig: FormConfig = {
  storageKey: "business-brain-form-data",
  title: "Set up your Business Brain",
  description: "Fill out the details below to create your Business Brain",
  sections: [
    {
      id: "quick-start",
      title: "Quick Start",
      description:
        "Essential information to get your Business Brain working (8-10 minutes)",
      fields: [
        {
          id: "businessName",
          label: "Business Name",
          type: "text",
          placeholder: "Acme Inc.",
          required: true,
          helpText: "Your business name",
        },
        {
          id: "website",
          label: "Website URL",
          type: "text",
          placeholder: "https://example.com",
          required: true,
          helpText: "Your main website",
        },
        {
          id: "whatYouSell",
          label: "What You Sell (One Sentence)",
          type: "textarea",
          placeholder:
            "We help course creators scale to $50k/month with done-for-you YouTube ads.",
          required: true,
          helpText: "In one sentence, what do you sell and to whom?",
        },
        {
          id: "businessType",
          label: "Business Type",
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
          id: "businessTypeOther",
          label: "Describe Your Niche",
          type: "text",
          placeholder: "Tell us your niche in a few words",
          showIf: { field: "businessType", value: "other" },
          helpText: "Describe your business niche",
        },
        {
          id: "monthlyRevenue",
          label: "Current Monthly Revenue Range",
          type: "select",
          required: true,
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
          id: "goal90Day",
          label: "#1 Goal for the Next 90 Days",
          type: "textarea",
          placeholder:
            "If we only helped you achieve ONE outcome in the next 90 days, what should it be?",
          required: true,
        },
        {
          id: "biggestBottleneck",
          label: "Biggest Current Bottleneck",
          type: "textarea",
          placeholder:
            "What's the single biggest bottleneck slowing you down right now?",
          required: true,
        },
        {
          id: "idealCustomer",
          label: "Ideal Customer Description",
          type: "textarea",
          placeholder:
            "Describe your ideal customer in 2–3 sentences (who they are, their situation, what they want).",
          required: true,
        },
        {
          id: "topObjection",
          label: "Top Objection You Hear",
          type: "text",
          placeholder:
            "What is the most common objection or hesitation you hear before someone buys?",
          required: true,
        },
        {
          id: "coreOffer",
          label: "Core Offer Summary",
          type: "textarea",
          placeholder:
            "Sales Accelerator – 8-week group program that helps coaches double close rates – $4,000.",
          required: true,
          helpText:
            "What's it called, what does it promise, and what does it cost?",
        },
        {
          id: "customerJourney",
          label: "Simple Customer Journey",
          type: "text",
          placeholder:
            "See ad → opt in → email sequence → book call → close on Zoom",
          required: true,
          helpText:
            "In one line, describe the main path from stranger → client",
        },
        {
          id: "brandVoiceStyle",
          label: "Brand Voice Style",
          type: "select",
          required: true,
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
          id: "riskBoldnessLevel",
          label: "Risk / Boldness Level",
          type: "select",
          required: true,
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
          id: "primaryCRM",
          label: "Primary CRM / Platform",
          type: "text",
          placeholder: "GoHighLevel, HubSpot, Salesforce, etc.",
          required: true,
          helpText:
            "Which platform do you mainly use for contacts and pipelines?",
        },
        {
          id: "bookingLink",
          label: "Booking Link",
          type: "text",
          placeholder: "https://calendly.com/yourname",
          required: true,
          helpText: "Where should we send people to book with you?",
        },
        {
          id: "supportEmail",
          label: "Support Email",
          type: "text",
          placeholder: "support@example.com",
          required: true,
          helpText: "What email should appear in content for support?",
        },
      ],
    },
    {
      id: "compliance-basics",
      title: "Compliance Basics",
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
          id: "regulatedIndustryType",
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
      id: "proof-credibility",
      title: "Proof & Credibility",
      description: "Case studies and testimonials",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "hasProofAssets",
          label: "Do you have case studies/testimonials ready?",
          type: "select",
          options: [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ],
        },
        {
          id: "proofAssets",
          label: "Paste 1-2 Examples",
          type: "textarea",
          placeholder:
            "Case study: Helped client X achieve Y result in Z timeframe...",
          showIf: { field: "hasProofAssets", value: "yes" },
        },
        {
          id: "proofFiles",
          label: "Or Upload Proof Documents",
          type: "file",
          fileConfig: {
            maxSize: 10 * 1024 * 1024,
            allowedExtensions: [".pdf", ".doc", ".docx", ".txt"],
            allowedMimeTypes: [
              "application/pdf",
              "application/msword",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "text/plain",
            ],
          },
          showIf: { field: "hasProofAssets", value: "yes" },
          helpText: "Upload case studies, testimonials, or results screenshots",
        },
      ],
    },
    {
      id: "voice-calibration",
      title: "Voice Calibration",
      description: "Fine-tune your brand voice with examples",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "voiceExamplesGood",
          label: "Paste 2-3 paragraphs you've written that sound like YOU",
          type: "textarea",
          placeholder:
            "Paste examples of your best writing that captures your voice...",
        },
        {
          id: "voiceExamplesAvoid",
          label: "Paste 2-3 examples of tone you want to AVOID",
          type: "textarea",
          placeholder:
            "Paste examples of styles/tones that don't fit your brand...",
        },
        {
          id: "contentLinks",
          label: "Example Content You Like (Links)",
          type: "textarea",
          placeholder:
            "Drop 1-3 links to content (yours or others) that feel like the voice you want",
        },
      ],
    },
    {
      id: "operations",
      title: "Operations",
      description: "Pipeline stages and operational preferences",
      isOptional: true,
      isCollapsible: true,
      defaultExpanded: false,
      fields: [
        {
          id: "pipelineStages",
          label: "Sales Pipeline Stages",
          type: "textarea",
          placeholder:
            "Lead → Qualified → Meeting Booked → Proposal Sent → Closed Won/Lost",
          helpText: "Leave blank to use smart defaults",
        },
        {
          id: "emailSignoff",
          label: "Email Sign-off Preference",
          type: "text",
          placeholder: "Best regards,\nThe [Business Name] Team",
        },
        {
          id: "brandEmails",
          label: "Brand Domain Emails",
          type: "text",
          placeholder: "hello@, support@, sales@",
          helpText: "List your brand email addresses",
        },
      ],
    },
  ],
  defaultValues: {
    businessName: "",
    website: "",
    whatYouSell: "",
    businessType: "",
    businessTypeOther: "",
    monthlyRevenue: "",
    goal90Day: "",
    biggestBottleneck: "",
    idealCustomer: "",
    topObjection: "",
    coreOffer: "",
    customerJourney: "",
    brandVoiceStyle: "",
    riskBoldnessLevel: "",
    primaryCRM: "",
    bookingLink: "",
    supportEmail: "",
    isRegulated: "",
    regulatedIndustryType: "",
    forbiddenWords: "",
    disclaimers: "",
    hasProofAssets: "",
    proofAssets: "",
    pipelineStages: "",
    emailSignoff: "",
    brandEmails: "",
    voiceExamplesGood: "",
    voiceExamplesAvoid: "",
    contentLinks: "",
  },
  submitButtonText: "Generate Business Brain",
  apiEndpoint: "/api/business-brain/analyze",
};
