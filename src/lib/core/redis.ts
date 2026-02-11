import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function getRedisClient(): Redis | null {
  if (globalForRedis.redis) {
    console.log("[Redis] Using existing Redis client instance");
    return globalForRedis.redis;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn("[Redis] REDIS_URL not configured. Rate limiting will not work.");
    return null;
  }

  const maskedUrl = redisUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`[Redis] Initializing Redis client: ${maskedUrl}`);

  try {
    const redis = new Redis(redisUrl, {
      // Allow retries per command so reconnects can succeed; otherwise client stays broken after 3 failures
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        if (times <= 5 || times % 10 === 0) {
          console.log(`[Redis] Retry attempt ${times}, waiting ${delay}ms`);
        }
        return delay;
      },
      enableOfflineQueue: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      lazyConnect: true,
      keepAlive: 10000,
    });
    
    redis.on("error", (error) => {
      console.error("[Redis] Connection error:", error.message);
    });

    redis.on("connect", () => {
      console.log("[Redis] Connected to Redis server");
    });

    redis.on("ready", () => {
      console.log("[Redis] Redis client ready for commands");
    });

    redis.on("close", () => {
      console.log("[Redis] Connection closed");
    });

    redis.on("reconnecting", (delay: any) => {
      console.log(`[Redis] Reconnecting in ${delay}ms`);
    });

    globalForRedis.redis = redis;
    console.log("[Redis] Redis client created and stored in global");

    return redis;
  } catch (error) {
    console.error("[Redis] Failed to create Redis client:", error);
    return null;
  }
}

let _redis: Redis | null | undefined = undefined;

function getRedisLazy(): Redis | null {
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';
  
  if (isBuildTime) {
    return null;
  }
  
  if (_redis === undefined) {
    _redis = getRedisClient();
  }
  return _redis;
}

export const redis = (() => {
  try {
    return getRedisLazy();
  } catch {
    return null;
  }
})();
const REDIS_PING_TIMEOUT_MS = 3000;

export async function isRedisAvailable(): Promise<boolean> {
  if (!redis) {
    console.log("[Redis] Health check: Redis client not initialized");
    return false;
  }

  try {
    const result = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Redis ping timeout")), REDIS_PING_TIMEOUT_MS)
      ),
    ]);
    const available = result === "PONG";
    if (available) {
      console.log("[Redis] Health check passed: Redis is available");
    } else {
      console.warn(`[Redis] Health check failed: Unexpected ping result: ${result}`);
    }
    return available;
  } catch (error) {
    console.error("[Redis] Health check failed:", error);
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (globalForRedis.redis) {
    await globalForRedis.redis.quit();
    globalForRedis.redis = undefined;
  }
}