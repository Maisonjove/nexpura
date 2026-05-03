/**
 * Canonical Nexpura dogfood tenant id.
 *
 * Joey 2026-05-03: the multi-tenant "free forever" pattern is removed
 * in favour of (a) extended trial or (b) cancelled. The only exception
 * is hello@nexpura.com's tenant — Joey's dogfood/test surface — which
 * stays free-forever. This id is the single source of truth for that
 * exemption: MRR helpers skip it, RBAC paths know it isn't a real
 * paying customer, and a DB CHECK constraint
 * (`free_forever_dogfood_only` on tenants) rejects is_free_forever=true
 * on every other tenant id.
 *
 * If the canonical dogfood tenant ever changes, update this constant
 * AND drop+re-add the CHECK constraint in the same migration.
 */
export const NEXPURA_DOGFOOD_TENANT_ID = '316a3313-d4fe-4dc8-8ad6-86a11f0f0209' as const;
