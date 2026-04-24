import { Redis } from "@upstash/redis";

// 300ms timeout: if Redis doesn't respond in time, fall through to DB fetcher.
// Prevents ~4500ms hangs when Upstash cold-starts (observed in production).
const REDIS_TIMEOUT_MS = 300;

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

/**
 * Get cached data or fetch fresh data if not in cache.
 * Falls back to fetcher if Redis is not configured or times out.
 *
 * Key perf improvements:
 * - 300ms timeout on Redis read: cold Upstash starts no longer block page loads
 * - Fire-and-forget Redis write: don't await cache population
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 300
): Promise<T> {
  if (!redis) return fetcher();

  try {
    // Race Redis against a 300ms timeout. On cold start / slow Redis we skip to DB.
    const cached = await Promise.race([
      redis.get<T>(key),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), REDIS_TIMEOUT_MS)
      ),
    ]);

    if (cached !== null && cached !== undefined) return cached;

    // Cache miss (or Redis timed out) — fetch fresh data from DB
    const fresh = await fetcher();

    // Write back to cache without blocking the response (fire-and-forget)
    redis.set(key, fresh, { ex: ttlSeconds }).catch((err: unknown) => {
      const e = err as { name?: string; message?: string; cause?: { code?: string; message?: string } };
      console.error("[cache] Redis write error:", {
        name: e?.name,
        message: e?.message,
        causeCode: e?.cause?.code,
        causeMessage: e?.cause?.message,
      });
    });

    return fresh;
  } catch (error) {
    // Log but don't fail - fall back to fetcher
    console.error("[cache] Redis error, falling back to fetcher:", error);
    return fetcher();
  }
}

/**
 * Invalidate a specific cache key.
 */
export async function invalidateCache(key: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.error("[cache] Failed to invalidate key:", key, error);
  }
}

/**
 * Invalidate multiple cache keys matching a pattern.
 * Note: SCAN-based deletion for patterns - use sparingly.
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  if (!redis) return;

  try {
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = Number(nextCursor);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== 0);
  } catch (error) {
    console.error("[cache] Failed to invalidate pattern:", pattern, error);
  }
}

/**
 * Generate a cache key for tenant-scoped data.
 */
export function tenantCacheKey(tenantId: string, ...parts: string[]): string {
  return `tenant:${tenantId}:${parts.join(":")}`;
}

/**
 * Invalidate all cache for a specific tenant.
 */
export async function invalidateTenantCache(tenantId: string): Promise<void> {
  await invalidateCachePattern(`tenant:${tenantId}:*`);
}
