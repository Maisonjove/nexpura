/**
 * Per-tenant cache tags for RSC list-payload caching.
 *
 * Each list route wraps its server-side row fetch in `unstable_cache` tagged
 * with one or more of these per-tenant tag strings. Write paths call
 * `revalidateTag(...)` with the matching tag to invalidate the specific
 * tenant's cached payloads atomically — rows created/edited/deleted from
 * an action appear on the next navigation without waiting on a TTL.
 *
 * The tag MUST include tenant_id so that invalidating one tenant's list
 * never purges another tenant's cache.
 */
export const CACHE_TAGS = {
  /** /customers list payload (rows + count + any support data). */
  customers: (tenantId: string) => `customers:${tenantId}`,

  /** /invoices list payload (rows + count + headline stats). */
  invoices: (tenantId: string) => `invoices:${tenantId}`,

  /** /inventory list payload (rows + count + categories + suppliers). */
  inventory: (tenantId: string) => `inventory:${tenantId}`,

  /** /tasks list payload (my tasks + all tasks). */
  tasks: (tenantId: string) => `tasks:${tenantId}`,

  /** /workshop list payload — depends on BOTH repairs and bespoke_jobs,
   *  so both of those actions should invalidate this tag. */
  workshop: (tenantId: string) => `workshop:${tenantId}`,
} as const;
