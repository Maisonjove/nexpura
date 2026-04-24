// Pass-through cache API.
//
// The previous implementation used Upstash/Redis. We're Supabase + Vercel
// only now; no shared cache service is in scope, and a shared cache layer
// across tenants is a tenant-leak risk we don't want to reimplement
// defensively. The 12 existing callers of getCached / invalidate* are
// kept working by this shim — getCached calls the fetcher directly, and
// the invalidation functions become no-ops. This removes ~50-100ms of
// cold-path speedup on dashboard and intake lookups; net latency is
// dominated by Supabase round-trip, which is itself fast from Vercel
// syd1 → Supabase. If a per-route cache is needed later, use Next.js
// `unstable_cache` + `revalidateTag` via cache-tags — it's process-local
// on each lambda and cannot leak across tenants because keys are
// explicit.
//
// tenantCacheKey is preserved — it's still a useful shape when callers
// want to namespace their Next.js cache tags by tenant.

export async function getCached<T>(
  _key: string,
  fetcher: () => Promise<T>,
  _ttlSeconds: number = 300,
): Promise<T> {
  return fetcher();
}

export async function invalidateCache(_key: string): Promise<void> {
  // no-op: no shared cache to invalidate
}

export async function invalidateCachePattern(_pattern: string): Promise<void> {
  // no-op
}

export function tenantCacheKey(tenantId: string, ...parts: string[]): string {
  return `tenant:${tenantId}:${parts.join(":")}`;
}

export async function invalidateTenantCache(_tenantId: string): Promise<void> {
  // no-op
}
