/**
 * Review-mode auth helper.
 *
 * Used by page server components to provide a guaranteed tenant_id
 * when the review sandbox cookie is present, regardless of whether
 * middleware session injection worked.
 *
 * This decouples the failing pages from the middleware entirely.
 */
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const REVIEW_COOKIE = "nexpura-review";
const REVIEW_TOKEN = "nexpura-review-2026";
const STAFF_COOKIE = "nexpura-staff";
const STAFF_TOKEN = "nexpura-staff-2026";
export const DEMO_TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
export const DEMO_USER_ID = "bd7d2c20-5727-4f80-a449-818429abecc9";
export const DEMO_CURRENCY = "AUD";

/**
 * Returns the tenant_id for review/staff mode, or null if not in sandbox mode.
 * Checks BOTH the cookie (set by middleware) AND the x-nexpura-rt header
 * (set by middleware even when session injection fails) so pages load even
 * when middleware threw before setting cookies.
 */
export async function getReviewTenantId(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    const headerStore = await headers();
    // Middleware sets this header early, before any async that could fail
    const rtHeader = headerStore.get("x-nexpura-rt");
    if (rtHeader === REVIEW_TOKEN || rtHeader === STAFF_TOKEN) {
      return DEMO_TENANT_ID;
    }
  } catch {
    // headers() not available in this context — fall through
  }

  try {
    const cookieStore = await cookies();
    const reviewVal = cookieStore.get(REVIEW_COOKIE)?.value;
    const staffVal = cookieStore.get(STAFF_COOKIE)?.value;
    if (reviewVal === REVIEW_TOKEN || staffVal === STAFF_TOKEN) {
      return DEMO_TENANT_ID;
    }
  } catch {
    // cookies() not available — fall through
  }

  return null;
}

/**
 * Returns { tenantId, userId, currency, admin } for any auth context.
 * Falls back to review/staff sandbox if normal auth is unavailable.
 * Pages can use this instead of the manual user + users-table lookup.
 */
export async function getAuthOrReviewContext() {
  const admin = createAdminClient();

  // Try normal Supabase auth first
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
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
          isReview: false,
        };
      }
    }
  } catch {
    // fall through to review mode check
  }

  // Fallback: check for review/staff sandbox cookie
  const reviewTenantId = await getReviewTenantId();
  if (reviewTenantId) {
    return {
      tenantId: reviewTenantId,
      userId: DEMO_USER_ID,
      currency: DEMO_CURRENCY,
      admin,
      isReview: true,
    };
  }

  return { tenantId: null, userId: null, currency: DEMO_CURRENCY, admin, isReview: false };
}
