import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds

export async function checkLoginAttempts(identifier: string): Promise<{
  allowed: boolean;
  attemptsRemaining?: number;
  lockedUntil?: number;
}> {
  if (!redis) return { allowed: true };

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
}

export async function recordFailedLogin(identifier: string): Promise<void> {
  if (!redis) return;

  const key = `login_attempts:${identifier}`;
  const attempts = await redis.incr(key);
  await redis.expire(key, LOCKOUT_DURATION);

  if (attempts >= MAX_ATTEMPTS) {
    const lockKey = `login_locked:${identifier}`;
    await redis.set(lockKey, Date.now() + LOCKOUT_DURATION * 1000, {
      ex: LOCKOUT_DURATION,
    });
  }
}

export async function clearLoginAttempts(identifier: string): Promise<void> {
  if (!redis) return;
  await redis.del(`login_attempts:${identifier}`);
  await redis.del(`login_locked:${identifier}`);
}
