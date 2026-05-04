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
import crypto from "crypto";
import { getAuthContext, requireIntegrationManager } from "@/lib/integrations";
import { checkRateLimit } from "@/lib/rate-limit";
import { signOAuthState } from "@/lib/webhook-security";
import logger from "@/lib/logger";
import { withSentryFlush } from "@/lib/sentry-flush";

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SCOPES = "read_products,write_products,read_inventory,write_inventory,read_orders";

/**
 * Secret used to HMAC-sign the OAuth `state` parameter AND the companion
 * cookie that binds it to this browser session. We deliberately derive
 * from the Shopify client secret so we never need a new env var, but it
 * is namespaced so a leak of `state` can't forge arbitrary data.
 */
function getStateSecret(): string {
  const base = process.env.SHOPIFY_CLIENT_SECRET || "";
  if (!base) throw new Error("[shopify/connect] SHOPIFY_CLIENT_SECRET not configured");
  return crypto.createHash("sha256").update(`shopify-oauth-state:${base}`).digest("hex");
}

export const GET = withSentryFlush(async (req: NextRequest) => {
  // CC-migration marker: defer to request time. Prevents the prerender
  // pipeline from evaluating the cookie-backed getAuthContext() call at
  // build time. No-op under the current pre-CC model.
  await connection();

  try {
    const { tenantId } = await requireIntegrationManager();

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

    // Build OAuth URL. W6-CRIT-08: the previous `state` was just
    // base64(JSON) — unsigned and unbound. Any attacker who could
    // induce a user's browser to hit the callback could forge a
    // different tenant's state and bind their own Shopify store to
    // the victim's tenant. New contract:
    //   * state = signed { tenantId, nonce } — callback verifies HMAC.
    //   * cookie = same nonce, HttpOnly + SameSite=Lax + Secure.
    //   * callback requires BOTH to match, enforcing same-browser
    //     binding + tenant equality.
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/shopify/callback`;
    const nonce = crypto.randomBytes(24).toString("base64url");
    const stateSecret = getStateSecret();
    const state = signOAuthState({ tenantId, nonce, issuedAt: Date.now() }, stateSecret);

    const params = new URLSearchParams({
      client_id: SHOPIFY_CLIENT_ID,
      scope: SCOPES,
      redirect_uri: redirectUri,
      state,
    });

    const authUrl = `https://${shop}.myshopify.com/admin/oauth/authorize?${params.toString()}`;

    const res = NextResponse.redirect(authUrl);
    res.cookies.set("shopify_oauth_nonce", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60, // 10 minutes
    });
    return res;
  } catch (err) {
    logger.error("[shopify/connect]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/website/connect?error=auth_failed`
    );
  }
});
