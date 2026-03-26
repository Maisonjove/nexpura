import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

/**
 * Get cached data or fetch fresh data if not in cache.
 * Falls back to fetcher if Redis is not configured.
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 300
): Promise<T> {
  if (!redis) return fetcher();

  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) return cached;

    const fresh = await fetcher();
    await redis.set(key, fresh, { ex: ttlSeconds });
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
    // For patterns, we need to scan and delete
    // This is expensive - prefer specific key invalidation when possible
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
