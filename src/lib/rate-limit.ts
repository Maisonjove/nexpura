import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Different rate limiters for different use cases
export const rateLimiters = {
  // General API: 100 requests per minute
  api: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "60 s"),
  }) : null,
  
  // Auth endpoints: 10 requests per minute (stricter)
  auth: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "60 s"),
  }) : null,
  
  // AI endpoints: 20 requests per minute
  ai: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "60 s"),
  }) : null,
  
  // Webhooks: 50 requests per minute
  webhook: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, "60 s"),
  }) : null,
  
  // Heavy operations: 5 per minute
  heavy: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "60 s"),
  }) : null,
};

export type RateLimitType = keyof typeof rateLimiters;

// Legacy export for backward compatibility
export const ratelimit = rateLimiters.api;

export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = 'api'
): Promise<{ success: boolean; remaining?: number }> {
  const limiter = rateLimiters[type];
  if (!limiter) return { success: true };
  
  const result = await limiter.limit(identifier);
  return { success: result.success, remaining: result.remaining };
}
