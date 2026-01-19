export type RateLimitTier = "tier1" | "tier2" | "tier3" | "auth";

export interface RateLimitConfig {
  user?: {
    window: number;
    limit: number;
  };
  organization?: {
    window: number;
    limit: number;
  };
  ip?: {
    window: number;
    limit: number;
  };
  failStrategy: "closed" | "open";
}

export const RATE_LIMIT_CONFIG: Record<string, RateLimitConfig> = {
  //TIER 1 - Expensive Cost
  "/api/sop/generate": {
    user: { window: 3600, limit: 3 },
    organization: { window: 3600, limit: 15 },
    failStrategy: "closed",
  },
  "/api/sop/update": {
    user: { window: 3600, limit: 5 },
    organization: { window: 3600, limit: 20 },
    failStrategy: "closed",
  },
  "/api/jd/analyze": {
    user: { window: 3600, limit: 3 },
    organization: { window: 3600, limit: 15 },
    failStrategy: "closed",
  },
  "/api/organization-knowledge-base/conversation": {
    user: { window: 3600, limit: 20 },
    organization: { window: 3600, limit: 100 },
    failStrategy: "closed",
  },

  // TIER 2 - Moderate Cost (OpenAI GPT-4o-mini)

  "/api/sop/review": {
    user: { window: 3600, limit: 10 },
    failStrategy: "open",
  },
  "/api/sop/enhance": {
    user: { window: 3600, limit: 5 },
    failStrategy: "open",
  },
  "/api/jd/refine": {
    user: { window: 3600, limit: 8 },
    failStrategy: "open",
  },

  // TIER 3 - Low Cost/Read Operations

  "/api/sop/saved": {
    user: { window: 3600, limit: 60 },
    failStrategy: "open",
  },
  "/api/dashboard/stats": {
    user: { window: 3600, limit: 60 },
    failStrategy: "open",
  },

  // AUTH - Brute Force Protection
  "/api/auth/signin": {
    ip: { window: 60, limit: 10 },
    failStrategy: "closed",
  },
  "/api/auth/forgot-password": {
    ip: { window: 3600, limit: 5 },
    failStrategy: "closed",
  },
  "/api/auth/reset-password": {
    ip: { window: 3600, limit: 5 },
    failStrategy: "closed",
  },
};

export function getRateLimitConfig(path: string): RateLimitConfig | null {
  if (RATE_LIMIT_CONFIG[path]) {
    return RATE_LIMIT_CONFIG[path];
  }

  const sortedPaths = Object.keys(RATE_LIMIT_CONFIG).sort(
    (a, b) => b.length - a.length
  );

  for (const configPath of sortedPaths) {
    if (path.startsWith(configPath)) {
      return RATE_LIMIT_CONFIG[configPath];
    }
  }

  return null;
}

export function isRateLimited(path: string): boolean {
  return getRateLimitConfig(path) !== null;
}
