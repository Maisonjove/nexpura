// High-scale helpers.
//
// The Upstash/Redis-dependent pieces (getSWR stale-while-revalidate,
// getLoadLevel / setLoadLevel / shouldEnableFeature, withCircuitBreaker
// cross-instance state) were removed with the rest of the Redis surface
// — they had no callers in the codebase. The two functions below are
// genuinely in use:
//
//   • coalesceRequest  — in-memory per-lambda request coalescing.
//                         Used by dashboard stats fetchers. Purely local
//                         state; no Redis ever required.
//   • checkDatabaseHealth — Supabase REST reachability probe used by
//                         /api/health. Only hits Supabase.

const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Coalesce identical in-flight requests on a single lambda instance.
 * If 100 concurrent users ask for the same cache key at the same time
 * only one fetcher runs; the rest await the in-flight promise.
 * Per-instance only — this is a memory Map, not a shared cache.
 */
export async function coalesceRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const existing = pendingRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = fetcher().finally(() => {
    pendingRequests.delete(key);
  });
  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Lightweight Supabase reachability probe. Hits the REST root with HEAD
 * and treats anything < 500 as healthy (401 means the service is up,
 * just unauthorised, which is fine for a liveness check). Used by
 * /api/health.
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
}> {
  const start = Date.now();
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
      {
        method: "HEAD",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
      },
    );
    return {
      healthy: response.status < 500,
      latencyMs: Date.now() - start,
    };
  } catch {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
    };
  }
}
