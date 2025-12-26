/**
 * Confidence decay utilities for learning events
 * Reduces confidence of insights over time to prevent stale data from affecting KB
 */

export interface ConfidenceDecayConfig {
  halfLifeDays?: number; // Days until confidence drops to 50% (default: 90)
  minConfidenceRatio?: number; // Minimum confidence as ratio of original (default: 0.5 = 50%)
  maxAgeDays?: number; // Maximum age before confidence reaches minimum (default: 180)
}

const DEFAULT_CONFIG: Required<ConfidenceDecayConfig> = {
  halfLifeDays: 90, // 50% confidence after 90 days
  minConfidenceRatio: 0.5, // Never go below 50% of original
  maxAgeDays: 180, // Reach minimum after 180 days
};

/**
 * Calculate adjusted confidence based on event age
 * Uses linear decay: confidence decreases linearly from original to minimum over maxAgeDays
 * 
 * @param originalConfidence Original confidence score (0-100)
 * @param createdAt Date when the event was created
 * @param config Decay configuration
 * @returns Adjusted confidence score (0-100)
 */
export function adjustConfidenceByAge(
  originalConfidence: number,
  createdAt: Date,
  config: ConfidenceDecayConfig = {}
): number {
  const { halfLifeDays, minConfidenceRatio, maxAgeDays } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const now = new Date();
  const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  // If event is very recent (less than 7 days), no decay
  if (ageInDays < 7) {
    return originalConfidence;
  }

  // Calculate decay factor
  // Linear decay: starts at 1.0, reaches minConfidenceRatio at maxAgeDays
  const decayFactor = Math.max(
    minConfidenceRatio,
    1 - ((1 - minConfidenceRatio) * ageInDays) / maxAgeDays
  );

  const adjustedConfidence = Math.round(originalConfidence * decayFactor);

  // Ensure confidence stays within valid range
  return Math.max(1, Math.min(100, adjustedConfidence));
}

/**
 * Check if an event should be considered based on age-adjusted confidence
 * 
 * @param originalConfidence Original confidence score
 * @param createdAt Date when the event was created
 * @param minConfidence Minimum confidence threshold
 * @param config Decay configuration
 * @returns true if adjusted confidence meets minimum threshold
 */
export function meetsConfidenceThreshold(
  originalConfidence: number,
  createdAt: Date,
  minConfidence: number,
  config: ConfidenceDecayConfig = {}
): boolean {
  const adjustedConfidence = adjustConfidenceByAge(
    originalConfidence,
    createdAt,
    config
  );
  return adjustedConfidence >= minConfidence;
}

/**
 * Get decay information for an event (useful for logging/debugging)
 */
export function getDecayInfo(
  originalConfidence: number,
  createdAt: Date,
  config: ConfidenceDecayConfig = {}
): {
  originalConfidence: number;
  adjustedConfidence: number;
  ageInDays: number;
  decayFactor: number;
  decayPercentage: number;
} {
  const adjustedConfidence = adjustConfidenceByAge(
    originalConfidence,
    createdAt,
    config
  );
  const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const decayFactor = adjustedConfidence / originalConfidence;
  const decayPercentage = (1 - decayFactor) * 100;

  return {
    originalConfidence,
    adjustedConfidence,
    ageInDays: Math.round(ageInDays * 10) / 10,
    decayFactor: Math.round(decayFactor * 100) / 100,
    decayPercentage: Math.round(decayPercentage * 10) / 10,
  };
}

