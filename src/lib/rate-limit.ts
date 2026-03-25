import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Use in-memory fallback if Redis not configured
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

export const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "60 s"),
      analytics: true,
    })
  : null;

export async function checkRateLimit(
  identifier: string
): Promise<{ success: boolean; remaining?: number }> {
  if (!ratelimit) return { success: true }; // Skip if not configured

  const result = await ratelimit.limit(identifier);
  return { success: result.success, remaining: result.remaining };
}
