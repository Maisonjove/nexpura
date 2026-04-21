/**
 * Shared helpers for enforcing session-derived tenant context on server
 * actions and API route handlers.
 *
 * Pattern 1 (body-supplied tenantId -> session-derived tenantId) of the
 * launch-QA remediation plan is enforced by these two helpers:
 *
 *   - getSessionTenantId()               -> resolves the authenticated
 *                                           caller's tenant from the auth
 *                                           context; throws on unauth.
 *   - assertCallerTenantMatches(resId)   -> given a resource's tenant_id
 *                                           loaded from the database, asserts
 *                                           that the authenticated caller
 *                                           belongs to the same tenant.
 *
 * Callers must load the resource first, then call assertCallerTenantMatches
 * with resource.tenant_id. This prevents a user in tenant A from acting on a
 * record belonging to tenant B simply by knowing the record's id, and it
 * short-circuits the "tenantId is passed in the body and trusted" bug class
 * entirely: the caller no longer has any say in which tenant the action runs
 * against.
 */
import { getAuthContext } from "@/lib/auth-context";

/**
 * Returns the authenticated caller's tenant ID as derived from the current
 * session/auth context. Throws if the caller is unauthenticated or has no
 * tenant binding.
 */
export async function getSessionTenantId(): Promise<string> {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("not_authenticated");
  if (!ctx.tenantId) throw new Error("tenant_required");
  return ctx.tenantId;
}

/**
 * Assert the authenticated caller's tenant matches the resource's
 * `tenant_id`. Throws `"tenant_required"` if no resource tenant is provided,
 * and `"tenant_mismatch"` if the caller's tenant differs.
 *
 * Use immediately after loading a resource by id in code paths that would
 * otherwise trust a caller-supplied tenant.
 */
export async function assertCallerTenantMatches(
  resourceTenantId: string | null | undefined,
): Promise<void> {
  if (!resourceTenantId) throw new Error("tenant_required");
  const callerTenantId = await getSessionTenantId();
  if (callerTenantId !== resourceTenantId) {
    throw new Error("tenant_mismatch");
  }
}
