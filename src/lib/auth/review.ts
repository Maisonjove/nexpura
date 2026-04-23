/**
 * Review-mode auth helper.
 *
 * Used by page server components to provide a guaranteed tenant_id
 * when the review sandbox cookie is present, regardless of whether
 * middleware session injection worked.
 *
 * This decouples the failing pages from the middleware entirely.
 *
 * ── Audit finding W7-HIGH-04 / W2-014 ────────────────────────────
 * Review + staff bypass tokens used to be hardcoded string literals
 * in this file. Anyone with read access to the repo (including every
 * collaborator, every CI log surface, GitHub search) could grab them
 * and sidestep middleware's env-gate for the DEMO tenant. Even
 * "internal" / "just for launch-QA" tokens are real secrets once they
 * exist in plaintext in source.
 *
 * Fix: read from env (NEXPURA_REVIEW_TOKEN / NEXPURA_STAFF_BYPASS_TOKEN),
 * compare constant-time via safeCompare, and FAIL CLOSED when either
 * env var is empty or unset — no hardcoded default, no silent grant.
 *
 * ── MANUAL ROTATION STEP ────────────────────────────────────────
 * After this change ships, rotate the token values:
 *   1. In Vercel production env, set NEXPURA_REVIEW_TOKEN to a fresh
 *      random string (NEVER the old "nexpura-review-2026" value).
 *      Do the same for NEXPURA_STAFF_BYPASS_TOKEN if it stays in use.
 *   2. Update any internal bookmarks that embed `?rt=<old-token>`.
 *   3. Until these env vars are set, review/staff bypass is disabled
 *      — the regular auth path must be used.
 *   4. The middleware already reads REVIEW_BYPASS_TOKEN /
 *      STAFF_BYPASS_TOKEN; align those too (same value, same rotation).
 */
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeCompare } from "@/lib/timing-safe-compare";

const REVIEW_COOKIE = "nexpura-review";
const STAFF_COOKIE = "nexpura-staff";

/** Resolve current review token from env (empty string when unset — disables bypass). */
function getReviewToken(): string {
  return process.env.NEXPURA_REVIEW_TOKEN ?? "";
}
/** Resolve current staff bypass token from env. */
function getStaffToken(): string {
  return process.env.NEXPURA_STAFF_BYPASS_TOKEN ?? "";
}

export const DEMO_TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
export const DEMO_USER_ID = "bd7d2c20-5727-4f80-a449-818429abecc9";
export const DEMO_CURRENCY = "AUD";

/**
 * Returns true when `value` matches the current review or staff token
 * AND the respective env var is set. Empty env → always false (no
 * silent grant). Intended for `rt` query-param checks on SSR pages.
 */
export function matchesReviewOrStaffToken(value: string | null | undefined): boolean {
  if (!value) return false;
  const r = getReviewToken();
  const s = getStaffToken();
  // Fail-closed: if neither env is configured, no token matches.
  if (!r && !s) return false;
  return (r !== "" && safeCompare(value, r)) || (s !== "" && safeCompare(value, s));
}

/**
 * Returns the tenant_id for review/staff mode, or null if not in sandbox mode.
 * Checks BOTH the cookie (set by middleware) AND the x-nexpura-rt header
 * (set by middleware even when session injection fails) so pages load even
 * when middleware threw before setting cookies.
 *
 * Fail-closed: both comparisons happen against env-loaded secrets. If
 * the env is unset, bypass is disabled regardless of what the client
 * sends.
 */
export async function getReviewTenantId(): Promise<string | null> {
  const reviewToken = getReviewToken();
  const staffToken = getStaffToken();
  if (!reviewToken && !staffToken) return null;

  try {
    const { headers } = await import("next/headers");
    const headerStore = await headers();
    // Middleware sets this header early, before any async that could fail
    const rtHeader = headerStore.get("x-nexpura-rt");
    if (rtHeader) {
      if (reviewToken && safeCompare(rtHeader, reviewToken)) return DEMO_TENANT_ID;
      if (staffToken && safeCompare(rtHeader, staffToken)) return DEMO_TENANT_ID;
    }
  } catch {
    // headers() not available in this context — fall through
  }

  try {
    const cookieStore = await cookies();
    const reviewVal = cookieStore.get(REVIEW_COOKIE)?.value;
    const staffVal = cookieStore.get(STAFF_COOKIE)?.value;
    if (reviewVal && reviewToken && safeCompare(reviewVal, reviewToken)) return DEMO_TENANT_ID;
    if (staffVal && staffToken && safeCompare(staffVal, staffToken)) return DEMO_TENANT_ID;
  } catch {
    // cookies() not available — fall through
  }

  return null;
}

/**
 * Returns { tenantId, userId, currency, admin, supabase, isReviewMode } for any auth context.
 * Falls back to review/staff sandbox if normal auth is unavailable.
 * Pages can use this instead of the manual user + users-table lookup.
 */
export async function getAuthOrReviewContext(rt?: string) {
  const admin = createAdminClient();
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // 1. Check for manual review token override (highest priority)
  if (rt && matchesReviewOrStaffToken(rt)) {
    return {
      tenantId: DEMO_TENANT_ID,
      userId: DEMO_USER_ID,
      currency: DEMO_CURRENCY,
      admin,
      supabase,
      isReviewMode: true,
    };
  }

  // 2. Try normal Supabase auth
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: userData } = await admin
        .from("users")
        .select("tenant_id, tenants(currency)")
        .eq("id", user.id)
        .single();

      if (userData?.tenant_id) {
        return {
          tenantId: userData.tenant_id as string,
          userId: user.id,
          currency: (userData.tenants as { currency?: string } | null)?.currency ?? DEMO_CURRENCY,
          admin,
          supabase,
          isReviewMode: false,
        };
      }
    }
  } catch {
    // fall through to review mode check
  }

  // 3. Fallback: check for review/staff sandbox cookie or header via middleware
  const reviewTenantId = await getReviewTenantId();
  if (reviewTenantId) {
    return {
      tenantId: reviewTenantId,
      userId: DEMO_USER_ID,
      currency: DEMO_CURRENCY,
      admin,
      supabase,
      isReviewMode: true,
    };
  }

  return {
    tenantId: null,
    userId: null,
    currency: DEMO_CURRENCY,
    admin,
    supabase,
    isReviewMode: false,
  };
}
