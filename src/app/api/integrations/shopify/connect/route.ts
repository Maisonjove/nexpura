/**
 * GET /api/integrations/shopify/connect
 *
 * Initiates Shopify OAuth flow.
 *
 * ── cacheComponents migration notes ─────────────────────────────────────
 *
 * Fifth route in the route-by-route CC migration sequence. Same one-line
 * `await connection()` template that worked on /api/check-subdomain,
 * /api/health/concurrency, and /api/warm.
 *
 * Blocker under global cacheComponents:
 *   `getAuthContext()` calls `createClient()` from `@/lib/supabase/server`
 *   which reads request cookies via `supabase.auth.getUser()`. That is a
 *   request-scoped data source. Under CC, the GET handler would be
 *   prerender-attempted, would bail on the cookie read, and the remaining
 *   async work (rate-limit check, OAuth state build, redirect) would hang
 *   the prerender pipeline → HANGING_PROMISE_REJECTION /
 *   NEXT_PRERENDER_INTERRUPTED, same shape as the 40cf0d0 build log.
 *
 * Fix:
 *   `await connection()` from `next/server` as the very first statement
 *   of GET, before `getAuthContext()`. Defers the entire handler to
 *   request time under CC; no-op under the current pre-CC model.
 *
 * OAuth safety:
 *   - state (base64-encoded `{ tenantId }`) is still built from the
 *     authenticated session, not from the query string — unchanged.
 *   - redirect URIs untouched.
 *   - No segment-config exports were present, so nothing to remove.
 */

import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { getAuthContext } from "@/lib/integrations";
import { checkRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SCOPES = "read_products,write_products,read_inventory,write_inventory,read_orders";

export async function GET(req: NextRequest) {
  // CC-migration marker: defer to request time. Prevents the prerender
  // pipeline from evaluating the cookie-backed getAuthContext() call at
  // build time. No-op under the current pre-CC model.
  await connection();

  try {
    const { tenantId } = await getAuthContext();

    // Rate limit OAuth initiations
    const { success: rateLimitOk } = await checkRateLimit(`shopify-connect:${tenantId}`);
    if (!rateLimitOk) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?error=rate_limited`
      );
    }
    
    // Get shop domain from query param
    const shop = req.nextUrl.searchParams.get("shop");
    
    if (!shop) {
      // Show shop input form
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?shopify=enter`
      );
    }

    // Build OAuth URL
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/shopify/callback`;
    const state = Buffer.from(JSON.stringify({ tenantId })).toString("base64");
    
    const params = new URLSearchParams({
      client_id: SHOPIFY_CLIENT_ID,
      scope: SCOPES,
      redirect_uri: redirectUri,
      state,
    });
    
    const authUrl = `https://${shop}.myshopify.com/admin/oauth/authorize?${params.toString()}`;
    
    return NextResponse.redirect(authUrl);
  } catch (err) {
    logger.error("[shopify/connect]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?error=auth_failed`
    );
  }
}
