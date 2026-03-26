import { Redis } from "@upstash/redis";

// Redis client for rate limiting - gracefully handles missing/invalid config
let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (e) {
  console.warn("[auth-security] Failed to initialize Redis client:", e);
  redis = null;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds

export async function checkLoginAttempts(identifier: string): Promise<{
  allowed: boolean;
  attemptsRemaining?: number;
  lockedUntil?: number;
}> {
  // If Redis is not available, allow the login (graceful degradation)
  if (!redis) return { allowed: true };

  try {
    const key = `login_attempts:${identifier}`;
    const lockKey = `login_locked:${identifier}`;

    // Check if locked
    const lockedUntil = await redis.get<number>(lockKey);
    if (lockedUntil && Date.now() < lockedUntil) {
      return { allowed: false, lockedUntil };
    }

    const attempts = (await redis.get<number>(key)) || 0;
    return {
      allowed: attempts < MAX_ATTEMPTS,
      attemptsRemaining: MAX_ATTEMPTS - attempts,
    };
  } catch (error) {
    // Redis error - allow login to proceed (graceful degradation)
    console.error("[auth-security] Redis error in checkLoginAttempts:", error);
    return { allowed: true };
  }
}

export async function recordFailedLogin(identifier: string): Promise<void> {
  if (!redis) return;

  try {
    const key = `login_attempts:${identifier}`;
    const attempts = await redis.incr(key);
    await redis.expire(key, LOCKOUT_DURATION);

    if (attempts >= MAX_ATTEMPTS) {
      const lockKey = `login_locked:${identifier}`;
      await redis.set(lockKey, Date.now() + LOCKOUT_DURATION * 1000, {
        ex: LOCKOUT_DURATION,
      });
    }
  } catch (error) {
    console.error("[auth-security] Redis error in recordFailedLogin:", error);
    // Don't throw - allow the flow to continue
  }
}

export async function clearLoginAttempts(identifier: string): Promise<void> {
  if (!redis) return;
  
  try {
    await redis.del(`login_attempts:${identifier}`);
    await redis.del(`login_locked:${identifier}`);
  } catch (error) {
    console.error("[auth-security] Redis error in clearLoginAttempts:", error);
    // Don't throw - allow the flow to continue
  }
}
