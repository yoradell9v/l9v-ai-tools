// Deep Insight Types for Business Profile Analysis

export type InsightCategory =
  | "language_pattern"
  | "structure"
  | "belief"
  | "relationship"
  | "proof"
  | "formatting"
  | "compliance"
  | "crm_pattern";

export interface DeepInsight {
  finding: string;              // Specific observation (not generic)
  evidence: string[];           // Exact quotes (3-10 words each)
  source_locations: string[];   // Where evidence was found
  confidence: number;           // 1-10 based on evidence strength
  category: InsightCategory;
  unique_identifier: string;    // What makes this unique to THIS business
  specificity_score: number;   // 1-10, must be 7+ to keep
  cross_references?: string[]; // IDs of related insights
  validation_notes?: string;    // Notes from cross-referencing
  confirmed_by?: number;        // Count of confirming insights
  contradicted_by?: string[];   // IDs of contradicting insights
}

export interface AnalysisContext {
  websiteUrl: string;
  websiteContent: {
    hero: string;
    about: string;
    services: string;
    testimonials: string[];
    fullText: string;
    metadata: { title: string; description: string };
  };
  files: DocumentAnalysis[];
  contentLinks?: Array<{
    url: string;
    hero: string;
    about: string;
    services: string;
    testimonials: string[];
    fullText: string;
    metadata: { title: string; description: string };
  }>;
  enhancedContext?: EnhancedContext;
  intakeData: any;
}

export interface DocumentAnalysis {
  name: string;
  type: "brand_guide" | "style_guide" | "other";
  sections: { title: string; content: string; importance: number }[];
  keyPhrases: string[];
  formattingPatterns?: FormattingPatterns;
  complianceMarkers?: ComplianceMarkers;
  voiceSamples?: Array<{
    type: "testimonial" | "sales_copy" | "explanation" | "other";
    text: string;
    context: string;
  }>;
}

export interface FormattingPatterns {
  headingStyles: string[];
  listUsage: {
    bulletPoints: number;
    numberedLists: number;
    examples: string[];
  };
  paragraphStructure: {
    avgLength: number;
    avgSentenceLength: number;
    examples: string[];
  };
  emphasisPatterns: {
    bold: string[];
    italic: string[];
    allCaps: string[];
  };
  ctaPatterns: string[];
}

export interface ComplianceMarkers {
  disclaimers: string[];
  legalTerms: string[];
  warningLanguage: string[];
}

export interface EnhancedContext {
  brandVoice: {
    stylePreference: string;
    riskLevel: string;
    goodExamples: string[];
    avoidExamples: string[];
    exampleLinks: string[]; // Raw URLs for reference
    exampleLinkContent?: Array<{
      url: string;
      hero: string;
      about: string;
      fullText: string;
      metadata: { title: string; description: string };
    }>; // Extracted content from URLs
  };
  positioning: {
    corePitch: string;
    targetAudience: string;
    mainObjection: string;
    coreOffer: string;
    businessStage: string;
    uniqueContext: string;
  };
  styleRules: {
    voiceStyle: string;
    goodExamples: string[];
    avoidExamples: string[];
    websiteSamples: {
      hero: string;
      about: string;
      services: string;
    };
    documentSamples: Array<{
      source: string;
      content: string;
      formatting: string;
    }>;
  };
  compliance: {
    isRegulated: boolean;
    industryType: string;
    forbiddenWords: string[];
    requiredDisclaimers: string[];
    proofAssets: string;
    riskLevel: string;
  };
  ghlImplementation: {
    crmPlatform: string;
    customerJourney: string;
    pipelineStages: string;
    bookingLink: string;
    supportEmail: string;
    emailSignoff: string;
    coreOffer: string;
    goal90Day: string;
  };
}

export interface MiningResult {
  insights: DeepInsight[];
  total_insights: number;
  high_confidence_count: number; // confidence >= 8
  specificity_avg: number;
  categories_covered: InsightCategory[];
}

