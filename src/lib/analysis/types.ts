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
  files: Array<{
    name: string;
    type: "brand_guide" | "style_guide" | "other";
    sections: { title: string; content: string; importance: number }[];
    keyPhrases: string[];
  }>;
  intakeData: any;
}

export interface MiningResult {
  insights: DeepInsight[];
  total_insights: number;
  high_confidence_count: number; // confidence >= 8
  specificity_avg: number;
  categories_covered: InsightCategory[];
}

