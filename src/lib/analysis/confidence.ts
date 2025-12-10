import { DeepInsight } from "./types";

export function calculateInsightConfidence(insight: DeepInsight): number {
  let score = 0;

  score += Math.min(insight.evidence.length * 10, 40);

  const uniqueSources = new Set(insight.source_locations).size;
  score += Math.min(uniqueSources * 15, 30);

  score += insight.specificity_score * 3;

  return Math.min(Math.round(score), 100);
}

export function validateInsight(insight: DeepInsight): boolean {
  if (insight.evidence.length < 2) {
    return false;
  }

  if (insight.specificity_score < 7) {
    return false;
  }

  if (insight.source_locations.length === 0) {
    return false;
  }
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
  if (genericPhrases.some((phrase) => findingLower.includes(phrase))) {
    const hasSpecificContent = insight.unique_identifier.length > 20;
    if (!hasSpecificContent) {
      return false;
    }
  }

  return true;
}

export function calculateAverageConfidence(insights: DeepInsight[]): number {
  if (insights.length === 0) return 0;
  const sum = insights.reduce((acc, insight) => acc + insight.confidence, 0);
  return Math.round(sum / insights.length);
}
