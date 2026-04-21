import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import logger from "@/lib/logger";

// Fail-CLOSED posture. Audit finding: previous implementation returned
// { success: true } whenever Upstash env vars were missing or Redis was
// unreachable. That turned every "rate-limited" endpoint (login, 2FA
// verify, invite accept, bespoke approval-response, POS refund) into an
// unthrottled surface if a single env var ever went unset.
//
// Production MUST have UPSTASH_REDIS_REST_URL + TOKEN configured. If
// they're missing in NODE_ENV=production, the process refuses to boot.
// In dev/preview without Redis, the limiter still runs (fail-closed
// with an explicit allow for localhost) so the app is testable.
//
// If Redis is configured but temporarily unreachable, we also fail
// closed and log to Sentry — better to return a 503 than to silently
// let through a brute-force wave.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (process.env.NODE_ENV === "production" && (!REDIS_URL || !REDIS_TOKEN)) {
  // Crash on boot rather than serve traffic without rate limiting.
  // Keeps the bad deploy out of production entirely.
  throw new Error(
    "[rate-limit] Refusing to boot: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN required in production. " +
      "Without them, rate limiting is effectively disabled and every /login, /2fa, /approval-response becomes brute-forceable."
  );
}

const redis = REDIS_URL && REDIS_TOKEN
  ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
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
  
  // PDF generation: 10 per minute per user (memory-intensive)
  pdf: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "60 s"),
  }) : null,
  
  // Bulk exports: 3 per minute
  export: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "60 s"),
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
  if (!limiter) {
    // Redis not configured. In production this path is unreachable
    // because the module throws at import time. In dev/preview we
    // fail-closed except for explicit localhost (so tests + local dev
    // aren't blocked). Anything else is denied with a logged warning.
    if (process.env.NODE_ENV !== "production") {
      const isLocalOrTest = /^(::1|127\.0\.0\.1|localhost|anonymous|test:)/.test(identifier);
      if (isLocalOrTest) return { success: true };
    }
    logger.error("[rate-limit] denying request — limiter not configured", { identifier, type });
    return { success: false };
  }
  try {
    const result = await limiter.limit(identifier);
    return { success: result.success, remaining: result.remaining };
  } catch (err) {
    // Redis unreachable (outage, network). Fail CLOSED and surface the
    // error — better to return 503s briefly than let a brute-force wave
    // through.
    logger.error("[rate-limit] denying request — limiter threw", { identifier, type, error: err });
    return { success: false };
  }
}
