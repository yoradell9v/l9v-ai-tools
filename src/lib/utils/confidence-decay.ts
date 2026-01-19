export interface ConfidenceDecayConfig {
  halfLifeDays?: number; 
  minConfidenceRatio?: number; 
  maxAgeDays?: number; 
}

const DEFAULT_CONFIG: Required<ConfidenceDecayConfig> = {
  halfLifeDays: 90, 
  minConfidenceRatio: 0.5, 
  maxAgeDays: 180, 
};

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

  if (ageInDays < 7) {
    return originalConfidence;
  }

  const decayFactor = Math.max(
    minConfidenceRatio,
    1 - ((1 - minConfidenceRatio) * ageInDays) / maxAgeDays
  );

  const adjustedConfidence = Math.round(originalConfidence * decayFactor);
  return Math.max(1, Math.min(100, adjustedConfidence));
}

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

