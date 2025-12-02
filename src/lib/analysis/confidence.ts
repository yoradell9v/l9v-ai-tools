import { DeepInsight } from "./types";

/**
 * Calculate confidence score for an insight based on evidence quality
 */
export function calculateInsightConfidence(insight: DeepInsight): number {
  let score = 0;

  // Evidence quantity: More quotes = higher confidence (max 40pts)
  score += Math.min(insight.evidence.length * 10, 40);

  // Evidence diversity: Multiple sources = higher confidence (max 30pts)
  const uniqueSources = new Set(insight.source_locations).size;
  score += Math.min(uniqueSources * 15, 30);

  // Specificity score: More specific = higher confidence (max 30pts)
  score += insight.specificity_score * 3;

  return Math.min(Math.round(score), 100);
}

/**
 * Validate insight meets quality thresholds
 */
export function validateInsight(insight: DeepInsight): boolean {
  // Must have at least 2 pieces of evidence
  if (insight.evidence.length < 2) {
    return false;
  }

  // Specificity must be 7+ (as per requirements)
  if (insight.specificity_score < 7) {
    return false;
  }

  // Must have at least one source location
  if (insight.source_locations.length === 0) {
    return false;
  }

  // Finding must be specific (not generic)
  const genericPhrases = [
    "professional",
    "high-quality",
    "customer-focused",
    "engaging",
    "effective",
    "well-designed",
    "user-friendly",
  ];
  
  const findingLower = insight.finding.toLowerCase();
  if (genericPhrases.some(phrase => findingLower.includes(phrase))) {
    // Only reject if it's ONLY generic phrases
    const hasSpecificContent = insight.unique_identifier.length > 20;
    if (!hasSpecificContent) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate average confidence for a set of insights
 */
export function calculateAverageConfidence(insights: DeepInsight[]): number {
  if (insights.length === 0) return 0;
  const sum = insights.reduce((acc, insight) => acc + insight.confidence, 0);
  return Math.round(sum / insights.length);
}

